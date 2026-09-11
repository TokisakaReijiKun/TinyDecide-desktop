import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, Edit3, Hourglass, Plus, Save, Trash2 } from 'lucide-react';
import type { CountdownConfig, SchedulerSnapshot } from './types';
import { createId } from './storage';
import { Modal } from './Modal';
import { countdownRemainingMs, formatDate, formatRemaining, formatRemainingText, localToday } from './countdown';

export function CountdownWorkspace({ snapshot, ready, error: nativeError, onSnapshot }: {
  snapshot: SchedulerSnapshot;
  ready: boolean;
  error: string;
  onSnapshot: (snapshot: SchedulerSnapshot) => void;
}) {
  const [draft, setDraft] = useState<CountdownConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const primary = useMemo(() => [...snapshot.countdowns].sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0], [snapshot.countdowns]);

  async function save(countdowns: CountdownConfig[]) {
    if (!window.desktop || busy) return;
    setBusy(true); setError('');
    try { onSnapshot(await window.desktop.saveCountdowns(countdowns)); setDraft(null); }
    catch (reason) { setError(String(reason).replace(/^Error:.*?: /, '')); }
    finally { setBusy(false); }
  }

  return <section className="countdown-workspace">
    <div className="workspace-toolbar"><div><p>目标日期 · 每日提醒</p><h2>倒计时</h2></div>
      <button className="save-button" disabled={!ready || busy} onClick={() => { setError(''); setDraft({ id: createId('countdown'), name: '重要日子', targetDate: localToday(), reminderTime: '09:00', enabled: true }); }}><Plus size={18} />添加倒计时</button></div>
    {(error || nativeError) && !draft && <p className="number-error" role="alert">{error || nativeError}</p>}
    {!primary && <div className="countdown-empty"><Hourglass size={42} /><h3>还没有倒计时</h3><p>设置目标日期和每天提醒时刻，程序会在托盘中按时提醒。</p><button className="save-button" disabled={!ready || busy} onClick={() => setDraft({ id: createId('countdown'), name: '重要日子', targetDate: localToday(), reminderTime: '09:00', enabled: true })}><Plus size={18} />创建第一个倒计时</button></div>}
    {primary && <>
      <article className="countdown-hero" aria-live="polite">
        <div className="countdown-hero-top"><div><span className="countdown-eyebrow">当前倒计时</span><h3>{primary.name}</h3><p>{formatDate(primary.targetDate)} · 每天 {primary.reminderTime} 提醒</p></div><Hourglass size={30} /></div>
        <CountdownDigits milliseconds={countdownRemainingMs(primary, now)} />
        <div className="countdown-hero-bottom"><span>{countdownRemainingMs(primary, now) > 0 ? '距离目标日期' : '目标日期已到'}</span><strong>{primary.enabled && snapshot.countdowns.length > 1 ? `${snapshot.countdowns.filter((item) => item.enabled).length} 个任务启用` : primary.enabled ? '每日提醒已启用' : '提醒已暂停'}</strong></div>
      </article>
      <div className="countdown-list-heading"><h3>我的倒计时</h3><span>{snapshot.countdowns.length} 个</span></div>
      <div className="countdown-list">
        {snapshot.countdowns.map((item) => <CountdownRow key={item.id} item={item} now={now} busy={busy} onToggle={() => void save(snapshot.countdowns.map((entry) => entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry))} onEdit={() => { setError(''); setDraft({ ...item }); }} onDelete={() => void save(snapshot.countdowns.filter((entry) => entry.id !== item.id))} />)}
      </div>
    </>}
    {draft && <CountdownEditor draft={draft} busy={busy} error={error} onChange={setDraft} onClose={() => { if (!busy) setDraft(null); }} onSave={() => {
      if (!draft.name.trim()) { setError('请输入倒计时名称'); return; }
      if (!draft.targetDate || draft.targetDate < localToday()) { setError('目标日期不能早于今天'); return; }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.reminderTime)) { setError('提醒时刻无效'); return; }
      const exists = snapshot.countdowns.some((item) => item.id === draft.id);
      void save(exists ? snapshot.countdowns.map((item) => item.id === draft.id ? draft : item) : [...snapshot.countdowns, draft]);
    }} />}
  </section>;
}

function CountdownDigits({ milliseconds }: { milliseconds: number }) {
  const value = formatRemaining(milliseconds);
  return <div className="countdown-digits"><div><strong>{value.days}</strong><span>天</span></div><b>:</b><div><strong>{String(value.hours).padStart(2, '0')}</strong><span>时</span></div><b>:</b><div><strong>{String(value.minutes).padStart(2, '0')}</strong><span>分</span></div><b>:</b><div><strong>{String(value.seconds).padStart(2, '0')}</strong><span>秒</span></div></div>;
}

function CountdownRow({ item, now, busy, onToggle, onEdit, onDelete }: { item: CountdownConfig; now: Date; busy: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const remaining = countdownRemainingMs(item, now);
  return <article className={`countdown-row ${!item.enabled ? 'paused' : ''}`}>
    <label className="desktop-check countdown-toggle"><input type="checkbox" aria-label={`启用 ${item.name}`} checked={item.enabled} disabled={busy} onChange={onToggle} /><span /></label>
    <div className="countdown-row-main"><div className="countdown-row-title"><h4>{item.name}</h4>{remaining <= 0 && <span className="countdown-done">已到达</span>}</div><p>{formatDate(item.targetDate)} · 每天 {item.reminderTime} <Bell size={14} /></p><small>{item.enabled ? `剩余 ${formatRemainingText(remaining)}` : '提醒已暂停'}</small></div>
    <button className="icon-only" aria-label={`编辑 ${item.name}`} title="编辑" disabled={busy} onClick={onEdit}><Edit3 size={18} /></button><button className="icon-only" aria-label={`删除 ${item.name}`} title="删除" disabled={busy} onClick={onDelete}><Trash2 size={18} /></button>
  </article>;
}

function CountdownEditor({ draft, busy, error, onChange, onClose, onSave }: { draft: CountdownConfig; busy: boolean; error: string; onChange: (draft: CountdownConfig) => void; onClose: () => void; onSave: () => void }) {
  return <Modal title="编辑倒计时" onClose={onClose}><form className="countdown-form" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
    <label className="desktop-field">倒计时名称<input required maxLength={80} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
    <label className="desktop-field">目标日期<input required type="date" min={localToday()} value={draft.targetDate} onChange={(event) => onChange({ ...draft, targetDate: event.target.value })} /><small>目标日当天提醒时显示“目标日期已到”。</small></label>
    <label className="desktop-field">每日提醒时刻<input required type="time" value={draft.reminderTime} onChange={(event) => onChange({ ...draft, reminderTime: event.target.value })} /><small>程序在托盘运行时也会提醒。</small></label>
    <label className="desktop-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => onChange({ ...draft, enabled: event.target.checked })} />启用每日提醒</label>
    {error && <p className="number-error" role="alert">{error}</p>}
    <button className="save-button" disabled={busy}><Save size={18} />{busy ? '保存中' : '保存倒计时'}</button>
  </form></Modal>;
}
