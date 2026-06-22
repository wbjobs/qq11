class MidiInputManager {
  constructor() {
    this.midiAccess = null;
    this.onNoteOn = null;
    this.onNoteOff = null;
    this.connectedInputs = [];
  }

  async connect(onNoteOn, onNoteOff) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;

    if (!navigator.requestMIDIAccess) {
      throw new Error('您的浏览器不支持 Web MIDI API');
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.setupInputs();
      this.midiAccess.onstatechange = () => this.setupInputs();
      return this.connectedInputs;
    } catch (err) {
      throw new Error('无法访问 MIDI 设备: ' + err.message);
    }
  }

  setupInputs() {
    this.connectedInputs = [];
    const inputs = this.midiAccess.inputs;

    inputs.forEach((input) => {
      input.onmidimessage = (event) => this.handleMidiMessage(event, input);
      this.connectedInputs.push({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer
      });
    });
  }

  handleMidiMessage(event, input) {
    const data = event.data;
    const statusByte = data[0];
    const messageType = statusByte & 0xf0;
    const channel = statusByte & 0x0f;

    if (messageType === 0x90 && data[2] > 0) {
      const noteNumber = data[1];
      const velocity = data[2];
      if (this.onNoteOn) {
        this.onNoteOn({ note: noteNumber, velocity, channel, timestamp: Date.now() });
      }
    } else if (messageType === 0x80 || (messageType === 0x90 && data[2] === 0)) {
      const noteNumber = data[1];
      if (this.onNoteOff) {
        this.onNoteOff({ note: noteNumber, channel, timestamp: Date.now() });
      }
    }
  }

  disconnect() {
    if (this.midiAccess) {
      const inputs = this.midiAccess.inputs;
      inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    }
    this.connectedInputs = [];
  }

  getInputs() {
    return this.connectedInputs;
  }
}

export const midiInputManager = new MidiInputManager();
