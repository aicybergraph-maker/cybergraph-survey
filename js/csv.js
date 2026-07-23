// Builds and downloads the per-respondent CSV: contact info, overall risk
// score, per-pillar scores, key org-profile answers, and every raw answer.
window.CyberGraphCsv = (function () {
  const CORE_COLUMNS = [
    'submission_id',
    'timestamp',
    'full_name',
    'email',
    'company',
    'job_title',
    'phone',
    'sector',
    'org_size',
    'tool_count',
    'compliance_frameworks',
    'cloud_platforms',
    'virtualisation',
    'overall_risk_score',
    'risk_label',
    'govern_score',
    'identify_score',
    'protect_score',
    'detect_score',
    'respond_score',
    'recover_score',
    'all_answers_json',
  ];

  function csvEscape(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  function answerText(question, answer) {
    if (!answer || answer.skipped) return '';
    if (question.type === 'text') return answer.text || '';
    if (question.type === 'multi') {
      return (answer.selected || []).map((i) => question.options[i]).join('; ');
    }
    return answer.index != null ? question.options[answer.index] : '';
  }

  function findAnswerText(questions, answers, key) {
    const q = questions.find((x) => x.key === key);
    if (!q) return '';
    return answerText(q, answers[key]);
  }

  function pillarScore(pillars, name) {
    const p = pillars.find((x) => x.pillar === name);
    return p && p.score != null ? p.score : '';
  }

  function buildRow(questions, submission) {
    const { contact, answers, results } = submission;
    const allAnswers = {};
    questions.forEach((q) => {
      allAnswers[q.key] = { question: q.text, answer: answerText(q, answers[q.key]) };
    });

    const row = {
      submission_id: submission.id,
      timestamp: submission.timestamp,
      full_name: contact.fullName,
      email: contact.email,
      company: contact.company,
      job_title: contact.jobTitle,
      phone: contact.phone,
      sector: findAnswerText(questions, answers, 'q1_sector'),
      org_size: findAnswerText(questions, answers, 'q2_org_size'),
      tool_count: findAnswerText(questions, answers, 'q3_tool_count'),
      compliance_frameworks: findAnswerText(questions, answers, 'q4_compliance_frameworks'),
      cloud_platforms: findAnswerText(questions, answers, 'q5_cloud_platforms'),
      virtualisation: findAnswerText(questions, answers, 'q6_virtualisation'),
      overall_risk_score: results.overall,
      risk_label: window.CyberGraphScoring.riskLabel(results.overall),
      govern_score: pillarScore(results.pillars, 'GOVERN'),
      identify_score: pillarScore(results.pillars, 'IDENTIFY'),
      protect_score: pillarScore(results.pillars, 'PROTECT'),
      detect_score: pillarScore(results.pillars, 'DETECT'),
      respond_score: pillarScore(results.pillars, 'RESPOND'),
      recover_score: pillarScore(results.pillars, 'RECOVER'),
      all_answers_json: JSON.stringify(allAnswers),
    };
    return row;
  }

  function toCsv(questions, submission) {
    const row = buildRow(questions, submission);
    const header = CORE_COLUMNS.join(',');
    const line = CORE_COLUMNS.map((col) => csvEscape(row[col])).join(',');
    return header + '\n' + line + '\n';
  }

  function download(questions, submission) {
    const csv = toCsv(questions, submission);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (submission.contact.company || submission.contact.fullName || 'respondent').replace(
      /[^a-z0-9]/gi,
      '_'
    );
    a.href = url;
    a.download = `cybergraph_survey_${safeName}_${submission.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { CORE_COLUMNS, buildRow, toCsv, download, answerText };
})();
