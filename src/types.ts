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
  type: "wheel" | "number";
  result: string | number[];
  createdAt: string;
  sourceName?: string;
};

export type AppState = {
  wheels: WheelConfig[];
  activeWheelId: string;
  numberConfig: NumberConfig;
  history: DecisionHistoryItem[];
};

export type AppView = "wheel" | "wheelList" | "wheelEditor" | "number";
