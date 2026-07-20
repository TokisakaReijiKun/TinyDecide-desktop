import type { AppState, DecisionHistoryItem, NumberConfig, WheelConfig, WheelOption } from "./types";

export const STORAGE_KEY = "xiaojd-desktop:v1";
export const HISTORY_LIMIT = 50;

const palette = ["#df2d3d", "#d83375", "#be2bd2", "#8930d8", "#245fd0", "#4099bb", "#82b548", "#f06b38"];

const ministerOptions: WheelOption[] = [
  { id: "minister-1", label: "大藏大臣", weight: 1, color: palette[0] },
  { id: "minister-2", label: "豆瓣酱大臣", weight: 1, color: palette[1] },
  { id: "minister-3", label: "日本料理大臣", weight: 1, color: palette[2] },
  { id: "minister-4", label: "总统大臣", weight: 1, color: palette[3] },
  { id: "minister-5", label: "外务大臣", weight: 1, color: palette[4] },
  { id: "minister-6", label: "厚生劳动大臣", weight: 1, color: palette[5] },
  { id: "minister-7", label: "文部科学大臣", weight: 1, color: palette[6] },
  { id: "minister-8", label: "内阁官房长官", weight: 1, color: palette[7] },
  { id: "minister-9", label: "内阁总理大臣", weight: 1, color: palette[0] }
];

const taskOptions: WheelOption[] = [
  { id: "task-1", label: "整理桌面", weight: 1, color: palette[0] },
  { id: "task-2", label: "写计划", weight: 1, color: palette[1] },
  { id: "task-3", label: "散步", weight: 1, color: palette[2] },
  { id: "task-4", label: "读书", weight: 1, color: palette[3] },
  { id: "task-5", label: "喝水", weight: 1, color: palette[4] },
  { id: "task-6", label: "休息", weight: 1, color: palette[5] }
];

export const defaultWheels: WheelConfig[] = [
  {
    id: "default-minister",
    name: "担当大臣",
    icon: "🤔",
    options: ministerOptions,
    spinDurationMs: 4000
  },
  {
    id: "default-task",
    name: "要做什么",
    icon: "🤔",
    options: taskOptions,
    spinDurationMs: 4000
  }
];

export const defaultNumberConfig: NumberConfig = {
  min: 1,
  max: 100,
  count: 1,
  allowRepeats: false,
  showOrdered: false,
  animationSeconds: 4
};

export const defaultState: AppState = {
  wheels: defaultWheels,
  activeWheelId: defaultWheels[0].id,
  numberConfig: defaultNumberConfig,
  history: []
};

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nextColor(index: number): string {
  return palette[index % palette.length];
}

export function createBlankWheel(): WheelConfig {
  return {
    id: createId("wheel"),
    name: "新转盘",
    icon: "🤔",
    spinDurationMs: 4000,
    options: [
      { id: createId("option"), label: "选项 1", weight: 1, color: nextColor(0) },
      { id: createId("option"), label: "选项 2", weight: 1, color: nextColor(1) },
      { id: createId("option"), label: "选项 3", weight: 1, color: nextColor(2) }
    ]
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normalizeHistory(history: unknown): DecisionHistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .filter((item): item is DecisionHistoryItem => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const maybe = item as Partial<DecisionHistoryItem>;
      const validResult = typeof maybe.result === "string" || Array.isArray(maybe.result);
      return typeof maybe.id === "string" && (maybe.type === "wheel" || maybe.type === "number") && validResult;
    })
    .slice(0, HISTORY_LIMIT);
}

function normalizeState(value: unknown): AppState {
  if (!value || typeof value !== "object") {
    return defaultState;
  }
  const maybe = value as Partial<AppState>;
  const wheels = normalizeWheels(maybe.wheels);
  const activeWheelId = wheels.some((wheel) => wheel.id === maybe.activeWheelId) ? String(maybe.activeWheelId) : wheels[0].id;

  return {
    wheels,
    activeWheelId,
    numberConfig: normalizeNumberConfig(maybe.numberConfig),
    history: normalizeHistory(maybe.history)
  };
}

function normalizeWheels(wheels: unknown): WheelConfig[] {
  if (!Array.isArray(wheels) || wheels.length === 0) {
    return defaultWheels;
  }
  const normalized = wheels
    .map((wheel, wheelIndex): WheelConfig | null => {
      if (!wheel || typeof wheel !== "object") {
        return null;
      }
      const maybe = wheel as Partial<WheelConfig>;
      const options = normalizeOptions(maybe.options, wheelIndex);
      if (options.length < 2) {
        return null;
      }
      return {
        id: typeof maybe.id === "string" ? maybe.id : createId("wheel"),
        name: typeof maybe.name === "string" && maybe.name.trim() ? maybe.name.trim() : `转盘 ${wheelIndex + 1}`,
        icon: typeof maybe.icon === "string" && maybe.icon.trim() ? maybe.icon.trim().slice(0, 4) : "🤔",
        options,
        spinDurationMs: clampInt(maybe.spinDurationMs, 1200, 8000, 4000)
      };
    })
    .filter((wheel): wheel is WheelConfig => Boolean(wheel));

  return normalized.length ? normalized : defaultWheels;
}

function normalizeOptions(options: unknown, wheelIndex: number): WheelOption[] {
  if (!Array.isArray(options)) {
    return ministerOptions;
  }
  return options
    .map((option, index): WheelOption | null => {
      if (!option || typeof option !== "object") {
        return null;
      }
      const maybe = option as Partial<WheelOption>;
      const label = typeof maybe.label === "string" ? maybe.label.trim() : "";
      if (!label) {
        return null;
      }
      return {
        id: typeof maybe.id === "string" ? maybe.id : createId("option"),
        label,
        weight: clampInt(maybe.weight, 1, 999, 1),
        color: typeof maybe.color === "string" && maybe.color ? maybe.color : nextColor(wheelIndex + index)
      };
    })
    .filter((option): option is WheelOption => Boolean(option));
}

function normalizeNumberConfig(config: unknown): NumberConfig {
  if (!config || typeof config !== "object") {
    return defaultNumberConfig;
  }
  const maybe = config as Partial<NumberConfig>;
  const min = clampInt(maybe.min, -999999, 999999, defaultNumberConfig.min);
  const max = clampInt(maybe.max, -999999, 999999, defaultNumberConfig.max);
  return {
    min,
    max,
    count: clampInt(maybe.count, 1, 1000, defaultNumberConfig.count),
    allowRepeats: Boolean(maybe.allowRepeats),
    showOrdered: Boolean(maybe.showOrdered),
    animationSeconds: clampInt(maybe.animationSeconds, 1, 8, defaultNumberConfig.animationSeconds)
  };
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numberValue)));
}
