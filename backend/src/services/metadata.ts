/**
 * Heuristic extraction of student name, roll/certificate number,
 * and institution from OCR-extracted certificate text.
 *
 * No single pattern fits every certificate layout, so this tries
 * (in order): explicit award phrases → labelled fields →
 * positional fallback (name-like line above the course details).
 */

export interface ExtractedMetadata {
  studentName?: string;
  rollNumber?: string;
  institution?: string;
}

const clean = (s: string): string =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s:,\-–—;."'()]+|[\s:,\-–—;."'()]+$/g, "")
    .trim();

const BANNED_NAME_HINTS = [
  "certificate",
  "complet", // completion/completed/completing
  "course",
  "univers",
  "college",
  "institut",
  "school",
  "academ",
  "udemy",
  "coursera",
  "hereby",
  "certif", // certify/certifies
  "congratul",
  "success",
  "curricul",
  "program",
  "train",
  "syllabus",
  "instruct",
  "limited",
  "private",
  "signature",
  "director",
  "grade",
  "percent",
];

function looksLikeName(raw: string): boolean {
  const t = clean(raw);
  if (t.length < 3 || t.length > 60) return false;
  if (/\d/.test(t)) return false; // real names have no digits
  if (!/^[A-Za-z][A-Za-z .'\-]*$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 6) return false;
  const lower = t.toLowerCase();
  if (BANNED_NAME_HINTS.some((b) => lower.includes(b))) return false;
  return true;
}

const STOP = String.raw`(?=\s+has\s+|\s+have\s+|\s+for\s+|\s+on\s+|\s+in\s+|\s+completed|\s+successfully|$)`;

const NAME_PATTERNS: RegExp[] = [
  // "This is to certify that JOHN SMITH has successfully completed ..."
  new RegExp(
    `(?:this is to )?certify that\\s+([A-Za-z][A-Za-z .\\-']{2,60}?)${STOP}`,
    "i"
  ),
  // "Awarded to / Presented to / Issued to JOHN SMITH ..."
  new RegExp(
    `(?:awarded|presented|issued|granted|conferred)\\s+to\\s+([A-Za-z][A-Za-z .\\-']{2,60}?)${STOP}`,
    "i"
  ),
  // "Recipient Name: JOHN SMITH" / "Student: John Smith"
  new RegExp(
    `(?:recipient|student|candidate|awardee|learner)(?:\\s+name)?\\s*[:\\-]\\s*([A-Za-z][A-Za-z .\\-']{2,60}?)${STOP}`,
    "i"
  ),
];

function extractStudentName(text: string): string | undefined {
  const flat = text.replace(/\s+/g, " ");

  for (const pattern of NAME_PATTERNS) {
    const match = flat.match(pattern);
    if (match?.[1] && looksLikeName(match[1])) {
      return clean(match[1]);
    }
  }

  // Generic "Name: ..." label — require 2+ words to avoid "Course Name: Python"
  const labelled = flat.match(
    /\bname\s*[:\-]\s*([A-Za-z][A-Za-z .'\-]{4,60})/i
  );
  if (
    labelled?.[1] &&
    labelled[1].trim().split(/\s+/).length >= 2 &&
    looksLikeName(labelled[1])
  ) {
    return clean(labelled[1]);
  }

  // Positional fallback: a standalone name-like line (2–4 words)
  // above the course/completion details. Recipient names are almost
  // always printed before the course description.
  const lines = text
    .split("\n")
    .map(clean)
    .filter(Boolean);
  let scope = lines;
  const markerIdx = lines.findIndex((l) =>
    /complet|success|course|curricul|program|train|syllabus/i.test(l)
  );
  if (markerIdx > 0) scope = lines.slice(0, markerIdx);

  const candidates = scope
    .filter((l) => {
      const words = l.split(/\s+/);
      return words.length >= 2 && words.length <= 4 && looksLikeName(l);
    })
    .sort((a, b) => b.length - a.length);

  return candidates[0] ? clean(candidates[0]) : undefined;
}

const PLATFORMS: Array<[RegExp, string]> = [
  [/linkedin\s+learning/i, "LinkedIn Learning"],
  [/great\s+learning/i, "Great Learning"],
  [/infosys\s+springboard/i, "Infosys Springboard"],
  [/\budemy\b/i, "Udemy"],
  [/\bcoursera\b/i, "Coursera"],
  [/\bedx\b/i, "edX"],
  [/\budacity\b/i, "Udacity"],
  [/\bsimplilearn\b/i, "Simplilearn"],
  [/\bskillshare\b/i, "Skillshare"],
  [/\bupgrad\b/i, "upGrad"],
  [/\bnptel\b/i, "NPTEL"],
  [/\bswayam\b/i, "SWAYAM"],
  [/\bcodecademy\b/i, "Codecademy"],
  [/\bpluralsight\b/i, "Pluralsight"],
  [/\bdatacamp\b/i, "DataCamp"],
];

function extractInstitution(text: string): string | undefined {
  // Online course platforms first (most common for course certificates)
  for (const [re, label] of PLATFORMS) {
    if (re.test(text)) return label;
  }

  // "X University / College / Institute ..." — capture only the words
  // leading up to the keyword, never the trailing course description.
  const lines = text
    .split("\n")
    .map(clean)
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(
      /([A-Za-z][\w .&'\-]{0,50}?\s+(?:university|college|institute|academy|school|organisation|organization|foundation))/i
    );
    if (m?.[1]) return clean(m[1]);
  }

  // "Issued by X" / "Offered by X" / "Authorized by X"
  const issued = text.match(
    /(?:issued|offered|authorized|accredited|provided)\s+by\s+([^\n,;]{2,60})/i
  );
  if (issued?.[1]) {
    const candidate = clean(issued[1]);
    if (candidate.length >= 3 && !/\d/.test(candidate)) return candidate;
  }

  return undefined;
}

const ROLL_PATTERNS: RegExp[] = [
  /roll[^:\n]{0,12}[:#\-]\s*([\w\d\-/]+)/i,
  /reg(?:istration)?[^:\n]{0,14}[:#\-]\s*([\w\d\-/]+)/i,
  /certificate[^:\n]{0,14}[:#\-]\s*([\w\d\-/]+)/i,
  /\bid[^:\n]{0,10}[:#\-]\s*([\w\d\-/]+)/i,
];

function extractRollNumber(text: string): string | undefined {
  const flat = text.replace(/\s+/g, " ");
  for (const pattern of ROLL_PATTERNS) {
    const match = flat.match(pattern);
    if (match?.[1]) {
      const candidate = clean(match[1]);
      // Roll/certificate numbers almost always contain a digit
      if (
        candidate.length >= 3 &&
        candidate.length <= 30 &&
        /\d/.test(candidate)
      ) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function extractMetadata(text: string): ExtractedMetadata {
  return {
    studentName: extractStudentName(text),
    rollNumber: extractRollNumber(text),
    institution: extractInstitution(text),
  };
}
