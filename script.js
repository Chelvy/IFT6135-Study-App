/* IFT6135 Study Tool — client-side SPA */

const SECTIONS = [
  { id: 'true-false',        title: 'True / False',       file: 'data/true-false.json',        type: 'tf'    },
  { id: 'multiple-choice',   title: 'Multiple Choice',    file: 'data/multiple-choice.json',   type: 'mcq'   },
  { id: 'math-formulation',  title: 'Math Formulation',   file: 'data/math-formulation.json',  type: 'math'  },
  { id: 'contextual',        title: 'Contextual / Situational', file: 'data/contextual.json',  type: 'mcq'   }
];

const STORAGE_KEY = 'ift6135-study-progress-v1';

const state = {
  questions: {},          // sectionId -> array of questions
  currentSection: null,   // 'dashboard' or a section id
  index: {},              // sectionId -> current question index
  progress: loadProgress() // sectionId -> { [qid]: { answer, correct } }
};

/* ---------- Progress persistence ---------- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
  catch { /* quota — ignore */ }
}

function ensureSectionProgress(sectionId) {
  if (!state.progress[sectionId]) state.progress[sectionId] = {};
  return state.progress[sectionId];
}

/* ---------- Data loading ---------- */
async function loadAllData() {
  await Promise.all(SECTIONS.map(async (s) => {
    const res = await fetch(s.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${s.file}`);
    state.questions[s.id] = await res.json();
    state.index[s.id] = 0;
  }));
}

/* ---------- Navigation ---------- */
function switchView(sectionId) {
  state.currentSection = sectionId;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.section === sectionId);
  });
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  if (sectionId === 'dashboard') {
    document.getElementById('dashboard').classList.add('active');
    renderDashboard();
  } else {
    document.getElementById('quiz-view').classList.add('active');
    renderQuiz();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const cards = document.getElementById('dashboard-cards');
  cards.innerHTML = '';

  let totalAnswered = 0, totalCorrect = 0, totalQuestions = 0;

  SECTIONS.forEach(s => {
    const qs = state.questions[s.id] || [];
    const prog = state.progress[s.id] || {};
    const answered = Object.keys(prog).length;
    const correct = Object.values(prog).filter(r => r.correct).length;
    const pct = qs.length ? Math.round((answered / qs.length) * 100) : 0;

    totalAnswered += answered;
    totalCorrect += correct;
    totalQuestions += qs.length;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${s.title}</h3>
      <div class="card-meta">${qs.length} questions</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="card-stats">
        <span><span class="stat-label">Answered:</span> <span class="stat-value">${answered}/${qs.length}</span></span>
        <span><span class="stat-label">Score:</span> <span class="stat-value">${correct}/${answered || 0}</span></span>
      </div>
    `;
    card.addEventListener('click', () => switchView(s.id));
    cards.appendChild(card);
  });

  // Overall summary card
  const overall = document.createElement('div');
  overall.className = 'card';
  overall.style.background = 'linear-gradient(135deg, #eef2fd, #e7f6f0)';
  overall.style.borderColor = '#cdd9ff';
  const overallPct = totalQuestions ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
  const acc = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  overall.innerHTML = `
    <h3>Overall</h3>
    <div class="card-meta">${totalQuestions} questions across 4 sections</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${overallPct}%"></div></div>
    <div class="card-stats">
      <span><span class="stat-label">Completion:</span> <span class="stat-value">${overallPct}%</span></span>
      <span><span class="stat-label">Accuracy:</span> <span class="stat-value">${acc}%</span></span>
    </div>
  `;
  cards.appendChild(overall);
}

/* ---------- Quiz rendering ---------- */
function renderQuiz() {
  const sectionId = state.currentSection;
  const section = SECTIONS.find(s => s.id === sectionId);
  const questions = state.questions[sectionId] || [];
  if (!section || !questions.length) return;

  const idx = clamp(state.index[sectionId] || 0, 0, questions.length - 1);
  state.index[sectionId] = idx;
  const q = questions[idx];
  const prog = ensureSectionProgress(sectionId);
  const record = prog[q.id];

  // Header
  document.getElementById('section-title').textContent = section.title;
  document.getElementById('question-counter').textContent = `Question ${idx + 1} / ${questions.length}`;
  const correctCount = Object.values(prog).filter(r => r.correct).length;
  const answeredCount = Object.keys(prog).length;
  document.getElementById('section-score').textContent = `Score: ${correctCount}/${answeredCount || 0}`;

  // Question body
  const body = document.getElementById('question-body');
  body.innerHTML = `<div class="q-prompt">${q.question}</div>` +
    (q.context ? `<div class="muted" style="margin-top:6px;font-size:0.92rem;">${q.context}</div>` : '');

  const answersEl = document.getElementById('answers');
  answersEl.innerHTML = '';
  const feedbackEl = document.getElementById('feedback');
  feedbackEl.className = 'feedback hidden';
  feedbackEl.innerHTML = '';

  const checkBtn = document.getElementById('check-btn');
  checkBtn.disabled = false;
  checkBtn.textContent = record ? 'Review' : 'Check Answer';

  if (section.type === 'tf') {
    renderTFOptions(q, answersEl, record);
  } else if (section.type === 'mcq') {
    renderMCQOptions(q, answersEl, record);
  } else if (section.type === 'math') {
    renderMathInput(q, answersEl, record);
  }

  if (record) {
    showFeedback(q, record.answer, record.correct);
    checkBtn.disabled = true;
  }

  // Nav buttons
  document.getElementById('prev-btn').disabled = idx === 0;
  document.getElementById('next-btn').disabled = idx === questions.length - 1;

  typesetMath();
}

function renderTFOptions(q, container, record) {
  const options = [
    { key: 'true',  label: 'True'  },
    { key: 'false', label: 'False' }
  ];
  options.forEach(opt => {
    const el = document.createElement('div');
    el.className = 'answer-option';
    el.dataset.key = opt.key;
    el.innerHTML = `<span class="letter">${opt.label[0]}</span><span>${opt.label}</span>`;
    if (record) {
      el.classList.add('disabled');
      if (opt.key === q.answer) el.classList.add('correct');
      if (opt.key === record.answer && record.answer !== q.answer) el.classList.add('incorrect');
    } else {
      el.addEventListener('click', () => selectAnswer(container, el));
    }
    container.appendChild(el);
  });
}

function renderMCQOptions(q, container, record) {
  q.options.forEach((optText, i) => {
    const letter = String.fromCharCode(65 + i); // A, B, C, D
    const el = document.createElement('div');
    el.className = 'answer-option';
    el.dataset.key = letter;
    el.innerHTML = `<span class="letter">${letter}.</span><span>${optText}</span>`;
    if (record) {
      el.classList.add('disabled');
      if (letter === q.answer) el.classList.add('correct');
      if (letter === record.answer && record.answer !== q.answer) el.classList.add('incorrect');
    } else {
      el.addEventListener('click', () => selectAnswer(container, el));
    }
    container.appendChild(el);
  });
}

function renderMathInput(q, container, record) {
  const wrap = document.createElement('div');
  const ta = document.createElement('textarea');
  ta.className = 'math-input';
  ta.placeholder = 'Type your answer (numeric value, expression, or short derivation)…';
  ta.id = 'math-answer';
  if (record) {
    ta.value = record.answer || '';
    ta.disabled = true;
  }
  wrap.appendChild(ta);
  const hint = document.createElement('div');
  hint.className = 'reveal-hint';
  hint.textContent = 'Tip: for numeric answers, the checker accepts whitespace/case-insensitive matches against the expected answer. Use the explanation to self-verify.';
  wrap.appendChild(hint);
  container.appendChild(wrap);
}

function selectAnswer(container, el) {
  container.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

/* ---------- Check & feedback ---------- */
function checkAnswer() {
  const sectionId = state.currentSection;
  const section = SECTIONS.find(s => s.id === sectionId);
  const questions = state.questions[sectionId];
  const idx = state.index[sectionId];
  const q = questions[idx];
  const prog = ensureSectionProgress(sectionId);
  if (prog[q.id]) return; // already answered

  let userAnswer = null;
  let correct = false;

  if (section.type === 'tf' || section.type === 'mcq') {
    const selected = document.querySelector('#answers .answer-option.selected');
    if (!selected) { flashMessage('Select an answer first.'); return; }
    userAnswer = selected.dataset.key;
    correct = userAnswer === q.answer;
  } else if (section.type === 'math') {
    const input = document.getElementById('math-answer');
    userAnswer = (input.value || '').trim();
    if (!userAnswer) { flashMessage('Type an answer first.'); return; }
    correct = matchesMathAnswer(userAnswer, q.answer, q.accepted);
  }

  prog[q.id] = { answer: userAnswer, correct };
  saveProgress();

  // Highlight
  if (section.type !== 'math') {
    document.querySelectorAll('#answers .answer-option').forEach(o => {
      o.classList.add('disabled');
      o.classList.remove('selected');
      if (o.dataset.key === q.answer) o.classList.add('correct');
      if (o.dataset.key === userAnswer && !correct) o.classList.add('incorrect');
    });
  } else {
    document.getElementById('math-answer').disabled = true;
  }

  showFeedback(q, userAnswer, correct);
  document.getElementById('check-btn').disabled = true;

  // Update score pill
  const correctCount = Object.values(prog).filter(r => r.correct).length;
  const answeredCount = Object.keys(prog).length;
  document.getElementById('section-score').textContent = `Score: ${correctCount}/${answeredCount}`;
}

function matchesMathAnswer(user, expected, accepted) {
  const norm = s => String(s).toLowerCase().replace(/\s+/g, '').replace(/[×·*]/g, '*');
  const u = norm(user);
  if (u === norm(expected)) return true;
  if (Array.isArray(accepted)) {
    return accepted.some(a => u === norm(a));
  }
  return false;
}

function showFeedback(q, userAnswer, correct) {
  const fb = document.getElementById('feedback');
  fb.classList.remove('hidden');
  fb.className = 'feedback ' + (correct ? 'correct' : 'incorrect');
  const section = SECTIONS.find(s => s.id === state.currentSection);
  let correctDisplay = '';
  if (section.type === 'tf') {
    correctDisplay = q.answer === 'true' ? 'True' : 'False';
  } else if (section.type === 'mcq') {
    const i = q.answer.charCodeAt(0) - 65;
    correctDisplay = `${q.answer}. ${q.options[i] || ''}`;
  } else if (section.type === 'math') {
    correctDisplay = q.answer;
  }
  fb.innerHTML = `
    <span class="verdict">${correct ? '✓ Correct' : '✗ Incorrect'}</span>
    <p class="explanation">${q.explanation || ''}</p>
    ${!correct ? `<div class="correct-answer"><strong>Expected answer:</strong> ${correctDisplay}</div>` : ''}
  `;
  typesetMath();
}

function flashMessage(msg) {
  const fb = document.getElementById('feedback');
  fb.classList.remove('hidden');
  fb.className = 'feedback';
  fb.innerHTML = `<p class="explanation">${msg}</p>`;
  setTimeout(() => {
    if (fb.innerHTML.includes(msg)) {
      fb.classList.add('hidden');
      fb.innerHTML = '';
    }
  }, 1800);
}

/* ---------- Controls ---------- */
function nextQuestion() {
  const sectionId = state.currentSection;
  const qs = state.questions[sectionId];
  if (state.index[sectionId] < qs.length - 1) {
    state.index[sectionId]++;
    renderQuiz();
  }
}
function prevQuestion() {
  const sectionId = state.currentSection;
  if (state.index[sectionId] > 0) {
    state.index[sectionId]--;
    renderQuiz();
  }
}

function resetSection() {
  const sectionId = state.currentSection;
  if (!confirm('Reset progress for this section?')) return;
  state.progress[sectionId] = {};
  state.index[sectionId] = 0;
  saveProgress();
  renderQuiz();
}

function resetAll() {
  if (!confirm('Reset ALL progress across every section? This cannot be undone.')) return;
  state.progress = {};
  SECTIONS.forEach(s => { state.index[s.id] = 0; });
  saveProgress();
  renderDashboard();
}

/* ---------- Utilities ---------- */
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function typesetMath() {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise().catch(() => {});
  }
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // Tab wiring
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchView(t.dataset.section));
  });
  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('next-btn').addEventListener('click', nextQuestion);
  document.getElementById('prev-btn').addEventListener('click', prevQuestion);
  document.getElementById('reset-section').addEventListener('click', resetSection);
  document.getElementById('reset-all').addEventListener('click', resetAll);

  try {
    await loadAllData();
  } catch (e) {
    document.getElementById('dashboard-cards').innerHTML =
      `<div class="card"><h3>Could not load question data</h3><div class="card-meta">${e.message}. If opening locally, serve the folder with a static server (e.g. <code>python3 -m http.server</code>).</div></div>`;
    return;
  }
  switchView('dashboard');
});
