import { useState } from 'react';
import { Clock3, Edit3, Plus, Save, Trash2 } from 'lucide-react';
import type { SchedulerSnapshot, WheelConfig, WheelSchedule } from './types';
import { createId } from './storage';
import { Modal } from './Modal';

const timeLabel = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '已暂停';
export function ScheduleWorkspace({ wheels, snapshot, ready, error: nativeError, onSnapshot }: {
  wheels: WheelConfig[]; snapshot: SchedulerSnapshot; ready: boolean; error: string; onSnapshot: (value: SchedulerSnapshot) => void;
}) {
  const [draft, setDraft] = useState<WheelSchedule | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(schedules: WheelSchedule[]) {
    if (!window.desktop || busy) return;
    setBusy(true); setError('');
    try { onSnapshot(await window.desktop.saveSchedules(schedules)); setDraft(null); }
    catch (reason) { setError(String(reason).replace(/^Error:.*?: /, '')); }
    finally { setBusy(false); }
  }
  const count = snapshot.schedules.filter((item) => item.enabled).length;
  return <section className="schedule-workspace">
    <div className="workspace-toolbar"><div><p>每天重复 · 本地时间</p><h2>定时转动</h2></div>
      <button className="save-button" disabled={!ready || busy} onClick={() => {
        setError(''); setDraft({ id: createId('schedule'), wheelId: wheels[0].id, startTime: '09:00', endTime: '18:00', intervalMinutes: 60, enabled: true });
      }}><Plus size={18} />添加定时</button></div>
    <div className="schedule-status"><Clock3 size={20} /><span>{!window.desktop ? '桌面版中可启用定时任务' : count ? `${count} 个任务运行中` : '暂无运行中的任务'}</span>
      <label className="desktop-check"><input type="checkbox" checked={snapshot.autoStart} disabled={!ready || busy} onChange={async (event) => {
        setBusy(true); setError('');
        try { onSnapshot(await window.desktop!.setAutoStart(event.target.checked)); } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
      }} />开机启动</label></div>
    {(error || nativeError) && !draft && <p className="number-error" role="alert">{error || nativeError}</p>}
    <div className="schedule-list">
      {!snapshot.schedules.length && <div className="empty-state">暂无定时任务</div>}
      {snapshot.schedules.map((item) => <article className="schedule-row" key={item.id}>
        <label className="desktop-check schedule-toggle"><input type="checkbox" aria-label={`启用 ${wheels.find((wheel) => wheel.id === item.wheelId)?.name} 定时任务`} checked={item.enabled} disabled={busy}
          onChange={(event) => void save(snapshot.schedules.map((schedule) => schedule.id === item.id ? { ...schedule, enabled: event.target.checked } : schedule))} /></label>
        <div className="schedule-detail"><h3>{wheels.find((wheel) => wheel.id === item.wheelId)?.name ?? '转盘已删除'}</h3>
          <p>{item.startTime} 至 {item.endTime}{item.endTime < item.startTime ? '（次日）' : ''} · 每 {item.intervalMinutes} 分钟</p>
          <small>下次：{timeLabel(item.nextRunAt)}</small></div>
        <button className="icon-only" aria-label="编辑定时任务" title="编辑定时任务" disabled={busy} onClick={() => { setError(''); setDraft({ ...item }); }}><Edit3 size={19} /></button>
        <button className="icon-only" aria-label="删除定时任务" title="删除定时任务" disabled={busy} onClick={() => void save(snapshot.schedules.filter((schedule) => schedule.id !== item.id))}><Trash2 size={19} /></button>
      </article>)}
    </div>
    {draft && <Modal title="定时任务" onClose={() => { if (!busy) setDraft(null); }}>
      <form className="schedule-form" onSubmit={(event) => { event.preventDefault();
        if (draft.startTime === draft.endTime) { setError('开始与结束时间不能相同'); return; }
        const existing = snapshot.schedules.some((item) => item.id === draft.id);
        void save(existing ? snapshot.schedules.map((item) => item.id === draft.id ? draft : item) : [...snapshot.schedules, draft]);
      }}>
        <label className="desktop-field">转盘<select value={draft.wheelId} onChange={(event) => setDraft({ ...draft, wheelId: event.target.value })}>{wheels.map((wheel) => <option key={wheel.id} value={wheel.id}>{wheel.name}</option>)}</select></label>
        <div className="schedule-times"><label className="desktop-field">开始时间<input required type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label>
          <label className="desktop-field">结束时间<input required type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></div>
        <label className="desktop-field">时间间隔（分钟）<input required type="number" min="1" max="1440" step="1" value={draft.intervalMinutes} onChange={(event) => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })} /></label>
        <label className="desktop-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />启用任务</label>
        {error && <p className="number-error" role="alert">{error}</p>}
        <button className="save-button" disabled={busy}><Save size={18} />{busy ? '保存中' : '保存定时'}</button>
      </form>
    </Modal>}
  </section>;
}
