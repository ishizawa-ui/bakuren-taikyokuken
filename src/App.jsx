import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowsClockwise,
  Crown,
  Heart,
  House,
  LockSimple,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  X,
  YinYang,
} from "@phosphor-icons/react";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  ORB_META,
  calculateGaugeGain,
  createBoard,
  getRoundConfig,
  hasPlayableChain,
  isAdjacent,
  reshuffleBoard,
  resolveBoard,
} from "./game.js";
import {
  playCounterSound,
  playDefeatSound,
  playLinkSound,
  playOrbAttackSound,
  playReshuffleSound,
  playRoundStartSound,
  playTechniqueSound,
  playVictorySound,
  pauseBgmForPage,
  resumeBgmAfterPageReturn,
  startBgm,
  stopBgm,
} from "./audio.js";
import { HomeScreen } from "./HomeScreen.jsx";
import { addScoreRecord, createScoreRecord, loadScoreRecords, persistScoreRecords } from "./records.js";

const TECHNIQUES = [
  {
    name: "雲 手",
    reading: "ウンシュウ",
    description: "敵全体に中ダメージ！",
    cost: 30,
    damage: 6_800,
    className: "cloud",
    callout: "柔らかく、重く。流れで攻める！",
  },
  {
    name: "野馬分鬣",
    reading: "ヤバブンソウ",
    description: "敵に大ダメージ！",
    cost: 65,
    damage: 12_500,
    className: "horse",
    callout: "野馬の勢いで、一気に駆け抜ける！",
  },
  {
    name: "太極爆発",
    reading: "タイキョクバクハツ",
    description: "敵に超特大ダメージ！",
    cost: 100,
    damage: 24_000,
    className: "burst",
    callout: "陰陽ひとつ、ぜんぶ整える！",
  },
];

const ORB_ATTACKS = {
  wind: { label: "旋風掌！", detail: "風の気" },
  water: { label: "流雲推手！", detail: "水の気" },
  fire: { label: "爆炎靠！", detail: "火の気" },
  shadow: { label: "残影掌！", detail: "影の気" },
  heart: { label: "ほっこり気功！", detail: "癒しの気" },
};

const FIRST_ROUND = getRoundConfig(1);

function GameHeader({ score, turns, round, paused, soundOn, audioStarted, onPause, onSound }) {
  return (
    <header className="game-header">
      <div className="brand" aria-label="爆連！太極拳">
        <div className="brand-main">
          <span>爆連！</span>
          <strong>太極拳</strong>
          <YinYang weight="fill" aria-hidden="true" />
        </div>
        <p>〜ゆるっと整え！ 爽快パズル道場〜</p>
      </div>

      <div className="header-stats" aria-label="ゲーム情報">
        <div className="stat-card">
          <span>スコア</span>
          <strong>{score.toLocaleString("ja-JP")}</strong>
        </div>
        <div className="stat-card turn-card">
          <span>ターン</span>
          <strong>{turns}</strong>
        </div>
        <div className="stat-card round-card">
          <span>対局</span>
          <strong>第{round}局</strong>
        </div>
      </div>

      <div className="header-actions">
        <button className="square-action" type="button" onClick={onPause} aria-label={paused ? "再開" : "ポーズ"}>
          {paused ? <Play weight="fill" /> : <Pause weight="fill" />}
          <span>{paused ? "再開" : "ポーズ"}</span>
        </button>
        <button
          className={`square-action sound-action ${soundOn ? "is-on" : "is-off"} ${audioStarted ? "is-playing" : ""}`}
          type="button"
          onClick={onSound}
          aria-label={!soundOn ? "BGMとSEを入れる" : audioStarted ? "BGMとSEを切る" : "BGMとSEを開始"}
        >
          {soundOn ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}
          <span>{soundOn ? audioStarted ? "BGM・SE" : "タップで音" : "消音"}</span>
        </button>
      </div>
    </header>
  );
}

function BattleStage({ enemyHp, enemyConfig, impact, effectText, attackScene }) {
  const hpPercent = Math.max(0, (enemyHp / enemyConfig.maxHp) * 100);
  const attackClass = attackScene ? `attack-${attackScene.type}` : "";
  return (
    <section
      className={`battle-stage rival-${enemyConfig.visual} ${impact ? "is-hit" : ""} ${attackClass}`}
      style={{ "--enemy-accent": enemyConfig.accent, "--enemy-hue": `${enemyConfig.hue}deg`, "--enemy-height": `${82 * enemyConfig.scale}%` }}
      aria-label={`第${enemyConfig.round}局 ${enemyConfig.name}とのバトルステージ`}
    >
      <div className="enemy-hud">
        <div className="brush-label">{enemyConfig.name}</div>
        <span className="enemy-rank"><Crown weight="fill" />{enemyConfig.rank}</span>
        <div className="enemy-health" aria-label={`敵のHP ${enemyHp}`}>
          <div className="enemy-health-fill" style={{ width: `${hpPercent}%` }} />
        </div>
        <strong>{enemyHp.toLocaleString("ja-JP")} / {enemyConfig.maxHp.toLocaleString("ja-JP")}</strong>
      </div>

      <div className="speech-bubble">ゆるく構えて、<br />ド派手にキメる！</div>
      <img className="fighter panda" src="/assets/panda-hero.png" alt="太極拳の構えをとるパンダ" />
      <img className="ki-stream" src="/assets/ki-stream.png" alt="" aria-hidden="true" />
      <span className="enemy-aura" aria-hidden="true" />
      <img className="fighter enemy" src="/assets/enemy-yoyoko.png" alt={`${enemyConfig.rank} ${enemyConfig.name}`} />
      {attackScene ? (
        <div className={`orb-attack-visual attack-${attackScene.type}`} key={attackScene.id} aria-hidden="true">
          <img className="attack-wave" src="/assets/ki-stream.png" alt="" />
          <img className="attack-orb" src={ORB_META[attackScene.type].src} alt="" />
          <span className="attack-ring" />
        </div>
      ) : null}
      {attackScene ? (
        <div className={`orb-attack-name attack-${attackScene.type}`} key={`name-${attackScene.id}`} aria-live="polite">
          <small>{ORB_ATTACKS[attackScene.type].detail}</small>
          <strong>{ORB_ATTACKS[attackScene.type].label}</strong>
        </div>
      ) : null}
      {impact ? <div className="damage-pop" aria-live="polite">-{impact.toLocaleString("ja-JP")}</div> : null}
      {effectText ? <div className="effect-callout" aria-live="polite">{effectText}</div> : null}
    </section>
  );
}

function MissionPanel({ enemyConfig }) {
  return (
    <aside className="mission-panel" aria-label="ミッションと気の効果">
      <section>
        <h2 className="brush-label">ミッション</h2>
        <p className="mission-copy">
          <strong>第{enemyConfig.round}局を整えろ！</strong>
          <span>反撃：{enemyConfig.strikeEvery}手ごと{enemyConfig.counterDamage > 1 ? `・${enemyConfig.counterDamage}体力` : ""}</span>
        </p>
      </section>
      <section className="legend-section">
        <h2 className="brush-label">同じ色をつなげると…</h2>
        <ul className="orb-legend">
          {Object.entries(ORB_META).filter(([type]) => type !== "rock").map(([type, orb]) => (
            <li key={type}>
              <img src={orb.src} alt="" />
              <span><strong>{orb.label}</strong>{orb.effect}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function PauseRules({ enemyConfig }) {
  return (
    <details className="pause-rules">
      <summary>
        <YinYang weight="fill" aria-hidden="true" />
        <span>ルールを見る</span>
      </summary>
      <div className="pause-rules-content">
        <section className="pause-rule-section" aria-labelledby="pause-mission-title">
          <h2 id="pause-mission-title">ミッション</h2>
          <p className="pause-rule-mission">
            <strong>第{enemyConfig.round}局を整えろ！</strong>
            <span>反撃：{enemyConfig.strikeEvery}手ごと{enemyConfig.counterDamage > 1 ? `・${enemyConfig.counterDamage}体力` : ""}</span>
          </p>
        </section>
        <section className="pause-rule-section" aria-labelledby="pause-orb-rule-title">
          <h2 id="pause-orb-rule-title">同じ色をつなげると…</h2>
          <ul className="pause-rule-orbs">
            {Object.entries(ORB_META).filter(([type]) => type !== "rock").map(([type, orb]) => (
              <li key={type}>
                <img src={orb.src} alt="" />
                <span><strong>{orb.label}</strong>{orb.effect}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}

function PuzzleBoard({ board, selected, locked, reshuffling, onPointerDown, onPointerMove, onPointerUp }) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  return (
    <div
      className={`puzzle-board ${selected.length > 1 ? "is-linking" : ""}`}
      role="grid"
      aria-label={`${BOARD_COLUMNS}列${BOARD_ROWS}行の気の盤面`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {board.map((type, index) => (
        <button
          className={`orb-cell orb-${type} ${selectedSet.has(index) ? "is-selected" : ""}`}
          data-orb-index={index}
          key={`${index}-${type}`}
          type="button"
          role="gridcell"
          aria-label={`${index + 1}番目 ${ORB_META[type].label}`}
          aria-pressed={selectedSet.has(index)}
          disabled={locked || type === "rock"}
          onPointerDown={(event) => onPointerDown(event, index)}
        >
          <img src={ORB_META[type].src} alt="" draggable="false" />
          {selectedSet.has(index) ? <span className="chain-number">{selected.indexOf(index) + 1}</span> : null}
        </button>
      ))}
      {reshuffling ? (
        <div className="board-reshuffle-overlay" role="status" aria-live="assertive">
          <ArrowsClockwise weight="bold" />
          <strong>気の流れが詰まった！</strong>
          <span>ターンを消費せず、盤面を整え直し中…</span>
        </div>
      ) : null}
    </div>
  );
}

function GaugeBar({ gauge, lives }) {
  return (
    <div className="gauge-row">
      <div className="gauge-shell" aria-label={`技ゲージ ${gauge}%`}>
        <strong>技ゲージ</strong>
        <div className="gauge-track"><div className="gauge-fill" style={{ width: `${gauge}%` }} /></div>
        <b>{gauge}%</b>
      </div>
      <div className="lives" aria-label={`残り体力 ${lives}`}>
        {[0, 1, 2].map((heart) => (
          <Heart key={heart} weight="fill" className={heart < lives ? "is-full" : "is-empty"} />
        ))}
      </div>
    </div>
  );
}

function TechniquePanel({ gauge, onUse, disabled }) {
  return (
    <aside className="technique-panel" aria-label="必殺技">
      <h2 className="brush-label">必殺技</h2>
      <div className="technique-list">
        {TECHNIQUES.map((technique, index) => {
          const locked = gauge < technique.cost;
          return (
            <button
              key={technique.name}
              type="button"
              className={`technique-card ${technique.className} ${locked ? "is-locked" : "is-ready"}`}
              disabled={locked || disabled}
              onClick={() => onUse(index)}
            >
              <span className="technique-art">
                {locked ? <LockSimple weight="fill" /> : <img src="/assets/panda-hero.png" alt="" />}
              </span>
              <span className="technique-copy">
                <strong>{technique.name}</strong>
                <small>{technique.reading}</small>
                <span>{technique.description}</span>
              </span>
              <span className="technique-cost">消費<b>{technique.cost}</b></span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function TechniqueCinematic({ scene, enemyConfig, onSkip }) {
  if (!scene) return null;
  const { technique } = scene;
  const burstOrbs = Object.entries(ORB_META).filter(([type]) => type !== "rock");
  return (
    <div className={`technique-cinematic cinematic-${technique.className}`} role="dialog" aria-modal="true" aria-label={`${technique.name}の演出`}>
      <button className="cinematic-skip" type="button" onClick={onSkip} aria-label="必殺技演出をスキップ">
        <X weight="bold" />
        <span>スキップ</span>
      </button>
      <div className="cinematic-stage">
        <div className="cinematic-ink" />
        <img className={`cinematic-enemy rival-${enemyConfig.visual}`} style={{ "--enemy-hue": `${enemyConfig.hue}deg` }} src="/assets/enemy-yoyoko.png" alt="" aria-hidden="true" />
        <div className="cinematic-panda-wrap">
          <img className="cinematic-panda" src="/assets/panda-hero.png" alt="必殺技を放つパンダ" />
          <span className="cinematic-aura" />
        </div>
        <div className="cinematic-waves" aria-hidden="true">
          <img src="/assets/ki-stream.png" alt="" />
          <img src="/assets/ki-stream.png" alt="" />
        </div>
        {technique.className === "burst" ? (
          <div className="cinematic-orbs" aria-hidden="true">
            {burstOrbs.map(([type, orb], index) => <img key={type} src={orb.src} alt="" style={{ "--orb-index": index }} />)}
          </div>
        ) : null}
        <div className="cinematic-title">
          <span>太極拳奥義</span>
          <strong>{technique.name}！</strong>
          <small>{technique.reading}</small>
          <p>{technique.callout}</p>
        </div>
        <div className="cinematic-impact">整えっ！</div>
      </div>
    </div>
  );
}

function GameOverlay({ status, round, score, nextEnemy, onNextRound, onRestart, onHome }) {
  if (status === "playing") return null;
  const won = status === "won";
  return (
    <div className="game-overlay" role="dialog" aria-modal="true" aria-label={won ? `第${round}局勝利` : "ゲームオーバー"}>
      <div className={`result-card ${won ? "is-victory" : "is-defeat"}`}>
        <span>{won ? `第${round}局 勝利！` : `第${round}局で敗北…`}</span>
        <strong>{won ? "整った〜" : "乱れた〜"}</strong>
        {won ? (
          <div className="next-rival-preview">
            <small>次の強敵</small>
            <b>{nextEnemy.name}</b>
            <span>HP {nextEnemy.maxHp.toLocaleString("ja-JP")}・{nextEnemy.turns}ターン・{nextEnemy.strikeEvery}手ごとに反撃</span>
          </div>
        ) : (
          <>
            <div className="final-record">
              <span>到達</span><strong>第{round}局</strong>
              <span>スコア</span><strong>{score.toLocaleString("ja-JP")}</strong>
            </div>
            <p>この修行記録をランキングに保存しました。</p>
          </>
        )}
        <div className="result-actions">
          <button type="button" onClick={won ? onNextRound : onHome}>
            {won ? <ArrowRight weight="bold" /> : <House weight="fill" />}
            {won ? "次の強敵へ" : "ホームで記録を見る"}
          </button>
          {!won ? (
            <button className="secondary-result-button" type="button" onClick={onRestart}>
              <ArrowCounterClockwise weight="bold" />
              第1局から再挑戦
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState("home");
  const [records, setRecords] = useState(() => loadScoreRecords());
  const [board, setBoard] = useState(() => createBoard());
  const [selected, setSelected] = useState([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [turns, setTurns] = useState(FIRST_ROUND.turns);
  const [movesMade, setMovesMade] = useState(0);
  const [gauge, setGauge] = useState(36);
  const [lives, setLives] = useState(3);
  const [enemyHp, setEnemyHp] = useState(FIRST_ROUND.maxHp);
  const [status, setStatus] = useState("playing");
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [audioStarted, setAudioStarted] = useState(false);
  const [impact, setImpact] = useState(0);
  const [effectText, setEffectText] = useState("");
  const [attackScene, setAttackScene] = useState(null);
  const [techniqueScene, setTechniqueScene] = useState(null);
  const [reshuffling, setReshuffling] = useState(false);
  const draggingRef = useRef(false);
  const selectedRef = useRef([]);
  const animationIdRef = useRef(0);
  const attackTimerRef = useRef(null);
  const techniqueTimerRef = useRef(null);
  const reshuffleTimerRef = useRef(null);
  const terminalTimerRef = useRef(null);
  const runRecordedRef = useRef(false);
  const enemyConfig = getRoundConfig(round);
  const nextEnemyConfig = getRoundConfig(round + 1);
  const isBusy = Boolean(attackScene || techniqueScene || reshuffling);
  const boardLocked = paused || status !== "playing" || isBusy;

  const recordRun = useCallback((finishedRound, finalScore) => {
    if (runRecordedRef.current) return;
    runRecordedRef.current = true;
    const record = createScoreRecord(finishedRound, finalScore);
    setRecords((current) => addScoreRecord(current, record));
  }, []);

  const flashImpact = useCallback((damage, text = "") => {
    setImpact(damage);
    setEffectText(text);
    window.setTimeout(() => setImpact(0), 560);
    window.setTimeout(() => setEffectText(""), 900);
  }, []);

  const triggerOrbAttack = useCallback((type) => {
    window.clearTimeout(attackTimerRef.current);
    animationIdRef.current += 1;
    setAttackScene({ id: animationIdRef.current, type });
    attackTimerRef.current = window.setTimeout(() => setAttackScene(null), 1_150);
  }, []);

  const finishChain = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const chain = selectedRef.current;
    setSelected([]);
    selectedRef.current = [];
    if (chain.length < 3 || status !== "playing" || boardLocked) return;

    const type = board[chain[0]];
    const result = resolveBoard(board, chain, type);
    const multiplier = type === "fire" ? 1.35 : type === "water" ? 1.1 : 1;
    const damage = type === "heart" || type === "wind" ? Math.round(chain.length * 720) : Math.round(chain.length * 1_050 * multiplier);
    const nextHp = Math.max(0, enemyHp - damage);
    const nextTurns = Math.max(0, turns - 1);
    const nextMovesMade = movesMade + 1;
    const gaugeGain = calculateGaugeGain(type, chain.length);
    const nextGauge = Math.min(100, gauge + gaugeGain);
    const nextScore = score + chain.length * chain.length * 115;
    const enemyStrikes = nextHp > 0 && nextTurns > 0 && nextMovesMade % enemyConfig.strikeEvery === 0;
    const healedLives = type === "heart" ? Math.min(3, lives + 1) : lives;
    const nextLives = Math.max(0, healedLives - (enemyStrikes ? enemyConfig.counterDamage : 0));

    const boardIsStuck = !hasPlayableChain(result.board);
    setBoard(result.board);
    setEnemyHp(nextHp);
    setTurns(nextTurns);
    setMovesMade(nextMovesMade);
    setGauge(nextGauge);
    setScore(nextScore);
    setLives(nextLives);
    triggerOrbAttack(type);
    const effectMessage = [
      type === "wind" ? `技ゲージ +${gaugeGain}` : chain.length >= 6 ? `${chain.length}連！` : "",
      enemyStrikes ? "敵の反撃！" : "",
    ].filter(Boolean).join("・");
    flashImpact(damage, effectMessage);
    playOrbAttackSound(type, chain.length, soundOn);
    if (enemyStrikes) playCounterSound(soundOn);

    if (boardIsStuck && nextHp > 0 && nextTurns > 0 && nextLives > 0) {
      setReshuffling(true);
      window.clearTimeout(reshuffleTimerRef.current);
      reshuffleTimerRef.current = window.setTimeout(() => {
        setBoard(reshuffleBoard(result.board));
        setReshuffling(false);
        playReshuffleSound(soundOn);
      }, 1_250);
    }

    window.clearTimeout(terminalTimerRef.current);
    if (nextHp <= 0) {
      terminalTimerRef.current = window.setTimeout(() => {
        setStatus("won");
        playVictorySound(soundOn);
      }, 1_100);
    } else if (nextTurns <= 0 || nextLives <= 0) {
      terminalTimerRef.current = window.setTimeout(() => {
        recordRun(round, nextScore);
        setStatus("lost");
        playDefeatSound(soundOn);
      }, 1_100);
    }
  }, [board, boardLocked, enemyConfig.counterDamage, enemyConfig.strikeEvery, enemyHp, flashImpact, gauge, lives, movesMade, recordRun, round, score, soundOn, status, triggerOrbAttack, turns]);

  const appendToChain = useCallback((index) => {
    const current = selectedRef.current;
    const first = current[0];
    if (first === undefined || board[index] !== board[first] || board[index] === "rock") return;
    const previous = current[current.length - 1];
    if (!isAdjacent(previous, index)) return;
    if (current.length > 1 && current[current.length - 2] === index) {
      const shortened = current.slice(0, -1);
      selectedRef.current = shortened;
      setSelected(shortened);
      return;
    }
    if (current.includes(index)) return;
    const next = [...current, index];
    selectedRef.current = next;
    setSelected(next);
    playLinkSound(next.length, soundOn);
  }, [board, soundOn]);

  const handlePointerDown = (event, index) => {
    if (boardLocked || board[index] === "rock") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    selectedRef.current = [index];
    setSelected([index]);
    playLinkSound(1, soundOn);
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-orb-index]");
    if (!element) return;
    appendToChain(Number(element.dataset.orbIndex));
  };

  const useTechnique = (index) => {
    const technique = TECHNIQUES[index];
    if (gauge < technique.cost || boardLocked) return;
    const nextHp = Math.max(0, enemyHp - technique.damage);
    window.clearTimeout(attackTimerRef.current);
    window.clearTimeout(techniqueTimerRef.current);
    setAttackScene(null);
    setTechniqueScene({ id: ++animationIdRef.current, technique, wins: nextHp <= 0 });
    setGauge((value) => value - technique.cost);
    setEnemyHp(nextHp);
    setScore((value) => value + technique.damage);
    playTechniqueSound(index, soundOn);
    techniqueTimerRef.current = window.setTimeout(() => {
      setTechniqueScene(null);
      flashImpact(technique.damage);
      if (nextHp <= 0) {
        setStatus("won");
        playVictorySound(soundOn);
      }
    }, 2_300);
  };

  const skipTechnique = () => {
    const finishedTechnique = techniqueScene;
    window.clearTimeout(techniqueTimerRef.current);
    setTechniqueScene(null);
    if (finishedTechnique) flashImpact(finishedTechnique.technique.damage);
    if (finishedTechnique?.wins) {
      setStatus("won");
      playVictorySound(soundOn);
    }
  };

  useEffect(() => {
    if (!soundOn) stopBgm();
  }, [soundOn]);

  useEffect(() => {
    const pauseForPageChange = () => {
      if (screen !== "game") return;
      pauseBgmForPage();
      setAudioStarted(false);
    };

    const resumeAfterPageChange = () => {
      if (screen !== "game" || !soundOn || document.visibilityState === "hidden") return;
      void resumeBgmAfterPageReturn(true).then(setAudioStarted);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseForPageChange();
      else resumeAfterPageChange();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pauseForPageChange);
    window.addEventListener("pageshow", resumeAfterPageChange);
    window.addEventListener("focus", resumeAfterPageChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pauseForPageChange);
      window.removeEventListener("pageshow", resumeAfterPageChange);
      window.removeEventListener("focus", resumeAfterPageChange);
    };
  }, [screen, soundOn]);

  useEffect(() => {
    persistScoreRecords(records);
  }, [records]);

  useEffect(() => () => {
    window.clearTimeout(attackTimerRef.current);
    window.clearTimeout(techniqueTimerRef.current);
    window.clearTimeout(reshuffleTimerRef.current);
    window.clearTimeout(terminalTimerRef.current);
    stopBgm();
  }, []);

  const clearTransientState = () => {
    window.clearTimeout(attackTimerRef.current);
    window.clearTimeout(techniqueTimerRef.current);
    window.clearTimeout(reshuffleTimerRef.current);
    window.clearTimeout(terminalTimerRef.current);
    setSelected([]);
    selectedRef.current = [];
    setPaused(false);
    setImpact(0);
    setEffectText("");
    setAttackScene(null);
    setTechniqueScene(null);
    setReshuffling(false);
  };

  const nextRound = () => {
    const targetRound = round + 1;
    const targetConfig = getRoundConfig(targetRound);
    clearTransientState();
    setRound(targetRound);
    setBoard(createBoard());
    setTurns(targetConfig.turns);
    setMovesMade(0);
    setGauge((value) => Math.min(50, value + 10));
    setLives(3);
    setEnemyHp(targetConfig.maxHp);
    setStatus("playing");
    startBgm(soundOn);
    playRoundStartSound(soundOn);
  };

  const toggleSound = () => {
    if (soundOn && !audioStarted) {
      void resumeBgmAfterPageReturn(true).then(setAudioStarted);
      playRoundStartSound(true);
      return;
    }

    const nextSoundOn = !soundOn;
    setSoundOn(nextSoundOn);
    if (nextSoundOn) {
      startBgm(true);
      playRoundStartSound(true);
      setAudioStarted(true);
    } else {
      stopBgm();
      setAudioStarted(false);
    }
  };

  const wakeAudio = (event) => {
    if (event.target.closest?.(".sound-action")) return;
    if (!soundOn) return;
    if (audioStarted) {
      startBgm(true);
      return;
    }
    void resumeBgmAfterPageReturn(true).then(setAudioStarted);
  };

  const startRun = () => {
    clearTransientState();
    runRecordedRef.current = false;
    setBoard(createBoard());
    setScore(0);
    setRound(1);
    setTurns(FIRST_ROUND.turns);
    setMovesMade(0);
    setGauge(36);
    setLives(3);
    setEnemyHp(FIRST_ROUND.maxHp);
    setStatus("playing");
    setScreen("game");
    startBgm(soundOn);
    playRoundStartSound(soundOn);
    setAudioStarted(soundOn);
  };

  const returnHome = () => {
    clearTransientState();
    stopBgm();
    setAudioStarted(false);
    setScreen("home");
  };

  const finishRun = () => {
    if (status !== "playing") return;
    clearTransientState();
    recordRun(round, score);
    setStatus("lost");
    playDefeatSound(soundOn);
  };

  if (screen === "home") return <HomeScreen records={records} onStart={startRun} />;

  return (
    <main className="game-shell" onPointerDownCapture={wakeAudio}>
      <GameHeader
        score={score}
        turns={turns}
        round={round}
        paused={paused}
        soundOn={soundOn}
        audioStarted={audioStarted}
        onPause={() => setPaused((value) => !value)}
        onSound={toggleSound}
      />
      <BattleStage enemyHp={enemyHp} enemyConfig={enemyConfig} impact={impact} effectText={effectText} attackScene={attackScene} />

      <section className="play-area">
        <MissionPanel enemyConfig={enemyConfig} />
        <div className="board-column">
          <PuzzleBoard
            board={board}
            selected={selected}
            locked={boardLocked}
            reshuffling={reshuffling}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishChain}
          />
          <GaugeBar gauge={gauge} lives={lives} />
        </div>
        <TechniquePanel gauge={gauge} onUse={useTechnique} disabled={boardLocked} />
      </section>

      <p className="instruction"><span />同じ色の“気”をつないで整えろ！<span /></p>
      {paused && status === "playing" ? (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="一時停止中">
          <div className="pause-card">
            <Play weight="fill" />
            <strong>呼吸を整え中…</strong>
            <span>修行を続けるか、現在の記録で終了できます。</span>
            <PauseRules enemyConfig={enemyConfig} />
            <div className="pause-actions">
              <button type="button" onClick={() => setPaused(false)}><Play weight="fill" />対局へ戻る</button>
              <button className="pause-end-button" type="button" onClick={finishRun}><House weight="fill" />記録して終了</button>
            </div>
          </div>
        </div>
      ) : null}
      <TechniqueCinematic scene={techniqueScene} enemyConfig={enemyConfig} onSkip={skipTechnique} />
      <GameOverlay
        status={status}
        round={round}
        score={score}
        nextEnemy={nextEnemyConfig}
        onNextRound={nextRound}
        onRestart={startRun}
        onHome={returnHome}
      />
    </main>
  );
}
