import React, { useState, useEffect, useRef, useCallback } from 'react';
import PianoRoll from './components/PianoRoll.jsx';
import { audioEngine } from './audio/AudioEngine.js';
import { midiInputManager } from './midi/MidiInputManager.js';
import { CHANNEL_COLORS } from './utils/midiUtils.js';

function App() {
  const [notes, setNotes] = useState([]);
  const [durationMs, setDurationMs] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [activeChannels, setActiveChannels] = useState(() => new Set([...Array(16).keys()]));
  const [allChannels, setAllChannels] = useState([]);
  const [liveNotes, setLiveNotes] = useState([]);
  const [midiConnected, setMidiConnected] = useState(false);
  const [midiDevices, setMidiDevices] = useState([]);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [currentFilename, setCurrentFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const liveNoteMapRef = useRef(new Map());

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    const channels = new Set();
    notes.forEach(n => channels.add(n.channel));
    setAllChannels(Array.from(channels).sort((a, b) => a - b));
  }, [notes]);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/records');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch records:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setCurrentFilename(file.name);

    try {
      const formData = new FormData();
      formData.append('midi', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '上传失败');
      }

      const data = await res.json();
      setNotes(data.parsedData.notes || []);
      setDurationMs(data.parsedData.durationMs || 0);
      setCurrentTime(0);
      setActiveChannels(new Set([...Array(16).keys()]));
      await fetchRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleLoadRecord = async (id) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/records/${id}`);
      if (!res.ok) throw new Error('加载记录失败');
      const data = await res.json();
      if (data.parsed_data) {
        setNotes(data.parsed_data.notes || []);
        setDurationMs(data.parsed_data.durationMs || 0);
        setCurrentFilename(data.filename);
        setCurrentTime(0);
        setActiveChannels(new Set([...Array(16).keys()]));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    try {
      await fetch(`/api/records/${id}`, { method: 'DELETE' });
      await fetchRecords();
    } catch (err) {
      setError('删除失败');
    }
  };

  const handleConnectMidi = async () => {
    try {
      setError(null);
      const devices = await midiInputManager.connect(
        (noteData) => {
          liveNoteMapRef.current.set(noteData.note + '_' + noteData.channel, noteData);
          setLiveNotes(Array.from(liveNoteMapRef.current.values()));
          audioEngine.playNote(noteData.note, noteData.velocity, 3000, noteData.channel);
        },
        (noteData) => {
          liveNoteMapRef.current.delete(noteData.note + '_' + noteData.channel);
          setLiveNotes(Array.from(liveNoteMapRef.current.values()));
          audioEngine.stopLiveNote(noteData.note, noteData.channel);
        }
      );
      setMidiDevices(devices);
      setMidiConnected(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisconnectMidi = () => {
    midiInputManager.disconnect();
    liveNoteMapRef.current.clear();
    setLiveNotes([]);
    setMidiConnected(false);
    setMidiDevices([]);
  };

  const handlePlay = () => {
    if (notes.length === 0) return;
    audioEngine.setPlaybackRate(playbackRate);
    setIsPlaying(true);
    audioEngine.startPlayback(
      notes.filter(n => activeChannels.has(n.channel)),
      (time) => setCurrentTime(time),
      () => {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    );
  };

  const handleStop = () => {
    audioEngine.stopPlayback();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handlePlaybackRateChange = (e) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    audioEngine.setPlaybackRate(rate);
  };

  const toggleChannel = (channel) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  const selectAllChannels = () => {
    setActiveChannels(new Set(allChannels.length > 0 ? allChannels : [...Array(16).keys()]));
  };

  const clearAllChannels = () => {
    setActiveChannels(new Set());
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  const filteredNotes = notes.filter(n => activeChannels.has(n.channel));

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎹 MIDI 钢琴卷帘编辑器</h1>
        <p>连接MIDI键盘或上传MIDI文件，实时查看和播放音符</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="controls">
        <div className="control-group">
          <label>MIDI文件</label>
          <input
            type="file"
            accept=".mid,.midi"
            onChange={handleFileUpload}
            disabled={loading}
          />
        </div>

        <div className="control-group">
          <label>MIDI键盘</label>
          {!midiConnected ? (
            <button className="btn btn-primary" onClick={handleConnectMidi}>
              连接MIDI设备
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleDisconnectMidi}>
              断开连接
            </button>
          )}
        </div>

        <div className="control-group">
          <label>播放控制</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-success"
              onClick={handlePlay}
              disabled={isPlaying || filteredNotes.length === 0}
            >
              ▶ 播放
            </button>
            <button
              className="btn btn-danger"
              onClick={handleStop}
              disabled={!isPlaying}
            >
              ■ 停止
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>回放速度: {playbackRate.toFixed(2)}x</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            value={playbackRate}
            onChange={handlePlaybackRateChange}
          />
        </div>

        <div className="control-group" style={{ flex: 1, minWidth: '300px' }}>
          <label>
            通道过滤器
            <button
              className="btn btn-secondary"
              style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}
              onClick={selectAllChannels}
            >
              全选
            </button>
            <button
              className="btn btn-secondary"
              style={{ marginLeft: '4px', padding: '2px 8px', fontSize: '11px' }}
              onClick={clearAllChannels}
            >
              清空
            </button>
          </label>
          <div className="channel-filters">
            {(allChannels.length > 0 ? allChannels : [...Array(16).keys()]).map(ch => (
              <button
                key={ch}
                className={`channel-btn ${activeChannels.has(ch) ? 'active' : ''}`}
                onClick={() => toggleChannel(ch)}
                style={activeChannels.has(ch) ? {
                  background: CHANNEL_COLORS[ch % CHANNEL_COLORS.length],
                  borderColor: CHANNEL_COLORS[ch % CHANNEL_COLORS.length]
                } : {}}
              >
                Ch {ch + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {midiDevices.length > 0 && (
        <div className="status-bar">
          <span>已连接MIDI设备: {midiDevices.map(d => d.name).join(', ')}</span>
          <span>实时音符: {liveNotes.length}</span>
        </div>
      )}

      <div className="piano-roll-container">
        <div className="status-bar">
          <span>
            {currentFilename || '未加载文件'}
            {loading && ' (加载中...)'}
          </span>
          <span>
            时间: {formatTime(currentTime)} / {formatTime(durationMs)}
            {' | '}
            音符数: {filteredNotes.length} / {notes.length}
          </span>
        </div>
        {notes.length > 0 || liveNotes.length > 0 ? (
          <PianoRoll
            notes={notes}
            activeChannels={activeChannels}
            currentTimeMs={currentTime}
            liveNotes={liveNotes}
          />
        ) : (
          <div className="empty-state">
            <p>请上传MIDI文件或连接MIDI键盘开始使用</p>
          </div>
        )}
      </div>

      <div className="records-section">
        <h2>📋 历史记录</h2>
        {records.length === 0 ? (
          <div className="empty-state">暂无记录</div>
        ) : (
          <table className="records-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>时长</th>
                <th>音符数</th>
                <th>上传时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{r.filename}</td>
                  <td>{formatTime(r.duration_ms)}</td>
                  <td>{r.note_count}</td>
                  <td>{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ marginRight: '8px', padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleLoadRecord(r.id)}
                    >
                      加载
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleDeleteRecord(r.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
