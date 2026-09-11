import type { CountdownConfig } from './types';

export function countdownTargetMs(targetDate: string): number {
  const [year, month, day] = targetDate.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function countdownRemainingMs(countdown: CountdownConfig, now = new Date()): number {
  return Math.max(0, countdownTargetMs(countdown.targetDate) - now.getTime());
}

export function formatRemaining(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

export function formatRemainingText(ms: number): string {
  const value = formatRemaining(ms);
  if (ms <= 0) return '目标日期已到';
  return `${value.days}天 ${String(value.hours).padStart(2, '0')}:${String(value.minutes).padStart(2, '0')}:${String(value.seconds).padStart(2, '0')}`;
}

export function formatDate(targetDate: string): string {
  const [year, month, day] = targetDate.split('-').map(Number);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day));
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
