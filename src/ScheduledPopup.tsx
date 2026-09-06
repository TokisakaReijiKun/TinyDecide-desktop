import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Check } from 'lucide-react';
import { useScheduler } from './useScheduler';
import { DecisionWheel, buildSegments } from './App';
import { playSound, setSoundEnabled } from './sound';
import { loadState } from './storage';
import type { ScheduledResult } from './types';

export function ScheduledPopup() {
  const { snapshot, error } = useScheduler();
  const current = snapshot.results[0];
  const pending = current && !current.acknowledged ? current : null;
  const [failure, setFailure] = useState('');
  useEffect(() => { setSoundEnabled(loadState().soundEnabled); }, []);
  return <main className="scheduled-popup"><header className="workspace-toolbar"><h2>定时转盘</h2></header>
    {(error || failure) && <p className="number-error">{error || failure}</p>}
    {!pending && <p className="empty-state">暂无当前结果</p>}
    {pending && <ScheduledCard key={pending.id} item={pending} onRead={() => {
      void window.desktop?.acknowledgeResults([pending.id]).catch((reason) => setFailure(String(reason)));
    }} />}
  </main>;
}
function ScheduledCard({ item, onRead }: { item: ScheduledResult; onRead: () => void }) {
  const segments = useMemo(() => buildSegments(item.wheel.options), [item.wheel.options]);
  const target = 7 * 360 + (360 - segments.find((segment) => segment.option.id === item.optionId)!.center);
  const remaining = useRef(Math.max(0, Date.parse(item.completedAt) - Date.now()));
  const [rotation, setRotation] = useState(remaining.current ? 0 : target);
  const [finished, setFinished] = useState(!remaining.current);
  const wheelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!remaining.current) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => setRotation(target)); });
    let lastLabel = '';
    const tick = window.setInterval(() => {
      if (!wheelRef.current) return;
      const matrix = new DOMMatrix(getComputedStyle(wheelRef.current).transform);
      const angle = ((-Math.atan2(matrix.b, matrix.a) * 180 / Math.PI) % 360 + 360) % 360;
      const id = segments.find((segment) => angle >= segment.start && angle < segment.end)?.option.id;
      if (id && id !== lastLabel) { lastLabel = id; playSound('tick'); }
    }, 35);
    const end = window.setTimeout(() => { setFinished(true); clearInterval(tick); playSound('win'); }, remaining.current + 80);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); clearInterval(tick); clearTimeout(end); };
  }, [segments, target]);
  return <article className="scheduled-card"><div className="schedule-result-heading"><h3>{item.wheel.name}</h3><time><Clock3 size={15} />{new Date(item.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
    <div className="scheduled-wheel"><DecisionWheel segments={segments} rotation={rotation} spinDurationMs={Math.max(100, remaining.current)} isSpinning={!finished} isResetting={!remaining.current} wheelRef={wheelRef} disabledOptionIds={[]} selectedOptionId={finished ? item.optionId : null} onSpin={() => {}} onToggleOption={() => {}} /></div>
    <strong className="scheduled-result" aria-live="polite">{finished ? item.result : '转动中…'}</strong>
    <button className="save-button" disabled={!finished} onClick={onRead}><Check size={18} />知道了</button>
  </article>;
}
