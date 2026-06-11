/**
 * FUSION X - AAC Board (Speech Communicator)
 * Manages Augmentative and Alternative Communication cards, sentence building, and Text-to-Speech (TTS).
 */

import { playSound, logSystemEvent } from './app.js';

// AAC Phrase Card Datastore
const aacPhrases = {
  quick: [
    { label: 'Yes', emoji: '✅', text: 'Yes' },
    { label: 'No', emoji: '❌', text: 'No' },
    { label: 'Hello', emoji: '👋', text: 'Hello' },
    { label: 'Please', emoji: '🙏', text: 'Please' },
    { label: 'Thank You', emoji: '💖', text: 'Thank you' },
    { label: 'Goodbye', emoji: '🚶‍♂️', text: 'Goodbye' },
    { label: 'Help', emoji: '🙋‍♂️', text: 'I need assistance' },
    { label: 'Stop', emoji: '🛑', text: 'Please stop' }
  ],
  needs: [
    { label: 'Drink Water', emoji: '🥤', text: 'I would like a drink of water' },
    { label: 'Eat Food', emoji: '🍛', text: 'I am hungry and would like to eat' },
    { label: 'Use Toilet', emoji: '🚾', text: 'I need to use the restroom' },
    { label: 'Sleep/Rest', emoji: '🛌', text: 'I am tired and want to rest' },
    { label: 'Adjust Chair', emoji: '🦽', text: 'Please adjust my wheelchair' },
    { label: 'Take Medicine', emoji: '💊', text: 'I need to take my medication' },
    { label: 'Go Outside', emoji: '🌳', text: 'I want to go outdoors' },
    { label: 'Clean Up', emoji: '🧹', text: 'Please clean this area' }
  ],
  feelings: [
    { label: 'Happy', emoji: '😊', text: 'I feel happy' },
    { label: 'Sad', emoji: '😢', text: 'I feel sad' },
    { label: 'Tired', emoji: '🥱', text: 'I feel very sleepy' },
    { label: 'In Pain', emoji: '🩹', text: 'I am in pain' },
    { label: 'Cold', emoji: '🥶', text: 'I feel cold' },
    { label: 'Hot', emoji: '🥵', text: 'I feel hot' },
    { label: 'Angry', emoji: '😡', text: 'I feel frustrated' },
    { label: 'Scared', emoji: '😱', text: 'I am afraid' }
  ],
  emergency: [
    { label: 'CALL HELP', emoji: '🚨', text: 'ALERT: I need emergency help immediately!' },
    { label: 'I FELL DOWN', emoji: '🤕', text: 'EMERGENCY: I have fallen down and cannot get up!' },
    { label: 'CALL DOCTOR', emoji: '🚑', text: 'Please call the doctor or medical support' },
    { label: 'CALL FAMILY', emoji: '👨‍👩‍👧‍👦', text: 'Please contact my family coordinator' },
    { label: 'CHOKING', emoji: '🤢', text: 'URGENT: I am having trouble breathing!' }
  ]
};

// Current sentence buffer
let sentenceBuffer = [];

// Available System TTS Voices
let systemVoices = [];

// Current Active category
let currentCategory = 'quick';

/**
 * Trigger browser native Text-To-Speech
 */
export function speakText(text, isEmergency = false) {
  if (!text) return;
  
  if (isEmergency) {
    playSound('sos');
  }

  // Cancel currently playing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Apply selected voice if any
  const voiceSelect = document.getElementById('setting-voice-select');
  if (voiceSelect && voiceSelect.value) {
    const selectedVoice = systemVoices.find(v => v.name === voiceSelect.value);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  // Adjust parameters based on emergency states
  if (isEmergency) {
    utterance.rate = 0.85; // Speak slower and clearer
    utterance.pitch = 1.3;  // Higher urgent frequency
    utterance.volume = 1.0;
  } else {
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
  }

  window.speechSynthesis.speak(utterance);
  logSystemEvent(`TTS Voice spoken: "${text}"`);
}

/**
 * Populate browser Voice options in settings
 */
function loadVoices() {
  systemVoices = window.speechSynthesis.getVoices();
  const voiceSelect = document.getElementById('setting-voice-select');
  if (!voiceSelect) return;

  voiceSelect.innerHTML = '';
  
  systemVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    
    if (voice.default) {
      option.selected = true;
    }
    voiceSelect.appendChild(option);
  });
}

/**
 * Add word card to sentence builder
 */
function addCardToSentence(card, category) {
  sentenceBuffer.push(card.label);
  const display = document.getElementById('aac-display');
  if (display) {
    display.value = sentenceBuffer.join(' ');
  }
  
  playSound('click');
  speakText(card.text, category === 'emergency');
}

/**
 * Fetch dynamic custom cards from local storage
 */
function getCustomCards() {
  const data = localStorage.getItem('aac_custom_cards');
  if (!data) {
    return { quick: [], needs: [], feelings: [], emergency: [] };
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return { quick: [], needs: [], feelings: [], emergency: [] };
  }
}

/**
 * Save new custom card to local storage
 */
function saveCustomCard(card, category) {
  const custom = getCustomCards();
  if (!custom[category]) custom[category] = [];
  
  custom[category].push(card);
  localStorage.setItem('aac_custom_cards', JSON.stringify(custom));
  logSystemEvent(`Custom AAC card saved to grid "${category}": "${card.label}"`);
}

/**
 * Render selected Category phrase cards into viewport grid
 */
export function renderAACGrid(category) {
  currentCategory = category;
  const container = document.getElementById('aac-cards-grid');
  if (!container) return;

  container.innerHTML = '';
  
  // Mix standard cards and local custom cards
  const standardCards = aacPhrases[category] || [];
  const custom = getCustomCards();
  const customCards = custom[category] || [];

  const allCards = [...standardCards, ...customCards];

  allCards.forEach(card => {
    const el = document.createElement('button');
    el.className = `aac-card card-${category} scan-target`;
    el.setAttribute('aria-label', `${card.label} phrase card`);
    
    el.innerHTML = `
      <div class="aac-card-icon">${card.emoji}</div>
      <div class="aac-card-label">${card.label}</div>
    `;

    el.addEventListener('click', () => addCardToSentence(card, category));
    container.appendChild(el);
  });

  // Rebuild switch scanning targets since grid modified
  window.dispatchEvent(new CustomEvent('viewportTabChanged', { detail: { activeTab: 'aac' } }));
}

/**
 * Initial setup binders
 */
export function initAAC() {
  // 1. Initial render default tab cards
  renderAACGrid('quick');

  // 2. Click observers on left-hand Categories
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      playSound('click');
      
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const cat = tab.getAttribute('data-category');
      renderAACGrid(cat);
    });
  });

  // 3. Clear button
  document.getElementById('aac-btn-clear').addEventListener('click', () => {
    playSound('click');
    sentenceBuffer = [];
    const display = document.getElementById('aac-display');
    if (display) display.value = '';
    logSystemEvent('AAC sentence builder cleared.');
  });

  // 4. Speak Sentence button
  document.getElementById('aac-btn-speak').addEventListener('click', () => {
    playSound('select');
    const display = document.getElementById('aac-display');
    if (display && display.value) {
      speakText(display.value);
    }
  });

  // 5. Custom Card Modal triggers
  const addBtn = document.getElementById('aac-btn-add-card');
  const cancelBtn = document.getElementById('aac-cancel-card');
  const modal = document.getElementById('aac-modal-add-card');
  const form = document.getElementById('aac-new-card-form');

  if (addBtn && modal) {
    addBtn.addEventListener('click', () => {
      playSound('click');
      modal.style.display = 'flex';
      
      // Auto-pre-populate category dropdown with current active category
      const catSelect = document.getElementById('aac-new-cat');
      if (catSelect) catSelect.value = currentCategory;
    });
  }

  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', () => {
      playSound('click');
      modal.style.display = 'none';
      form.reset();
    });
  }

  if (form && modal) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const label = document.getElementById('aac-new-label').value;
      const text = document.getElementById('aac-new-text').value;
      const emoji = document.getElementById('aac-new-emoji').value || '💬';
      const category = document.getElementById('aac-new-cat').value;

      const newCard = { label, emoji, text };

      // Save and close
      saveCustomCard(newCard, category);
      playSound('select');
      modal.style.display = 'none';
      form.reset();

      // Speak validation
      speakText(`Card saved to ${category}`);

      // Re-render
      renderAACGrid(currentCategory);
    });
  }

  // 6. Load TTS Voice profiles
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}
