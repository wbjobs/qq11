import React, { useRef, useEffect, useCallback } from 'react';
import { midiNoteToName, isBlackKey, CHANNEL_COLORS } from '../utils/midiUtils.js';

const NOTE_HEIGHT = 14;
const KEYBOARD_WIDTH = 60;
const MIN_NOTE = 21;
const MAX_NOTE = 108;
const TOTAL_NOTES = MAX_NOTE - MIN_NOTE + 1;
const PIXELS_PER_MS = 0.15;

export default function PianoRoll({
  notes = [],
  activeChannels,
  currentTimeMs = 0,
  liveNotes = [],
  pixelsPerMs = PIXELS_PER_MS
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = TOTAL_NOTES * NOTE_HEIGHT;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < TOTAL_NOTES; i++) {
      const noteNumber = MAX_NOTE - i;
      const y = i * NOTE_HEIGHT;
      const isBlack = isBlackKey(noteNumber);

      if (isBlack) {
        ctx.fillStyle = '#161b22';
      } else {
        ctx.fillStyle = (i % 12 === 0) ? '#1c2128' : '#0d1117';
      }
      ctx.fillRect(KEYBOARD_WIDTH, y, width - KEYBOARD_WIDTH, NOTE_HEIGHT);
    }

    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= TOTAL_NOTES; i++) {
      const y = i * NOTE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    let beat = 0;
    const beatWidth = pixelsPerMs * 500;
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    for (let x = KEYBOARD_WIDTH; x < width; x += beatWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      beat++;
    }

    for (let i = 0; i < TOTAL_NOTES; i++) {
      const noteNumber = MAX_NOTE - i;
      const y = i * NOTE_HEIGHT;
      const isBlack = isBlackKey(noteNumber);

      ctx.fillStyle = isBlack ? '#1a1a1a' : '#f0f0f0';
      ctx.fillRect(0, y, KEYBOARD_WIDTH - 1, NOTE_HEIGHT);

      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, y, KEYBOARD_WIDTH - 1, NOTE_HEIGHT);

      if (noteNumber % 12 === 0) {
        ctx.fillStyle = isBlack ? '#ccc' : '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(midiNoteToName(noteNumber), 4, y + NOTE_HEIGHT / 2);
      }
    }

    const filteredNotes = notes.filter(n => activeChannels.has(n.channel));
    filteredNotes.forEach((note) => {
      const noteIndex = MAX_NOTE - note.note;
      if (noteIndex < 0 || noteIndex >= TOTAL_NOTES) return;

      const x = KEYBOARD_WIDTH + note.startTimeMs * pixelsPerMs;
      const y = noteIndex * NOTE_HEIGHT + 1;
      const w = Math.max(note.durationMs * pixelsPerMs, 2);
      const h = NOTE_HEIGHT - 2;

      const color = CHANNEL_COLORS[note.channel % CHANNEL_COLORS.length];
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;

      const radius = Math.min(3, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    liveNotes.forEach((note) => {
      const noteIndex = MAX_NOTE - note.note;
      if (noteIndex < 0 || noteIndex >= TOTAL_NOTES) return;

      const y = noteIndex * NOTE_HEIGHT;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.fillRect(0, y, KEYBOARD_WIDTH - 1, NOTE_HEIGHT);
    });

    const playheadX = KEYBOARD_WIDTH + currentTimeMs * pixelsPerMs;
    if (playheadX > KEYBOARD_WIDTH) {
      ctx.strokeStyle = '#ff4136';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      ctx.fillStyle = '#ff4136';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

  }, [notes, activeChannels, currentTimeMs, liveNotes, pixelsPerMs]);

  useEffect(() => {
    draw();

    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  useEffect(() => {
    if (scrollRef.current && currentTimeMs > 0) {
      const playheadX = KEYBOARD_WIDTH + currentTimeMs * pixelsPerMs;
      const container = scrollRef.current;
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.clientWidth;

      if (playheadX > visibleRight - 100) {
        container.scrollLeft = playheadX - container.clientWidth + 100;
      } else if (playheadX < visibleLeft + KEYBOARD_WIDTH + 50) {
        container.scrollLeft = Math.max(0, playheadX - KEYBOARD_WIDTH - 50);
      }
    }
  }, [currentTimeMs, pixelsPerMs]);

  return (
    <div
      ref={scrollRef}
      style={{
        overflow: 'auto',
        maxHeight: '600px',
        background: '#0d1117',
        border: '1px solid #21262d'
      }}
    >
      <div ref={containerRef} style={{ minWidth: '2000px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
