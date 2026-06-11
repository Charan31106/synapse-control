/**
 * FUSION X - Simulated Smart Home Environment
 * Manages device states, thermostat climate controls, mood lighting, simulated Smart TV channels, and Abort-Countdown SOS.
 */

import { playSound, logSystemEvent } from './app.js';
import { speakText } from './aac.js';

// Central Home Device States
export const homeDevices = {
  lights: { active: false, color: 'warm', label: 'Living Room Lights', desc: 'Smart Accent Lighting' },
  door: { active: false, label: 'Main Entry Door', desc: 'Secure Lock Gate' }, 
  ac: { active: false, temp: 22, label: 'Smart Thermostat', desc: 'AC HVAC Unit' },
  tv: { active: false, channelIndex: 0, label: 'Smart Media Display', desc: 'Interactive TV Screen' },
  sos: { active: false, staged: false }
};

// Smart TV Channel Data
const tvChannels = [
  { name: 'RETRO GAMING', emoji: '🎮👾🛸', desc: 'Space Invaders active. High score: 9240' },
  { name: 'RELAXING NATURE', emoji: '🌲🌊🏔️', desc: 'Alpine stream ambiance active. Sunset view' },
  { name: 'LIVE HOME NEWS', emoji: '📰🎙️⚡', desc: 'Fusion X weekly brief. Weather: 22°C Clear' }
];

// Audio interval timers
let sosSirenInterval = null;
let countdownInterval = null;
let countdownSeconds = 5;

/**
 * Update UI Cards to match device state variables
 */
export function updateDeviceUI(device) {
  const card = document.getElementById(`appliance-${device}`);
  if (!card) return;

  const btn = card.querySelector('.toggle-device-btn');
  const infoSpan = card.querySelector('.appliance-meta span');
  const tab = document.getElementById('tab-smarthome');

  const state = homeDevices[device];

  switch (device) {
    case 'lights': {
      card.classList.toggle('active', state.active);
      if (btn) btn.textContent = state.active ? 'Turn Off' : 'Turn On';
      if (btn) btn.className = `btn scan-target ${state.active ? 'btn-primary' : 'btn-secondary'}`;
      if (infoSpan) infoSpan.textContent = state.active ? `Glow Mood: ${state.color.toUpperCase()}` : 'Device Offline';
      
      // Update lightbulb glow color
      const bulb = card.querySelector('.bulb-glow-circle');
      const colorMap = { warm: '#f59e0b', blue: '#3b82f6', pink: '#ec4899', green: '#10b981' };
      
      if (bulb) {
        bulb.style.backgroundColor = state.active ? colorMap[state.color] : 'transparent';
        bulb.style.boxShadow = state.active ? `0 0 35px ${colorMap[state.color]}` : 'none';
      }

      // Dynamic Ambient wall lighting reflections
      if (tab) {
        tab.classList.remove('lights-on-warm', 'lights-on-blue', 'lights-on-pink', 'lights-on-green');
        if (state.active) {
          tab.classList.add(`lights-on-${state.color}`);
        }
      }
      break;
    }
    case 'door': {
      card.classList.toggle('active', state.active);
      const doorIcon = document.getElementById('door-icon');
      if (doorIcon) {
        doorIcon.className = state.active ? 'fa-solid fa-door-open' : 'fa-solid fa-door-closed';
      }
      if (btn) btn.textContent = state.active ? 'Lock Door' : 'Unlock Door';
      if (btn) btn.className = `btn scan-target ${state.active ? 'btn-primary' : 'btn-secondary'}`;
      if (infoSpan) infoSpan.textContent = state.active ? 'Entrance Unlocked' : 'Entrance Secure';
      break;
    }
    case 'ac': {
      card.classList.toggle('active', state.active);
      if (btn) btn.textContent = state.active ? 'Power Off' : 'Power On';
      if (btn) btn.className = `btn scan-target ${state.active ? 'btn-primary' : 'btn-secondary'}`;
      if (infoSpan) infoSpan.textContent = state.active ? 'Climate Controlled' : 'AC Offline';
      
      const tempDisplay = document.getElementById('ac-temp-val');
      if (tempDisplay) tempDisplay.textContent = state.temp;

      // Adjust animated fan propeller speed based on cooling temperature (Colder = Faster spin!)
      const fanIcon = document.getElementById('hvac-fan-icon');
      if (fanIcon) {
        if (state.active) {
          // Speed duration range: 16°C = 0.5s, 30°C = 2.5s
          const duration = 0.5 + ((state.temp - 16) / 14) * 2.0;
          fanIcon.style.animationDuration = `${duration}s`;
        } else {
          fanIcon.style.animationDuration = '0s';
        }
      }
      break;
    }
    case 'tv': {
      card.classList.toggle('active', state.active);
      if (btn) btn.textContent = state.active ? 'Power Off' : 'Power On';
      if (btn) btn.className = `btn scan-target ${state.active ? 'btn-primary' : 'btn-secondary'}`;
      if (infoSpan) infoSpan.textContent = state.active ? `Playing Channel ${state.channelIndex + 1}` : 'Device Offline';

      const staticOverlay = document.getElementById('tv-static-effect');
      const screenView = document.getElementById('tv-channel-view');

      if (state.active) {
        if (staticOverlay) staticOverlay.style.opacity = '0.15';
        if (screenView) {
          const activeCh = tvChannels[state.channelIndex];
          screenView.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 4px;">${activeCh.emoji}</div>
            <div style="color: #fff; font-size: 11px; letter-spacing: 0.5px;">${activeCh.name}</div>
            <div style="font-size: 9px; color: var(--text-secondary); margin-top: 4px; font-weight: normal;">${activeCh.desc}</div>
          `;
        }
      } else {
        if (staticOverlay) staticOverlay.style.opacity = '0';
        if (screenView) {
          screenView.innerHTML = 'OFF';
        }
      }

      // TV ambient flicker reflection
      if (tab) {
        tab.classList.toggle('tv-on', state.active);
      }
      break;
    }
  }
}

/**
 * Toggle individual smart appliances
 */
export function toggleDevice(device, forceState = null) {
  const state = homeDevices[device];
  if (!state) return;

  // Set state
  state.active = forceState !== null ? forceState : !state.active;

  // Visual cues
  updateDeviceUI(device);

  // Spoken confirmations customized for the blind
  let speechMsg = '';
  if (device === 'door') {
    speechMsg = state.active ? 'Main Entry Door unlocked' : 'Main Entry Door locked';
  } else if (device === 'lights') {
    speechMsg = state.active ? 'Living Room Lights turned on' : 'Living Room Lights turned off';
  } else if (device === 'ac') {
    speechMsg = state.active ? 'Air conditioning powered on' : 'Air conditioning powered off';
  } else if (device === 'tv') {
    speechMsg = state.active ? 'Smart Media Display powered on' : 'Smart Media Display powered off';
  } else {
    speechMsg = `${state.label} ${state.active ? 'activated' : 'deactivated'}`;
  }

  // Sound and vocal feedback
  if (state.active) {
    playSound('select');
    speakText(speechMsg);
    logSystemEvent(`${state.label} turned ON.`);
  } else {
    playSound('click');
    speakText(speechMsg);
    logSystemEvent(`${state.label} turned OFF.`);
  }

  // Update logs
  appendEmergencyLog(`${state.label} shifted to: ${state.active ? 'ON' : 'OFF'}`);
}

/**
 * Cycle media display channel index
 */
function nextTVChannel() {
  if (!homeDevices.tv.active) {
    toggleDevice('tv', true);
    return;
  }

  homeDevices.tv.channelIndex = (homeDevices.tv.channelIndex + 1) % tvChannels.length;
  updateDeviceUI('tv');
  
  playSound('click');
  const activeCh = tvChannels[homeDevices.tv.channelIndex];
  speakText(`Changing channel to ${activeCh.name}`);
  logSystemEvent(`Smart TV channel changed to: ${activeCh.name}`);
  appendEmergencyLog(`TV channel changed: ${activeCh.name}`);
}

/**
 * Append messages to simulated safety log feed
 */
function appendEmergencyLog(text) {
  const logBox = document.getElementById('emergency-log');
  if (!logBox) return;

  const now = new Date().toLocaleTimeString();
  logBox.innerHTML = `[${now}] ${text}<br>` + logBox.innerHTML;
}

/**
 * Launch high-security SOS safety countdown
 */
export function triggerSOS() {
  if (homeDevices.sos.active || homeDevices.sos.staged) return;
  homeDevices.sos.staged = true;

  logSystemEvent('SOS distressed staged. Initiating abort delay.', 'warning');
  appendEmergencyLog('SOS STAGED: Countdown active.');

  // 1. Reset Countdown params
  countdownSeconds = 5;
  const overlay = document.getElementById('global-sos-overlay');
  const countdownRing = document.getElementById('sos-countdown-ring');
  const sirenSymbol = document.getElementById('sos-siren-symbol');
  const countdownText = document.getElementById('sos-countdown-num');
  const header = document.getElementById('sos-header-text');
  const desc = document.getElementById('sos-desc-text');

  // Display initial overlay states
  if (overlay) overlay.style.display = 'flex';
  if (countdownRing) countdownRing.style.display = 'flex';
  if (sirenSymbol) sirenSymbol.style.display = 'none';
  if (countdownText) countdownText.textContent = countdownSeconds;
  if (header) header.textContent = 'SOS DISTRESS INITIALIZING';
  if (desc) desc.textContent = `Broadcasting emergency coordinate beacons in ${countdownSeconds} seconds. Hit the button below immediately to abort.`;

  // Play warning tick and speak count
  playSound('scan');
  speakText('Emergency. Broadcast staging in five seconds.');

  // 2. Start Ticking Countdown interval
  countdownInterval = setInterval(() => {
    countdownSeconds--;
    
    if (countdownSeconds > 0) {
      if (countdownText) countdownText.textContent = countdownSeconds;
      if (desc) desc.textContent = `Broadcasting emergency coordinate beacons in ${countdownSeconds} seconds. Hit the button below immediately to abort.`;
      
      // Warning sound and vocal cue
      playSound('scan');
      speakText(`${countdownSeconds}`);
    } else {
      // Countdown expired! Trigger distress broadcast sirens!
      clearInterval(countdownInterval);
      countdownInterval = null;
      activateDistressBroadcast();
    }
  }, 1000);

  // Dispatch layout shift so scanning moves to overlay button
  window.dispatchEvent(new CustomEvent('viewportTabChanged', { detail: { activeTab: 'sos' } }));
}

/**
 * Activates raw distressed broadcast sirens (called after countdown expires)
 */
function activateDistressBroadcast() {
  homeDevices.sos.staged = false;
  homeDevices.sos.active = true;

  logSystemEvent('CRITICAL: SOS Distress broadcast active!', 'danger');
  appendEmergencyLog('EMERGENCY: Distress beacon active.');

  const countdownRing = document.getElementById('sos-countdown-ring');
  const sirenSymbol = document.getElementById('sos-siren-symbol');
  const header = document.getElementById('sos-header-text');
  const desc = document.getElementById('sos-desc-text');

  if (countdownRing) countdownRing.style.display = 'none';
  if (sirenSymbol) sirenSymbol.style.display = 'block';
  if (header) header.textContent = 'EMERGENCY BROADCAST ACTIVE';
  if (desc) desc.textContent = 'Sirens sounding. Medical support coordinates sent. Care coordinators contacted.';

  // 1. Play Siren loop
  playSound('sos');
  sosSirenInterval = setInterval(() => {
    playSound('sos');
  }, 1000);

  // 2. Verbal warning
  speakText('Emergency alarm triggered. Coordinates dispatched.', true);

  // 3. Simulated safety overrides
  toggleDevice('lights', true);
  toggleDevice('door', true); // Unlocked so support can enter
}

/**
 * Terminate emergency alarms and abort staged count
 */
export function cancelSOS() {
  if (!homeDevices.sos.active && !homeDevices.sos.staged) return;

  const isStaged = homeDevices.sos.staged;

  // Clear timers
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (sosSirenInterval) {
    clearInterval(sosSirenInterval);
    sosSirenInterval = null;
  }

  homeDevices.sos.active = false;
  homeDevices.sos.staged = false;

  logSystemEvent(isStaged ? 'SOS staging aborted by user.' : 'SOS distress beacon resolved.');
  appendEmergencyLog(isStaged ? 'SOS: Staging Aborted.' : 'Distress signal cleared.');

  // Hide modal
  const overlay = document.getElementById('global-sos-overlay');
  if (overlay) overlay.style.display = 'none';

  // Spoken resolution
  speakText(isStaged ? 'Distress aborted. Safety restored.' : 'Emergency cancelled. Safety system restored.');
  playSound('select');

  // Trigger grid state update
  window.dispatchEvent(new CustomEvent('viewportTabChanged', { detail: { activeTab: 'smarthome' } }));
}

/**
 * Initialize smart home controls
 */
export function initSmartHome() {
  
  // 1. Circular Lighting preset color dot clicks
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering parent appliance card click
      
      const color = dot.getAttribute('data-color');
      
      // Update dots active class
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');

      homeDevices.lights.color = color;
      
      // Auto power lights if not active
      if (!homeDevices.lights.active) {
        toggleDevice('lights', true);
      } else {
        updateDeviceUI('lights');
        playSound('click');
        speakText(`Mood color ${color}`);
      }
      
      appendEmergencyLog(`Lighting shifted: ${color.toUpperCase()}`);
    });
  });

  // 2. Setup visual UI clicks on toggle buttons
  document.querySelectorAll('.toggle-device-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const device = btn.getAttribute('data-device');
      if (device) toggleDevice(device);
    });
  });

  // 3. Smart TV Channel Forward click
  const tvChanBtn = document.getElementById('tv-next-channel');
  if (tvChanBtn) {
    tvChanBtn.addEventListener('click', nextTVChannel);
  }

  // 4. Thermostat Temp Sliders
  document.getElementById('thermo-down').addEventListener('click', () => {
    if (!homeDevices.ac.active) toggleDevice('ac', true);
    if (homeDevices.ac.temp > 16) {
      homeDevices.ac.temp--;
      updateDeviceUI('ac');
      playSound('click');
      speakText(`AC target ${homeDevices.ac.temp} degrees`);
      appendEmergencyLog(`AC temp decreased: ${homeDevices.ac.temp}°C`);
    }
  });

  document.getElementById('thermo-up').addEventListener('click', () => {
    if (!homeDevices.ac.active) toggleDevice('ac', true);
    if (homeDevices.ac.temp < 30) {
      homeDevices.ac.temp++;
      updateDeviceUI('ac');
      playSound('click');
      speakText(`AC target ${homeDevices.ac.temp} degrees`);
      appendEmergencyLog(`AC temp increased: ${homeDevices.ac.temp}°C`);
    }
  });

  // 5. SOS Buttons
  const globalSos = document.getElementById('global-sos-btn');
  if (globalSos) globalSos.addEventListener('click', triggerSOS);

  const homeSos = document.getElementById('home-sos-btn');
  if (homeSos) homeSos.addEventListener('click', triggerSOS);

  const globalSosCancel = document.getElementById('global-sos-cancel');
  if (globalSosCancel) globalSosCancel.addEventListener('click', cancelSOS);

  // Initialize display states
  updateDeviceUI('lights');
  updateDeviceUI('door');
  updateDeviceUI('ac');
  updateDeviceUI('tv');
}
