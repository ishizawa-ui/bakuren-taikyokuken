import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_ENEMY_HP,
  calculateGaugeGain,
  createBoard,
  getRoundConfig,
  hasPlayableChain,
  reshuffleBoard,
} from "../src/game.js";

const DEAD_BOARD = Array.from({ length: 40 }, (_, index) => {
  const row = Math.floor(index / 8);
  const column = index % 8;
  return (row + column) % 2 === 0 ? "wind" : "water";
});

test("new boards always contain a chain of at least three", () => {
  for (let run = 0; run < 50; run += 1) {
    assert.equal(hasPlayableChain(createBoard()), true);
  }
});

test("dead boards are detected", () => {
  assert.equal(hasPlayableChain(DEAD_BOARD), false);
});

test("reshuffling a dead board guarantees a legal chain without changing its pieces", () => {
  const shuffled = reshuffleBoard(DEAD_BOARD);
  assert.equal(hasPlayableChain(shuffled), true);
  assert.deepEqual([...shuffled].sort(), [...DEAD_BOARD].sort());
});

test("every cleared round increases enemy HP", () => {
  const rounds = Array.from({ length: 10 }, (_, index) => getRoundConfig(index + 1));
  assert.equal(rounds[0].maxHp, BASE_ENEMY_HP);
  rounds.slice(1).forEach((config, index) => assert.ok(config.maxHp > rounds[index].maxHp));
});

test("later rivals tighten turns and counterattacks with sensible floors", () => {
  const first = getRoundConfig(1);
  const fifth = getRoundConfig(5);
  const tenth = getRoundConfig(10);
  assert.deepEqual({ turns: first.turns, strikeEvery: first.strikeEvery, counterDamage: first.counterDamage }, { turns: 15, strikeEvery: 5, counterDamage: 1 });
  assert.ok(fifth.turns < first.turns);
  assert.ok(fifth.strikeEvery < first.strikeEvery);
  assert.deepEqual({ turns: tenth.turns, strikeEvery: tenth.strikeEvery, counterDamage: tenth.counterDamage }, { turns: 11, strikeEvery: 2, counterDamage: 2 });
});

test("the first five rounds introduce distinct stronger rivals", () => {
  const names = Array.from({ length: 5 }, (_, index) => getRoundConfig(index + 1).name);
  assert.equal(new Set(names).size, 5);
  assert.match(getRoundConfig(6).name, /2式/);
});

test("yellow wind orbs charge twice the base technique gauge", () => {
  ["water", "fire", "shadow", "heart"].forEach((type) => {
    assert.equal(calculateGaugeGain(type, 3), 15);
  });
  assert.equal(calculateGaugeGain("wind", 3), 30);
  assert.equal(calculateGaugeGain("wind", 6), 66);
  assert.equal(calculateGaugeGain("fire", 6), 36);
});
