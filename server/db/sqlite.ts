import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Define database path
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'summaries.db');

// Initialize the database connection
const db = new Database(dbPath);

// Create tables if they don't exist
export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      video_url TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      style TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accessed_at TEXT NOT NULL,
      UNIQUE(video_id, style)
    )
  `);
  console.log('SQLite database initialized successfully');
}

// Interface for summary data
export interface SummaryData {
  videoId: string;
  videoUrl: string;
  title: string;
  summary: string;
  style: string;
}

// Interface for database record
export interface SummaryRecord {
  video_id: string;
  video_url: string;
  title: string;
  summary: string;
  style: string;
  created_at: string;
  accessed_at: string;
}

// Check if a summary exists for a video
export function checkSummaryExists(videoId: string, style: string): boolean {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM summaries WHERE video_id = ? AND style = ?');
  const result = stmt.get(videoId, style) as { count: number };
  return result.count > 0;
}

// Get a cached summary
export function getCachedSummary(
  videoId: string,
  style: string
): SummaryRecord | undefined {
  const stmt = db.prepare('SELECT * FROM summaries WHERE video_id = ? AND style = ?');
  const record = stmt.get(videoId, style) as SummaryRecord | undefined;

  if (record) {
    // Update the accessed_at timestamp
    const now = new Date().toISOString();
    const updateStmt = db.prepare('UPDATE summaries SET accessed_at = ? WHERE video_id = ? AND style = ?');
    updateStmt.run(now, videoId, style);
  }

  return record;
}

// Save a new summary
export function saveSummary(data: SummaryData): void {
  const now = new Date().toISOString();

  try {
    // Use INSERT OR REPLACE to handle both insert and update cases
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO summaries 
      (video_id, video_url, title, summary, style, created_at, accessed_at) 
      VALUES 
      (?, ?, ?, ?, ?, 
       COALESCE((SELECT created_at FROM summaries WHERE video_id = ? AND style = ?), ?), 
       ?)
    `);

    stmt.run(
      data.videoId,
      data.videoUrl,
      data.title,
      data.summary,
      data.style,
      data.videoId,
      data.style,
      now,
      now
    );

    // Enforce the limit of 100 summaries
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM summaries');
    const count = (countStmt.get() as { count: number }).count;
    
    const MAX_SUMMARIES = 100;
    if (count > MAX_SUMMARIES) {
      // Delete oldest summaries based on accessed_at date
      const deleteStmt = db.prepare(`
        DELETE FROM summaries 
        WHERE id IN (
          SELECT id FROM summaries 
          ORDER BY accessed_at ASC 
          LIMIT ?
        )
      `);
      deleteStmt.run(count - MAX_SUMMARIES);
    }
  } catch (error) {
    console.error("Error saving summary to SQLite database:", error);
  }
}

// Get recent summaries
export function getRecentSummaries(limit: number = 10): SummaryRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM summaries 
    ORDER BY accessed_at DESC 
    LIMIT ?
  `);
  
  return stmt.all(limit) as SummaryRecord[];
}

// Initialize the database when the module is loaded
initializeDatabase();

// Close the database connection when the process exits
process.on('exit', () => {
  db.close();
}); 