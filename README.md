# CyberGraph AI — CSV Survey App

A standalone, fully static HTML/JS version of the CyberGraph AI cybersecurity
posture survey. All **67 questions** from `CyberGraph_Survey_Questions.xlsx`
are included, with the same NIST-CSF-pillar risk scoring used elsewhere in
this repo. On completion, each respondent's browser downloads a CSV with
their contact info, full answers, and risk score — no backend or database
required.

This is intentionally separate from `CyberGraph-SurveyWebApp/cybergraph-survey/`
(the full FastAPI + React + Postgres build) — a lightweight alternative for
when you just need something you can host anywhere for free and get a CSV
out of, without running a server.

## How it works

```
CyberGraph-SurveyWebApp/cybergraph-survey/CyberGraph_Survey_Questions.xlsx
                  |  (tools/build_questions.py)
                  v
            js/questions.json  (67 questions, sections A-I, NIST pillars)
                  |
                  v
   index.html + js/app.js   — 9-section wizard + contact-info page
                  |
      js/scoring.js  — per-question risk (0-1) -> weighted 0-100 overall
      and per-pillar (GOVERN/IDENTIFY/PROTECT/DETECT/RESPOND/RECOVER) scores
                  |
      js/csv.js  — builds one CSV row (contact + key answers + all 67
      raw answers as a JSON blob column) and triggers a browser download
                  |
                  v
   history.html + js/history.js  — lists past submissions (this browser only)
```

## Running locally

No build step — serve the folder statically:

```bash
cd csv-survey-app
python3 -m http.server 8080
```

Open http://localhost:8080/index.html.

## Regenerating questions.json

If `CyberGraph_Survey_Questions.xlsx` changes, rebuild `js/questions.json`:

```bash
cd csv-survey-app
pip install -r tools/requirements.txt
python3 tools/build_questions.py
```

By default this reads the xlsx from the sibling
`../CyberGraph-SurveyWebApp/cybergraph-survey/CyberGraph_Survey_Questions.xlsx`.
Pass an explicit path as the first argument to use a different file.

Note: `tools/build_questions.py` contains a hardcoded `YES_IS_RISK` map for
the 18 yes/no questions (whether answering "Yes" is good or bad for that
specific question — e.g. "Yes" to *"Is SOAR implemented?"* is good, but
"Yes" to *"Is alert fatigue a significant challenge?"* is bad). If new
yes/no questions are added to the spreadsheet, add their polarity to that
map or they'll default to "No is the risky answer."

## What's in the CSV

Each download has one header row and one data row:

`submission_id, timestamp, full_name, email, company, job_title, phone, sector, org_size, tool_count, compliance_frameworks, cloud_platforms, virtualisation, overall_risk_score, risk_label, govern_score, identify_score, protect_score, detect_score, respond_score, recover_score, all_answers_json`

- The first columns are contact info plus the six core Organisation Profile
  answers (sector, size, tool count, compliance, cloud, virtualisation) —
  the fields most useful for quick filtering/sorting in Excel.
- `overall_risk_score` (0-100) and `risk_label` (Low / Medium / High) are the
  headline results; the six pillar scores break it down further.
- `all_answers_json` is a JSON blob with every one of the 67 questions and
  the respondent's answer, for full fidelity without a 67-column-wide sheet.

## Important limitations

**CSV is per-respondent, not a shared master file.** Because this is a fully
static site with no backend, each completed survey downloads its own CSV to
that respondent's device. There is no single combined spreadsheet of every
submission automatically — if you need that, either:
- collect the downloaded CSVs manually (e.g. ask respondents to email them
  back) and concatenate them (they all share the same header row), or
- add a small backend that appends each submission to one shared file/DB —
  ask if you want this built; it's a moderate addition to `js/app.js`
  (POST the submission instead of / in addition to downloading the CSV).

**History is per-browser.** `history.html` reads from this browser's
`localStorage` only — it won't show submissions made on other devices.

**Single-vs-multi-select simplification.** The source spreadsheet marks all
checkbox/radio-style questions as response type `multi` without distinguishing
single-choice from select-all-that-apply. This app renders every `multi`
question as checkboxes (0+ selections) uniformly — the scoring formula
(average of selected option indices) is correct either way, but a question
intended as single-choice will let a respondent pick more than one option.

## Deploying (GitHub Pages — free)

```bash
cd csv-survey-app
git init
git add .
git commit -m "Initial CyberGraph CSV survey app"
git branch -M main
git remote add origin https://github.com/<you>/cybergraph-csv-survey.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source → Deploy from a branch**, choose
`main` and `/ (root)`. Live at `https://<you>.github.io/cybergraph-csv-survey/`.

Netlify, Vercel, or Cloudflare Pages work equally well (drag-and-drop the
folder or connect the repo for auto-deploy) if you'd rather not use GitHub
Pages.

## File overview

```
csv-survey-app/
  tools/build_questions.py   Python: xlsx -> js/questions.json
  tools/requirements.txt     Python deps (openpyxl)
  js/questions.json          generated: all 67 questions, sections, pillars
  js/scoring.js              risk scoring (ported from CyberGraph Survey.html)
  js/csv.js                  builds + downloads the CSV for a submission
  js/app.js                  9-section wizard, contact page, results page
  js/history.js              submission history list (localStorage)
  css/style.css               styling (light/dark aware)
  index.html                  the survey wizard
  history.html                submission history page
```
