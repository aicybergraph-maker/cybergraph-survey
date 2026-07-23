const STORAGE_KEY = 'cybergraph_submissions';
const { computeResults, riskLabel, recommendations } = window.CyberGraphScoring;

let surveyData = null; // { title, sections, pillars, questions }
let sectionsQuestions = {}; // code -> [questions]
let pages = []; // ['contact', 'A', 'B', ..., 'results']
let pageIndex = 0;
let answers = {}; // key -> answer object
let contact = { fullName: '', email: '', company: '', jobTitle: '', phone: '' };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function init() {
  const res = await fetch('js/questions.json', { cache: 'no-store' });
  surveyData = await res.json();
  document.getElementById('survey-title').textContent = surveyData.title;

  surveyData.sections.forEach((s) => {
    sectionsQuestions[s.code] = surveyData.questions.filter((q) => q.section === s.code);
  });
  pages = ['contact', ...surveyData.sections.map((s) => s.code), 'results'];

  renderPage();
}

function currentSection() {
  const code = pages[pageIndex];
  return surveyData.sections.find((s) => s.code === code);
}

function renderProgress() {
  const bar = document.getElementById('progress-bar');
  const label = document.getElementById('progress-label');
  const pct = Math.round((pageIndex / (pages.length - 1)) * 100);
  bar.style.width = `${pct}%`;
  const code = pages[pageIndex];
  if (code === 'contact') label.textContent = 'Your information';
  else if (code === 'results') label.textContent = 'Results';
  else {
    const section = surveyData.sections.find((s) => s.code === code);
    const sectionOrdinal = surveyData.sections.findIndex((s) => s.code === code) + 1;
    label.textContent = `Section ${sectionOrdinal} of ${surveyData.sections.length}: ${section.name}`;
  }
}

function questionField(q) {
  const answer = answers[q.key] || {};
  const requiredMark = q.required ? '<span class="required">*</span>' : '';
  const skipMark = !q.required && q.allowSkip ? `<button type="button" class="btn-skip" data-key="${q.key}">Skip</button>` : '';
  let inputHtml = '';

  if (q.type === 'text') {
    inputHtml = `<textarea class="qa-input" data-key="${q.key}" data-kind="text" rows="2">${escapeHtml(answer.text || '')}</textarea>`;
  } else if (q.type === 'multi') {
    inputHtml = q.options
      .map((opt, i) => {
        const checked = (answer.selected || []).includes(i) ? 'checked' : '';
        return `<label class="choice"><input type="checkbox" class="qa-input" data-kind="multi" data-key="${q.key}" data-index="${i}" ${checked}> ${escapeHtml(opt)}</label>`;
      })
      .join('');
  } else {
    // scale5, scale_text, yn_text -> single-select radio list
    inputHtml = q.options
      .map((opt, i) => {
        const checked = answer.index === i ? 'checked' : '';
        return `<label class="choice"><input type="radio" class="qa-input" data-kind="single" name="${q.key}" data-key="${q.key}" data-index="${i}" ${checked}> ${escapeHtml(opt)}</label>`;
      })
      .join('');
  }

  const skippedClass = answer.skipped ? 'skipped' : '';
  return `
    <div class="question ${skippedClass}" data-question-key="${q.key}">
      <div class="question-head">
        <p class="question-text">${escapeHtml(q.text)} ${requiredMark}</p>
        ${skipMark}
      </div>
      ${q.why ? `<p class="question-why">${escapeHtml(q.why)}</p>` : ''}
      <div class="question-input">${inputHtml}</div>
      ${answer.skipped ? '<p class="skipped-note">Skipped</p>' : ''}
    </div>
  `;
}

function renderSectionPage(code) {
  const section = surveyData.sections.find((s) => s.code === code);
  const questions = sectionsQuestions[code];
  return `
    <h2>${escapeHtml(section.name)}</h2>
    ${questions.map(questionField).join('')}
  `;
}

function renderContactPage() {
  return `
    <h2>Your information</h2>
    <p class="section-intro">Tell us who to attribute this assessment to. This is saved alongside your risk score.</p>
    <div class="field">
      <label>Full name <span class="required">*</span></label>
      <input type="text" id="c-fullName" value="${escapeHtml(contact.fullName)}">
    </div>
    <div class="field">
      <label>Email <span class="required">*</span></label>
      <input type="email" id="c-email" value="${escapeHtml(contact.email)}">
    </div>
    <div class="field">
      <label>Company / Organisation <span class="required">*</span></label>
      <input type="text" id="c-company" value="${escapeHtml(contact.company)}">
    </div>
    <div class="field">
      <label>Job title</label>
      <input type="text" id="c-jobTitle" value="${escapeHtml(contact.jobTitle)}">
    </div>
    <div class="field">
      <label>Phone</label>
      <input type="text" id="c-phone" value="${escapeHtml(contact.phone)}">
    </div>
  `;
}

function renderResultsPage() {
  const results = computeResults(surveyData.questions, answers);
  const label = riskLabel(results.overall);
  const recs = recommendations(results.pillars);

  const pillarRows = results.pillars
    .filter((p) => p.score != null)
    .map(
      (p) => `
      <div class="pillar-row">
        <span class="pillar-name">${p.pillar}</span>
        <div class="pillar-bar"><div class="pillar-bar-fill risk-${riskLabel(p.score).toLowerCase()}" style="width:${p.score}%"></div></div>
        <span class="pillar-score">${p.score}</span>
      </div>`
    )
    .join('');

  const recHtml = recs
    .map((r) => `<li><strong>${r.pillar}</strong> (${r.score}/100) — ${escapeHtml(r.text)}</li>`)
    .join('');

  window._lastResults = results;

  return `
    <h2>Your CyberGraph AI Risk Assessment</h2>
    <div class="score-card">
      <div class="score-number risk-${label.toLowerCase()}">${results.overall}</div>
      <div class="score-meta">
        <div class="score-label">Overall Risk Score</div>
        <div class="score-tag risk-${label.toLowerCase()}">${label} Risk</div>
      </div>
    </div>
    <h3>By NIST CSF Pillar</h3>
    <div class="pillar-list">${pillarRows}</div>
    <h3>Top Recommendations</h3>
    <ul class="rec-list">${recHtml}</ul>
    <p class="hint">A CSV with your full answers and risk score has been downloaded to your device.</p>
    <button type="button" id="btn-download-again" class="btn-secondary">Download CSV again</button>
  `;
}

function renderPage() {
  const container = document.getElementById('page-container');
  const code = pages[pageIndex];

  if (code === 'contact') container.innerHTML = renderContactPage();
  else if (code === 'results') container.innerHTML = renderResultsPage();
  else container.innerHTML = renderSectionPage(code);

  renderProgress();
  bindPageEvents(code);
  updateNavButtons(code);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindPageEvents(code) {
  if (code === 'results') {
    document.getElementById('btn-download-again').addEventListener('click', () => {
      const submission = buildSubmission(window._lastResults);
      window.CyberGraphCsv.download(surveyData.questions, submission);
    });
    return;
  }

  const container = document.getElementById('page-container');

  container.querySelectorAll('.qa-input').forEach((el) => {
    el.addEventListener('change', () => {
      const key = el.dataset.key;
      const kind = el.dataset.kind;
      answers[key] = answers[key] || {};
      answers[key].skipped = false;
      if (kind === 'text') {
        answers[key].text = el.value;
      } else if (kind === 'single') {
        answers[key].index = Number(el.dataset.index);
      } else if (kind === 'multi') {
        const idx = Number(el.dataset.index);
        answers[key].selected = answers[key].selected || [];
        if (el.checked) {
          if (!answers[key].selected.includes(idx)) answers[key].selected.push(idx);
        } else {
          answers[key].selected = answers[key].selected.filter((i) => i !== idx);
        }
      }
      const qEl = container.querySelector(`[data-question-key="${key}"]`);
      qEl.classList.remove('skipped');
      const note = qEl.querySelector('.skipped-note');
      if (note) note.remove();
    });
  });

  container.querySelectorAll('.btn-skip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      answers[key] = { skipped: true };
      renderPage();
    });
  });
}

function validateCurrentPage() {
  const code = pages[pageIndex];
  if (code === 'contact') {
    contact.fullName = document.getElementById('c-fullName').value.trim();
    contact.email = document.getElementById('c-email').value.trim();
    contact.company = document.getElementById('c-company').value.trim();
    contact.jobTitle = document.getElementById('c-jobTitle').value.trim();
    contact.phone = document.getElementById('c-phone').value.trim();
    if (!contact.fullName || !contact.email || !contact.company) {
      alert('Please fill in your name, email, and company before continuing.');
      return false;
    }
    return true;
  }
  if (code === 'results') return true;

  const questions = sectionsQuestions[code];
  for (const q of questions) {
    if (!q.required) continue;
    const a = answers[q.key];
    if (!a || a.skipped) {
      alert(`Please answer: "${q.text}"`);
      return false;
    }
    if (q.type === 'text' && !a.text) {
      alert(`Please answer: "${q.text}"`);
      return false;
    }
    if (q.type === 'multi' && (!a.selected || a.selected.length === 0)) {
      alert(`Please answer: "${q.text}"`);
      return false;
    }
    if ((q.type === 'scale5' || q.type === 'scale_text' || q.type === 'yn_text') && a.index == null) {
      alert(`Please answer: "${q.text}"`);
      return false;
    }
  }
  return true;
}

function buildSubmission(results) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    contact: { ...contact },
    answers: JSON.parse(JSON.stringify(answers)),
    results,
  };
}

function saveSubmission(submission) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  all.push(submission);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function updateNavButtons(code) {
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  backBtn.style.visibility = pageIndex === 0 ? 'hidden' : 'visible';
  if (code === 'results') {
    nextBtn.style.display = 'none';
    backBtn.style.display = 'none';
  } else {
    nextBtn.style.display = 'inline-block';
    backBtn.style.display = 'inline-block';
    const isLastSection = pages[pageIndex + 1] === 'results';
    nextBtn.textContent = isLastSection ? 'Finish & See Results' : 'Next';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('btn-back').addEventListener('click', () => {
    if (pageIndex > 0) {
      pageIndex -= 1;
      renderPage();
    }
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    if (!validateCurrentPage()) return;
    pageIndex += 1;
    if (pages[pageIndex] === 'results') {
      const results = computeResults(surveyData.questions, answers);
      const submission = buildSubmission(results);
      saveSubmission(submission);
      renderPage();
      window.CyberGraphCsv.download(surveyData.questions, submission);
    } else {
      renderPage();
    }
  });
});
