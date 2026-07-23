const STORAGE_KEY = 'cybergraph_submissions';
const { computeResults, riskLabel, recommendations } = window.CyberGraphScoring;

let surveyData = null; // { title, sections, pillars, questions }
let sectionsQuestions = {}; // code -> [questions]
let pages = []; // ['contact', 'A', 'B', ..., 'results']
let pageIndex = 0;
let answers = {}; // key -> answer object
let contact = {
  fullName: '',
  email: '',
  company: '',
  jobTitle: '',
  country: '',
  phone: '',
  linkedin: '',
  anonymous: false,
  consent: false,
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

let initError = null;
const initPromise = init();

async function init() {
  try {
    const res = await fetch('js/questions.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading js/questions.json`);
    surveyData = await res.json();

    surveyData.sections.forEach((s) => {
      sectionsQuestions[s.code] = surveyData.questions.filter((q) => q.section === s.code);
    });
    pages = ['contact', ...surveyData.sections.map((s) => s.code), 'results'];
  } catch (e) {
    initError = e;
  }
}

function renderInitError() {
  document.getElementById('progress-label').textContent = '';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('btn-back').style.display = 'none';
  document.getElementById('btn-next').style.display = 'none';
  document.getElementById('page-container').innerHTML = `
    <div class="question">
      <p class="question-text">Could not load the survey questions.</p>
      <p class="question-why">
        This usually means the page was opened directly as a file (a "file://" URL) instead of
        through a web server, which browsers block for security reasons. Serve this folder over
        HTTP instead — for example: <code>python3 -m http.server 8080</code> — then open
        <code>http://localhost:8080/index.html</code>. This also resolves correctly once hosted
        on GitHub Pages or any other static host.
      </p>
      <p class="question-why">Details: ${escapeHtml(initError ? initError.message : 'unknown error')}</p>
    </div>
  `;
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

function questionField(q, number) {
  const answer = answers[q.key] || {};
  const requiredMark = q.required ? '<span class="required">*</span>' : '';
  const skipMark = !q.required && q.allowSkip ? `<button type="button" class="btn-skip" data-key="${q.key}">Skip</button>` : '';
  const infoIcon = q.why
    ? `<span class="info-icon" tabindex="0" role="button" aria-label="Why we ask this">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11.5"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span class="info-tooltip">${escapeHtml(q.why)}</span>
      </span>`
    : '';
  let inputHtml = '';

  if (q.type === 'text') {
    inputHtml = `<textarea class="qa-input" data-key="${q.key}" data-kind="text" rows="2">${escapeHtml(answer.text || '')}</textarea>`;
  } else if (q.type === 'multi') {
    inputHtml = q.options
      .map((opt, i) => {
        const checked = (answer.selected || []).includes(i) ? 'checked' : '';
        return `<label class="choice"><input type="checkbox" class="qa-input" data-kind="multi" data-key="${q.key}" data-index="${i}" ${checked}><span class="choice-text">${escapeHtml(opt)}</span></label>`;
      })
      .join('');
  } else {
    // scale5, scale_text, yn_text -> single-select radio list
    inputHtml = q.options
      .map((opt, i) => {
        const checked = answer.index === i ? 'checked' : '';
        return `<label class="choice"><input type="radio" class="qa-input" data-kind="single" name="${q.key}" data-key="${q.key}" data-index="${i}" ${checked}><span class="choice-text">${escapeHtml(opt)}</span></label>`;
      })
      .join('');
  }

  const skippedClass = answer.skipped ? 'skipped' : '';
  return `
    <div class="question ${skippedClass}" data-question-key="${q.key}">
      <div class="question-head">
        <p class="question-text"><span class="q-number">${number}</span>${escapeHtml(q.text)} ${requiredMark}${infoIcon}</p>
        ${skipMark}
      </div>
      <div class="question-input">${inputHtml}</div>
      ${answer.skipped ? '<p class="skipped-note">Skipped</p>' : ''}
    </div>
  `;
}

const SECTION_ICON_PATHS = {
  domain: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01"/>',
  security: '<path d="M12 2 4 5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V5z"/><path d="m9 12 2 2 4-4"/>',
  hub: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M9.5 17 11 12M14.5 17 13 12"/>',
  architecture: '<path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"/>',
  backup: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
  visibility: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  emergency: '<path d="M12 9v4M12 17h.01"/><path d="m4.5 19 7-13a1.7 1.7 0 0 1 3 0l7 13a1.7 1.7 0 0 1-1.5 2.5h-14A1.7 1.7 0 0 1 4.5 19Z"/>',
  science: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M8 15h8"/>',
  insights: '<path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/>',
};

function sectionIconSvg(iconName) {
  const paths = SECTION_ICON_PATHS[iconName] || SECTION_ICON_PATHS.domain;
  return `<svg class="section-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function renderSectionPage(code) {
  const section = surveyData.sections.find((s) => s.code === code);
  const questions = sectionsQuestions[code];
  return `
    <h2 class="section-title">${sectionIconSvg(section.icon)}${escapeHtml(section.name)}</h2>
    ${questions.map((q, i) => questionField(q, i + 1)).join('')}
  `;
}

function renderContactPage() {
  const isAnon = contact.anonymous;

  const personalFieldsHtml = `
    <div class="field">
      <label>Full Name <span class="required">*</span></label>
      <input type="text" id="c-fullName" placeholder="Jane Smith" value="${escapeHtml(contact.fullName)}">
    </div>
    <div class="field">
      <label>Work Email <span class="required">*</span></label>
      <input type="email" id="c-email" placeholder="jane@example.com" value="${escapeHtml(contact.email)}">
    </div>
    <div class="field">
      <label>Organisation <span class="required">*</span></label>
      <input type="text" id="c-company" placeholder="Acme Corp" value="${escapeHtml(contact.company)}">
    </div>
    <div class="field-row">
      <div class="field">
        <label>Job Title</label>
        <input type="text" id="c-jobTitle" placeholder="CISO" value="${escapeHtml(contact.jobTitle)}">
      </div>
      <div class="field">
        <label>Country</label>
        <input type="text" id="c-country" placeholder="United Kingdom" value="${escapeHtml(contact.country)}">
      </div>
    </div>
    <div class="field">
      <label>Phone</label>
      <input type="text" id="c-phone" placeholder="+44 7700 900000" value="${escapeHtml(contact.phone)}">
    </div>
    <div class="field">
      <label>LinkedIn URL</label>
      <input type="text" id="c-linkedin" placeholder="https://linkedin.com/in/..." value="${escapeHtml(contact.linkedin)}">
    </div>
  `;

  return `
    <h2>Start your assessment</h2>
    <p class="section-intro">Fill in your details to receive a personalised report, or enable anonymous mode to skip all personal fields.</p>

    <div class="toggle-card">
      <label class="toggle-switch">
        <input type="checkbox" id="c-anonymous" ${isAnon ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <div class="toggle-copy">
        <div class="toggle-label-row">
          <span class="toggle-label">Participate anonymously</span>
          ${isAnon ? '<span class="badge-active">Active</span>' : ''}
        </div>
        <p class="toggle-hint">${
          isAnon
            ? 'Your name, email, and contact details will not be collected.'
            : 'Enable to hide all personal information from your submission.'
        }</p>
      </div>
    </div>

    ${isAnon ? '' : personalFieldsHtml}

    <div class="consent-card">
      <label class="consent-row">
        <input type="checkbox" id="c-consent" ${contact.consent ? 'checked' : ''}>
        <span>
          I understand my answers are processed entirely in this browser to generate my risk report —
          nothing is sent to a server. A CSV file with my answers${isAnon ? '' : ' and contact details'}
          will be downloaded to my device when I finish.
        </span>
      </label>
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

  if (code === 'contact') {
    const anonToggle = document.getElementById('c-anonymous');
    anonToggle.addEventListener('change', () => {
      if (!contact.anonymous) {
        // capture whatever was typed before switching into anonymous mode
        contact.fullName = document.getElementById('c-fullName').value.trim();
        contact.email = document.getElementById('c-email').value.trim();
        contact.company = document.getElementById('c-company').value.trim();
        contact.jobTitle = document.getElementById('c-jobTitle').value.trim();
        contact.country = document.getElementById('c-country').value.trim();
        contact.phone = document.getElementById('c-phone').value.trim();
        contact.linkedin = document.getElementById('c-linkedin').value.trim();
      }
      contact.consent = document.getElementById('c-consent').checked;
      contact.anonymous = anonToggle.checked;
      if (contact.anonymous) {
        contact.fullName = '';
        contact.email = '';
        contact.company = '';
        contact.jobTitle = '';
        contact.country = '';
        contact.phone = '';
        contact.linkedin = '';
      }
      renderPage();
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
    contact.anonymous = document.getElementById('c-anonymous').checked;
    contact.consent = document.getElementById('c-consent').checked;

    if (!contact.anonymous) {
      contact.fullName = document.getElementById('c-fullName').value.trim();
      contact.email = document.getElementById('c-email').value.trim();
      contact.company = document.getElementById('c-company').value.trim();
      contact.jobTitle = document.getElementById('c-jobTitle').value.trim();
      contact.country = document.getElementById('c-country').value.trim();
      contact.phone = document.getElementById('c-phone').value.trim();
      contact.linkedin = document.getElementById('c-linkedin').value.trim();

      if (!contact.fullName || !contact.email || !contact.company) {
        alert('Please fill in your name, work email, and organisation before continuing.');
        return false;
      }
    }

    if (!contact.consent) {
      alert('Please confirm the consent checkbox before continuing.');
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
  nextBtn.classList.remove('btn-full');

  if (code === 'results') {
    nextBtn.style.display = 'none';
    backBtn.style.display = 'none';
    return;
  }

  nextBtn.style.display = 'inline-block';

  if (code === 'contact' && contact.anonymous) {
    backBtn.style.display = 'none';
    nextBtn.textContent = 'Start Anonymous Survey';
    nextBtn.classList.add('btn-full');
  } else {
    backBtn.style.display = pageIndex === 0 ? 'none' : 'inline-block';
    const isLastSection = pages[pageIndex + 1] === 'results';
    nextBtn.textContent = isLastSection ? 'Finish & See Results' : 'Next';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('btn-start-survey');

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Loading…';
    await initPromise;
    startBtn.disabled = false;
    startBtn.textContent = 'Start Survey';

    document.getElementById('landing-view').hidden = true;
    document.getElementById('wizard-view').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (initError) renderInitError();
    else renderPage();
  });

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
