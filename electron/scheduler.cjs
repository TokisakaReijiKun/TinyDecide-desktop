const { randomInt } = require('node:crypto');
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function minutes(value) {
  if (!TIME.test(value)) throw new Error('时间格式必须为 HH:mm');
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
function parseLocalDate(value) {
  const match = typeof value === 'string' ? value.match(DATE) : null;
  if (!match) throw new Error('日期格式必须为 YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (year < 1970 || year > 9999 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('目标日期无效');
  }
  return date;
}
function localDateKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function validateSchedules(schedules, wheels) {
  if (!Array.isArray(schedules) || schedules.length > 64) throw new Error('最多添加 64 个定时任务');
  const ids = new Set();
  return schedules.map((item) => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('任务编号无效');
    ids.add(item.id);
    if (!wheels.some((wheel) => wheel.id === item.wheelId)) throw new Error('请选择有效的转盘');
    if (minutes(item.startTime) === minutes(item.endTime)) throw new Error('开始时间与结束时间不能相同');
    if (!Number.isInteger(item.intervalMinutes) || item.intervalMinutes < 1 || item.intervalMinutes > 1440) throw new Error('时间间隔应为 1 至 1440 分钟');
    return { id: item.id, wheelId: item.wheelId, startTime: item.startTime, endTime: item.endTime,
      intervalMinutes: item.intervalMinutes, enabled: Boolean(item.enabled) };
  });
}
function validateWheels(wheels) {
  if (!Array.isArray(wheels) || !wheels.length || wheels.length > 500) throw new Error('转盘数据无效');
  const ids = new Set();
  return wheels.map((wheel) => {
    if (!wheel || typeof wheel.id !== 'string' || ids.has(wheel.id) || typeof wheel.name !== 'string' || !wheel.name.trim()) throw new Error('转盘名称不能为空');
    ids.add(wheel.id);
    if (!Array.isArray(wheel.options) || wheel.options.length < 2 || wheel.options.length > 500) throw new Error('每个转盘需要 2 至 500 个选项');
    const optionIds = new Set();
    const options = wheel.options.map((option) => {
      if (!option || typeof option.id !== 'string' || optionIds.has(option.id) || typeof option.label !== 'string' || !option.label.trim() || !Number.isInteger(option.weight) || option.weight < 1 || option.weight > 999 || !/^#[0-9a-f]{6}$/i.test(option.color)) throw new Error('转盘选项、颜色或权重无效');
      optionIds.add(option.id);
      return { id: option.id, label: option.label, weight: option.weight, color: option.color };
    });
    return { id: wheel.id, name: wheel.name, icon: wheel.icon || '', options, spinDurationMs: Math.min(8000, Math.max(1200, Number(wheel.spinDurationMs) || 4000)) };
  });
}
function validateCountdowns(countdowns) {
  if (!Array.isArray(countdowns) || countdowns.length > 64) throw new Error('最多添加 64 个倒计时');
  const ids = new Set();
  return countdowns.map((item) => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('倒计时编号无效');
    ids.add(item.id);
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name || name.length > 80) throw new Error('倒计时名称应为 1 至 80 个字符');
    parseLocalDate(item.targetDate);
    minutes(item.reminderTime);
    return { id: item.id, name, targetDate: item.targetDate, reminderTime: item.reminderTime, enabled: Boolean(item.enabled) };
  });
}
// Local calendar slots include the preceding day's overnight window.
function slotsAround(schedule, now) {
  const start = minutes(schedule.startTime);
  let end = minutes(schedule.endTime);
  if (end <= start) end += 1440;
  const slots = [];
  for (let offset = -1; offset <= 2; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    for (let minute = start; minute <= end; minute += schedule.intervalMinutes) {
      slots.push(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute).getTime());
    }
  }
  return [...new Set(slots)].sort((a, b) => a - b);
}
function nextRun(schedule, now = new Date()) {
  if (!schedule.enabled) return null;
  const slot = slotsAround(schedule, now).find((time) => time > now.getTime());
  return slot === undefined ? null : new Date(slot).toISOString();
}
function dueSlot(schedule, now, lastSlot = 0, activeSince = 0) {
  if (!schedule.enabled) return null;
  const time = now.getTime();
  const slot = slotsAround(schedule, now).filter((value) => value <= time).at(-1);
  // Tolerate timer jitter, but do not replay missed runs after sleep.
  return slot !== undefined && slot > lastSlot && slot >= activeSince && time - slot <= 5000 ? slot : null;
}
function nextCountdownRun(countdown, now = new Date()) {
  if (!countdown.enabled) return null;
  parseLocalDate(countdown.targetDate);
  const reminderMinutes = minutes(countdown.reminderTime);
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, reminderMinutes);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return localDateKey(candidate) <= countdown.targetDate ? candidate.toISOString() : null;
}
function dueCountdownSlot(countdown, now, lastSlot = 0, activeSince = 0) {
  if (!countdown.enabled || localDateKey(now) > countdown.targetDate) return null;
  const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, minutes(countdown.reminderTime)).getTime();
  const time = now.getTime();
  return slot <= time && time - slot <= 5000 && slot > lastSlot && slot >= activeSince ? slot : null;
}
function countdownRemainingMs(countdown, now = new Date()) {
  return Math.max(0, parseLocalDate(countdown.targetDate).getTime() - now.getTime());
}
function pickWeighted(options) {
  let ticket = randomInt(options.reduce((sum, option) => sum + option.weight, 0));
  for (const option of options) {
    if (ticket < option.weight) return option;
    ticket -= option.weight;
  }
  return options[options.length - 1];
}
module.exports = {
  validateSchedules, validateWheels, validateCountdowns,
  nextRun, dueSlot, nextCountdownRun, dueCountdownSlot, countdownRemainingMs,
  pickWeighted
};
