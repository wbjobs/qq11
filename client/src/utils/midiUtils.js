const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiNoteToFreq(noteNumber) {
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

export function midiNoteToName(noteNumber) {
  const octave = Math.floor(noteNumber / 12) - 1;
  const note = NOTE_NAMES[noteNumber % 12];
  return note + octave;
}

export function isBlackKey(noteNumber) {
  const note = noteNumber % 12;
  return note === 1 || note === 3 || note === 6 || note === 8 || note === 10;
}

export const CHANNEL_COLORS = [
  '#ff4136', '#ff851b', '#ffdc00', '#2ecc40',
  '#39cccc', '#0074d9', '#b10dc9', '#f012be',
  '#ff6b6b', '#ffb347', '#ffee7a', '#88e08e',
  '#7fdbff', '#6c8fd0', '#cc66cc', '#ff85c2'
];
