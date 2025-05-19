# YouTube Video Summarizer

A React application that uses the Gemini API to generate structured summaries of YouTube videos based on their transcripts, with SQLite storage for caching and persistence.

## Features

- Automatically extracts and processes transcripts from YouTube videos
- Uses Google's Gemini AI to generate intelligent summaries
- Multiple summarization styles to choose from:
  - Detailed: Comprehensive summary with all important points
  - Concise: Brief summary with only essential points (5-7 points)
  - Bullet Points: Organized bullet-point list of main topics
  - Analytical: Deeper analysis with arguments, evidence and implications
  - Review Style: Summary with pros, cons and recommendations
- Interactive Q&A feature to ask questions about the video content
- Save summaries to SQLite database for efficient retrieval
- Clean, responsive UI that works across devices
- Timestamps for each point in the summary
- Input any YouTube video URL with available captions/transcript
- Generate a detailed summary with timestamps using Google's Gemini AI
- Save summaries locally for future reference
- Responsive design that works on desktop and mobile devices

## Technologies Used

- **Frontend**: React, TypeScript, Vite
- **Backend**: Express.js
- **Database**: SQLite (via better-sqlite3)
- **AI**: Google Gemini API
- **Other**: YouTube Transcript API

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (JavaScript runtime)
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3001
   ```
   Replace `your_gemini_api_key_here` with your actual Gemini API key.

### Database Setup

The application uses SQLite for efficient storage and retrieval of video summaries. The database will be automatically initialized when you start the application.

If you're migrating from a previous version that used JSON storage, run:

```
npm run migrate
```

This will transfer existing summaries from the JSON file to the SQLite database and create a backup of your original data.

### Running the Application

You can run both the frontend and backend concurrently with a single command:

```
npm start
```

This will:

- Start the Express server on port 3001
- Launch the Vite development server for the React frontend

Alternatively, you can run them separately:

- Frontend only: `npm run dev`
- Backend only: `npm run server`

## How It Works

1. The user inputs a YouTube video URL
2. The backend extracts the video transcript using the YouTube Transcript API
3. The Gemini AI generates a structured summary based on the transcript
4. The summary is displayed to the user with timestamps and key points
5. The summary is stored in the SQLite database for quick retrieval if the same video is requested again

## Database Structure

The SQLite database stores video summaries with the following schema:

- `id`: Unique identifier for each summary
- `video_id`: YouTube video ID
- `video_url`: Full YouTube video URL
- `title`: Video title
- `summary`: Generated summary text
- `style`: Summary style (detailed, concise, bullet, analytical, review)
- `created_at`: Timestamp when summary was first created
- `accessed_at`: Timestamp when summary was last accessed

The database automatically manages storage, keeping the 100 most recently accessed summaries.

## Future Enhancements

- Different summarization styles/formats
- User authentication for saved summaries
- Sharing summaries via links
- Caching to prevent repeat API calls for the same video
- Dark/light theme toggle

## License

MIT
