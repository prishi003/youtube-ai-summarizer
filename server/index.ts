import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { YoutubeTranscript } from "youtube-transcript";
import fetch from "node-fetch";
import {
  checkSummaryExists,
  getCachedSummary,
  saveSummary,
  getRecentSummaries,
} from "./db/sqlite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Function to extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Function to fetch video title
async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch video title");
    }
    const data = (await response.json()) as { title: string };
    return data.title;
  } catch (error) {
    console.error("Error fetching video title:", error);
    return "Untitled Video";
  }
}

// Get recent summaries
app.get("/api/summaries/recent", async (req, res) => {
  try {
    const recentSummaries = getRecentSummaries(100); // Increase limit to 100

    // Transform for client consumption
    const summaries = recentSummaries.map((record) => {
      // Parse the stored summary text using the existing parseSummary function
      const summaryPoints = parseSummary(record.summary);

      return {
        videoId: record.video_id,
        videoUrl: record.video_url,
        title: record.title,
        summary: summaryPoints,
        style: record.style,
        createdAt: record.created_at,
      };
    });

    res.json({ summaries });
  } catch (error) {
    console.error("Error fetching recent summaries:", error);
    res.status(500).json({ error: "Failed to fetch recent summaries" });
  }
});

// API endpoint to summarize a YouTube video
app.post("/api/summarize", async (req, res) => {
  try {
    const { videoUrl, style = "detailed", format = "plain" } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required" });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // Check if we have this summary cached
    if (checkSummaryExists(videoId, style)) {
      console.log(
        `Using cached summary for video ID: ${videoId}, style: ${style}`
      );
      const cachedSummary = getCachedSummary(videoId, style);

      if (cachedSummary) {
        // Parse the stored summary text back into structured format
        const summaryPoints = parseSummary(cachedSummary.summary);
        return res.json({
          title: cachedSummary.title,
          summary: summaryPoints,
          style,
          cached: true,
        });
      }
    }

    // If not cached, proceed with generating a new summary

    // Get video title
    const videoTitle = await getVideoTitle(videoId);

    // Get transcript
    console.log(`Fetching transcript for video ID: ${videoId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return res
        .status(404)
        .json({ error: "No transcript found for this video" });
    }

    // Format transcript text
    const transcriptText = transcript
      .map((item) => `[${item.offset / 1000}s] ${item.text}`)
      .join(" ");

    console.log(`Generating ${style} summary with Gemini AI...`);

    // Prompt based on selected style
    let prompt = "";
    const markdownFormatInstructions =
      format === "markdown"
        ? `Format your response using proper markdown:
      - Use **bold** for emphasis and categories 
      - Use bullet points with * for lists
      - Use headings with # where appropriate
      - Separate distinct sections with blank lines
      - Make sure each paragraph is well-formatted
      - Format each key point as an individual paragraph`
        : "";

    switch (style) {
      case "concise":
        prompt = `
        Generate a concise summary of this YouTube video transcript with just the essential points.
        Focus on the key points only, with no additional details or explanations.
        Include accurate timestamps with each point.
        Limit to 5-7 key points at most.
        ${markdownFormatInstructions}
        
        Here's the transcript with timestamps in seconds:
        ${transcriptText}
        `;
        break;

      case "bullet":
        prompt = `
        Generate a bullet-point summary of this YouTube video transcript.
        Create a clear, organized bullet-point list of the main points covered in the video.
        Group related points into categories if relevant.
        Include timestamps with each bullet point.
        ${markdownFormatInstructions}
        
        Here's the transcript with timestamps in seconds:
        ${transcriptText}
        `;
        break;

      case "analytical":
        prompt = `
        Generate an analytical summary of this YouTube video transcript.
        Provide a deeper analysis of the video content, including:
        - Main arguments or points presented
        - Evidence or examples provided
        - Any counterarguments or limitations mentioned
        - Implications or conclusions
        Include timestamps with each analyzed point.
        ${markdownFormatInstructions}
        
        Here's the transcript with timestamps in seconds:
        ${transcriptText}
        `;
        break;

      case "review":
        prompt = `
        Generate a review-style summary of this YouTube video transcript.
        This should include:
        - Brief overview of the subject
        - Key features discussed
        - Clear pros and cons
        - Final verdict or recommendation
        Include timestamps with each point.
        ${markdownFormatInstructions}
        
        Here's the transcript with timestamps in seconds:
        ${transcriptText}
        `;
        break;

      case "detailed":
      default:
        prompt = `        I need a detailed summary of this YouTube video transcript, divided into key points with timestamps.
        Structure the summary to provide a clear understanding of the main topics and information presented in the video.
        For product reviews, highlight the key features, pros and cons, and final conclusions.
        Include timestamps with each point.
        ${markdownFormatInstructions}
        
        Here's the transcript with timestamps in seconds:
        ${transcriptText}
        `;
        break;
    }

    // Generate summary using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    // Parse the summary into a structured format
    const summaryPoints = parseSummary(summary);

    // Save the summary to the database
    saveSummary({
      videoId,
      videoUrl,
      title: videoTitle,
      summary,
      style,
    });

    res.json({ title: videoTitle, summary: summaryPoints, style });
  } catch (error: unknown) {
    console.error("Error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to summarize video",
    });
  }
});

// API endpoint to answer questions about the video
app.post("/api/ask", async (req, res) => {
  try {
    const { question, summary, videoTitle } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!summary || !summary.length) {
      return res.status(400).json({ error: "Video summary is required" });
    }

    // Format summary for context
    const formattedSummary = summary
      .map((item) => `[${item.timestamp}] ${item.point}`)
      .join("\n");

    console.log("Generating answer with Gemini AI...");

    // Prompt for Gemini with improved markdown guidance
    const prompt = `
    You are an assistant that answers questions about YouTube videos.
    
    The following is a summary of a video titled "${videoTitle}":
    
    ${formattedSummary}
    
    Using only the information in the summary above, please answer this question:
    ${question}
    
    If the answer cannot be determined from the summary, please say "Based on the summary, I cannot answer this question."
    
    Format your response using markdown:
    - Use **bold** for emphasis and categories like "Pros:" and "Cons:"
    - Use bullet points with * for lists
    - Use headings with # where appropriate
    - Format any specific features, metrics, or specifications in a clear, readable way
    
    Make your answer conversational, helpful, and concise. Avoid saying "According to the summary" repeatedly.
    `;

    // Generate answer using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    res.json({ answer });
  } catch (error: unknown) {
    console.error("Error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to answer question",
    });
  }
});

// API endpoint for purchase decision analysis
app.post("/api/analyze/purchase", async (req, res) => {
  try {
    const { summaries } = req.body;

    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      return res.status(400).json({
        error: "Please provide at least one summary for analysis",
      });
    }

    console.log(
      `Analyzing purchase decision for ${summaries.length} summaries...`
    );

    // Prepare the data for the Gemini AI
    const summaryTexts = summaries
      .map((summary) => {
        const productTitle = summary.title;
        const summaryContent =
          summary.paragraphSummary ||
          (summary.summary ? createSummaryText(summary.summary) : "");

        return `Product: ${productTitle}\n\nSummary:\n${summaryContent}\n\n`;
      })
      .join("---\n\n");

    // Create a prompt for Gemini AI
    const prompt = `
      I have summaries from video reviews about a product I'm considering buying. 
      Based on these summaries, please analyze whether I should purchase this product.
      
      Provide your analysis in the following format:
      1. Product Overview - what product(s) are being reviewed
      2. Key Pros - main positive points mentioned across reviews
      3. Key Cons - main negative points mentioned across reviews
      4. Price Considerations - any mentions of price, value, or alternatives
      5. Final Verdict - clear recommendation on whether to buy with brief reasoning
      
      Format your response using proper markdown with headings, bullet points, and emphasis where appropriate.
      Be critical and objective in your analysis. Don't just repeat what the reviews say but synthesize the information.
      If there are contradictions between different reviews, point them out.
      
      Here are the summaries:
      ${summaryTexts}
    `;

    // Generate answer with Gemini AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    res.json({ analysis });
  } catch (error) {
    console.error("Error analyzing purchase decision:", error);
    res.status(500).json({
      error: "Failed to analyze purchase decision",
    });
  }
});

// API endpoint for product comparison analysis
app.post("/api/analyze/comparison", async (req, res) => {
  try {
    const { summaries } = req.body;

    if (!summaries || !Array.isArray(summaries) || summaries.length < 2) {
      return res.status(400).json({
        error: "Please provide at least two summaries for comparison",
      });
    }

    console.log(`Comparing ${summaries.length} products...`);

    // Prepare the data for the Gemini AI
    const summaryTexts = summaries
      .map((summary) => {
        const productTitle = summary.title;
        const summaryContent =
          summary.paragraphSummary ||
          (summary.summary ? createSummaryText(summary.summary) : "");

        return `Product: ${productTitle}\n\nSummary:\n${summaryContent}\n\n`;
      })
      .join("---\n\n");

    // Create a prompt for Gemini AI
    const prompt = `
      I have summaries from video reviews about multiple similar products that I'm considering.
      Based on these summaries, please compare these products and recommend which one I should choose.
      
      Provide your comparison in the following format:
      1. Products Overview - list all products being compared
      2. Feature Comparison - compare key features of each product
      3. Performance Comparison - compare performance aspects
      4. Price Comparison - compare pricing and value for money
      5. Pros and Cons - list key advantages and disadvantages of each product
      6. Recommendation - clearly state which product is better and why
      
      Format your response using proper markdown with headings, bullet points, and emphasis where appropriate.
      Create comparison tables where relevant.
      Be as objective as possible in your comparison.
      If there's a clear winner, state which one and why. If it depends on specific use cases, explain the scenarios.
      
      Here are the summaries:
      ${summaryTexts}
    `;

    // Generate answer with Gemini AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    res.json({ analysis });
  } catch (error) {
    console.error("Error comparing products:", error);
    res.status(500).json({
      error: "Failed to compare products",
    });
  }
});

// Helper function to create a text summary from summary points
function createSummaryText(
  summaryPoints: { timestamp: string; point: string }[]
): string {
  return summaryPoints
    .map((point) => {
      if (point.timestamp) {
        return `[${point.timestamp}] ${point.point}`;
      }
      return point.point;
    })
    .join("\n\n");
}

// Function to parse the summary into a structured format
function parseSummary(summary: string): { timestamp: string; point: string }[] {
  try {
    // If the summary is empty or undefined, return an empty array
    if (!summary || summary.trim() === "") {
      return [];
    }

    // Basic parsing logic for Gemini's output format
    const lines = summary.split("\n");
    const summaryPoints: { timestamp: string; point: string }[] = [];

    // Variables to track context
    let currentTimestamp = "";
    let currentPoint = "";
    let inCodeBlock = false;
    let emptyLineCount = 0;

    // Process line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Toggle code block state
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        currentPoint += line + "\n";
        continue;
      }

      // Look for timestamp patterns
      const timestampMatch = line.match(/(\d+:\d+(?::\d+)?)/);

      // If we're in a code block, just add the line as is
      if (inCodeBlock) {
        currentPoint += line + "\n";
        continue;
      }

      // If we encounter multiple empty lines, it might signal a new section
      if (line.trim() === "") {
        emptyLineCount++;

        // Add an empty line to preserve markdown spacing
        currentPoint += "\n";

        // If this is the second consecutive empty line and we have content,
        // save the current point and start a new one
        if (emptyLineCount > 1 && currentPoint.trim().length > 0) {
          summaryPoints.push({
            timestamp: currentTimestamp,
            point: currentPoint.trim(),
          });
          currentPoint = "";
          // Keep the current timestamp for potential continuation
        }
        continue;
      }

      // Reset empty line counter for non-empty lines
      emptyLineCount = 0;

      // Check if this line starts a new section with a timestamp
      if (timestampMatch) {
        // If we have accumulated content, save it before starting a new point
        if (currentPoint.trim().length > 0) {
          summaryPoints.push({
            timestamp: currentTimestamp,
            point: currentPoint.trim(),
          });
        }

        // Extract the timestamp
        currentTimestamp = timestampMatch[1];

        // Get content after timestamp
        let pointContent = line;

        // Try to extract content after the timestamp
        const contentAfterTimestamp = line.substring(
          line.indexOf(timestampMatch[0]) + timestampMatch[0].length
        );
        if (contentAfterTimestamp.trim().length > 0) {
          // Remove common separators like ":" or "-" after timestamps
          pointContent = contentAfterTimestamp.replace(/^[:\s-]+/, "").trim();
        } else {
          // If there's no content after timestamp on this line, check the next line
          if (i + 1 < lines.length && lines[i + 1].trim().length > 0) {
            pointContent = lines[i + 1].trim();
            i++; // Skip the next line since we've included it
          } else {
            pointContent = ""; // No content found
          }
        }

        // Start a new point
        currentPoint = pointContent + "\n";
      }
      // Check for markdown headings - these typically start new sections
      else if (line.trim().match(/^#{1,6}\s/)) {
        // If we have accumulated content, save it before starting a new section
        if (currentPoint.trim().length > 0) {
          summaryPoints.push({
            timestamp: currentTimestamp,
            point: currentPoint.trim(),
          });
        }

        // Start a new point with this heading
        currentPoint = line + "\n";
        // Keep the current timestamp for headings without timestamps
      }
      // For list items and normal text, append to current point
      else {
        currentPoint += line + "\n";
      }
    }

    // Add the last point if it exists
    if (currentPoint.trim().length > 0) {
      summaryPoints.push({
        timestamp: currentTimestamp,
        point: currentPoint.trim(),
      });
    }

    // If we found no points with the normal parsing, fall back to treating the entire summary as one point
    if (summaryPoints.length === 0 && summary.trim().length > 0) {
      return [{ timestamp: "", point: summary.trim() }];
    }

    return summaryPoints;
  } catch (error) {
    console.error("Error parsing summary:", error);
    // Return the original summary as a single point if parsing fails
    return [{ timestamp: "", point: summary }];
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
