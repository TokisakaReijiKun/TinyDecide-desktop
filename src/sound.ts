const pools = new Map<string, HTMLAudioElement[]>();
let enabled = true;
export function setSoundEnabled(value: boolean) { enabled = value; }
export function playSound(name: 'tick' | 'win' | 'pop') {
  if (!enabled) return;
  let pool = pools.get(name);
  if (!pool) {
    pool = Array.from({ length: name === 'tick' ? 6 : 2 }, () => {
      const audio = new Audio(`${import.meta.env.BASE_URL}reference/sounds/${name}.wav`);
      audio.volume = name === 'tick' ? 0.45 : 0.55;
      return audio;
    });
    pools.set(name, pool);
  }
  const audio = pool.find((item) => item.paused || item.ended) ?? pool[0];
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}
