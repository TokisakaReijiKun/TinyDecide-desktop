const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSchedules, validateWheels, nextRun, dueSlot, pickWeighted } = require('../electron/scheduler.cjs');
const schedule = { id: 's1', wheelId: 'w1', startTime: '09:00', endTime: '18:00', intervalMinutes: 60, enabled: true };
const at = (day, hour, minute, second = 0) => new Date(2026, 8, day, hour, minute, second);
test('daily start, interval, inclusive end, and next day', () => {
  assert.equal(dueSlot(schedule, at(6, 9, 0)), +at(6, 9, 0));
  assert.equal(dueSlot(schedule, at(6, 9, 30)), null);
  assert.equal(dueSlot(schedule, at(6, 18, 0)), +at(6, 18, 0));
  assert.equal(dueSlot(schedule, at(6, 19, 0)), null);
  assert.equal(nextRun(schedule, at(6, 18, 0)), at(7, 9, 0).toISOString());
});
test('overnight window follows previous day without duplicate midnight', () => {
  const overnight = { ...schedule, startTime: '22:30', endTime: '01:30', intervalMinutes: 30 };
  assert.equal(dueSlot(overnight, at(7, 0, 0)), +at(7, 0, 0));
  assert.equal(dueSlot(overnight, at(7, 1, 30)), +at(7, 1, 30));
  assert.equal(dueSlot(overnight, at(7, 2, 0)), null);
  assert.equal(nextRun(overnight, at(7, 1, 30)), at(7, 22, 30).toISOString());
});
test('jitter, sleep, activation and persisted duplicate protection', () => {
  assert.equal(dueSlot(schedule, at(6, 10, 0, 3)), +at(6, 10, 0));
  assert.equal(dueSlot(schedule, at(6, 10, 0, 6)), null);
  assert.equal(dueSlot(schedule, at(6, 10, 0, 1), +at(6, 10, 0)), null);
  assert.equal(dueSlot(schedule, at(6, 10, 0, 2), 0, +at(6, 10, 0, 1)), null);
  assert.equal(dueSlot({ ...schedule, enabled: false }, at(6, 10, 0)), null);
  assert.equal(nextRun({ ...schedule, enabled: false }, at(6, 10, 0)), null);
});
test('uneven intervals are anchored at the start, never beyond the end', () => {
  const uneven = { ...schedule, startTime: '09:10', endTime: '10:00', intervalMinutes: 35 };
  assert.equal(nextRun(uneven, at(6, 9, 10)), at(6, 9, 45).toISOString());
  assert.equal(nextRun(uneven, at(6, 9, 45)), at(7, 9, 10).toISOString());
});
test('validation rejects malformed times, non-integral intervals, and stale wheels', () => {
  assert.equal(validateSchedules([schedule], [{ id: 'w1' }]).length, 1);
  for (const patch of [{ startTime: '24:00' }, { endTime: '09:00' }, { intervalMinutes: 0 }, { intervalMinutes: 1.2 }, { intervalMinutes: 1441 }, { wheelId: 'missing' }]) {
    assert.throws(() => validateSchedules([{ ...schedule, ...patch }], [{ id: 'w1' }]));
  }
  assert.throws(() => validateSchedules([schedule, schedule], [{ id: 'w1' }]));
});
test('weighted selection respects valid options and wheel snapshots validate', () => {
  const options = [{ id: 'a', label: 'A', weight: 1, color: '#ff0000' }, { id: 'b', label: 'B', weight: 999, color: '#00ff00' }];
  const wheels = validateWheels([{ id: 'w1', name: 'Test', options, spinDurationMs: 4000 }]);
  assert.equal(wheels[0].options.length, 2);
  for (let i = 0; i < 50; i++) assert.ok(options.includes(pickWeighted(options)));
  assert.throws(() => validateWheels([{ ...wheels[0], options: [{ ...options[0], weight: NaN }, options[1]] }]));
});
