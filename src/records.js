export const SCORE_RECORDS_KEY = "bakuren-taikyoku:score-records:v1";
export const MAX_SCORE_RECORDS = 10;
const RECORD_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function asNonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const achievedAt = new Date(record.achievedAt);
  if (Number.isNaN(achievedAt.getTime())) return null;
  const round = Math.max(1, asNonNegativeInteger(record.round, 1));
  const score = asNonNegativeInteger(record.score);
  return {
    id: typeof record.id === "string" && record.id ? record.id : `${achievedAt.toISOString()}-${round}-${score}`,
    round,
    score,
    achievedAt: achievedAt.toISOString(),
  };
}

export function rankScoreRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map(normalizeRecord)
    .filter(Boolean)
    .sort((left, right) => (
      right.score - left.score
      || right.round - left.round
      || Date.parse(right.achievedAt) - Date.parse(left.achievedAt)
    ))
    .slice(0, MAX_SCORE_RECORDS);
}

export function createScoreRecord(round, score, now = new Date()) {
  const achievedAt = now.toISOString();
  const safeRound = Math.max(1, asNonNegativeInteger(round, 1));
  const safeScore = asNonNegativeInteger(score);
  const randomId = globalThis.crypto?.randomUUID?.();
  return {
    id: randomId ?? `${achievedAt}-${safeRound}-${safeScore}`,
    round: safeRound,
    score: safeScore,
    achievedAt,
  };
}

export function addScoreRecord(records, record) {
  return rankScoreRecords([...(Array.isArray(records) ? records : []), record]);
}

export function loadScoreRecords(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const saved = storage.getItem(SCORE_RECORDS_KEY);
    return saved ? rankScoreRecords(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

export function persistScoreRecords(records, storage = globalThis.localStorage) {
  const ranked = rankScoreRecords(records);
  if (!storage) return ranked;
  try {
    storage.setItem(SCORE_RECORDS_KEY, JSON.stringify(ranked));
  } catch {
    // The game remains playable when storage is unavailable or full.
  }
  return ranked;
}

export function formatRecordDate(achievedAt) {
  return RECORD_DATE_FORMATTER.format(new Date(achievedAt));
}
