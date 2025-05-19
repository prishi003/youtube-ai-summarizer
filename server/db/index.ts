import fs from "fs";
import path from "path";

// Define database path - stored in the db directory
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "summaries.json");

// Interface for summary data
interface SummaryData {
  videoId: string;
  videoUrl: string;
  title: string;
  summary: string;
  style: string;
}

// Interface for database record
interface SummaryRecord {
  video_id: string;
  video_url: string;
  title: string;
  summary: string;
  style: string;
  created_at: string;
  accessed_at: string;
}

// Interface for the full database
interface Database {
  summaries: SummaryRecord[];
}

// Read the database file
function readDatabase(): Database {
  if (!fs.existsSync(dbPath)) {
    return { summaries: [] };
  }

  try {
    const data = fs.readFileSync(dbPath, "utf8");
    return JSON.parse(data) as Database;
  } catch (error) {
    console.error("Error reading database file:", error);
    return { summaries: [] };
  }
}

// Write to the database file
function writeDatabase(data: Database): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to database file:", error);
  }
}

// Initialize the database
export function initializeDatabase(): void {
  if (!fs.existsSync(dbPath)) {
    writeDatabase({ summaries: [] });
    console.log("Database initialized successfully");
  }
}

// Check if a summary exists for a video
export function checkSummaryExists(videoId: string, style: string): boolean {
  const db = readDatabase();
  return db.summaries.some(
    (record) => record.video_id === videoId && record.style === style
  );
}

// Get a cached summary
export function getCachedSummary(
  videoId: string,
  style: string
): SummaryRecord | undefined {
  const db = readDatabase();
  const record = db.summaries.find(
    (record) => record.video_id === videoId && record.style === style
  );

  if (record) {
    // Update the accessed_at timestamp
    record.accessed_at = new Date().toISOString();
    writeDatabase(db);
  }

  return record;
}

// Save a new summary
export function saveSummary(data: SummaryData): void {
  const db = readDatabase();
  const now = new Date().toISOString();

  // Check if record already exists
  const existingIndex = db.summaries.findIndex(
    (record) => record.video_id === data.videoId && record.style === data.style
  );

  const newRecord: SummaryRecord = {
    video_id: data.videoId,
    video_url: data.videoUrl,
    title: data.title,
    summary: data.summary,
    style: data.style,
    created_at: now,
    accessed_at: now,
  };

  if (existingIndex >= 0) {
    // Update existing record
    newRecord.created_at = db.summaries[existingIndex].created_at;
    db.summaries[existingIndex] = newRecord;
  } else {
    // Add new record
    db.summaries.push(newRecord);

    // Enforce the limit of 100 summaries
    const MAX_SUMMARIES = 100;
    if (db.summaries.length > MAX_SUMMARIES) {
      // Sort by accessed_at date (oldest first)
      db.summaries.sort(
        (a, b) =>
          new Date(a.accessed_at).getTime() - new Date(b.accessed_at).getTime()
      );

      // Remove oldest summaries to stay within limit
      db.summaries = db.summaries.slice(db.summaries.length - MAX_SUMMARIES);
    }
  }

  writeDatabase(db);
}

// Get recent summaries
export function getRecentSummaries(limit: number = 10): SummaryRecord[] {
  const db = readDatabase();

  // Sort by accessed_at date (most recent first) and limit results
  return [...db.summaries]
    .sort(
      (a, b) =>
        new Date(b.accessed_at).getTime() - new Date(a.accessed_at).getTime()
    )
    .slice(0, limit);
}

// Initialize the database when the module is loaded
initializeDatabase();
