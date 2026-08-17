const BGM_MELODY = [
  293.66, 329.63, 392, 440, 392, 329.63, 293.66, 246.94,
  261.63, 293.66, 349.23, 392, 349.23, 293.66, 261.63, 220,
];

let context = null;
let musicBus = null;
let effectsBus = null;
let bgmTimer = null;
let bgmStep = 0;
let bgmRequested = false;

function getContext() {
  if (context) return context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  const master = context.createGain();
  musicBus = context.createGain();
  effectsBus = context.createGain();
  master.gain.value = 0.72;
  musicBus.gain.value = 0.045;
  effectsBus.gain.value = 0.2;
  musicBus.connect(master);
  effectsBus.connect(master);
  master.connect(context.destination);
  return context;
}

function scheduleTone({
  frequency,
  endFrequency = frequency,
  duration = 0.12,
  gain = 0.16,
  offset = 0,
  type = "sine",
  destination = "effects",
}) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + offset;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.025, duration * 0.22));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(destination === "music" ? musicBus : effectsBus);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function scheduleNoise(duration = 0.2, gain = 0.12, offset = 0, frequency = 480) {
  const audio = getContext();
  if (!audio) return;
  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  const start = audio.currentTime + offset;
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(effectsBus);
  source.start(start);
}

function resumeAudio() {
  const audio = getContext();
  if (audio && audio.state !== "running") void audio.resume().catch(() => {});
  return audio;
}

function clearBgmTimer() {
  if (bgmTimer) window.clearInterval(bgmTimer);
  bgmTimer = null;
}

function activateBgm(audio) {
  if (!bgmRequested || !audio || audio.state !== "running") return false;
  if (bgmTimer) return true;
  musicBus.gain.cancelScheduledValues(audio.currentTime);
  musicBus.gain.setTargetAtTime(0.045, audio.currentTime, 0.04);
  playBgmStep();
  bgmTimer = window.setInterval(playBgmStep, 300);
  return true;
}

async function ensureAudioRunning(audio) {
  if (!audio) return false;
  if (audio.state === "running") return true;
  try {
    await audio.resume();
    return audio.state === "running";
  } catch {
    return false;
  }
}

function playBgmStep() {
  if (!context || !musicBus) return;
  const frequency = BGM_MELODY[bgmStep % BGM_MELODY.length];
  scheduleTone({ frequency, endFrequency: frequency * 1.01, duration: 0.26, gain: 0.16, type: "triangle", destination: "music" });
  if (bgmStep % 4 === 0) {
    scheduleTone({ frequency: frequency / 2, duration: 0.55, gain: 0.12, type: "sine", destination: "music" });
  }
  bgmStep += 1;
}

export function startBgm(enabled) {
  bgmRequested = enabled;
  if (!enabled) return;
  const audio = getContext();
  if (!audio || bgmTimer) return;
  if (audio.state === "running") {
    activateBgm(audio);
    return;
  }
  void ensureAudioRunning(audio).then((running) => {
    if (running) activateBgm(audio);
  });
}

export function stopBgm() {
  bgmRequested = false;
  clearBgmTimer();
  if (context && musicBus) musicBus.gain.setTargetAtTime(0.0001, context.currentTime, 0.035);
}

export function pauseBgmForPage() {
  clearBgmTimer();
  if (context && musicBus) musicBus.gain.setTargetAtTime(0.0001, context.currentTime, 0.025);
}

export async function resumeBgmAfterPageReturn(enabled) {
  bgmRequested = enabled;
  if (!enabled) return false;
  clearBgmTimer();
  const audio = getContext();
  if (!(await ensureAudioRunning(audio))) return false;
  return activateBgm(audio);
}

export function playLinkSound(length, enabled) {
  if (!enabled) return;
  resumeAudio();
  scheduleTone({ frequency: 280 + length * 34, endFrequency: 315 + length * 38, duration: 0.075, gain: 0.12, type: "sine" });
}

export function playOrbAttackSound(type, chainLength, enabled) {
  if (!enabled) return;
  resumeAudio();
  const force = Math.min(0.28, 0.16 + chainLength * 0.014);
  if (type === "wind") {
    scheduleTone({ frequency: 390, endFrequency: 920, duration: 0.42, gain: force, type: "triangle" });
    scheduleNoise(0.32, 0.09);
  } else if (type === "water") {
    scheduleTone({ frequency: 260, endFrequency: 620, duration: 0.5, gain: force, type: "sine" });
    scheduleTone({ frequency: 520, endFrequency: 340, duration: 0.38, gain: 0.1, offset: 0.08, type: "triangle" });
  } else if (type === "fire") {
    scheduleTone({ frequency: 190, endFrequency: 72, duration: 0.44, gain: force, type: "sawtooth" });
    scheduleNoise(0.42, 0.18);
  } else if (type === "shadow") {
    [0, 0.09, 0.18].forEach((offset, index) => scheduleTone({ frequency: 210 + index * 75, endFrequency: 120, duration: 0.12, gain: force * 0.75, offset, type: "square" }));
  } else {
    [523.25, 659.25, 783.99].forEach((frequency, index) => scheduleTone({ frequency, duration: 0.3, gain: 0.12, offset: index * 0.08, type: "sine" }));
  }
}

export function playTechniqueSound(index, enabled) {
  if (!enabled) return;
  resumeAudio();
  if (index === 0) {
    scheduleNoise(0.32, 0.045, 0, 1_700);
    scheduleTone({ frequency: 349.23, endFrequency: 698.46, duration: 0.42, gain: 0.11, type: "sine" });
    [523.25, 659.25, 783.99].forEach((frequency, note) => {
      scheduleTone({ frequency, endFrequency: frequency * 1.08, duration: 0.28, gain: 0.09, offset: 0.08 + note * 0.065, type: "triangle" });
    });
    return;
  }

  if (index === 1) {
    scheduleNoise(0.42, 0.085, 0.03, 1_150);
    [220, 277.18, 329.63].forEach((frequency, note) => {
      scheduleTone({ frequency, endFrequency: frequency * 1.55, duration: 0.31, gain: 0.15, offset: note * 0.085, type: "triangle" });
    });
    scheduleTone({ frequency: 659.25, endFrequency: 987.77, duration: 0.38, gain: 0.15, offset: 0.24, type: "square" });
    return;
  }

  scheduleNoise(0.62, 0.12, 0.02, 920);
  [196, 293.66, 440].forEach((frequency, note) => {
    scheduleTone({ frequency, endFrequency: frequency * 2.35, duration: 0.62, gain: 0.17 + note * 0.025, offset: note * 0.055, type: note === 1 ? "sine" : "triangle" });
  });
  [523.25, 659.25, 783.99, 1_046.5].forEach((frequency, note) => {
    scheduleTone({ frequency, endFrequency: frequency * 1.12, duration: 0.34, gain: 0.12, offset: 0.3 + note * 0.045, type: "triangle" });
  });
  scheduleTone({ frequency: 174.61, endFrequency: 98, duration: 0.3, gain: 0.24, offset: 0.38, type: "triangle" });
  scheduleNoise(0.24, 0.18, 0.38, 620);
}

export function playReshuffleSound(enabled) {
  if (!enabled) return;
  [440, 554.37, 659.25].forEach((frequency, index) => scheduleTone({ frequency, duration: 0.16, gain: 0.11, offset: index * 0.09, type: "triangle" }));
}

export function playCounterSound(enabled) {
  if (!enabled) return;
  scheduleTone({ frequency: 150, endFrequency: 65, duration: 0.26, gain: 0.24, type: "square" });
  scheduleNoise(0.2, 0.14);
}

export function playVictorySound(enabled) {
  if (!enabled) return;
  [392, 493.88, 587.33, 783.99].forEach((frequency, index) => scheduleTone({ frequency, duration: 0.32, gain: 0.15, offset: index * 0.12, type: "triangle" }));
}

export function playDefeatSound(enabled) {
  if (!enabled) return;
  [293.66, 246.94, 196, 146.83].forEach((frequency, index) => scheduleTone({ frequency, endFrequency: frequency * 0.92, duration: 0.38, gain: 0.13, offset: index * 0.14, type: "sine" }));
}

export function playRoundStartSound(enabled) {
  if (!enabled) return;
  [220, 329.63, 440].forEach((frequency, index) => scheduleTone({ frequency, endFrequency: frequency * 1.08, duration: 0.28, gain: 0.14, offset: index * 0.1, type: "triangle" }));
}
