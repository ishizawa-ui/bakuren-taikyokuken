export const BOARD_COLUMNS = 8;
export const BOARD_ROWS = 5;
export const BASE_ENEMY_HP = 45_000;

const ENEMY_PROFILES = [
  { name: "ヨロヨロ拳法家", rank: "見習い", visual: "novice", accent: "#d54837", hue: 0, scale: 1 },
  { name: "カチコチ拳法家", rank: "鉄壁の使い手", visual: "guard", accent: "#3d8fbe", hue: 168, scale: 1.04 },
  { name: "イライラ拳法家", rank: "猛攻の達人", visual: "rage", accent: "#e65d23", hue: 332, scale: 1.08 },
  { name: "グラグラ拳豪", rank: "奥義継承者", visual: "master", accent: "#8d53bd", hue: 58, scale: 1.12 },
  { name: "無極の太極魔王", rank: "気の支配者", visual: "demon", accent: "#d12b52", hue: 214, scale: 1.16 },
];

export function getRoundConfig(round) {
  const safeRound = Math.max(1, Math.floor(round));
  const profile = ENEMY_PROFILES[Math.min(safeRound - 1, ENEMY_PROFILES.length - 1)];
  const isBeyondFinalProfile = safeRound > ENEMY_PROFILES.length;
  return {
    ...profile,
    name: isBeyondFinalProfile ? `${profile.name}・${safeRound - 4}式` : profile.name,
    rank: isBeyondFinalProfile ? `${profile.rank} Lv.${safeRound}` : profile.rank,
    round: safeRound,
    maxHp: Math.round(BASE_ENEMY_HP * (1.45 ** (safeRound - 1))),
    turns: Math.max(9, 15 - Math.floor((safeRound - 1) / 2)),
    strikeEvery: Math.max(2, 5 - Math.floor((safeRound - 1) / 2)),
    counterDamage: safeRound >= 7 ? 2 : 1,
  };
}

export const ORB_META = {
  wind: { label: "風の気：", effect: "技ゲージを2倍チャージ", src: "/assets/orb-wind.png" },
  water: { label: "水の気：", effect: "敵にダメージ", src: "/assets/orb-water.png" },
  fire: { label: "火の気：", effect: "大きなダメージ", src: "/assets/orb-fire.png" },
  shadow: { label: "影の気：", effect: "妨害ブロックを破壊", src: "/assets/orb-shadow.png" },
  heart: { label: "癒しの気：", effect: "HPを回復", src: "/assets/orb-heart.png" },
  rock: { label: "岩ブロック", effect: "", src: "/assets/orb-rock.png" },
};

export const BASE_GAUGE_PER_ORB = 5;
export const WIND_GAUGE_PER_ORB = BASE_GAUGE_PER_ORB * 2;

export function calculateGaugeGain(type, chainLength) {
  const safeLength = Math.max(0, Math.floor(Number(chainLength) || 0));
  const perOrb = type === "wind" ? WIND_GAUGE_PER_ORB : BASE_GAUGE_PER_ORB;
  return safeLength * perOrb + Math.max(0, safeLength - 3) * 2;
}

const TYPES = ["wind", "water", "fire", "shadow", "heart"];
let seed = 0x5f3759df;

function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4_294_967_296;
}

function randomOrb() {
  return TYPES[Math.floor(random() * TYPES.length)];
}

export function hasPlayableChain(board) {
  const visited = new Set();
  for (let start = 0; start < board.length; start += 1) {
    if (visited.has(start) || board[start] === "rock") continue;
    const type = board[start];
    const stack = [start];
    let connected = 0;
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop();
      connected += 1;
      const neighbors = [current - 1, current + 1, current - BOARD_COLUMNS, current + BOARD_COLUMNS];
      neighbors.forEach((neighbor) => {
        if (
          neighbor >= 0
          && neighbor < board.length
          && !visited.has(neighbor)
          && isAdjacent(current, neighbor)
          && board[neighbor] === type
        ) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      });
    }

    if (connected >= 3) return true;
  }
  return false;
}

function shuffle(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export function reshuffleBoard(board) {
  const movableIndexes = [];
  const movableValues = [];
  board.forEach((type, index) => {
    if (type === "rock") return;
    movableIndexes.push(index);
    movableValues.push(type);
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = [...board];
    const shuffled = shuffle(movableValues);
    movableIndexes.forEach((index, valueIndex) => { candidate[index] = shuffled[valueIndex]; });
    if (hasPlayableChain(candidate)) return candidate;
  }

  const guaranteed = [...board];
  const counts = new Map();
  movableValues.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  const guaranteedType = [...counts].find(([, count]) => count >= 3)?.[0] ?? "wind";
  const movableSet = new Set(movableIndexes);
  let targetIndexes = null;
  for (let index = 0; index < board.length; index += 1) {
    const horizontal = [index, index + 1, index + 2];
    const vertical = [index, index + BOARD_COLUMNS, index + BOARD_COLUMNS * 2];
    if (index % BOARD_COLUMNS <= BOARD_COLUMNS - 3 && horizontal.every((target) => movableSet.has(target))) {
      targetIndexes = horizontal;
      break;
    }
    if (vertical.every((target) => movableSet.has(target))) {
      targetIndexes = vertical;
      break;
    }
  }
  if (!targetIndexes) return guaranteed;

  targetIndexes.forEach((targetIndex, lockedPosition) => {
    if (guaranteed[targetIndex] === guaranteedType) return;
    const lockedTargets = new Set(targetIndexes.slice(0, lockedPosition + 1));
    const sourceIndex = movableIndexes.find((index) => !lockedTargets.has(index) && guaranteed[index] === guaranteedType);
    if (sourceIndex === undefined) return;
    [guaranteed[targetIndex], guaranteed[sourceIndex]] = [guaranteed[sourceIndex], guaranteed[targetIndex]];
  });
  return guaranteed;
}

export function createBoard() {
  const initial = Array.from({ length: BOARD_COLUMNS * BOARD_ROWS }, randomOrb);
  [5, 15, 16, 21, 28, 36].forEach((index) => { initial[index] = "rock"; });
  return hasPlayableChain(initial) ? initial : reshuffleBoard(initial);
}

export function isAdjacent(from, to) {
  if (from === undefined || to === undefined) return false;
  const fromRow = Math.floor(from / BOARD_COLUMNS);
  const fromColumn = from % BOARD_COLUMNS;
  const toRow = Math.floor(to / BOARD_COLUMNS);
  const toColumn = to % BOARD_COLUMNS;
  return Math.abs(fromRow - toRow) + Math.abs(fromColumn - toColumn) === 1;
}

export function resolveBoard(board, chain, type) {
  const removed = new Set(chain);
  if (type === "shadow") {
    chain.forEach((index) => {
      const neighbors = [index - 1, index + 1, index - BOARD_COLUMNS, index + BOARD_COLUMNS];
      neighbors.forEach((neighbor) => {
        if (neighbor >= 0 && neighbor < board.length && isAdjacent(index, neighbor) && board[neighbor] === "rock") removed.add(neighbor);
      });
    });
  }

  const next = [...board];
  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    const survivors = [];
    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      const index = row * BOARD_COLUMNS + column;
      if (!removed.has(index)) survivors.push(next[index]);
    }
    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      next[row * BOARD_COLUMNS + column] = survivors[BOARD_ROWS - 1 - row] ?? randomOrb();
    }
  }
  return { board: next };
}
