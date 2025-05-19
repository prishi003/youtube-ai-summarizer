# YouTube Video Summarizer

This project is a React application that uses the Gemini API to analyze and summarize YouTube videos.

## Features

- Input any YouTube video URL
- Extract the video transcript
- Generate a detailed summary with timestamps using Google's Gemini AI
- Display a structured, easy-to-understand summary of the video's content

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Express.js server
- **AI**: Google Gemini API for text generation
- **Styling**: CSS with responsive design

## Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Create a `.env` file in the root directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3001
   ```
4. Start the development server: `bun dev`
5. Start the backend server: `bun server`

## Usage

1. Enter a YouTube video URL in the input field
2. Click "Summarize"
3. Wait for the AI to process the video transcript
4. View the generated summary with timestamps

## Project Structure

- `src/` - React frontend code
- `server/` - Express backend API
- `docs/` - Project documentation

## Documentation

- [Changelog](./CHANGELOG.md)
- [Current Progress](./CURRENT_PROGRESS.md)
- [TODO](./TODO.md)
