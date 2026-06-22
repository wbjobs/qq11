import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseMidiBuffer } from './midiParser.js';
import { saveRecord, getAllRecords, getRecordById, deleteRecord } from './db.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/api/records', (req, res) => {
  try {
    const records = getAllRecords();
    res.json(records);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

app.get('/api/records/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const record = getRecordById(id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (err) {
    console.error('Error fetching record:', err);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

app.delete('/api/records/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    deleteRecord(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting record:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

app.post('/api/upload', upload.single('midi'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const originalName = req.file.originalname;
    const buffer = req.file.buffer;

    const parsedData = parseMidiBuffer(buffer);

    const recordId = saveRecord(
      originalName,
      parsedData.durationMs,
      parsedData.totalNotes,
      parsedData
    );

    res.json({
      id: recordId,
      filename: originalName,
      durationMs: parsedData.durationMs,
      noteCount: parsedData.totalNotes,
      parsedData
    });
  } catch (err) {
    console.error('Error parsing MIDI:', err);
    res.status(500).json({ error: 'Failed to parse MIDI file: ' + err.message });
  }
});

app.post('/api/parse', express.raw({ type: 'application/octet-stream', limit: '10mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No MIDI data provided' });
    }

    const parsedData = parseMidiBuffer(req.body);
    res.json(parsedData);
  } catch (err) {
    console.error('Error parsing MIDI:', err);
    res.status(500).json({ error: 'Failed to parse MIDI data' });
  }
});

app.listen(PORT, () => {
  console.log(`MIDI Piano Roll Server running on http://localhost:${PORT}`);
});
