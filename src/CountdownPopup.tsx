import { useEffect, useState } from 'react';
import { Bell, Check, Hourglass } from 'lucide-react';
import { useScheduler } from './useScheduler';
import { countdownRemainingMs, formatDate, formatRemaining, formatRemainingText } from './countdown';

export function CountdownPopup() {
  const { snapshot, error } = useScheduler();
  const [now, setNow] = useState(() => new Date());
  const [failure, setFailure] = useState('');
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const alert = snapshot.countdownAlert;
  const config = alert ? { id: alert.countdownId, name: alert.name, targetDate: alert.targetDate, reminderTime: '', enabled: true } : null;
  const remaining = config ? countdownRemainingMs(config, now) : 0;
  const value = formatRemaining(remaining);
  return <main className="countdown-popup"><div className="countdown-popup-icon"><Hourglass size={26} /></div><span className="countdown-eyebrow">每日倒计时提醒</span><h1>{alert?.name ?? '倒计时提醒'}</h1>
    {alert ? <><p className="countdown-popup-date"><Bell size={15} />目标日期：{formatDate(alert.targetDate)}</p><div className="countdown-popup-digits" aria-live="polite"><strong>{value.days}</strong><span>天</span><b>:</b><strong>{String(value.hours).padStart(2, '0')}</strong><span>时</span><b>:</b><strong>{String(value.minutes).padStart(2, '0')}</strong><span>分</span><b>:</b><strong>{String(value.seconds).padStart(2, '0')}</strong><span>秒</span></div><p className="countdown-popup-copy">{remaining > 0 ? `距离目标日期还有 ${formatRemainingText(remaining)}` : '今天就是目标日期'}</p><button className="save-button" disabled={!alert.acknowledged && !alert.id} onClick={() => { if (!alert) return; void window.desktop?.acknowledgeCountdownAlert(alert.id).catch((reason) => setFailure(String(reason))); }}><Check size={18} />知道了</button></> : <p className="empty-state">暂无当前提醒</p>}
    {(error || failure) && <p className="number-error" role="alert">{error || failure}</p>}
  </main>;
}
