/**
 * FUSION X - Core Application Orchestration Engine
 * Coordinates state, UI navigation, WebAudio sound synthesis, and accessibility layers.
 */

// Import Sub-modules
import { initAAC, speakText } from './aac.js';
import { initSmartHome } from './smarthome.js';
import { initVoiceAssistant } from './voice.js';
import { initSwitchScanning } from './scanning.js';
import { initCameraTracker } from './tracker.js';

// Global System State
export const state = {
  activeTab: 'dashboard',
  assistiveModes: {
    gaze: false,
    scanning: false,
    voice: true
  },
  settings: {
    highContrast: false,
    dyslexicFont: false,
    colorblind: 'none',
    largeCursor: false,
    scanSpeed: 2.0,   // seconds
    gazeSpeed: 1.5,   // multiplier
    dwellTime: 1.5,   // seconds
    defaultVoice: null
  },
  logs: [],
  visualizerAmplitude: 3, // Wave height factor (increases on speech/listen)
  visualizerSpeed: 0.08    // Wave scroll speed
};

// WebAudio Context for Sound Synthesis
let audioCtx = null;

/**
 * Initialize WebAudio on first interaction
 */
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

/**
 * Synthesize direct HIFI sound cues using native WebAudio API
 */
export function playSound(type) {
  try {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') {
      audioCtx?.resume();
    }
    
    const now = audioCtx.currentTime;
    
    // Flare visualizer wave amplitude when playSound triggers
    state.visualizerAmplitude = 12;
    setTimeout(() => {
      if (state.visualizerAmplitude === 12) state.visualizerAmplitude = 3;
    }, 400);

    switch (type) {
      case 'click': {
        // High crisp chirp
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }
      case 'scan': {
        // Low volume tick
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(320, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }
      case 'select': {
        // Pleasant upward chime
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.08, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
          
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.2);
        });
        break;
      }
      case 'sos': {
        // Emergency Sirens
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        
        osc1.frequency.setValueAtTime(600, now);
        osc1.frequency.linearRampToValueAtTime(1000, now + 0.4);
        osc1.frequency.linearRampToValueAtTime(600, now + 0.8);
        
        osc2.frequency.setValueAtTime(800, now);
        osc2.frequency.linearRampToValueAtTime(400, now + 0.4);
        osc2.frequency.linearRampToValueAtTime(800, now + 0.8);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.8);
        osc2.stop(now + 0.8);
        break;
      }
    }
  } catch (e) {
    console.error('Audio synthesis failed:', e);
  }
}

/**
 * System Logger
 */
export function logSystemEvent(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const event = { timestamp, message, type };
  state.logs.unshift(event);
  
  // Keep logs list manageable
  if (state.logs.length > 50) state.logs.pop();

  // Update Dashboard Visual Log Feed
  const feed = document.getElementById('dashboard-log-feed');
  if (feed) {
    const item = document.createElement('div');
    item.className = `log-item ${type === 'warning' ? 'warning' : type === 'danger' ? 'danger' : ''}`;
    item.innerHTML = `
      <div class="log-text">${message}</div>
      <div class="log-time">${timestamp}</div>
    `;
    feed.insertBefore(item, feed.firstChild);
    
    // Maintain maximum DOM log length
    if (feed.children.length > 15) {
      feed.removeChild(feed.lastChild);
    }
  }
}

/**
 * Global Tab Navigation Handler
 */
export function switchTab(tabId) {
  if (tabId === state.activeTab) return;
  
  // Audio response
  playSound('click');
  
  // Update state
  state.activeTab = tabId;

  // Toggle active Sidebar buttons
  document.querySelectorAll('.menu-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Toggle visible viewport content
  document.querySelectorAll('.viewport-tab').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${tabId}`);
  });

  // System notification
  logSystemEvent(`Navigated to: ${tabId.toUpperCase()}`);

  // Dispatch custom event to notify scanning engine that layouts shifted
  window.dispatchEvent(new CustomEvent('viewportTabChanged', { detail: { activeTab: tabId } }));
}

/**
 * Statusbar clock updating
 */
function updateClock() {
  const timeEl = document.getElementById('system-time');
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Dynamic Simulated Battery status and charge drift
 */
let batteryCharge = 82;
function updateBatteryStatus() {
  const fill = document.getElementById('battery-bar-fill');
  const text = document.getElementById('battery-text');
  const icon = document.getElementById('battery-icon');

  if (!fill || !text) return;

  // Slowly drift battery simulation down to mock operational hardware load
  if (Math.random() > 0.6) {
    batteryCharge = Math.max(10, batteryCharge - 1);
  }

  fill.style.width = `${batteryCharge}%`;
  text.textContent = `${batteryCharge}%`;

  if (batteryCharge > 50) {
    fill.style.backgroundColor = 'var(--accent-success)';
    icon.className = 'fa-solid fa-battery-three-quarters';
  } else if (batteryCharge > 20) {
    fill.style.backgroundColor = 'var(--accent-warning)';
    icon.className = 'fa-solid fa-battery-half';
  } else {
    fill.style.backgroundColor = 'var(--accent-danger)';
    icon.className = 'fa-solid fa-battery-quarter';
    icon.style.animation = 'pulse-scale 1s infinite';
  }
}

/**
 * Canvas Sine-Wave Voice Visualizer
 */
let wavePhase = 0;
function renderAudioVisualizer() {
  const canvas = document.getElementById('audio-visualizer');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Determine current ambient target amplitude based on voice assistant active states
  let targetAmp = 3;
  const mic = document.getElementById('voice-indicator');
  const isSpeaking = window.speechSynthesis.speaking;
  const isHearing = mic && mic.classList.contains('listening');

  if (isSpeaking) {
    targetAmp = 10;
    state.visualizerSpeed = 0.15;
  } else if (isHearing) {
    targetAmp = 7;
    state.visualizerSpeed = 0.1;
  } else {
    targetAmp = 3; // Breathing amplitude
    state.visualizerSpeed = 0.05;
  }

  // Smoothly interpolate current visual amplitude
  state.visualizerAmplitude += (targetAmp - state.visualizerAmplitude) * 0.1;

  // Draw Wave 1 (Neon Cyan)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
  ctx.lineWidth = 2;
  for (let x = 0; x < width; x++) {
    const y = height / 2 + Math.sin(x * 0.08 + wavePhase) * state.visualizerAmplitude;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw Wave 2 (Neon Pink, inverted phase)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < width; x++) {
    const y = height / 2 + Math.cos(x * 0.06 - wavePhase) * (state.visualizerAmplitude * 0.8);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Increment wave shifting offset
  wavePhase += state.visualizerSpeed;

  requestAnimationFrame(renderAudioVisualizer);
}

/**
 * Plotted Dashboard Calibration Chart loop
 */
let calibrationHistory = [98.4, 98.2, 98.5, 98.4, 98.8, 98.6, 98.7, 98.4, 98.9, 98.8, 98.7, 98.9];
function plotSystemChart() {
  const canvas = document.getElementById('dashboard-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Fit canvas to parent coordinates
  const rect = canvas.parentNode.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // 1. Draw coordinate grids
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 1; i < gridLines; i++) {
    const y = (h / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    const x = (w / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // 2. Map coordinates points
  const pointsCount = calibrationHistory.length;
  const paddingX = 20;
  const paddingY = 20;
  const usableWidth = w - paddingX * 2;
  const usableHeight = h - paddingY * 2;

  // Max-min bounds
  const minVal = 98.0;
  const maxVal = 99.2;

  const getCanvasCoords = (index, value) => {
    const cx = paddingX + (index / (pointsCount - 1)) * usableWidth;
    const cy = h - paddingY - ((value - minVal) / (maxVal - minVal)) * usableHeight;
    return { x: cx, y: cy };
  };

  // 3. Draw smooth HSL green bezier chart path
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
  ctx.lineWidth = 3.5;

  for (let i = 0; i < pointsCount; i++) {
    const pt = getCanvasCoords(i, calibrationHistory[i]);
    if (i === 0) {
      ctx.moveTo(pt.x, pt.y);
    } else {
      const prevPt = getCanvasCoords(i - 1, calibrationHistory[i - 1]);
      // Bezier curve calculations
      const xc = (prevPt.x + pt.x) / 2;
      const yc = (prevPt.y + pt.y) / 2;
      ctx.quadraticCurveTo(prevPt.x, prevPt.y, xc, yc);
    }
  }
  ctx.stroke();

  // 4. Fill gradient below chart path
  ctx.beginPath();
  const startPt = getCanvasCoords(0, calibrationHistory[0]);
  ctx.moveTo(startPt.x, h);
  ctx.lineTo(startPt.x, startPt.y);
  
  for (let i = 1; i < pointsCount; i++) {
    const pt = getCanvasCoords(i, calibrationHistory[i]);
    const prevPt = getCanvasCoords(i - 1, calibrationHistory[i - 1]);
    const xc = (prevPt.x + pt.x) / 2;
    const yc = (prevPt.y + pt.y) / 2;
    ctx.quadraticCurveTo(prevPt.x, prevPt.y, xc, yc);
  }
  const endPt = getCanvasCoords(pointsCount - 1, calibrationHistory[pointsCount - 1]);
  ctx.lineTo(endPt.x, h);
  ctx.closePath();

  const fillGlow = ctx.createLinearGradient(0, 0, 0, h);
  fillGlow.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  fillGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = fillGlow;
  ctx.fill();

  // 5. Drawing glowing pulsing pointer on latest plotted dot
  const lastIndex = pointsCount - 1;
  const lastVal = calibrationHistory[lastIndex];
  const lastPt = getCanvasCoords(lastIndex, lastVal);

  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0; // reset

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 10 + Math.sin(performance.now() * 0.01) * 3, 0, 2 * Math.PI);
  ctx.stroke();
}

/**
 * Shift Precision Logs dynamically on intervals
 */
function runChartDataGenerator() {
  setInterval(() => {
    const lastVal = calibrationHistory[calibrationHistory.length - 1];
    const noise = (Math.random() - 0.5) * 0.25;
    const nextVal = Math.max(98.1, Math.min(99.1, lastVal + noise));
    
    calibrationHistory.push(parseFloat(nextVal.toFixed(2)));
    if (calibrationHistory.length > 15) {
      calibrationHistory.shift();
    }

    const percentageText = document.getElementById('precision-percentage');
    if (percentageText) {
      percentageText.textContent = `${nextVal.toFixed(2)}% Live`;
    }

    plotSystemChart();
  }, 2500);
}

/**
 * UI Bindings & Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Clock timer
  updateClock();
  setInterval(updateClock, 10000);

  // 2. Battery status and charging state check
  updateBatteryStatus();
  setInterval(updateBatteryStatus, 15000);

  // 3. Tab clicking listeners
  document.querySelectorAll('.menu-item').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // 4. User Welcome Text greeting
  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good Morning' : hours < 18 ? 'Good Afternoon' : 'Good Evening';
  const msgEl = document.getElementById('welcome-message');
  if (msgEl) msgEl.textContent = `${greeting}, User`;

  // 5. Dashboard Quick Speech command pad clicks
  document.querySelectorAll('.quick-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.getAttribute('data-text');
      if (text) {
        speakText(text);
        logSystemEvent(`Quick Voice: "${text}"`, 'info');
      }
    });
  });

  // 6. Hover and Highlight details are managed cleanly via hardware-accelerated CSS transitions for maximum accessibility and visual comfort.

  // 7. Accessibility Settings Bindings
  
  // High Contrast
  const hcToggle = document.getElementById('setting-high-contrast');
  hcToggle.addEventListener('change', (e) => {
    state.settings.highContrast = e.target.checked;
    document.body.classList.toggle('theme-high-contrast', state.settings.highContrast);
    logSystemEvent(`High Contrast mode ${state.settings.highContrast ? 'ON' : 'OFF'}`, 'warning');
    playSound('select');
  });

  // Dyslexic Font
  const dfToggle = document.getElementById('setting-dyslexic-font');
  dfToggle.addEventListener('change', (e) => {
    state.settings.dyslexicFont = e.target.checked;
    document.body.classList.toggle('theme-dyslexic', state.settings.dyslexicFont);
    logSystemEvent(`Dyslexic typography profile ${state.settings.dyslexicFont ? 'ON' : 'OFF'}`, 'info');
    playSound('select');
  });

  // Large Cursor
  const lcToggle = document.getElementById('setting-large-cursor');
  lcToggle.addEventListener('change', (e) => {
    state.settings.largeCursor = e.target.checked;
    document.body.classList.toggle('cursor-large', state.settings.largeCursor);
    document.body.classList.toggle('text-large', state.settings.largeCursor);
    logSystemEvent(`Workspace text scale shifted ${state.settings.largeCursor ? 'UP' : 'NORMAL'}`);
    playSound('select');
  });

  // Colorblind profile select dropdown
  const cbSelect = document.getElementById('setting-colorblind');
  cbSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    
    // Remove all colorblind classes
    document.body.classList.remove('theme-protanopia', 'theme-deuteranopia', 'theme-tritanopia', 'theme-monochrome');
    
    state.settings.colorblind = val;
    if (val !== 'none') {
      document.body.classList.add(`theme-${val}`);
      logSystemEvent(`Color matrix corrected for: ${val.toUpperCase()}`);
    } else {
      logSystemEvent('Colorblind correction deactivated.');
    }
    playSound('select');
  });

  // Scan Speed Slider
  const scanSpeedInput = document.getElementById('setting-scan-speed');
  const scanSpeedLabel = document.getElementById('label-scan-speed');
  scanSpeedInput.addEventListener('input', (e) => {
    state.settings.scanSpeed = parseFloat(e.target.value);
    scanSpeedLabel.textContent = state.settings.scanSpeed.toFixed(1);
    window.dispatchEvent(new CustomEvent('scanSpeedChanged', { detail: state.settings.scanSpeed }));
  });

  // Gaze Speed Slider
  const gazeSpeedInput = document.getElementById('setting-gaze-speed');
  const gazeSpeedLabel = document.getElementById('label-gaze-speed');
  gazeSpeedInput.addEventListener('input', (e) => {
    state.settings.gazeSpeed = parseFloat(e.target.value);
    gazeSpeedLabel.textContent = state.settings.gazeSpeed.toFixed(1);
  });

  // Gaze Dwell Time Slider
  const dwellTimeInput = document.getElementById('setting-dwell-time');
  const dwellTimeLabel = document.getElementById('label-dwell-time');
  dwellTimeInput.addEventListener('input', (e) => {
    state.settings.dwellTime = parseFloat(e.target.value);
    dwellTimeLabel.textContent = state.settings.dwellTime.toFixed(1);
  });

  // 8. Initialize Subsystems
  initAAC();
  initSmartHome();
  initVoiceAssistant();
  initSwitchScanning();
  initCameraTracker();

  // 9. Launch Audio Visualizers and plotted charts
  renderAudioVisualizer();
  
  setTimeout(() => {
    plotSystemChart();
    runChartDataGenerator();
  }, 100);

  // Redraw canvas charts when window resizes
  window.addEventListener('resize', plotSystemChart);

  // Log Startup success
  logSystemEvent('Fusion X Command Center operational.', 'info');

  // Request audio activation on first keypress/click
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('keydown', initAudio, { once: true });
});
