import fs from 'fs';
import path from 'path';
import { initializeDatabase, saveSummary } from './db/sqlite';

// Define path to the old JSON database
const dbDir = path.join(__dirname, 'db');
const jsonDbPath = path.join(dbDir, 'summaries.json');

interface JsonDatabase {
  summaries: Array<{
    video_id: string;
    video_url: string;
    title: string;
    summary: string;
    style: string;
    created_at: string;
    accessed_at: string;
  }>;
}

// Main migration function
async function migrateData() {
  console.log('Starting migration from JSON to SQLite...');
  
  // Initialize the SQLite database
  initializeDatabase();
  
  // Check if JSON database exists
  if (!fs.existsSync(jsonDbPath)) {
    console.log('No JSON database found. Migration complete (nothing to migrate).');
    return;
  }
  
  try {
    // Read the JSON database
    const jsonData = fs.readFileSync(jsonDbPath, 'utf8');
    const database = JSON.parse(jsonData) as JsonDatabase;
    
    if (!database.summaries || database.summaries.length === 0) {
      console.log('JSON database is empty. Migration complete (nothing to migrate).');
      return;
    }
    
    console.log(`Found ${database.summaries.length} records to migrate.`);
    
    // Migrate each record to SQLite
    for (const record of database.summaries) {
      await saveSummary({
        videoId: record.video_id,
        videoUrl: record.video_url,
        title: record.title,
        summary: record.summary,
        style: record.style
      });
    }
    
    console.log('Migration completed successfully!');
    
    // Backup the original JSON file
    const backupPath = jsonDbPath + '.backup';
    fs.copyFileSync(jsonDbPath, backupPath);
    console.log(`Original JSON database backed up to ${backupPath}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateData().catch(console.error); 