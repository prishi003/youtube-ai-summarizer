import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

interface SummaryPoint {
  timestamp: string;
  point: string;
}

interface SavedSummary {
  id: string;
  videoUrl: string;
  title: string;
  summary: SummaryPoint[];
  paragraphSummary: string;
  savedAt: Date;
  style?: string;
  selected?: boolean;
}

// New interface for server history
interface ServerSummary {
  videoId: string;
  videoUrl: string;
  title: string;
  summary: SummaryPoint[];
  style: string;
  createdAt: string;
  selected?: boolean;
}

// Define available summarization styles
interface SummaryStyle {
  id: string;
  name: string;
  description: string;
}

// Interface for analysis results
interface AnalysisResult {
  type: "purchase" | "comparison";
  result: string;
  loading: boolean;
}

const summaryStyles: SummaryStyle[] = [
  {
    id: "detailed",
    name: "Detailed",
    description: "Comprehensive summary with all important points",
  },
  {
    id: "concise",
    name: "Concise",
    description: "Brief summary with only essential points (5-7 points)",
  },
  {
    id: "bullet",
    name: "Bullet Points",
    description: "Organized bullet-point list of main topics",
  },
  {
    id: "analytical",
    name: "Analytical",
    description: "Deeper analysis with arguments, evidence and implications",
  },
  {
    id: "review",
    name: "Review Style",
    description: "Summary with pros, cons and recommendations",
  },
];

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [summary, setSummary] = useState<SummaryPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>(() => {
    const saved = localStorage.getItem("savedSummaries");
    return saved ? JSON.parse(saved) : [];
  });

  // Add state for server history
  const [recentSummaries, setRecentSummaries] = useState<ServerSummary[]>([]);

  // Add state for sidebar visibility on mobile
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(false);

  // Add state for selected summary style
  const [selectedStyle, setSelectedStyle] = useState<string>("detailed");

  // Add states for question asking feature
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAskingQuestion, setIsAskingQuestion] = useState<boolean>(false);

  // Add state for selected summaries and analysis
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  // Load recent summaries from server
  useEffect(() => {
    fetchRecentSummaries();
  }, []);

  const createParagraphSummary = (points: SummaryPoint[]): string => {
    // Filter out empty points
    const validPoints = points.filter((point) => {
      return point.point && point.point.trim().length > 0;
    });

    if (validPoints.length === 0) return "";

    // Join points while preserving markdown formatting
    return validPoints
      .map((item) => {
        const point = item.point;

        // Add timestamp as a heading if it exists and not already in markdown format
        if (item.timestamp && !point.startsWith("#")) {
          // Check if the point is clearly a markdown heading
          if (!/^#{1,6}\s/.test(point)) {
            return `**[${item.timestamp}]** ${point}`;
          }
        }

        return point;
      })
      .join("\n\n");
  };

  const handleSummarize = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSummary(null);
    setVideoTitle("");
    setLoadingProgress(10);
    // Reset question and answer when generating a new summary
    setQuestion("");
    setAnswer(null);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        // Increment slowly up to 90% (the actual completion will set it to 100%)
        const newProgress = prev + Math.random() * 5;
        return newProgress < 90 ? newProgress : 90;
      });
    }, 1000);

    try {
      const response = await fetch("http://localhost:3001/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: youtubeUrl,
          style: selectedStyle,
          format: "markdown", // Request markdown formatted response
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to summarize video");
      }

      const data = await response.json();
      setSummary(data.summary);
      setVideoTitle(data.title || "Untitled Video");
      setLoadingProgress(100);

      // If the response was from cache, inform the user
      if (data.cached) {
        console.log("Used cached result");
      }

      // Refresh recent summaries after generating a new one
      fetchRecentSummaries();
    } catch (err) {
      console.error("Error summarizing video:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to summarize the video. Please check the URL and try again."
      );
      setLoadingProgress(0);
    } finally {
      setIsLoading(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  // Function to fetch recent summaries
  const fetchRecentSummaries = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/api/summaries/recent"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch recent summaries");
      }

      const data = await response.json();
      setRecentSummaries(data.summaries || []);
    } catch (err) {
      console.error("Error fetching recent summaries:", err);
    }
  };

  // Load a summary from history
  const handleLoadServerSummary = (summary: ServerSummary) => {
    setYoutubeUrl(summary.videoUrl);
    setSummary(summary.summary);
    setVideoTitle(summary.title);
    setSelectedStyle(summary.style);
  };

  const handleAskQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!question.trim() || !summary || !videoTitle) {
      return;
    }

    setIsAskingQuestion(true);
    setAnswer(null);

    try {
      const response = await fetch("http://localhost:3001/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          summary,
          videoTitle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to answer question");
      }

      const data = await response.json();
      setAnswer(data.answer);
    } catch (err) {
      console.error("Error asking question:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to answer the question. Please try again."
      );
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleSaveSummary = () => {
    if (!summary || !videoTitle) return;

    const paragraphSummary = createParagraphSummary(summary);

    const newSavedSummary: SavedSummary = {
      id: Date.now().toString(),
      videoUrl: youtubeUrl,
      title: videoTitle,
      summary: summary,
      paragraphSummary,
      savedAt: new Date(),
      style: selectedStyle,
    };

    const updatedSavedSummaries = [...savedSummaries, newSavedSummary];
    setSavedSummaries(updatedSavedSummaries);
    localStorage.setItem(
      "savedSummaries",
      JSON.stringify(updatedSavedSummaries)
    );
  };

  const handleDeleteSavedSummary = (id: string) => {
    const updatedSavedSummaries = savedSummaries.filter((s) => s.id !== id);
    setSavedSummaries(updatedSavedSummaries);
    localStorage.setItem(
      "savedSummaries",
      JSON.stringify(updatedSavedSummaries)
    );
  };

  const cleanSummaryPoint = (point: string): string => {
    // Remove J**, J**, 0:07)**, etc. markers and any leading timestamps
    return point
      .replace(/J\*\*|\*\*/g, "")
      .replace(/^\d+:\d+\s*/, "") // Remove any timestamps like 0:07 at the beginning
      .replace(/^\s*\*+\s*/, "") // Remove leading asterisks
      .replace(/^\s*\]+\s*/, "") // Remove leading brackets
      .trim();
  };

  // Toggle selection of a summary from recent summaries
  const toggleSelectRecentSummary = (videoId: string) => {
    setRecentSummaries((prevSummaries) =>
      prevSummaries.map((summary) =>
        summary.videoId === videoId
          ? { ...summary, selected: !summary.selected }
          : summary
      )
    );
  };

  // Toggle selection of a saved summary
  const toggleSelectSavedSummary = (id: string) => {
    setSavedSummaries((prevSummaries) =>
      prevSummaries.map((summary) =>
        summary.id === id
          ? { ...summary, selected: !summary.selected }
          : summary
      )
    );
    localStorage.setItem(
      "savedSummaries",
      JSON.stringify(
        savedSummaries.map((summary) =>
          summary.id === id
            ? { ...summary, selected: !summary.selected }
            : summary
        )
      )
    );
  };

  // Handle purchase decision analysis
  const handlePurchaseDecision = async () => {
    setAnalysisResult({
      type: "purchase",
      result: "",
      loading: true,
    });

    try {
      // Get all selected summaries from both sources
      const selectedRecentSummaries = recentSummaries.filter(
        (summary) => summary.selected
      );
      const selectedSavedSummaries = savedSummaries.filter(
        (summary) => summary.selected
      );

      // Prepare the data to send to the server
      const purchaseAnalysisData = {
        summaries: [
          ...selectedRecentSummaries.map((summary) => ({
            title: summary.title,
            summary: summary.summary,
            type: "recent",
          })),
          ...selectedSavedSummaries.map((summary) => ({
            title: summary.title,
            summary: summary.summary,
            paragraphSummary: summary.paragraphSummary,
            type: "saved",
          })),
        ],
      };

      // Check if we have at least one summary selected
      if (purchaseAnalysisData.summaries.length === 0) {
        throw new Error("Please select at least one summary to analyze");
      }

      // Send to server for analysis
      const response = await fetch(
        "http://localhost:3001/api/analyze/purchase",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(purchaseAnalysisData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to analyze purchase decision"
        );
      }

      const data = await response.json();
      setAnalysisResult({
        type: "purchase",
        result: data.analysis,
        loading: false,
      });
    } catch (err) {
      console.error("Error analyzing purchase decision:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze purchase decision. Please try again."
      );
      setAnalysisResult(null);
    }
  };

  // Handle product comparison analysis
  const handleProductComparison = async () => {
    setAnalysisResult({
      type: "comparison",
      result: "",
      loading: true,
    });

    try {
      // Get all selected summaries from both sources
      const selectedRecentSummaries = recentSummaries.filter(
        (summary) => summary.selected
      );
      const selectedSavedSummaries = savedSummaries.filter(
        (summary) => summary.selected
      );

      // Prepare the data to send to the server
      const comparisonAnalysisData = {
        summaries: [
          ...selectedRecentSummaries.map((summary) => ({
            title: summary.title,
            summary: summary.summary,
            type: "recent",
          })),
          ...selectedSavedSummaries.map((summary) => ({
            title: summary.title,
            summary: summary.summary,
            paragraphSummary: summary.paragraphSummary,
            type: "saved",
          })),
        ],
      };

      // Check if we have at least two summaries selected
      if (comparisonAnalysisData.summaries.length < 2) {
        throw new Error("Please select at least two summaries to compare");
      }

      // Send to server for analysis
      const response = await fetch(
        "http://localhost:3001/api/analyze/comparison",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(comparisonAnalysisData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to analyze product comparison"
        );
      }

      const data = await response.json();
      setAnalysisResult({
        type: "comparison",
        result: data.analysis,
        loading: false,
      });
    } catch (err) {
      console.error("Error analyzing product comparison:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze product comparison. Please try again."
      );
      setAnalysisResult(null);
    }
  };

  // Clear all selected summaries and analysis results
  const clearSelections = () => {
    setRecentSummaries((prevSummaries) =>
      prevSummaries.map((summary) => ({ ...summary, selected: false }))
    );

    const updatedSavedSummaries = savedSummaries.map((summary) => ({
      ...summary,
      selected: false,
    }));
    setSavedSummaries(updatedSavedSummaries);
    localStorage.setItem(
      "savedSummaries",
      JSON.stringify(updatedSavedSummaries)
    );

    setAnalysisResult(null);
  };

  // Count number of selected summaries
  const selectedCount =
    recentSummaries.filter((s) => s.selected).length +
    savedSummaries.filter((s) => s.selected).length;

  return (
    <div className="app-container">
      {/* Sidebar for recent summaries */}
      <aside
        className={`summaries-sidebar ${sidebarVisible ? "visible" : ""}`}
        onClick={(e) => {
          // Check if the click was on the ::after pseudo-element (close button)
          if (
            window.matchMedia("(max-width: 1200px)").matches &&
            e.clientX > window.innerWidth - 60 &&
            e.clientY < 60
          ) {
            setSidebarVisible(false);
          }
        }}
      >
        <div className="sidebar-header">
          <h2>Recent Summaries</h2>
        </div>

        <div className="summaries-list">
          {recentSummaries.length === 0 ? (
            <p className="no-summaries">No recent summaries</p>
          ) : (
            recentSummaries.map((summary, index) => (
              <div
                key={summary.videoId + summary.style}
                className={`summary-history-item ${
                  summary.selected ? "selected" : ""
                }`}
                onClick={() => handleLoadServerSummary(summary)}
                style={{
                  backgroundColor: `hsl(${(index * 55) % 360}, 70%, 90%)`,
                }}
              >
                <h3 className="summary-history-title">{summary.title}</h3>
                <div className="summary-history-meta">
                  <span className="summary-style-badge-small">
                    {summaryStyles.find((s) => s.id === summary.style)?.name ||
                      summary.style}
                  </span>
                  <span className="summary-date">
                    {new Date(summary.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <label className="summary-select-checkbox">
                  <input
                    type="checkbox"
                    checked={!!summary.selected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelectRecentSummary(summary.videoId);
                    }}
                  />
                  Select
                </label>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="container">
          {/* Mobile sidebar toggle */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            aria-label="Toggle history sidebar"
          >
            History
          </button>

          <h1>YouTube Video Summarizer</h1>

          {/* Selection tools */}
          {selectedCount > 0 && (
            <div className="selection-tools">
              <div className="selection-info">
                <span>{selectedCount} summaries selected</span>
                <button
                  className="clear-selections-btn"
                  onClick={clearSelections}
                >
                  Clear All
                </button>
              </div>
              <div className="analysis-actions">
                <button
                  className="analyze-btn purchase-btn"
                  onClick={handlePurchaseDecision}
                  disabled={selectedCount < 1}
                >
                  Should I Buy This Product?
                </button>
                <button
                  className="analyze-btn compare-btn"
                  onClick={handleProductComparison}
                  disabled={selectedCount < 2}
                >
                  Compare Selected Products
                </button>
              </div>
            </div>
          )}

          {/* Analysis results */}
          {analysisResult && (
            <div className="analysis-results">
              <h2>
                {analysisResult.type === "purchase"
                  ? "Purchase Decision Analysis"
                  : "Product Comparison Analysis"}
              </h2>
              {analysisResult.loading ? (
                <div className="loading-analysis">
                  <div className="loader"></div>
                  <p>Analyzing summaries...</p>
                </div>
              ) : (
                <div className="analysis-content">
                  <ReactMarkdown>{analysisResult.result}</ReactMarkdown>
                </div>
              )}
              <button
                className="close-analysis-btn"
                onClick={() => setAnalysisResult(null)}
              >
                Close Analysis
              </button>
            </div>
          )}

          <form onSubmit={handleSummarize} className="url-form">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Enter YouTube Video URL"
              required
              className="url-input"
            />

            <div className="style-selector">
              <label htmlFor="summary-style">Summary Style</label>
              <div className="style-select-container">
                <select
                  id="summary-style"
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="style-select"
                  disabled={isLoading}
                >
                  {summaryStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="style-description">
                {
                  summaryStyles.find((style) => style.id === selectedStyle)
                    ?.description
                }
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !youtubeUrl}
              className="submit-button"
            >
              {isLoading ? "Summarizing..." : "Summarize"}
            </button>
          </form>

          {error && (
            <div className="error-container">
              <p>Error: {error}</p>
            </div>
          )}

          {isLoading && (
            <div className="loading-container">
              <p>Analyzing video content...</p>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <p className="subtle-text">
                This may take a minute or two depending on the video length.
              </p>
            </div>
          )}

          {summary && (
            <div className="summary-container">
              <div className="summary-header">
                <h2>{videoTitle}</h2>
                <div className="summary-meta">
                  <span className="summary-style-badge">
                    {
                      summaryStyles.find((style) => style.id === selectedStyle)
                        ?.name
                    }{" "}
                    Summary
                  </span>
                  <button onClick={handleSaveSummary} className="save-button">
                    Save Summary
                  </button>
                </div>
              </div>

              <div className="paragraph-summary">
                <ReactMarkdown>{createParagraphSummary(summary)}</ReactMarkdown>
              </div>

              {/* Question asking section */}
              <div className="question-section">
                <h3>Ask a Question</h3>
                <form onSubmit={handleAskQuestion} className="question-form">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask something about this video..."
                    required
                    className="question-input"
                    disabled={isAskingQuestion}
                  />
                  <button
                    type="submit"
                    disabled={isAskingQuestion || !question.trim()}
                    className="question-button"
                  >
                    {isAskingQuestion ? "Thinking..." : "Ask"}
                  </button>
                </form>

                {isAskingQuestion && (
                  <div className="answer-loading">
                    <p>Thinking about your question...</p>
                  </div>
                )}

                {answer && (
                  <div className="answer-container">
                    <h4>Answer:</h4>
                    <div className="markdown-content">
                      <ReactMarkdown>{answer}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              <div className="timestamp-toggle">
                <details>
                  <summary>View with timestamps</summary>
                  <ul className="summary-list">
                    {summary.map((item, index) => {
                      const cleanedPoint = cleanSummaryPoint(item.point);
                      if (
                        !cleanedPoint ||
                        cleanedPoint === ")" ||
                        cleanedPoint.length <= 1
                      )
                        return null;

                      return (
                        <li key={index} className="summary-item">
                          <span className="timestamp">{item.timestamp}</span>
                          <span className="point">{cleanedPoint}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </div>
            </div>
          )}

          {savedSummaries.length > 0 && (
            <div className="saved-summaries-container">
              <h2>Saved Summaries</h2>
              <div className="saved-summaries-list">
                {savedSummaries.map((saved) => (
                  <div key={saved.id} className="saved-summary-card">
                    <h3>{saved.title}</h3>
                    <p className="saved-date">
                      Saved on: {new Date(saved.savedAt).toLocaleDateString()}
                    </p>
                    <div className="saved-summary-actions">
                      <button
                        onClick={() => {
                          setYoutubeUrl(saved.videoUrl);
                          setSummary(saved.summary);
                          setVideoTitle(saved.title);
                        }}
                        className="load-button"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSavedSummary(saved.id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
