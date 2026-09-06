/// <reference types="vite/client" />

interface Window {
  desktop?: {
    getScheduler(): Promise<import('./types').SchedulerSnapshot>;
    saveSchedules(schedules: import('./types').WheelSchedule[]): Promise<import('./types').SchedulerSnapshot>;
    syncWheels(wheels: import('./types').WheelConfig[]): Promise<import('./types').SchedulerSnapshot>;
    setAutoStart(enabled: boolean): Promise<import('./types').SchedulerSnapshot>;
    acknowledgeResults(ids: string[]): Promise<import('./types').SchedulerSnapshot>;
    clearScheduledHistory(): Promise<import('./types').SchedulerSnapshot>;
    onScheduler(callback: (snapshot: import('./types').SchedulerSnapshot) => void): () => void;
  };
}
