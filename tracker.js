/**
 * SYNAPSE CONTROL - Gaze & Head Gesture Tracker
 * Integrates MediaPipe Face Landmarker for camera tracking and drives the dwell-click pointer simulator.
 */

import { state, playSound, logSystemEvent } from './app.js';
import { speakText } from './aac.js';

let faceLandmarker = null;
let webcamStream = null;
let trackingActive = false;
let animationFrameId = null;

// Virtual Cursor coordinates
let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;

// Gaze calibration baseline offsets
let baselineX = null;
let baselineY = null;

// Gaze Dwell clicking state variables
let hoveredElement = null;
let dwellStartTime = null;
let dwellTimerId = null;
let lastBlinkTime = 0;

// Simulated Gaze Joystick state variables
let isDraggingJoystick = false;
let joystickOffset = { x: 0, y: 0 };
let joystickLoopId = null;

/**
 * Update virtual cursor visual styling positions
 */
function updateGazeCursorPosition() {
  const cursor = document.getElementById('gaze-cursor');
  if (!cursor) return;

  // Clamping coordinates inside viewport limits
  cursorX = Math.max(20, Math.min(window.innerWidth - 20, cursorX));
  cursorY = Math.max(20, Math.min(window.innerHeight - 20, cursorY));

  cursor.style.left = `${cursorX}px`;
  cursor.style.top = `${cursorY}px`;

  // Process Dwell-selection logic
  checkDwellClickTarget();
}

/**
 * Dwell Clicking logic
 * Checks if the virtual cursor sits over a focusable .scan-target element.
 */
function checkDwellClickTarget() {
  const cursor = document.getElementById('gaze-cursor');
  const progressRing = document.getElementById('gaze-dwell-progress');
  if (!cursor || !progressRing) return;

  cursor.style.pointerEvents = 'none';
  const element = document.elementFromPoint(cursorX, cursorY);
  cursor.style.pointerEvents = 'auto';

  const target = element ? element.closest('.scan-target') : null;

  if (target) {
    if (hoveredElement !== target) {
      resetDwellTimer();
      hoveredElement = target;
      
      // Highlight the targeted option visually so the user knows they can blink-click it
      target.classList.add('gaze-hover');
      playSound('scan');

      // ONLY dwell-click automatically if webcam camera tracking is NOT active (e.g. simulated joystick fallback)
      if (!trackingActive) {
        dwellStartTime = Date.now();
        
        progressRing.style.opacity = '1';
        progressRing.style.animation = `dwell-spin ${state.settings.dwellTime}s linear forwards`;

        dwellTimerId = setTimeout(() => {
          playSound('select');
          target.click();
          logSystemEvent(`Gaze click triggered on: ${target.innerText.split('\n')[0]}`, 'info');
          
          resetDwellTimer();
        }, state.settings.dwellTime * 1000);
      }
    }
  } else {
    resetDwellTimer();
  }
}

/**
 * Cancel active dwell clicking timers
 */
function resetDwellTimer() {
  const progressRing = document.getElementById('gaze-dwell-progress');
  if (progressRing) {
    progressRing.style.opacity = '0';
    progressRing.style.animation = 'none';
  }
  
  if (dwellTimerId) {
    clearTimeout(dwellTimerId);
    dwellTimerId = null;
  }
  
  // Remove visual hover outline from previous target
  if (hoveredElement) {
    hoveredElement.classList.remove('gaze-hover');
  }
  
  hoveredElement = null;
  dwellStartTime = null;
}

/**
 * Handle Gaze controller activation
 */
export function toggleGazeTracker(force = null) {
  state.assistiveModes.gaze = force !== null ? force : !state.assistiveModes.gaze;

  const cursor = document.getElementById('gaze-cursor');
  const badge = document.getElementById('badge-gaze');
  const card = document.getElementById('toggle-card-gaze');

  if (state.assistiveModes.gaze) {
    logSystemEvent('Camera gaze service activated.', 'info');
    if (cursor) cursor.style.display = 'block';
    if (badge) badge.textContent = 'Gaze: ON';
    if (badge) badge.classList.add('active');
    if (card) card.classList.add('active');
    
    cursorX = window.innerWidth / 2;
    cursorY = window.innerHeight / 2;
    updateGazeCursorPosition();

    startSimulatedGazeLoop();
  } else {
    logSystemEvent('Camera gaze service suspended.');
    if (cursor) cursor.style.display = 'none';
    if (badge) badge.textContent = 'Gaze: OFF';
    if (badge) badge.classList.remove('active');
    if (card) card.classList.remove('active');
    
    resetDwellTimer();
    stopSimulatedGazeLoop();
  }
}

/* ==========================================
   CAMERA & AI MEDIAPIPE CORE
   ========================================== */

/**
 * Dynamic import helper for MediaPipe vision components
 */
async function loadMediaPipe() {
  try {
    logSystemEvent('Fetching vision machine model libraries...', 'info');
    
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8");
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    
    faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1
    });

    logSystemEvent('AI Face Landmarker model compiled.', 'info');
    speakText('Face tracking model loaded');
    return true;
  } catch (err) {
    console.error('Failed to compile MediaPipe:', err);
    logSystemEvent('Vision library failed to load. Falling back to joystick control.', 'warning');
    speakText('Model error, using joystick fallback');
    return false;
  }
}

/**
 * Initialize Webcam Capture Feed
 */
async function startWebcam() {
  const video = document.getElementById('camera-video');
  const placeholder = document.getElementById('camera-placeholder');
  const btn = document.getElementById('btn-init-camera');

  if (!video) return;

  try {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initializing model...';
    
    if (!faceLandmarker) {
      const ready = await loadMediaPipe();
      if (!ready) {
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Initialization Failed';
        return;
      }
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initializing Camera...';
    
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });

    video.srcObject = webcamStream;
    video.addEventListener('loadeddata', () => {
      if (placeholder) placeholder.style.display = 'none';
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Tracking Service Running';
      btn.className = 'btn btn-secondary scan-target';
      trackingActive = true;
      
      const recalBtn = document.getElementById('btn-recalibrate-gaze');
      if (recalBtn) recalBtn.style.display = 'inline-flex';

      // Auto-activate Gaze Mode when webcam tracking starts
      if (!state.assistiveModes.gaze) {
        toggleGazeTracker(true);
      }

      startTrackingLoop();
    });

    logSystemEvent('Webcam camera connected.', 'info');
  } catch (err) {
    console.error('Camera connection failed:', err);
    logSystemEvent('Camera permission denied or camera device absent.', 'warning');
    btn.innerHTML = '<i class="fa-solid fa-video-slash"></i> Camera Access Denied';
    speakText('Camera access denied');
  }
}

/**
 * Animation Frame tracking processing loop
 */
function startTrackingLoop() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('tracker-canvas');
  if (!video || !canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  let lastVideoTime = -1;

  function renderLoop() {
    if (!trackingActive) return;

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (faceLandmarker) {
        const results = faceLandmarker.detectForVideo(video, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];

          // Draw Glowing Constellation Triangulation Mesh & Target Crosshairs
          drawFacialCues(ctx, landmarks);

          // Head Rotation & Gaze Pointer Calculation
          const nose = landmarks[4];
          const leftEye = landmarks[133];
          const rightEye = landmarks[362];

          if (nose && leftEye && rightEye) {
            const currentOffsetX = nose.x - (leftEye.x + rightEye.x) / 2;
            const currentOffsetY = nose.y - (leftEye.y + rightEye.y) / 2;

            // Capture initial neutral baseline posture on first frame
            if (baselineX === null || baselineY === null) {
              baselineX = currentOffsetX;
              baselineY = currentOffsetY;
            }

            // Calculate exact head tilt deviation from neutral baseline
            const dx = currentOffsetX - baselineX;
            const dy = currentOffsetY - baselineY;

            // High-precision adaptive sensitivity (boosted further for ultra-rapid, strain-free response)
            const sensitivityX = state.settings.gazeSpeed * 280;
            const sensitivityY = state.settings.gazeSpeed * 220;
             
            cursorX += dx * sensitivityX;
            cursorY += dy * sensitivityY;
 
            updateGazeCursorPosition();
          }

          // Blink clicking logic (Eyelid distance tracker)
          const leftUpper = landmarks[159];
          const leftLower = landmarks[145];
          const rightUpper = landmarks[386];
          const rightLower = landmarks[374];

          if (leftUpper && leftLower && rightUpper && rightLower) {
            const leftDist = leftLower.y - leftUpper.y;
            const rightDist = rightLower.y - rightUpper.y;

            const blinkThreshold = 0.012;
            const now = Date.now();
            if (leftDist < blinkThreshold && rightDist < blinkThreshold && (now - lastBlinkTime > 600)) {
              lastBlinkTime = now;
              if (hoveredElement) {
                const target = hoveredElement;
                resetDwellTimer();
                playSound('select');
                target.click();
                logSystemEvent(`Blink select triggered on: ${target.innerText.split('\n')[0]}`, 'info');
              } else {
                resetDwellTimer();
              }
            }
          }
        }
      }
    }

    animationFrameId = requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

/**
 * Draws high-tech spatial triangulation vectors and target crosshairs on canvas
 */
function drawFacialCues(ctx, landmarks) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // 1. Draw glowing blue face outline vectors
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;

  // Eyes, Mouth, and Outline connection paths
  const leftEyeIndex = [33, 160, 158, 133, 153, 144, 33];
  const rightEyeIndex = [263, 387, 385, 362, 380, 373, 263];
  const mouthOuterIndex = [61, 37, 0, 267, 291, 321, 17, 91, 61];
  
  const drawPath = (indices) => {
    ctx.beginPath();
    indices.forEach((idx, i) => {
      const pt = landmarks[idx];
      if (pt) {
        const x = pt.x * w;
        const y = pt.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };

  drawPath(leftEyeIndex);
  drawPath(rightEyeIndex);
  drawPath(mouthOuterIndex);

  // Connect eyes to nose to chin for triangulation graphic
  const nose = landmarks[4];
  const chin = landmarks[152];
  const forehead = landmarks[10];

  if (nose && chin && forehead) {
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.beginPath();
    ctx.moveTo(forehead.x * w, forehead.y * h);
    ctx.lineTo(nose.x * w, nose.y * h);
    ctx.lineTo(chin.x * w, chin.y * h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo((landmarks[133]?.x || 0) * w, (landmarks[133]?.y || 0) * h);
    ctx.lineTo(nose.x * w, nose.y * h);
    ctx.lineTo((landmarks[362]?.x || 0) * w, (landmarks[362]?.y || 0) * h);
    ctx.stroke();
  }

  // 2. High-Tech Targeted Crosshair centered on the Nose Axis
  if (nose) {
    const nx = nose.x * w;
    const ny = nose.y * h;

    ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
    ctx.lineWidth = 1.5;

    // Crosshair target circle
    ctx.beginPath();
    ctx.arc(nx, ny, 16, 0, 2 * Math.PI);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(nx, ny, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(nx - 24, ny);
    ctx.lineTo(nx - 8, ny);
    ctx.moveTo(nx + 8, ny);
    ctx.lineTo(nx + 24, ny);
    ctx.moveTo(nx, ny - 24);
    ctx.lineTo(nx, ny - 8);
    ctx.moveTo(nx, ny + 8);
    ctx.lineTo(nx, ny + 24);
    ctx.stroke();
  }
}

/* ==========================================
   SIMULATED JOYSTICK CONTROLLER LOOP
   ========================================== */

/**
 * Continuously drifts virtual cursor based on Joystick offsets
 */
function startSimulatedGazeLoop() {
  if (joystickLoopId) return;

  function driftLoop() {
    if (state.assistiveModes.gaze) {
      cursorX += joystickOffset.x * (state.settings.gazeSpeed * 0.6);
      cursorY += joystickOffset.y * (state.settings.gazeSpeed * 0.6);

      updateGazeCursorPosition();
    }
    joystickLoopId = requestAnimationFrame(driftLoop);
  }
  driftLoop();
}

/**
 * Stop joystick drift loop
 */
function stopSimulatedGazeLoop() {
  if (joystickLoopId) {
    cancelAnimationFrame(joystickLoopId);
    joystickLoopId = null;
  }
  joystickOffset = { x: 0, y: 0 };
}

/**
 * Joystick Drag calculations
 */
function handleJoystickMove(e) {
  const pad = document.getElementById('gaze-sim-pad');
  const knob = document.getElementById('gaze-sim-knob');
  if (!pad || !knob || !isDraggingJoystick) return;

  const rect = pad.getBoundingClientRect();
  const padRadius = rect.width / 2;
  const centerX = rect.left + padRadius;
  const centerY = rect.top + padRadius;

  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  let dx = clientX - centerX;
  let dy = clientY - centerY;

  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > padRadius - 20) {
    dx = (dx / dist) * (padRadius - 20);
    dy = (dy / dist) * (padRadius - 20);
  }

  knob.style.left = `calc(50% + ${dx}px)`;
  knob.style.top = `calc(50% + ${dy}px)`;

  joystickOffset = { x: dx * 0.35, y: dy * 0.35 };
}

/**
 * Release joystick knob handles
 */
function resetJoystickKnob() {
  const knob = document.getElementById('gaze-sim-knob');
  if (knob) {
    knob.style.left = '50%';
    knob.style.top = '50%';
  }
  isDraggingJoystick = false;
  joystickOffset = { x: 0, y: 0 };
}

/**
 * Reset Gaze calibration baselines to current head pose
 */
export function resetGazeCalibration() {
  baselineX = null;
  baselineY = null;
  playSound('select');
  logSystemEvent('Gaze calibration baseline reset to current head posture.', 'info');
  speakText('Center calibrated');
}

/**
 * Bind calibration listeners and fallback controllers
 */
export function initCameraTracker() {
  
  const gazeCard = document.getElementById('toggle-card-gaze');
  if (gazeCard) {
    gazeCard.addEventListener('click', () => {
      toggleGazeTracker();
    });
  }

  const initBtn = document.getElementById('btn-init-camera');
  if (initBtn) {
    initBtn.addEventListener('click', startWebcam);
  }

  const recalBtn = document.getElementById('btn-recalibrate-gaze');
  if (recalBtn) {
    recalBtn.addEventListener('click', () => {
      resetGazeCalibration();
    });
  }

  const pad = document.getElementById('gaze-sim-pad');
  const knob = document.getElementById('gaze-sim-knob');

  if (pad && knob) {
    const dragStart = (e) => {
      e.preventDefault();
      isDraggingJoystick = true;
      playSound('click');
      
      // Auto-activate Gaze Mode when user explicitly drags simulated joystick knob
      if (!state.assistiveModes.gaze) {
        toggleGazeTracker(true);
      }
    };

    knob.addEventListener('mousedown', dragStart);
    knob.addEventListener('touchstart', dragStart, { passive: false });

    window.addEventListener('mousemove', handleJoystickMove);
    window.addEventListener('touchmove', handleJoystickMove, { passive: false });

    window.addEventListener('mouseup', resetJoystickKnob);
    window.addEventListener('touchend', resetJoystickKnob);
  }
}
