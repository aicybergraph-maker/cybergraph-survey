const STORAGE_KEY = 'cybergraph_submissions';
const { riskLabel } = window.CyberGraphScoring;

let questions = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function loadSubmissions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

function renderTable() {
  const submissions = loadSubmissions();
  const tbody = document.getElementById('history-body');
  const empty = document.getElementById('empty-state');
  tbody.innerHTML = '';

  if (submissions.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  submissions.forEach((sub) => {
    const label = riskLabel(sub.results.overall);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(sub.timestamp).toLocaleString()}</td>
      <td>${escapeHtml(sub.contact.fullName)}</td>
      <td>${escapeHtml(sub.contact.company)}</td>
      <td>${sub.results.overall} <span class="score-tag risk-${label.toLowerCase()}">${label}</span></td>
      <td>
        <button class="btn-view" data-id="${sub.id}">View</button>
        <button class="btn-download" data-id="${sub.id}">Download CSV</button>
        <button class="btn-delete" data-id="${sub.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const detail = document.getElementById('detail-section');
  const detailBody = document.getElementById('detail-body');

  tbody.querySelectorAll('.btn-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = submissions.find((s) => s.id === btn.dataset.id);
      const pillarRows = sub.results.pillars
        .filter((p) => p.score != null)
        .map((p) => `<div class="result-row"><div class="result-q">${p.pillar}</div><div class="result-a">${p.score}</div></div>`)
        .join('');
      detailBody.innerHTML = `
        <p><b>Email:</b> ${escapeHtml(sub.contact.email)} &nbsp; <b>Job title:</b> ${escapeHtml(sub.contact.jobTitle || '—')}</p>
        <h4>Pillar scores</h4>
        ${pillarRows}
      `;
      detail.hidden = false;
      detail.scrollIntoView({ behavior: 'smooth' });
    });
  });

  tbody.querySelectorAll('.btn-download').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = submissions.find((s) => s.id === btn.dataset.id);
      window.CyberGraphCsv.download(questions, sub);
    });
  });

  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this submission?')) return;
      const all = loadSubmissions().filter((s) => s.id !== btn.dataset.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      renderTable();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('js/questions.json', { cache: 'no-store' });
  const data = await res.json();
  questions = data.questions;
  renderTable();
});
