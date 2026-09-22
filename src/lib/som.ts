let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function tocarTom(frequencia: number, duracaoMs: number, atraso = 0) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const ganho = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = frequencia;
  osc.connect(ganho);
  ganho.connect(audio.destination);
  const inicio = audio.currentTime + atraso;
  ganho.gain.setValueAtTime(0.15, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracaoMs / 1000);
  osc.start(inicio);
  osc.stop(inicio + duracaoMs / 1000);
}

export function beepSucesso() {
  tocarTom(880, 110);
}

export function beepErro() {
  tocarTom(220, 160);
  tocarTom(180, 200, 0.12);
}
