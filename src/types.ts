export type WheelOption = {
  id: string;
  label: string;
  weight: number;
  color: string;
};

export type WheelConfig = {
  id: string;
  name: string;
  icon: string;
  options: WheelOption[];
  spinDurationMs: number;
};

export type NumberConfig = {
  min: number;
  max: number;
  count: number;
  allowRepeats: boolean;
  showOrdered: boolean;
  animationSeconds: number;
};

export type DecisionHistoryItem = {
  id: string;
  type: "wheel" | "number" | "coin" | "scheduled";
  result: string | number[];
  createdAt: string;
  sourceName?: string;
};

export type AppState = {
  wheels: WheelConfig[];
  activeWheelId: string;
  numberConfig: NumberConfig;
  history: DecisionHistoryItem[];
  soundEnabled: boolean;
};

export type AppView = "wheel" | "wheelList" | "wheelEditor" | "number";

export type WheelSchedule = {
  id: string;
  wheelId: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  enabled: boolean;
  nextRunAt?: string | null;
};
export type ScheduledResult = {
  id: string;
  scheduleId: string;
  wheel: WheelConfig;
  optionId: string;
  result: string;
  startedAt: string;
  completedAt: string;
  scheduledAt: string;
  acknowledged: boolean;
};
export type SchedulerSnapshot = {
  schedules: WheelSchedule[];
  results: ScheduledResult[];
  autoStart: boolean;
  error: string;
};
