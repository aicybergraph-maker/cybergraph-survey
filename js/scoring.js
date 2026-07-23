// NIST-pillar risk scoring, ported from the CyberGraph AI survey's scoring
// logic (see CyberGraph Survey.html / surveyDataJs). All 67 questions score
// 0 (no risk) to 1 (max risk) per answer; weighted averages roll up to
// per-pillar, per-section, and an overall 0-100 risk score.
window.CyberGraphScoring = (function () {
  const YN_RISK = { Yes: 0.1, Partially: 0.5, No: 0.9, 'N/A': 0.5 };

  function scoreQuestion(q, answer) {
    if (!answer || answer.skipped) return null;
    if (q.type === 'text') return null;
    if (q.type === 'scale5' || q.type === 'scale_text') {
      if (answer.index == null) return null;
      return q.options.length > 1 ? answer.index / (q.options.length - 1) : 0.5;
    }
    if (q.type === 'yn_text') {
      if (answer.index == null) return null;
      const label = q.options[answer.index];
      let risk = YN_RISK[label] ?? 0.5;
      if (q.yesIsRisk) risk = label === 'Yes' ? 0.9 : label === 'No' ? 0.1 : risk;
      return risk;
    }
    if (q.type === 'multi') {
      if (!answer.selected || answer.selected.length === 0) return null;
      const avgIdx = answer.selected.reduce((a, b) => a + b, 0) / answer.selected.length;
      return q.options.length > 1 ? avgIdx / (q.options.length - 1) : 0.5;
    }
    return null;
  }

  function computeResults(questions, answers) {
    let wSum = 0;
    let wRisk = 0;
    const pillarAgg = {};
    const sectionAgg = {};

    for (const q of questions) {
      if (!q.weight) continue;
      const risk = scoreQuestion(q, answers[q.key]);
      if (risk == null) continue;
      wSum += q.weight;
      wRisk += q.weight * risk;
      if (q.pillar !== 'ALL') {
        const p = (pillarAgg[q.pillar] = pillarAgg[q.pillar] || { w: 0, r: 0 });
        p.w += q.weight;
        p.r += q.weight * risk;
      }
      const s = (sectionAgg[q.section] = sectionAgg[q.section] || { w: 0, r: 0, name: q.sectionName });
      s.w += q.weight;
      s.r += q.weight * risk;
    }

    const overall = wSum > 0 ? Math.round((wRisk / wSum) * 100) : 0;
    const pillars = ['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'].map((p) => ({
      pillar: p,
      score: pillarAgg[p] ? Math.round((pillarAgg[p].r / pillarAgg[p].w) * 100) : null,
    }));
    const sections = Object.keys(sectionAgg).map((code) => ({
      code,
      name: sectionAgg[code].name,
      score: Math.round((sectionAgg[code].r / sectionAgg[code].w) * 100),
    }));

    return { overall, pillars, sections };
  }

  function riskLabel(score) {
    if (score >= 67) return 'High';
    if (score >= 34) return 'Medium';
    return 'Low';
  }

  const RECOMMENDATIONS = {
    GOVERN:
      'Formalize board-level security reporting and adopt quantitative risk modelling (e.g. FAIR) to meet emerging disclosure requirements like the SEC four-day rule.',
    IDENTIFY:
      'Close asset and vulnerability visibility gaps — consolidate CAASM, CSPM, and vulnerability data so nothing in your environment is unaccounted for.',
    PROTECT:
      'Strengthen identity, network, and data-loss controls; audit privileged access and DLP coverage across cloud and on-prem estates.',
    DETECT:
      'Reduce alert fatigue and validate SIEM/EDR coverage — aim for 100% endpoint coverage and a triage workflow that surfaces true positives.',
    RESPOND:
      'Run scenario-specific incident response tabletop exercises, including ransomware, and mandate Root-Cause-Analysis before any restore.',
    RECOVER:
      'Test full failover or cleanroom recovery at least annually and ensure backup data is scanned for malware before restoration.',
  };

  function recommendations(pillars) {
    return pillars
      .filter((p) => p.score != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((p) => ({ pillar: p.pillar, score: p.score, text: RECOMMENDATIONS[p.pillar] }));
  }

  return { scoreQuestion, computeResults, riskLabel, recommendations };
})();
