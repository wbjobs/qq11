import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'midi.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS midi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    note_count INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parsed_data TEXT
  )
`);

export function saveRecord(filename, durationMs, noteCount, parsedData) {
  const stmt = db.prepare(`
    INSERT INTO midi_records (filename, duration_ms, note_count, parsed_data)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(filename, durationMs, noteCount, JSON.stringify(parsedData));
  return result.lastInsertRowid;
}

export function getAllRecords() {
  const stmt = db.prepare(`
    SELECT id, filename, duration_ms, note_count, created_at
    FROM midi_records
    ORDER BY created_at DESC
  `);
  return stmt.all();
}

export function getRecordById(id) {
  const stmt = db.prepare(`
    SELECT * FROM midi_records WHERE id = ?
  `);
  const row = stmt.get(id);
  if (row && row.parsed_data) {
    row.parsed_data = JSON.parse(row.parsed_data);
  }
  return row;
}

export function deleteRecord(id) {
  const stmt = db.prepare('DELETE FROM midi_records WHERE id = ?');
  return stmt.run(id);
}

export default db;
