import { useEffect, useState } from 'react';
import type { SchedulerSnapshot, WheelConfig } from './types';

export function useScheduler(wheels?: WheelConfig[]) {
  const [snapshot, setSnapshot] = useState<SchedulerSnapshot>({ schedules: [], results: [], autoStart: false, error: '' });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [syncedWheels, setSyncedWheels] = useState<WheelConfig[] | undefined>();
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    let active = true;
    const unsubscribe = desktop.onScheduler((next) => { if (active) setSnapshot(next); });
    void desktop.getScheduler().then((next) => { if (active) { setSnapshot(next); setReady(true); } }).catch((reason) => setError(String(reason)));
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!ready || !wheels || !window.desktop) return;
    void window.desktop.syncWheels(wheels).then(() => { setError(''); setSyncedWheels(wheels); }).catch((reason) => setError(String(reason)));
  }, [ready, wheels]);
  return { snapshot, ready: ready && (!wheels || syncedWheels === wheels), error: error || snapshot.error, setSnapshot };
}
