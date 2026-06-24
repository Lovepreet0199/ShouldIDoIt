// app.js - logic for "Should I Do It?"
// Frontend talks to backend POST /api/decision; falls back to random answers on failure.

// 1) DOM references
const questionInput = document.getElementById('question');
const askBtn = document.getElementById('askBtn');
const loadingEl = document.getElementById('loading');
const loadingMsg = document.getElementById('loadingMsg');
const resultEl = document.getElementById('result');
const answerEl = document.getElementById('answer');
const metaEl = document.getElementById('meta');
const reasoningEl = document.getElementById('reasoning');
const errorEl = document.getElementById('error');

questionInput.focus();

// 2) Loading messages and fallback answers
const loadingMessages = [
  'Scanning the internet...',
  'Consulting experts...',
  'Asking a duck...',
  'Ignoring evidence...',
  'Finalizing decision...'
];

const fallbackAnswers = [
  'Yes',
  'No',
  'Maybe',
  'Absolutely',
  'Definitely not',
  'Proceed with caution'
];

const fallbackReasonings = [
  'The ducks have spoken, and they are surprisingly opinionated today.',
  'Statistically, someone on Reddit already did this and regretted it.',
  'Your gut knew before you typed. I just made it official.',
  'Bold move. The universe respects bold moves… sometimes.',
  'Sleep on it. Or don\'t. I\'m not your mom.',
  'Every great story starts with a questionable decision.',
  'The risk-to-drama ratio is off the charts. Proceed accordingly.'
];

const fallbackCategories = [
  'Finance',
  'Relationships',
  'Career',
  'Food',
  'Technology',
  'General'
];

const fallbackRisks = ['Low', 'Medium', 'High'];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomConfidence() {
  const min = 50.0;
  const max = 99.9;
  const value = Math.random() * (max - min) + min;
  return Math.round(value * 10) / 10;
}

function validateQuestion(raw) {
  const input = (raw || '').trim();

  if (!input) return { valid: false, message: 'empty' };
  if (input.length < 5) return { valid: false, message: 'too_short' };

  if (input.length > 30 && !/\s/.test(input)) {
    return { valid: false, message: 'no_spaces_long' };
  }

  const letters = (input.match(/[A-Za-z]/g) || []).length;
  const alphaRatio = letters / input.length;
  if (input.length > 8 && alphaRatio < 0.6) {
    return { valid: false, message: 'low_alpha_ratio' };
  }

  const tokens = input.split(/\s+/).filter(Boolean);
  const goodWords = tokens.filter(t => /[A-Za-z]{3,}/.test(t) && /[aeiouyAEIOUY]/.test(t));
  if (goodWords.length === 0) return { valid: false, message: 'no_recognizable_words' };

  const decisionPhrases = [
    'should i', 'can i', 'could i', 'do i', 'is it a good idea to',
    'would it be okay to', 'should we', 'should i buy', 'should i quit', 'should i go'
  ];

  const lower = input.toLowerCase();
  const hasDecisionPhrase = decisionPhrases.some(p => lower.includes(p));
  const looksLikeQuestion = /\?$/.test(input) || /\b(should|would|could|can|is|do)\b/.test(lower);

  if (hasDecisionPhrase || looksLikeQuestion) {
    return { valid: true, message: 'ok' };
  }

  return { valid: false, message: 'not_a_decision_question' };
}

// Fallback: original random logic when backend/API fails
function getFallbackAnswer(question) {
  return {
    answer: pickRandom(fallbackAnswers),
    confidence: Math.round(randomConfidence()),
    reasoning: pickRandom(fallbackReasonings),
    risk: pickRandom(fallbackRisks),
    category: pickRandom(fallbackCategories),
    fallback: true
  };
}

async function fetchDecision(question) {
  const response = await fetch('/api/decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function getAnswer(question) {
  try {
    return await fetchDecision(question);
  } catch (err) {
    console.warn('Backend unavailable, using fallback:', err.message);
    return getFallbackAnswer(question);
  }
}

function startLoadingSequence() {
  loadingEl.hidden = false;
  resultEl.hidden = true;
  errorEl.hidden = true;

  const duration = 2000 + Math.floor(Math.random() * 1000);
  let idx = 0;
  loadingMsg.textContent = loadingMessages[idx];

  const interval = setInterval(() => {
    idx = (idx + 1) % loadingMessages.length;
    loadingMsg.textContent = loadingMessages[idx];
  }, 600);

  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, duration);
  });
}

function riskClass(risk) {
  const lower = (risk || '').toLowerCase();
  if (lower === 'low') return 'risk-low';
  if (lower === 'high') return 'risk-high';
  return 'risk-medium';
}

function renderResult(data) {
  const { answer, confidence, reasoning, risk, category } = data;

  answerEl.textContent = `Decision: ${answer.toUpperCase()}`;

  metaEl.innerHTML = `
    <span class="meta-item"><strong>Confidence:</strong> ${confidence}%</span>
    <span class="meta-item ${riskClass(risk)}"><strong>Risk:</strong> ${risk}</span>
    <span class="meta-item"><strong>Category:</strong> ${category}</span>
  `;

  reasoningEl.innerHTML = `
    <div class="reasoning-label">Reasoning</div>
    <p>${reasoning}</p>
  `;

  resultEl.hidden = false;
}

async function handleSubmit() {
  const question = questionInput.value.trim();
  const validation = validateQuestion(question);

  const invalidMessages = [
    'I need an actual question.',
    "That doesn't look like a life decision.",
    'Please ask something humans would ask.',
    'My duck consultants are confused.',
    `I cannot determine whether '${question || ''}' is a good idea.`
  ];

  if (!validation.valid) {
    const msg = pickRandom(invalidMessages);
    errorEl.textContent = msg;
    errorEl.hidden = false;
    resultEl.hidden = true;
    return;
  }

  errorEl.hidden = true;
  resultEl.hidden = true;

  const [result] = await Promise.all([
    getAnswer(question),
    startLoadingSequence()
  ]);

  loadingEl.hidden = true;
  renderResult(result);
}

askBtn.addEventListener('click', handleSubmit);
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSubmit();
  }
});

window.getAnswer = getAnswer;
