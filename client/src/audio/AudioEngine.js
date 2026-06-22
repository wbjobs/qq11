import { midiNoteToFreq } from '../utils/midiUtils.js';

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.activeOscillators = new Map();
    this.masterGain = null;
    this.playbackRate = 1.0;
    this.isPlaying = false;
    this.scheduledEvents = [];
    this.startTime = 0;
    this.startAudioContextTime = 0;
    this.timeoutIds = [];
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
  }

  playNote(noteNumber, velocity = 100, duration = 200, channel = 0) {
    this.init();

    const freq = midiNoteToFreq(noteNumber);
    const velocityGain = (velocity / 127) * 0.8 + 0.2;

    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    osc1.type = 'triangle';
    osc1.frequency.value = freq;

    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;

    const now = this.audioContext.currentTime;
    const durationSec = duration / 1000;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(velocityGain, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(velocityGain * 0.7, now + durationSec * 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    const osc2Gain = this.audioContext.createGain();
    osc2Gain.gain.value = 0.3;

    osc1.connect(gainNode);
    osc2.connect(osc2Gain);
    osc2Gain.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);

    const noteKey = noteNumber + '_' + channel;
    if (this.activeOscillators.has(noteKey)) {
      this.stopLiveNote(noteNumber, channel);
    }
    this.activeOscillators.set(noteKey, { osc1, osc2, gainNode, osc2Gain });
  }

  stopLiveNote(noteNumber, channel) {
    const noteKey = noteNumber + '_' + channel;
    const oscs = this.activeOscillators.get(noteKey);
    if (oscs) {
      const now = this.audioContext.currentTime;
      try {
        oscs.gainNode.gain.cancelScheduledValues(now);
        oscs.gainNode.gain.setValueAtTime(oscs.gainNode.gain.value, now);
        oscs.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        oscs.osc1.stop(now + 0.15);
        oscs.osc2.stop(now + 0.15);
      } catch (e) {}
      this.activeOscillators.delete(noteKey);
    }
  }

  startPlayback(notes, onProgress, onEnd) {
    this.init();
    this.stopPlayback();
    this.isPlaying = true;
    this.startTime = 0;
    this.startAudioContextTime = this.audioContext.currentTime;

    const sortedNotes = [...notes].sort((a, b) => a.startTimeMs - b.startTimeMs);

    sortedNotes.forEach((note) => {
      const scheduledTime = note.startTimeMs / this.playbackRate;
      const duration = note.durationMs / this.playbackRate;

      const timeoutId = setTimeout(() => {
        if (!this.isPlaying) return;
        this.playNote(note.note, note.velocity, duration, note.channel);
      }, scheduledTime);

      this.timeoutIds.push(timeoutId);
    });

    if (sortedNotes.length > 0) {
      const lastNote = sortedNotes[sortedNotes.length - 1];
      const totalDuration = (lastNote.startTimeMs + lastNote.durationMs) / this.playbackRate;

      const progressInterval = setInterval(() => {
        if (!this.isPlaying) {
          clearInterval(progressInterval);
          return;
        }
        const elapsed = (this.audioContext.currentTime - this.startAudioContextTime) * 1000;
        const adjustedElapsed = elapsed * this.playbackRate;
        if (onProgress) onProgress(adjustedElapsed);
      }, 50);

      const endTimeout = setTimeout(() => {
        if (this.isPlaying) {
          this.stopPlayback();
          if (onEnd) onEnd();
        }
      }, totalDuration + 200);

      this.timeoutIds.push(endTimeout, progressInterval);
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    this.timeoutIds.forEach((id) => {
      if (typeof id === 'number') {
        clearTimeout(id);
        clearInterval(id);
      }
    });
    this.timeoutIds = [];

    for (const [key, oscs] of this.activeOscillators) {
      try {
        const now = this.audioContext.currentTime;
        oscs.gainNode.gain.cancelScheduledValues(now);
        oscs.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        oscs.osc1.stop(now + 0.1);
        oscs.osc2.stop(now + 0.1);
      } catch (e) {}
    }
    this.activeOscillators.clear();
  }
}

export const audioEngine = new AudioEngine();
