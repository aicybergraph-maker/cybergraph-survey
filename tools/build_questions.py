"""Convert CyberGraph_Survey_Questions.xlsx (Questions sheet, all 67 rows) into
js/questions.json for the static survey app.

Usage:
    python3 build_questions.py <path-to-xlsx> [output.json]

Defaults to reading from the sibling CyberGraph-SurveyWebApp project's xlsx
if no path is given, and writing to ../js/questions.json.
"""
import json
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required. Install with: pip install openpyxl")

DEFAULT_XLSX = (
    Path(__file__).resolve().parent.parent.parent
    / "CyberGraph-SurveyWebApp"
    / "cybergraph-survey"
    / "CyberGraph_Survey_Questions.xlsx"
)

SECTION_ICONS = {
    "A": "domain",
    "B": "security",
    "C": "hub",
    "D": "architecture",
    "E": "backup",
    "F": "visibility",
    "G": "emergency",
    "H": "science",
    "I": "insights",
}

# For yn_text questions with a nonzero scoring weight: whether answering
# "Yes" indicates a *risk* (bad) or a *control in place* (good, so "No" is
# the risk). Sourced from reading each question's intent. Questions with
# weight 0 (concept-validation / market-research) are not scored, so their
# polarity here is irrelevant.
YES_IS_RISK = {
    "q9_soar": False,
    "q10_xdr": False,
    "q12_dlp": False,
    "q13_dspm": False,
    "q17_asset_mgmt": False,
    "q20_cspm": False,
    "q21_tip": False,
    "q25_missed_detection_incident": True,
    "q30_microsegmentation": False,
    "q34_attack_coverage": False,
    "q35_backup_isolation": False,
    "q36_backup_malware_scanning": False,
    "q38_ire_availability": False,
    "q39_immutable_storage": False,
    "q45_alert_fatigue": True,
    "q50_rca_process": False,
    "q60_design_partner_interest": False,
    "q64_incident_experience": True,
}


def parse_options(raw):
    if not raw or str(raw).strip().startswith("(free text"):
        return []
    lines = str(raw).split("\n")
    options = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # strip a leading "N. " ordinal prefix
        parts = line.split(". ", 1)
        options.append(parts[1] if len(parts) == 2 and parts[0].isdigit() else line)
    return options


def main():
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    dest = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else Path(__file__).resolve().parent.parent / "js" / "questions.json"
    )

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["Questions"]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    print("Columns:", header)

    sections_seen = {}
    questions = []

    for row in rows[1:]:
        (
            position, key, section, section_name, pillar, text, why, cgai_note,
            resp_type, is_required, allow_skip, weight, startup_critical,
            options_raw, option_count,
        ) = row

        if not key:
            continue

        if section not in sections_seen:
            sections_seen[section] = section_name

        question = {
            "key": key,
            "section": section,
            "sectionName": section_name,
            "pillar": pillar,
            "text": text,
            "why": why or "",
            "type": resp_type,
            "required": bool(is_required),
            "allowSkip": bool(allow_skip),
            "weight": float(weight) if weight else 0,
            "options": parse_options(options_raw),
        }
        if resp_type == "yn_text":
            question["yesIsRisk"] = YES_IS_RISK.get(key, False)

        questions.append(question)

    sections = [
        {"code": code, "name": name, "icon": SECTION_ICONS.get(code, "quiz")}
        for code, name in sections_seen.items()
    ]
    pillars = ["GOVERN", "IDENTIFY", "PROTECT", "DETECT", "RESPOND", "RECOVER"]

    payload = {
        "title": "CyberGraph AI — Cybersecurity Posture Survey",
        "sections": sections,
        "pillars": pillars,
        "questions": questions,
    }

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(questions)} questions across {len(sections)} sections to {dest}")


if __name__ == "__main__":
    main()
