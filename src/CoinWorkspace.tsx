import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import type { DecisionHistoryItem } from './types';
import { playSound } from './sound';

const themes = [{ id: 'chinese', name: '咸丰古钱' }, { id: 'chip', name: '筹码' }, { id: 'constantine', name: '君士坦丁' },
  { id: 'panda', name: '熊猫' }, { id: 'pirate', name: '海盗' }, { id: 'rome', name: '罗马' }];
const asset = (path: string) => `${import.meta.env.BASE_URL}reference/${path}`;
type Face = 'heads' | 'tails';

export function CoinWorkspace({ history, onResult, soundEnabled }: {
  history: DecisionHistoryItem[]; soundEnabled: boolean;
  onResult: (item: Omit<DecisionHistoryItem, 'id' | 'createdAt'>) => void;
}) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('xiaojd-coin-theme');
    return themes.some((item) => item.id === saved) ? saved! : 'chinese';
  });
  const [face, setFace] = useState<Face>('heads');
  const [toss, setToss] = useState<{ from: Face; to: Face; id: number } | null>(null);
  const [error, setError] = useState('');
  const [hasResult, setHasResult] = useState(false);
  const busy = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { localStorage.setItem('xiaojd-coin-theme', theme); }, [theme]);
  useEffect(() => {
    if (toss && video.current) void video.current.play().catch(() => {
      busy.current = false; setToss(null); setError('动画未能播放，请重试。');
    });
  }, [toss]);
  function flip() {
    if (busy.current) return;
    busy.current = true;
    setError(''); setHasResult(false);
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    const next = { from: face, to: value[0] % 2 ? 'heads' as Face : 'tails' as Face, id: Date.now() };
    setToss(next);
    playSound('pop');
  }
  function finish() {
    if (!toss || !busy.current) return;
    busy.current = false;
    setFace(toss.to); setHasResult(true); setToss(null);
    onResult({ type: 'coin', result: toss.to === 'heads' ? '正面' : '反面', sourceName: themes.find((item) => item.id === theme)!.name });
  }
  const headsCount = history.filter((item) => item.result === '正面').length;
  return <div className="coin-workspace">
    <section className="coin-stage">
      <div className="workspace-toolbar"><h2>抛硬币</h2><Coins size={24} /></div>
      <div className="coin-result" aria-live="polite">{toss ? '抛掷中' : hasResult ? face === 'heads' ? '正面' : '反面' : '正面 / 反面'}</div>
      <button className="coin-media" onClick={flip} disabled={Boolean(toss)} aria-label="抛硬币">
        {toss ? <video key={toss.id} ref={video} playsInline muted={!soundEnabled} preload="auto"
          src={asset(`videos/coins/${theme}/${toss.from}_to_${toss.to}_light.mp4`)}
          onEnded={finish} onError={() => { busy.current = false; setToss(null); setError('硬币动画读取失败，请检查安装文件。'); }} />
          : <img src={asset(`images/coin_${theme}_${face}.png`)} alt={face === 'heads' ? '硬币正面' : '硬币反面'} />}
      </button>
      {error && <p className="number-error" role="alert">{error}</p>}
      <button className="save-button coin-command" disabled={Boolean(toss)} onClick={flip}><Coins size={18} />{toss ? '抛掷中' : '抛一次'}</button>
    </section>
    <aside className="coin-settings"><h3>硬币款式</h3>
      <div className="coin-themes" role="group" aria-label="硬币款式">{themes.map((item) => <button key={item.id}
        aria-pressed={theme === item.id} disabled={Boolean(toss)} onClick={() => { setTheme(item.id); setFace('heads'); setHasResult(false); }}>
        <img src={asset(`images/coin_${item.id}_heads.png`)} alt="" /><span>{item.name}</span>
      </button>)}</div>
      <h3>最近 {history.length} 次</h3><div className="coin-counts"><span>正面 <strong>{headsCount}</strong></span><span>反面 <strong>{history.length - headsCount}</strong></span></div>
      <div className="compact-history">{history.slice(0, 8).map((item) => <article key={item.id}><strong>{item.result}</strong><time>{new Date(item.createdAt).toLocaleTimeString('zh-CN')}</time></article>)}</div>
    </aside>
  </div>;
}
