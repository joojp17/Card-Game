type SoundName = "tick" | "win" | "newRound" | "judge";

let audioContext: AudioContext | null = null;

export function unlockAudio() {
  const context = getAudioContext();
  void context.resume();
}

export function playSound(name: SoundName) {
  const context = getAudioContext();

  if (context.state === "suspended") {
    return;
  }

  if (name === "tick") {
    playTone(context, 880, 0.05, "square", 0.035);
    return;
  }

  if (name === "judge") {
    playMelody(context, [440, 660, 880], 0.09, "triangle", 0.055);
    return;
  }

  if (name === "newRound") {
    playMelody(context, [523, 659, 784], 0.1, "sine", 0.05);
    return;
  }

  playMelody(context, [784, 988, 1175, 1568], 0.11, "triangle", 0.06);
}

function getAudioContext() {
  audioContext ??= new AudioContext();
  return audioContext;
}

function playMelody(context: AudioContext, notes: number[], noteLength: number, type: OscillatorType, volume: number) {
  notes.forEach((frequency, index) => {
    playTone(context, frequency, noteLength, type, volume, index * noteLength * 0.86);
  });
}

function playTone(
  context: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}
