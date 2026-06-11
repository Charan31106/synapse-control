/**
 * FUSION X - Switch Access & step Scanning Engine
 * Sequentially highlights visible scan targets at custom speeds for single-switch accessibility.
 */

import { state, playSound, logSystemEvent } from './app.js';
import { speakText } from './aac.js';

let scanElements = [];
let currentIndex = -1;
let scanIntervalId = null;

/**
 * Audit DOM for currently visible elements on active tab with .scan-target class
 */
export function rebuildScanTargets() {
  // Clear previous highlights
  clearActiveHighlight();

  // Find all scan targets
  const allTargets = Array.from(document.querySelectorAll('.scan-target'));

  // Filter only visible elements (within active viewport tab, active sidebar, or active overlay modals)
  scanElements = allTargets.filter(el => {
    // Basic element visibility check
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) {
      return false;
    }

    // Check if element sits inside an inactive tab
    const parentTab = el.closest('.viewport-tab');
    if (parentTab && !parentTab.classList.contains('active')) {
      return false;
    }

    // If emergency SOS overlay is active, only scan targets inside that overlay!
    const inSosOverlay = el.closest('.sos-overlay');
    const sosOverlayActive = document.getElementById('global-sos-overlay')?.style.display === 'flex';
    if (sosOverlayActive && !inSosOverlay) {
      return false;
    }
    if (!sosOverlayActive && inSosOverlay) {
      return false;
    }

    return true;
  });

  currentIndex = scanElements.length > 0 ? 0 : -1;
  applyHighlight();
}

/**
 * Remove scanning style markers from DOM elements
 */
function clearActiveHighlight() {
  document.querySelectorAll('.scan-target-focused').forEach(el => {
    el.classList.remove('scan-target-focused');
  });
}

/**
 * Apply scanning focus styles to element at current index
 */
function applyHighlight() {
  clearActiveHighlight();
  if (currentIndex === -1 || scanElements.length === 0) return;

  const activeEl = scanElements[currentIndex];
  if (!activeEl) return;

  // Add highlight class
  activeEl.classList.add('scan-target-focused');

  // Play scanning visual/audio click
  playSound('scan');

  // Auditory read screen assistance: read card text or labels
  const textVal = activeEl.innerText || activeEl.getAttribute('aria-label') || activeEl.placeholder || 'Button';
  const cleanLabel = textVal.split('\n')[0].replace(/[✅❌🚨🤕🚑🥤🍛]/g, '').trim(); // Remove raw symbols

  // In high contrast/screen reader mode, announce element vocally (quieter pitch)
  if (state.settings.highContrast) {
    speakText(cleanLabel);
  }
}

/**
 * Shift highlight frame to next index
 */
function stepScan() {
  if (scanElements.length === 0) return;
  currentIndex = (currentIndex + 1) % scanElements.length;
  applyHighlight();
}

/**
 * Activate the step scanner timers
 */
export function startScanning() {
  if (scanIntervalId) clearInterval(scanIntervalId);
  
  state.assistiveModes.scanning = true;
  logSystemEvent('Switch step-scanning service active.', 'info');

  // Update System Badges
  const badge = document.getElementById('badge-scan');
  const card = document.getElementById('toggle-card-scan');
  if (badge) {
    badge.textContent = 'Scan: ON';
    badge.classList.add('scanning');
  }
  if (card) card.classList.add('active');

  // Add scanning active class on viewport to draw scanning outline borders
  document.querySelector('.app-viewport')?.classList.add('scanning-active');

  // Build target list and run loop
  rebuildScanTargets();
  
  const speedMs = state.settings.scanSpeed * 1000;
  scanIntervalId = setInterval(stepScan, speedMs);
}

/**
 * Terminate scanning cycles
 */
export function stopScanning() {
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
  }

  state.assistiveModes.scanning = false;
  logSystemEvent('Switch step-scanning service suspended.');

  // Reset Badges
  const badge = document.getElementById('badge-scan');
  const card = document.getElementById('toggle-card-scan');
  if (badge) {
    badge.textContent = 'Scan: OFF';
    badge.classList.remove('scanning');
  }
  if (card) card.classList.remove('active');

  document.querySelector('.app-viewport')?.classList.remove('scanning-active');
  clearActiveHighlight();
  currentIndex = -1;
}

/**
 * Trigger universal click on currently focused element
 */
function selectCurrentElement() {
  if (!state.assistiveModes.scanning || currentIndex === -1 || scanElements.length === 0) return;

  const target = scanElements[currentIndex];
  if (!target) return;

  // Sound feedback
  playSound('select');

  // Execute standard click
  target.click();

  // Highlight scanning path changes may trigger (tab jumps). Re-align list immediately after click!
  setTimeout(() => {
    rebuildScanTargets();
  }, 100);
}

/**
 * Bind keyboard micro-switches and state custom observers
 */
export function initSwitchScanning() {
  // 1. Keyboard Universal Key Listeners (Spacebar acts as Switch Selector)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      // If scanning is active, Space triggers selection instead of page scrolling!
      if (state.assistiveModes.scanning) {
        e.preventDefault();
        selectCurrentElement();
      }
    }
  });

  // 2. Click toggler on control panel card
  const scanCard = document.getElementById('toggle-card-scan');
  if (scanCard) {
    scanCard.addEventListener('click', () => {
      if (state.assistiveModes.scanning) {
        stopScanning();
      } else {
        startScanning();
      }
    });
  }

  // 3. Tab navigation layout shifts trigger targeting rebuilds
  window.addEventListener('viewportTabChanged', () => {
    if (state.assistiveModes.scanning) {
      rebuildScanTargets();
      
      // Reset scanning timer so users get a full window on first element of new tab
      clearInterval(scanIntervalId);
      scanIntervalId = setInterval(stepScan, state.settings.scanSpeed * 1000);
    }
  });

  // 4. Listen for speed slider adjustments
  window.addEventListener('scanSpeedChanged', (e) => {
    if (state.assistiveModes.scanning) {
      clearInterval(scanIntervalId);
      scanIntervalId = setInterval(stepScan, e.detail * 1000);
      logSystemEvent(`Scan rate updated to: ${e.detail}s`);
    }
  });
}
