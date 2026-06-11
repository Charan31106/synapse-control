/**
 * FUSION X - Voice Command Center
 * Integrates Web Speech Recognition API to parse accessibility commands and control hub modules.
 */

import { switchTab, logSystemEvent } from './app.js';
import { toggleDevice, triggerSOS, cancelSOS, homeDevices, updateDeviceUI } from './smarthome.js';
import { speakText } from './aac.js';
import { resetGazeCalibration } from './tracker.js';

let recognition = null;
let voiceActive = true;

/**
 * Update visual voice indicators in bottom dock
 */
function setVoiceUI(listening, statusText = '') {
  const indicator = document.getElementById('voice-indicator');
  const transcript = document.getElementById('voice-transcript');
  
  if (indicator) {
    indicator.classList.toggle('listening', listening);
    indicator.style.cursor = 'pointer';
    indicator.title = voiceActive ? 'Click to Mute Voice Assistant' : 'Click to Unmute Voice Assistant';
  }
  
  if (transcript && statusText) {
    transcript.textContent = statusText;
  }
}

/**
 * Parse vocal inputs and coordinate central hub states
 */
function processVoiceCommand(rawText) {
  const text = rawText.toLowerCase().trim();
  logSystemEvent(`Voice command captured: "${rawText}"`, 'info');

  // 1. Navigation Commands
  if (text.includes('go to dashboard') || text.includes('show dashboard') || text.includes('open hub') || text.includes('control hub')) {
    switchTab('dashboard');
    speakText('Opening control hub dashboard');
    return;
  }
  if (text.includes('go to aac') || text.includes('open aac') || text.includes('show aac') || text.includes('communicator') || text.includes('board')) {
    switchTab('aac');
    speakText('Opening speech communicator board');
    return;
  }
  if (text.includes('go to smart home') || text.includes('open smart home') || text.includes('show smart home') || text.includes('open home')) {
    switchTab('smarthome');
    speakText('Opening smart home deck');
    return;
  }
  if (text.includes('go to gaze') || text.includes('open gaze') || text.includes('show gaze') || text.includes('open camera') || text.includes('calibration')) {
    switchTab('calibration');
    speakText('Opening gaze calibration feed');
    return;
  }
  if (text.includes('go to settings') || text.includes('open settings') || text.includes('show settings')) {
    switchTab('settings');
    speakText('Opening access settings');
    return;
  }

  // Gaze Calibration Vocal Commands
  if (text.includes('recalibrate') || text.includes('calibrate') || text.includes('center gaze') || text.includes('recalibrate center')) {
    resetGazeCalibration();
    return;
  }

  // 2. Emergency Triggers
  if (text.includes('help help') || text.includes('emergency') || text.includes('trigger sos') || text.includes('call for help')) {
    triggerSOS();
    return;
  }
  if (text.includes('cancel help') || text.includes('cancel emergency') || text.includes('cancel sos') || text.includes('clear alarm')) {
    cancelSOS();
    return;
  }

  // 3. Smart Home Appliance Controls
  if (text.includes('turn on lights') || text.includes('lights on') || text.includes('activate lights')) {
    toggleDevice('lights', true);
    return;
  }
  if (text.includes('turn off lights') || text.includes('lights off') || text.includes('deactivate lights')) {
    toggleDevice('lights', false);
    return;
  }
  if (text.includes('unlock door') || text.includes('open door')) {
    toggleDevice('door', true);
    return;
  }
  if (text.includes('lock door') || text.includes('close door')) {
    toggleDevice('door', false);
    return;
  }
  if (text.includes('turn on ac') || text.includes('ac on')) {
    toggleDevice('ac', true);
    return;
  }
  if (text.includes('turn off ac') || text.includes('ac off')) {
    toggleDevice('ac', false);
    return;
  }

  // Climate temperature modifications
  if (text.includes('ac temperature up') || text.includes('warmer') || text.includes('increase temperature')) {
    if (!homeDevices.ac.active) toggleDevice('ac', true);
    if (homeDevices.ac.temp < 30) {
      homeDevices.ac.temp++;
      updateDeviceUI('ac');
      speakText(`AC warmer: ${homeDevices.ac.temp} degrees`);
    }
    return;
  }
  if (text.includes('ac temperature down') || text.includes('cooler') || text.includes('reduce temperature')) {
    if (!homeDevices.ac.active) toggleDevice('ac', true);
    if (homeDevices.ac.temp > 16) {
      homeDevices.ac.temp--;
      updateDeviceUI('ac');
      speakText(`AC cooler: ${homeDevices.ac.temp} degrees`);
    }
    return;
  }

  // 4. AAC Speech dictations ("say [x]" or "speak [x]")
  if (text.startsWith('say ') || text.startsWith('speak ')) {
    const speechStr = rawText.substring(rawText.indexOf(' ') + 1);
    speakText(speechStr);
    return;
  }

  // Fallback wake notification
  setVoiceUI(true, `Command unrecognized: "${rawText}". Try "go to AAC" or "turn on lights".`);
  speakText('Command not recognized, please try again.');
}

/**
 * Initialize Speech Recognition services
 */
export function initVoiceAssistant() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    logSystemEvent('Speech Recognition API unsupported in this browser.', 'warning');
    setVoiceUI(false, 'Speech API Unsupported (Use Chrome/Edge/Safari)');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  // State observers
  recognition.onstart = () => {
    logSystemEvent('Speech recognition capture session active.');
    setVoiceUI(true, 'Listening for voice commands...');
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      logSystemEvent('Microphone access blocked. Voice assistant disabled.', 'warning');
      setVoiceUI(false, 'Microphone blocked (Check browser permissions)');
      voiceActive = false;
    } else {
      console.error('Speech recognition error:', event.error);
    }
  };

  recognition.onend = () => {
    // Keep assistant listening perpetually unless manually muted/disabled
    if (voiceActive) {
      setTimeout(() => {
        try {
          recognition.start();
        } catch (err) {
          // Recognition already running or starting
        }
      }, 300);
    } else {
      setVoiceUI(false, 'Voice Assistant muted. Click mic to unmute.');
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      processVoiceCommand(finalTranscript);
    } else if (interimTranscript) {
      setVoiceUI(true, `Hearing: "${interimTranscript}"...`);
    }
  };

  // 5. Microphone Click Toggle Hook
  const indicator = document.getElementById('voice-indicator');
  if (indicator) {
    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      voiceActive = !voiceActive;
      if (!voiceActive) {
        logSystemEvent('Voice recognition muted by user.', 'warning');
        try {
          recognition.stop();
        } catch (err) {}
        setVoiceUI(false, 'Voice Assistant muted. Click mic to unmute.');
        speakText('Voice assistant muted');
      } else {
        logSystemEvent('Voice recognition unmuted by user.', 'info');
        try {
          recognition.start();
        } catch (err) {}
        setVoiceUI(true, 'Listening for voice commands...');
        speakText('Voice assistant active');
      }
    });
  }

  // Boot Engine
  try {
    recognition.start();
  } catch (e) {
    console.error('Failed to start speech recognition:', e);
  }
}

