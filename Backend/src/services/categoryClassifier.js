/**
 * Rule-based clinical category classifier.
 *
 * Takes a chief complaint + symptom list (and optional age/known conditions)
 * and returns a category, a confidence score, and a list of alternative
 * categories the dispatcher should be aware of.
 *
 * Why rule-based first: it's deterministic, fast, demoable without internet,
 * and survives a Gemini outage. The AI gateway can later refine this output,
 * but the spine works without it.
 *
 * Categories must match the enum on Incident.category.
 */

// Keyword → category weight map.
// Each keyword votes with a numeric weight; the category with the highest
// total wins. Confidence = winnerScore / (winnerScore + secondScore + 1).
const KEYWORDS = {
  cardiac: [
    ["chest pain", 5],
    ["heart attack", 6],
    ["mi", 4],
    ["myocardial", 6],
    ["palpitation", 3],
    ["angina", 5],
    ["tachycardia", 3],
    ["bradycardia", 3],
    ["arrhythmia", 4],
    ["cardiac arrest", 7],
    ["chest tightness", 4],
    ["pressure in chest", 4],
    ["radiating arm", 4],
    ["sweating chest", 3],
    ["jaw pain", 2],
    ["heart", 2],
  ],
  stroke: [
    ["stroke", 7],
    ["facial droop", 6],
    ["one side weakness", 6],
    ["arm weakness", 4],
    ["slurred speech", 6],
    ["aphasia", 5],
    ["sudden numbness", 4],
    ["tia", 4],
    ["fast positive", 5],
    ["cant speak", 4],
    ["confusion sudden", 3],
  ],
  trauma: [
    ["accident", 4],
    ["road accident", 6],
    ["rta", 5],
    ["fall from height", 5],
    ["bleeding", 3],
    ["fracture", 4],
    ["head injury", 5],
    ["broken", 3],
    ["stab", 6],
    ["gunshot", 7],
    ["crushed", 5],
    ["amputation", 6],
    ["impaled", 6],
    ["car crash", 6],
    ["bike crash", 5],
    ["unconscious accident", 6],
    ["polytrauma", 7],
  ],
  neuro: [
    ["seizure", 5],
    ["convulsion", 5],
    ["unconscious", 3],
    ["altered mental", 4],
    ["headache severe", 4],
    ["worst headache", 5],
    ["meningitis", 5],
    ["loss of consciousness", 4],
    ["fits", 4],
  ],
  respiratory: [
    ["shortness of breath", 4],
    ["sob", 3],
    ["cant breathe", 5],
    ["choking", 5],
    ["wheezing", 3],
    ["asthma", 4],
    ["copd", 4],
    ["pneumonia", 4],
    ["respiratory arrest", 7],
    ["difficulty breathing", 4],
    ["gasping", 4],
  ],
  obstetric: [
    ["labor", 6],
    ["delivery", 5],
    ["pregnant", 5],
    ["water broke", 6],
    ["contractions", 5],
    ["postpartum", 5],
    ["miscarriage", 5],
    ["bleeding pregnant", 6],
  ],
  pediatric: [
    ["child", 3],
    ["infant", 4],
    ["baby", 4],
    ["newborn", 5],
    ["toddler", 3],
    ["high fever child", 4],
  ],
  burn: [
    ["burn", 5],
    ["fire", 3],
    ["scald", 4],
    ["electrocuted", 5],
    ["chemical burn", 5],
    ["explosion", 5],
  ],
};

// Categories that should win even if other categories tie, when severity is
// time-critical. Used to break ties.
const TIME_CRITICAL_PRIORITY = [
  "cardiac",
  "stroke",
  "trauma",
  "respiratory",
  "neuro",
];

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Classify an incident by category.
 *
 * @param {object} input
 * @param {string} input.chiefComplaint
 * @param {string[]} [input.symptoms]
 * @param {number} [input.age]
 * @param {object} [input.knownConditions]
 * @returns {{ category: string, confidence: number, alternatives: string[], scores: object }}
 */
export const classifyCategory = ({
  chiefComplaint,
  symptoms = [],
  age,
  knownConditions = {},
}) => {
  const haystack = [
    normalize(chiefComplaint),
    ...symptoms.map(normalize),
  ].join(" ");

  const scores = {};
  for (const cat of Object.keys(KEYWORDS)) {
    scores[cat] = 0;
  }

  for (const [cat, kws] of Object.entries(KEYWORDS)) {
    for (const [kw, weight] of kws) {
      if (haystack.includes(kw)) {
        scores[cat] += weight;
      }
    }
  }

  // Age + history boosts
  if (typeof age === "number") {
    if (age <= 12) scores.pediatric += 4;
    if (age >= 60) {
      // Older adults with chest/stroke symptoms: nudge cardiac/stroke up.
      if (scores.cardiac > 0) scores.cardiac += 1;
      if (scores.stroke > 0) scores.stroke += 1;
    }
  }
  if (knownConditions?.cardiacHistory && scores.cardiac > 0) {
    scores.cardiac += 2;
  }

  // Pick winner. Ties go to the time-critical priority list.
  const ranked = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const ai = TIME_CRITICAL_PRIORITY.indexOf(a[0]);
      const bi = TIME_CRITICAL_PRIORITY.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  if (ranked.length === 0) {
    return {
      category: "general",
      confidence: 0.4,
      alternatives: [],
      scores,
    };
  }

  const [winnerCat, winnerScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  const confidence = Math.min(
    0.99,
    winnerScore / (winnerScore + secondScore + 1)
  );

  return {
    category: winnerCat,
    confidence: Number(confidence.toFixed(2)),
    alternatives: ranked.slice(1, 4).map(([c]) => c),
    scores,
  };
};

/**
 * Suggest the ambulance type (ALS vs BLS) for a given category + age.
 * High-acuity categories default to ALS; everything else BLS unless symptoms
 * suggest otherwise.
 */
export const suggestAmbulanceType = (category) => {
  if (
    ["cardiac", "stroke", "trauma", "respiratory", "neuro"].includes(category)
  ) {
    return "ALS";
  }
  return "BLS";
};

/**
 * Suggest priority (HIGH/MEDIUM/LOW) from category + classifier confidence.
 * The dispatcher can override this.
 */
export const suggestPriority = (category, confidence) => {
  if (
    ["cardiac", "stroke", "trauma", "respiratory"].includes(category) &&
    confidence >= 0.5
  ) {
    return "HIGH";
  }
  if (["neuro", "obstetric", "burn"].includes(category) && confidence >= 0.5) {
    return "HIGH";
  }
  if (category === "general" || confidence < 0.4) {
    return "MEDIUM";
  }
  return "MEDIUM";
};
