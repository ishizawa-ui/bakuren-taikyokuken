import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SCORE_RECORDS,
  SCORE_RECORDS_KEY,
  addScoreRecord,
  createScoreRecord,
  formatRecordDate,
  loadScoreRecords,
  persistScoreRecords,
  rankScoreRecords,
} from "../src/records.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("ranking keeps only the ten strongest runs", () => {
  const records = Array.from({ length: 14 }, (_, index) => ({
    id: `run-${index}`,
    round: index + 1,
    score: index * 1_000,
    achievedAt: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
  }));
  const ranked = rankScoreRecords(records);
  assert.equal(ranked.length, MAX_SCORE_RECORDS);
  assert.equal(ranked[0].score, 13_000);
  assert.equal(ranked.at(-1).score, 4_000);
});

test("ties are ordered by reached round and then newest date", () => {
  const ranked = rankScoreRecords([
    { id: "old", round: 3, score: 9_000, achievedAt: "2026-08-01T00:00:00.000Z" },
    { id: "deep", round: 5, score: 9_000, achievedAt: "2026-07-01T00:00:00.000Z" },
    { id: "new", round: 3, score: 9_000, achievedAt: "2026-08-02T00:00:00.000Z" },
  ]);
  assert.deepEqual(ranked.map((record) => record.id), ["deep", "new", "old"]);
});

test("records persist and corrupted storage fails safely", () => {
  const storage = createMemoryStorage();
  const record = createScoreRecord(4, 12_345, new Date("2026-08-17T09:00:00.000Z"));
  persistScoreRecords(addScoreRecord([], record), storage);
  assert.deepEqual(loadScoreRecords(storage), [record]);

  const corrupted = createMemoryStorage({ [SCORE_RECORDS_KEY]: "not-json" });
  assert.deepEqual(loadScoreRecords(corrupted), []);
  assert.equal(formatRecordDate(record.achievedAt), "2026/08/17");
});
