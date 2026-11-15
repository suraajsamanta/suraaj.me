/** Self-contained, gesture-unlocked Web Audio. No downloads, autoplay, or shared legacy state. */
export type SoundFrame = { speed: number; throttle: boolean; drift: number; boost: boolean; active: boolean; muted: boolean };
export type RaceSound = ReturnType<typeof createRaceSound>;
export function createRaceSound() {
  let context: AudioContext | undefined, master: GainNode | undefined;
  let engineGain: GainNode, engineFilter: BiquadFilterNode, windGain: GainNode, tireGain: GainNode;
  let low: OscillatorNode, harmonic: OscillatorNode, whine: OscillatorNode;
  let disposed = false, muted = false, visible = true;
  const voices = new Set<AudioScheduledSourceNode>();
  const smooth = (param: AudioParam, value: number, seconds = .06) => param.setTargetAtTime(value, context!.currentTime, seconds);
  function create() {
    if (context || disposed) return;
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context = new Ctor();
    master = context.createGain(); master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -15; limiter.knee.value = 18; limiter.ratio.value = 5;
    master.connect(limiter); limiter.connect(context.destination);
    engineGain = context.createGain(); engineGain.gain.value = 0;
    engineFilter = context.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 450; engineFilter.Q.value = .6;
    engineGain.connect(engineFilter); engineFilter.connect(master);
    low = context.createOscillator(); low.type = 'sawtooth'; low.frequency.value = 48; low.connect(engineGain); low.start();
    harmonic = context.createOscillator(); harmonic.type = 'triangle'; harmonic.frequency.value = 96;
    const overtone = context.createGain(); overtone.gain.value = .42; harmonic.connect(overtone); overtone.connect(engineGain); harmonic.start();
    whine = context.createOscillator(); whine.type = 'sine'; whine.frequency.value = 180;
    const electric = context.createGain(); electric.gain.value = .16; whine.connect(electric); electric.connect(engineGain); whine.start();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const wind = context.createBiquadFilter(); wind.type = 'lowpass'; wind.frequency.value = 680;
    windGain = context.createGain(); windGain.gain.value = 0; noise.connect(wind); wind.connect(windGain); windGain.connect(master);
    const tires = context.createBiquadFilter(); tires.type = 'bandpass'; tires.frequency.value = 1700; tires.Q.value = 1.5;
    tireGain = context.createGain(); tireGain.gain.value = 0; noise.connect(tires); tires.connect(tireGain); tireGain.connect(master); noise.start();
    voices.add(low); voices.add(harmonic); voices.add(whine); voices.add(noise);
  }
  function unlock() {
    if (disposed || !visible) return;
    try { create(); if (context?.state === 'suspended') void context.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  function gesture(event: Event) { if (event.isTrusted) unlock(); }
  window.addEventListener('pointerdown', gesture, { passive: true });
  window.addEventListener('keydown', gesture, { passive: true });
  // A scene can finish loading during the original launch gesture.
  if (navigator.userActivation?.isActive) unlock();
  function tone(frequency: number, duration: number, volume: number, end = frequency, delay = 0, type: OscillatorType = 'sine') {
    if (!context || context.state !== 'running' || muted || !visible || !master) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(master); voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .025);
  }
  return {
    get ready() { return context?.state === 'running'; },
    unlock,
    setVisible(value: boolean) {
      visible = value;
      if (!value && context?.state === 'running') void context.suspend().catch(() => {});
      else if (value && context?.state === 'suspended') void context.resume().catch(() => {});
    },
    update(frame: SoundFrame) {
      muted = frame.muted;
      if (!context || !master || context.state !== 'running') return;
      smooth(master.gain, frame.muted ? 0 : .42, .08);
      const speed = Math.max(0, frame.speed), gear = Math.min(5, Math.floor(speed / 7));
      const rpm = 49 + speed * 2.4 + (speed - gear * 7) * 4.1 + (frame.throttle ? 13 : 0);
      smooth(low.frequency, rpm); smooth(harmonic.frequency, rpm * 2.01); smooth(whine.frequency, rpm * (frame.boost ? 5.2 : 3.2), .13);
      smooth(engineGain.gain, frame.active ? .11 + (frame.throttle ? .09 : .025) + (frame.boost ? .035 : 0) : 0);
      smooth(engineFilter.frequency, 370 + speed * 26 + (frame.throttle ? 330 : 0));
      smooth(windGain.gain, frame.active ? Math.pow(Math.min(1, speed / 40), 2) * .15 : 0, .2);
      smooth(tireGain.gain, frame.active ? Math.min(1, frame.drift) * .25 : 0, .045);
    },
    cue(kind: 'countdown' | 'go' | 'boost' | 'charge' | 'lap' | 'finish' | 'impact') {
      if (kind === 'countdown') tone(520, .13, .2, 500);
      if (kind === 'go') { tone(1040, .48, .19, 1100); tone(520, .38, .1); }
      if (kind === 'boost') { tone(100, .42, .17, 720, 0, 'triangle'); tone(850, .34, .065, 1600, .045); }
      if (kind === 'charge') { tone(740, .1, .09); tone(1110, .16, .11, 1110, .09); }
      if (kind === 'lap') [660, 880, 1320].forEach((note, i) => tone(note, .25, .13, note, i * .1));
      if (kind === 'finish') [523, 659, 784, 1046].forEach((note, i) => tone(note, .65, .14, note, i * .13));
      if (kind === 'impact') tone(100, .13, .17, 30, 0, 'triangle');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture);
      for (const voice of voices) { try { voice.stop(); } catch {} voice.disconnect(); }
      voices.clear(); if (context) void context.close().catch(() => {});
    },
  };
}
