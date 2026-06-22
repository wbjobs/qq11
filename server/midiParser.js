import MidiParser from 'midi-parser-js';

export function parseMidiBuffer(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const parsed = MidiParser.parse(uint8Array);
  return extractNoteEvents(parsed);
}

function extractNoteEvents(midiData) {
  const { header, track } = midiData;
  const ticksPerBeat = header.ticksPerBeat || 480;
  const tracks = [];
  let totalDurationTicks = 0;

  for (let trackIndex = 0; trackIndex < track.length; trackIndex++) {
    const trackData = track[trackIndex];
    const events = trackData.event || [];
    const noteEvents = [];
    const activeNotes = new Map();
    let currentTime = 0;
    let tempo = 500000;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      currentTime += event.deltaTime || 0;

      if (event.type === 255 && event.metaType === 81) {
        const data = event.data;
        if (typeof data === 'number') {
          tempo = data;
        } else if (Array.isArray(data)) {
          tempo = (data[0] << 16) | (data[1] << 8) | data[2];
        }
      }

      if (event.type === 8 || event.type === 9) {
        const noteNumber = event.data[0];
        const velocity = event.data[1];
        const channel = (event.channel !== undefined) ? event.channel : 0;

        if (event.type === 9 && velocity > 0) {
          activeNotes.set(noteNumber + '_' + channel, {
            note: noteNumber,
            velocity,
            channel,
            startTime: currentTime,
            startTempo: tempo
          });
        } else {
          const key = noteNumber + '_' + channel;
          if (activeNotes.has(key)) {
            const noteOn = activeNotes.get(key);
            const duration = currentTime - noteOn.startTime;
            noteEvents.push({
              note: noteOn.note,
              velocity: noteOn.velocity,
              channel: noteOn.channel,
              startTime: noteOn.startTime,
              duration: duration,
              track: trackIndex
            });
            activeNotes.delete(key);
          }
        }
      }
    }

    for (const [key, noteOn] of activeNotes) {
      noteEvents.push({
        note: noteOn.note,
        velocity: noteOn.velocity,
        channel: noteOn.channel,
        startTime: noteOn.startTime,
        duration: currentTime - noteOn.startTime,
        track: trackIndex
      });
    }

    if (noteEvents.length > 0) {
      tracks.push({
        index: trackIndex,
        events: noteEvents
      });
    }

    totalDurationTicks = Math.max(totalDurationTicks, currentTime);
  }

  const allNotes = tracks.flatMap(t => t.events);
  const durationMs = ticksToMs(totalDurationTicks, ticksPerBeat, 500000);

  const notesWithTimeMs = allNotes.map(n => ({
    ...n,
    startTimeMs: ticksToMs(n.startTime, ticksPerBeat, 500000),
    durationMs: ticksToMs(n.duration, ticksPerBeat, 500000)
  }));

  return {
    ticksPerBeat,
    totalDurationTicks,
    durationMs,
    totalNotes: notesWithTimeMs.length,
    tracks,
    notes: notesWithTimeMs
  };
}

function ticksToMs(ticks, ticksPerBeat, tempoMicrosecondsPerBeat) {
  const microsecondsPerTick = tempoMicrosecondsPerBeat / ticksPerBeat;
  return (ticks * microsecondsPerTick) / 1000;
}
