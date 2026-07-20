import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import {
  ClipboardList,
  Clock3,
  Edit3,
  History,
  List,
  Minus,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X
} from "lucide-react";
import type { AppState, DecisionHistoryItem, NumberConfig, WheelConfig, WheelOption } from "./types";
import { clampInt, createBlankWheel, createId, HISTORY_LIMIT, loadState, nextColor, saveState } from "./storage";
import wheelSpinButton from "./assets/wheel_spin_button@3x.png";

type AppSection = "wheel" | "number" | "history";

type WheelSegment = {
  option: WheelOption;
  start: number;
  end: number;
  center: number;
  span: number;
};

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

const MAX_WEIGHT = 999;
const WHEEL_SPIN_TURNS = 7;
const COLOR_PRESETS = [
  "#ff3b30",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#16bcd0",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#cde633",
  "#ffeb3b",
  "#ffc107",
  "#ff9800",
  "#ff5722",
  "#795548",
  "#9e9e9e",
  "#607d8b",
  "#000000",
  "#ffffff"
];

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [section, setSection] = useState<AppSection>("wheel");
  const [editingWheelId, setEditingWheelId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isWheelResetting, setIsWheelResetting] = useState(false);
  const [wheelResult, setWheelResult] = useState("???");
  const [rollingWheelLabel, setRollingWheelLabel] = useState("???");
  const [disabledWheelOptionIds, setDisabledWheelOptionIds] = useState<string[]>([]);
  const [selectedWheelOptionId, setSelectedWheelOptionId] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const rotationTargetRef = useRef(0);
  const spinTimerRef = useRef<number | null>(null);
  const spinFrameRef = useRef<number | null>(null);
  const [numberResult, setNumberResult] = useState<number[]>([]);
  const [isNumberRolling, setIsNumberRolling] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeWheel = useMemo(
    () => state.wheels.find((wheel) => wheel.id === state.activeWheelId) ?? state.wheels[0],
    [state.activeWheelId, state.wheels]
  );
  const editingWheel = useMemo(
    () => state.wheels.find((wheel) => wheel.id === editingWheelId) ?? activeWheel,
    [activeWheel, editingWheelId, state.wheels]
  );
  const segments = useMemo(() => buildSegments(activeWheel.options), [activeWheel.options]);
  const numberError = getNumberError(state.numberConfig);

  function setActiveWheel(wheelId: string) {
    stopSpinTracking();
    setState((current) => ({ ...current, activeWheelId: wheelId }));
    setEditingWheelId(null);
    setIsSpinning(false);
    setIsWheelResetting(true);
    setWheelResult("???");
    setRollingWheelLabel("???");
    setDisabledWheelOptionIds([]);
    setSelectedWheelOptionId(null);
    rotationTargetRef.current = 0;
    setRotation(0);
    window.requestAnimationFrame(() => {
      setIsWheelResetting(false);
    });
    setSection("wheel");
  }

  function upsertWheel(nextWheel: WheelConfig) {
    setState((current) => {
      const exists = current.wheels.some((wheel) => wheel.id === nextWheel.id);
      return {
        ...current,
        activeWheelId: nextWheel.id,
        wheels: exists ? current.wheels.map((wheel) => (wheel.id === nextWheel.id ? nextWheel : wheel)) : [...current.wheels, nextWheel]
      };
    });
  }

  function patchWheel(wheelId: string, updater: (wheel: WheelConfig) => WheelConfig) {
    setState((current) => ({
      ...current,
      wheels: current.wheels.map((wheel) => (wheel.id === wheelId ? updater(wheel) : wheel))
    }));
  }

  function createWheel() {
    const wheel = createBlankWheel();
    upsertWheel(wheel);
    setEditingWheelId(wheel.id);
    setSection("wheel");
  }

  function removeWheel(wheelId: string) {
    setState((current) => {
      if (current.wheels.length <= 1) {
        return current;
      }
      const wheels = current.wheels.filter((wheel) => wheel.id !== wheelId);
      return {
        ...current,
        wheels,
        activeWheelId: current.activeWheelId === wheelId ? wheels[0].id : current.activeWheelId
      };
    });
    setEditingWheelId(null);
  }

  function addHistory(item: Omit<DecisionHistoryItem, "id" | "createdAt">) {
    setState((current) => ({
      ...current,
      history: [
        {
          ...item,
          id: createId("history"),
          createdAt: new Date().toISOString()
        },
        ...current.history
      ].slice(0, HISTORY_LIMIT)
    }));
  }

  function spinWheel() {
    if (activeWheel.options.length < 2) {
      return;
    }
    stopSpinTracking();

    const enabledOptions = activeWheel.options.filter((option) => !disabledWheelOptionIds.includes(option.id));
    if (enabledOptions.length === 0) {
      return;
    }

    const selected = pickWeighted(enabledOptions);
    const selectedSegment = segments.find((segment) => segment.option.id === selected.id);
    if (!selectedSegment) {
      return;
    }

    const pointerAngle = 0;
    const baseRotation = Math.max(rotationTargetRef.current, rotation);
    const targetWithinTurn = normalizeDegrees(pointerAngle - selectedSegment.center);
    const minimumTarget = baseRotation + WHEEL_SPIN_TURNS * 360;
    const targetRotation = minimumTarget + normalizeDegrees(targetWithinTurn - normalizeDegrees(minimumTarget));
    rotationTargetRef.current = targetRotation;
    setIsWheelResetting(false);
    setIsSpinning(true);
    setWheelResult("???");
    setSelectedWheelOptionId(null);
    setRotation(targetRotation);

    const updateRollingResult = () => {
      const pointed = getPointedSegmentLabel(wheelRef.current, segments);
      if (pointed) {
        setRollingWheelLabel(pointed);
      }
      spinFrameRef.current = window.requestAnimationFrame(updateRollingResult);
    };
    spinFrameRef.current = window.requestAnimationFrame(updateRollingResult);

    spinTimerRef.current = window.setTimeout(() => {
      if (spinFrameRef.current !== null) {
        window.cancelAnimationFrame(spinFrameRef.current);
      }
      spinFrameRef.current = window.requestAnimationFrame(() => {
        const pointedSegment = getPointedSegment(wheelRef.current, segments) ?? selectedSegment;
        const pointedOption = pointedSegment.option;
        spinTimerRef.current = null;
        spinFrameRef.current = null;
        setIsSpinning(false);
        setSelectedWheelOptionId(pointedOption.id);
        setRollingWheelLabel(pointedOption.label);
        setWheelResult(pointedOption.label);
        addHistory({ type: "wheel", result: pointedOption.label, sourceName: activeWheel.name });
      });
    }, activeWheel.spinDurationMs);
  }

  function resetWheel() {
    stopSpinTracking();
    setIsSpinning(false);
    setIsWheelResetting(true);
    rotationTargetRef.current = 0;
    setRotation(0);
    setWheelResult("???");
    setRollingWheelLabel("???");
    setSelectedWheelOptionId(null);
    setDisabledWheelOptionIds([]);
    window.requestAnimationFrame(() => {
      setIsWheelResetting(false);
    });
  }

  function stopSpinTracking() {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    if (spinFrameRef.current !== null) {
      window.cancelAnimationFrame(spinFrameRef.current);
      spinFrameRef.current = null;
    }
  }

  function toggleWheelOption(optionId: string) {
    if (isSpinning) {
      return;
    }
    setSelectedWheelOptionId(null);
    setWheelResult("???");
    setRollingWheelLabel("???");
    setDisabledWheelOptionIds((current) =>
      current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
    );
  }

  function updateNumberConfig(patch: Partial<NumberConfig>) {
    setState((current) => ({
      ...current,
      numberConfig: {
        ...current.numberConfig,
        ...patch
      }
    }));
  }

  function generateNumbers() {
    const error = getNumberError(state.numberConfig);
    if (error || isNumberRolling) {
      return;
    }
    const finalResult = createRandomNumbers(state.numberConfig);
    const intervalMs = 80;
    const rollMs = state.numberConfig.animationSeconds * 1000;
    let elapsed = 0;

    setSection("number");
    setIsNumberRolling(true);
    const timer = window.setInterval(() => {
      elapsed += intervalMs;
      setNumberResult([randomInt(state.numberConfig.min, state.numberConfig.max)]);
      if (elapsed >= rollMs) {
        window.clearInterval(timer);
        const shown = state.numberConfig.showOrdered ? [...finalResult].sort((a, b) => a - b) : finalResult;
        setNumberResult(shown);
        setIsNumberRolling(false);
        addHistory({ type: "number", result: shown, sourceName: `${state.numberConfig.min} ~ ${state.numberConfig.max}` });
      }
    }, intervalMs);
  }

  function clearHistory() {
    setState((current) => ({ ...current, history: [] }));
  }

  return (
    <main className="desktop-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-mark">决</div>
          <div>
            <h1>小决定 Desktop</h1>
            <p>Windows 桌面随机决策工具</p>
          </div>
        </div>

        <nav className="section-tabs" aria-label="主要功能">
          <button className={section === "wheel" ? "active" : ""} onClick={() => setSection("wheel")}>
            <List size={20} />
            转盘
          </button>
          <button className={section === "number" ? "active" : ""} onClick={() => setSection("number")}>
            <Shuffle size={20} />
            随机数字
          </button>
          <button className={section === "history" ? "active" : ""} onClick={() => setSection("history")}>
            <History size={20} />
            历史记录
          </button>
        </nav>

        <WheelLibrary
          wheels={state.wheels}
          activeWheelId={state.activeWheelId}
          searchText={searchText}
          onSearch={setSearchText}
          onCreate={createWheel}
          onSelect={setActiveWheel}
          onEdit={(wheelId) => {
            setEditingWheelId(wheelId);
            setSection("wheel");
          }}
        />
      </aside>

      <section className="workspace">
        {section === "wheel" && (
          <WheelWorkspace
            wheel={activeWheel}
            editingWheel={editingWheel}
            editingWheelId={editingWheelId}
            canDelete={state.wheels.length > 1}
            segments={segments}
            rotation={rotation}
            isSpinning={isSpinning}
            isResetting={isWheelResetting}
            result={wheelResult}
            rollingResult={rollingWheelLabel}
            wheelRef={wheelRef}
            disabledOptionIds={disabledWheelOptionIds}
            selectedOptionId={selectedWheelOptionId}
            recentHistory={state.history.filter((item) => item.type === "wheel").slice(0, 5)}
            onSpin={spinWheel}
            onReset={resetWheel}
            onToggleOption={toggleWheelOption}
            onEdit={() => setEditingWheelId(activeWheel.id)}
            onCloseEditor={() => setEditingWheelId(null)}
            onChangeWheel={(wheel) => patchWheel(wheel.id, () => wheel)}
            onSaveWheel={(wheel) => {
              upsertWheel(wheel);
              setEditingWheelId(null);
            }}
            onDeleteWheel={() => removeWheel(editingWheel.id)}
          />
        )}

        {section === "number" && (
          <NumberWorkspace
            config={state.numberConfig}
            result={numberResult}
            error={numberError}
            isRolling={isNumberRolling}
            history={state.history.filter((item) => item.type === "number").slice(0, 8)}
            onGenerate={generateNumbers}
            onConfigChange={updateNumberConfig}
          />
        )}

        {section === "history" && <HistoryWorkspace history={state.history} onClear={clearHistory} />}
      </section>
    </main>
  );
}

function WheelLibrary(props: {
  wheels: WheelConfig[];
  activeWheelId: string;
  searchText: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  onSelect: (wheelId: string) => void;
  onEdit: (wheelId: string) => void;
}) {
  const normalizedSearch = props.searchText.trim().toLowerCase();
  const wheels = props.wheels.filter((wheel) => wheel.name.toLowerCase().includes(normalizedSearch));

  return (
    <section className="wheel-library">
      <div className="library-heading">
        <h2>我的转盘</h2>
        <button onClick={props.onCreate}>
          <Plus size={18} />
          新建
        </button>
      </div>
      <label className="search-field">
        <Search size={18} />
        <input value={props.searchText} onChange={(event) => props.onSearch(event.target.value)} placeholder="搜索转盘" />
      </label>
      <div className="library-list">
        {wheels.map((wheel) => (
          <article className={`library-card ${wheel.id === props.activeWheelId ? "selected" : ""}`} key={wheel.id}>
            <button className="library-card-main" onClick={() => props.onSelect(wheel.id)}>
              <span>{wheel.icon}</span>
              <strong>{wheel.name}</strong>
              <small>{wheel.options.length} 个选项</small>
            </button>
            <button className="library-edit" aria-label={`编辑 ${wheel.name}`} onClick={() => props.onEdit(wheel.id)}>
              <Edit3 size={18} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function WheelWorkspace(props: {
  wheel: WheelConfig;
  editingWheel: WheelConfig;
  editingWheelId: string | null;
  canDelete: boolean;
  segments: WheelSegment[];
  rotation: number;
  isSpinning: boolean;
  isResetting: boolean;
  result: string;
  rollingResult: string;
  wheelRef: RefObject<HTMLDivElement | null>;
  disabledOptionIds: string[];
  selectedOptionId: string | null;
  recentHistory: DecisionHistoryItem[];
  onSpin: () => void;
  onReset: () => void;
  onToggleOption: (optionId: string) => void;
  onEdit: () => void;
  onCloseEditor: () => void;
  onChangeWheel: (wheel: WheelConfig) => void;
  onSaveWheel: (wheel: WheelConfig) => void;
  onDeleteWheel: () => void;
}) {
  return (
    <div className="wheel-workspace">
      <section className="wheel-stage-panel">
        <div className="workspace-toolbar">
          <div>
            <p>当前转盘</p>
            <h2>{props.wheel.name}</h2>
          </div>
          <div className="toolbar-actions">
            <button className="ghost-button" onClick={props.onEdit}>
              <Edit3 size={20} />
              编辑
            </button>
          </div>
        </div>

        <div className="desktop-wheel-result">
          <span>{props.wheel.name}</span>
          <strong>{props.isSpinning ? props.rollingResult : props.result}</strong>
        </div>

        <DecisionWheel
          segments={props.segments}
          rotation={props.rotation}
          spinDurationMs={props.wheel.spinDurationMs}
          isSpinning={props.isSpinning}
          isResetting={props.isResetting}
          wheelRef={props.wheelRef}
          disabledOptionIds={props.disabledOptionIds}
          selectedOptionId={props.selectedOptionId}
          onSpin={props.onSpin}
          onToggleOption={props.onToggleOption}
        />

        <div className="desktop-wheel-actions">
          <button className="primary-pill" onClick={props.onReset}>
            还原转盘
          </button>
          <button className="round-button" aria-label="编辑" onClick={props.onEdit}>
            <Edit3 size={24} />
          </button>
        </div>
      </section>

      <aside className="side-panel">
        {props.editingWheelId ? (
          <WheelEditor
            wheel={props.editingWheel}
            canDelete={props.canDelete}
            onChange={props.onChangeWheel}
            onSave={props.onSaveWheel}
            onCancel={props.onCloseEditor}
            onDelete={props.onDeleteWheel}
          />
        ) : (
          <WheelSummary wheel={props.wheel} history={props.recentHistory} onEdit={props.onEdit} />
        )}
      </aside>
    </div>
  );
}

function DecisionWheel(props: {
  segments: WheelSegment[];
  rotation: number;
  spinDurationMs: number;
  isSpinning: boolean;
  isResetting: boolean;
  wheelRef: RefObject<HTMLDivElement | null>;
  disabledOptionIds: string[];
  selectedOptionId: string | null;
  onSpin: () => void;
  onToggleOption: (optionId: string) => void;
}) {
  const gradient = props.segments
    .map((segment) => {
      const isDisabled = props.disabledOptionIds.includes(segment.option.id);
      const isDimmedAfterPick = props.selectedOptionId !== null && props.selectedOptionId !== segment.option.id;
      const color = isDisabled || isDimmedAfterPick ? darkenColor(segment.option.color, isDisabled ? 0.22 : 0.38) : segment.option.color;
      return `${color} ${segment.start}deg ${segment.end}deg`;
    })
    .join(", ");

  function handleWheelClick(event: MouseEvent<HTMLDivElement>) {
    if (props.isSpinning) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = event.clientX - centerX;
    const y = event.clientY - centerY;
    const distance = Math.hypot(x, y);
    if (distance < rect.width * 0.19) {
      return;
    }

    const visualAngle = normalizeDegrees((Math.atan2(x, -y) * 180) / Math.PI);
    const rotation = getCurrentRotationDegrees(event.currentTarget) ?? normalizeDegrees(props.rotation);
    const localAngle = normalizeDegrees(visualAngle - rotation);
    const segment = getSegmentAtLocalAngle(props.segments, localAngle);
    if (segment) {
      props.onToggleOption(segment.option.id);
    }
  }

  return (
    <div className="decision-wheel-button">
      <div className="decision-wheel-shadow">
        <div
          className="decision-wheel"
          ref={props.wheelRef}
          onClick={handleWheelClick}
          style={{
            background: `conic-gradient(${gradient})`,
            transform: `rotate(${props.rotation}deg)`,
            transitionDuration: props.isResetting ? "0ms" : `${props.spinDurationMs}ms`
          }}
        >
          {props.segments.map((segment) => (
            <span className="segment-divider" key={`divider-${segment.option.id}`} style={{ transform: `rotate(${segment.start}deg)` }} />
          ))}
          {props.segments.map((segment) => (
            <button
              type="button"
              className="segment-label"
              key={segment.option.id}
              disabled={props.isSpinning}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleOption(segment.option.id);
              }}
              style={{
                transform: `rotate(${segment.center}deg) translateY(calc(-1 * var(--label-radius))) rotate(90deg)`
              }}
            >
              {segment.option.label}
            </button>
          ))}
        </div>
        <button className="decision-hub-button" onClick={props.onSpin} aria-label="旋转转盘">
          <img className="decision-hub" src={wheelSpinButton} alt="" draggable={false} />
        </button>
      </div>
    </div>
  );
}

function WheelSummary(props: { wheel: WheelConfig; history: DecisionHistoryItem[]; onEdit: () => void }) {
  return (
    <div className="summary-panel">
      <div className="panel-heading">
        <div>
          <p>转盘信息</p>
          <h3>{props.wheel.name}</h3>
        </div>
        <button className="icon-only" onClick={props.onEdit}>
          <Edit3 size={20} />
        </button>
      </div>
      <div className="stat-grid">
        <div>
          <strong>{props.wheel.options.length}</strong>
          <span>选项</span>
        </div>
        <div>
          <strong>{Math.round(props.wheel.spinDurationMs / 1000)}s</strong>
          <span>动画</span>
        </div>
      </div>
      <h4>最近结果</h4>
      <div className="compact-history">
        {props.history.length === 0 && <p>还没有转盘结果。</p>}
        {props.history.map((item) => (
          <article key={item.id}>
            <strong>{item.result}</strong>
            <time>{formatTime(item.createdAt)}</time>
          </article>
        ))}
      </div>
    </div>
  );
}

function WheelEditor(props: {
  wheel: WheelConfig;
  canDelete: boolean;
  onChange: (wheel: WheelConfig) => void;
  onSave: (wheel: WheelConfig) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [colorEditorOptionId, setColorEditorOptionId] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<"preset" | "custom">("preset");
  const [weightEditorOptionId, setWeightEditorOptionId] = useState<string | null>(null);
  const totalWeight = props.wheel.options.reduce((sum, option) => sum + option.weight, 0);
  const colorEditorOption = props.wheel.options.find((option) => option.id === colorEditorOptionId) ?? null;
  const weightEditorOption = props.wheel.options.find((option) => option.id === weightEditorOptionId) ?? null;

  function patchWheel(patch: Partial<WheelConfig>) {
    props.onChange({ ...props.wheel, ...patch });
  }

  function updateOption(optionId: string, patch: Partial<WheelOption>) {
    patchWheel({
      options: props.wheel.options.map((option) =>
        option.id === optionId
          ? {
              ...option,
              ...patch,
              weight: patch.weight !== undefined ? clampInt(patch.weight, 1, MAX_WEIGHT, option.weight) : option.weight
            }
          : option
      )
    });
  }

  function addOption() {
    patchWheel({
      options: [
        ...props.wheel.options,
        {
          id: createId("option"),
          label: `选项 ${props.wheel.options.length + 1}`,
          weight: 1,
          color: nextColor(props.wheel.options.length)
        }
      ]
    });
  }

  function removeOption(optionId: string) {
    if (props.wheel.options.length <= 2) {
      return;
    }
    patchWheel({ options: props.wheel.options.filter((option) => option.id !== optionId) });
    if (colorEditorOptionId === optionId) {
      setColorEditorOptionId(null);
    }
    if (weightEditorOptionId === optionId) {
      setWeightEditorOptionId(null);
    }
  }

  function openColorEditor(optionId: string) {
    setColorEditorOptionId(optionId);
    setWeightEditorOptionId(null);
    setColorMode("preset");
  }

  function openWeightEditor(optionId: string) {
    setWeightEditorOptionId(optionId);
    setColorEditorOptionId(null);
  }

  function updateCustomColor(patch: Partial<RgbColor>) {
    if (!colorEditorOption) {
      return;
    }
    updateOption(colorEditorOption.id, { color: rgbToHex({ ...hexToRgb(colorEditorOption.color), ...patch }) });
  }

  return (
    <div className="editor-panel">
      <div className="panel-heading">
        <div>
          <p>编辑转盘</p>
          <h3>{props.wheel.name}</h3>
        </div>
        <button className="icon-only" onClick={props.onCancel}>
          <List size={20} />
        </button>
      </div>

      <label className="desktop-field">
        名称
        <input value={props.wheel.name} onChange={(event) => patchWheel({ name: event.target.value })} />
      </label>
      <label className="desktop-field">
        图标
        <input value={props.wheel.icon} onChange={(event) => patchWheel({ icon: event.target.value.slice(0, 4) || "🤔" })} />
      </label>
      <label className="desktop-field">
        动画时长
        <input
          type="number"
          min="1200"
          max="8000"
          step="100"
          value={props.wheel.spinDurationMs}
          onChange={(event) => patchWheel({ spinDurationMs: clampInt(event.target.value, 1200, 8000, props.wheel.spinDurationMs) })}
        />
      </label>

      <div className="option-toolbar">
        <h4>选项</h4>
        <button onClick={addOption}>
          <Plus size={18} />
          添加
        </button>
      </div>

      <div className="desktop-option-list">
        {props.wheel.options.map((option) => (
          <div className="desktop-option-row" key={option.id}>
            <button className="remove-option-button" disabled={props.wheel.options.length <= 2} onClick={() => removeOption(option.id)}>
              <Minus size={18} />
            </button>
            <input value={option.label} onChange={(event) => updateOption(option.id, { label: event.target.value })} />
            <button className="option-color-dot" style={{ backgroundColor: option.color }} aria-label={`${option.label} 颜色`} onClick={() => openColorEditor(option.id)} />
            <button className="weight-pill" aria-label={`${option.label} 权重`} onClick={() => openWeightEditor(option.id)}>
              <span>{formatPercent(option.weight, totalWeight)}</span>
              <em />
              <strong>权重</strong>
            </button>
            <input
              type="number"
              min="1"
              max={MAX_WEIGHT}
              value={option.weight}
              aria-label={`${option.label} 权重`}
              onChange={(event) => updateOption(option.id, { weight: Number(event.target.value) })}
            />
            <button disabled={props.wheel.options.length <= 2} onClick={() => removeOption(option.id)}>
              <Minus size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="editor-actions">
        {props.canDelete && (
          <button className="danger-button" onClick={props.onDelete}>
            <Trash2 size={18} />
            删除
          </button>
        )}
        <button className="save-button" onClick={() => props.onSave(props.wheel)}>
          保存
        </button>
      </div>

      {colorEditorOption && (
        <div className="editor-sheet-backdrop" onClick={() => setColorEditorOptionId(null)}>
          <div className="editor-sheet color-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-switch">
              <button className={colorMode === "preset" ? "active" : ""} onClick={() => setColorMode("preset")}>
                主要
              </button>
              <button className={colorMode === "custom" ? "active" : ""} onClick={() => setColorMode("custom")}>
                自定义
              </button>
            </div>
            <button className="sheet-close" aria-label="关闭颜色选择" onClick={() => setColorEditorOptionId(null)}>
              <X size={26} />
            </button>

            {colorMode === "preset" ? (
              <div className="preset-color-grid">
                {COLOR_PRESETS.map((color) => (
                  <button
                    className={`preset-color ${normalizeHex(colorEditorOption.color) === normalizeHex(color) ? "selected" : ""}`}
                    key={color}
                    style={{ backgroundColor: color }}
                    aria-label={`选择颜色 ${color}`}
                    onClick={() => updateOption(colorEditorOption.id, { color })}
                  />
                ))}
              </div>
            ) : (
              <CustomColorPicker color={colorEditorOption.color} onChange={updateCustomColor} />
            )}
          </div>
        </div>
      )}

      {weightEditorOption && (
        <div className="editor-sheet-backdrop" onClick={() => setWeightEditorOptionId(null)}>
          <div className="editor-sheet weight-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="sheet-close" aria-label="关闭权重编辑" onClick={() => setWeightEditorOptionId(null)}>
              <X size={26} />
            </button>
            <div className="weight-sheet-heading">
              <span style={{ backgroundColor: weightEditorOption.color }} />
              <div>
                <p>{weightEditorOption.label}</p>
                <strong>{formatPercent(weightEditorOption.weight, totalWeight)}</strong>
              </div>
            </div>
            <div className="weight-stepper">
              <button onClick={() => updateOption(weightEditorOption.id, { weight: weightEditorOption.weight - 1 })}>
                <Minus size={20} />
              </button>
              <input
                type="number"
                min="1"
                max={MAX_WEIGHT}
                value={weightEditorOption.weight}
                aria-label={`${weightEditorOption.label} 权重值`}
                onChange={(event) => updateOption(weightEditorOption.id, { weight: Number(event.target.value) })}
              />
              <button onClick={() => updateOption(weightEditorOption.id, { weight: weightEditorOption.weight + 1 })}>
                <Plus size={20} />
              </button>
            </div>
            <input
              className="weight-range"
              type="range"
              min="1"
              max={MAX_WEIGHT}
              value={weightEditorOption.weight}
              onChange={(event) => updateOption(weightEditorOption.id, { weight: Number(event.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomColorPicker(props: { color: string; onChange: (patch: Partial<RgbColor>) => void }) {
  const rgb = hexToRgb(props.color);
  const hsv = rgbToHsv(rgb);

  function updateFromArea(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
    const value = clampNumber(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    props.onChange(hsvToRgb({ hue: hsv.hue, saturation, value }));
  }

  return (
    <div className="custom-color-panel">
      <button
        className="color-area"
        style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
        onPointerDown={updateFromArea}
        onPointerMove={(event) => {
          if (event.buttons === 1) {
            updateFromArea(event);
          }
        }}
        aria-label="自定义颜色区域"
      >
        <span style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.value) * 100}%` }} />
      </button>
      <div className="custom-color-controls">
        <span className="custom-color-preview" style={{ backgroundColor: props.color }} />
        <input
          className="hue-slider"
          type="range"
          min="0"
          max="359"
          value={Math.round(hsv.hue)}
          aria-label="色相"
          onChange={(event) => props.onChange(hsvToRgb({ ...hsv, hue: Number(event.target.value) }))}
        />
      </div>
      <div className="rgb-editor">
        <strong>RGB</strong>
        <label>
          R
          <input type="number" min="0" max="255" value={rgb.red} onChange={(event) => props.onChange({ red: clampInt(event.target.value, 0, 255, rgb.red) })} />
        </label>
        <label>
          G
          <input type="number" min="0" max="255" value={rgb.green} onChange={(event) => props.onChange({ green: clampInt(event.target.value, 0, 255, rgb.green) })} />
        </label>
        <label>
          B
          <input type="number" min="0" max="255" value={rgb.blue} onChange={(event) => props.onChange({ blue: clampInt(event.target.value, 0, 255, rgb.blue) })} />
        </label>
      </div>
    </div>
  );
}

function NumberWorkspace(props: {
  config: NumberConfig;
  result: number[];
  error: string;
  isRolling: boolean;
  history: DecisionHistoryItem[];
  onGenerate: () => void;
  onConfigChange: (patch: Partial<NumberConfig>) => void;
}) {
  const visibleResult = props.result.length ? props.result.join("  ") : "42";

  return (
    <div className="number-workspace">
      <section className="number-main-panel">
        <div className="workspace-toolbar">
          <div>
            <p>随机数字</p>
            <h2>
              {props.config.min} ~ {props.config.max}
            </h2>
          </div>
          <button className="primary-pill" disabled={Boolean(props.error) || props.isRolling} onClick={props.onGenerate}>
            生成
          </button>
        </div>
        <button className="desktop-number-display" disabled={Boolean(props.error) || props.isRolling} onClick={props.onGenerate}>
          {props.isRolling ? <Shuffle className="rolling-icon" size={72} /> : visibleResult}
        </button>
        {props.error && <p className="number-error">{props.error}</p>}
      </section>

      <aside className="number-settings-drawer">
        <div className="summary-panel">
          <div className="panel-heading">
            <div>
              <p>数字设置</p>
              <h3>生成规则</h3>
            </div>
            <ClipboardList size={22} />
          </div>
          <div className="number-config-form">
            <label className="desktop-field">
              最小值
              <input type="number" value={props.config.min} onChange={(event) => props.onConfigChange({ min: Number(event.target.value) })} />
            </label>
            <label className="desktop-field">
              最大值
              <input type="number" value={props.config.max} onChange={(event) => props.onConfigChange({ max: Number(event.target.value) })} />
            </label>
            <label className="desktop-field">
              数量
              <input type="number" min="1" max="1000" value={props.config.count} onChange={(event) => props.onConfigChange({ count: Number(event.target.value) })} />
            </label>
            <label className="desktop-check">
              <input
                type="checkbox"
                checked={props.config.allowRepeats}
                onChange={(event) => props.onConfigChange({ allowRepeats: event.target.checked })}
              />
              允许重复
            </label>
            <label className="desktop-check">
              <input
                type="checkbox"
                checked={props.config.showOrdered}
                onChange={(event) => props.onConfigChange({ showOrdered: event.target.checked })}
              />
              按顺序展示结果
            </label>
            <div className="duration-control">
              <Clock3 size={20} />
              <span>动画时长</span>
              <button onClick={() => props.onConfigChange({ animationSeconds: clampInt(props.config.animationSeconds - 1, 1, 8, 4) })}>
                <Minus size={18} />
              </button>
              <strong>{props.config.animationSeconds}s</strong>
              <button onClick={() => props.onConfigChange({ animationSeconds: clampInt(props.config.animationSeconds + 1, 1, 8, 4) })}>
                <Plus size={18} />
              </button>
            </div>
          </div>
          <h4>最近数字</h4>
          <div className="compact-history">
            {props.history.length === 0 && <p>还没有数字结果。</p>}
            {props.history.map((item) => (
              <article key={item.id}>
                <strong>{Array.isArray(item.result) ? item.result.join(", ") : item.result}</strong>
                <time>{formatTime(item.createdAt)}</time>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function HistoryWorkspace(props: { history: DecisionHistoryItem[]; onClear: () => void }) {
  return (
    <section className="history-workspace">
      <div className="workspace-toolbar">
        <div>
          <p>全部结果</p>
          <h2>历史记录</h2>
        </div>
        <button className="ghost-button" disabled={!props.history.length} onClick={props.onClear}>
          清空历史
        </button>
      </div>
      <div className="history-table">
        {props.history.length === 0 && <div className="empty-state">还没有历史记录。</div>}
        {props.history.map((item) => (
          <article key={item.id}>
            <span>{item.type === "wheel" ? "转盘" : "随机数字"}</span>
            <strong>{Array.isArray(item.result) ? item.result.join(", ") : item.result}</strong>
            <em>{item.sourceName}</em>
            <time>{formatTime(item.createdAt)}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildSegments(options: WheelOption[]): WheelSegment[] {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = 0;
  return options.map((option) => {
    const span = (option.weight / total) * 360;
    const segment = {
      option,
      start: cursor,
      end: cursor + span,
      center: cursor + span / 2,
      span
    };
    cursor += span;
    return segment;
  });
}

function pickWeighted(options: WheelOption[]): WheelOption {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let needle = Math.random() * total;
  for (const option of options) {
    needle -= option.weight;
    if (needle <= 0) {
      return option;
    }
  }
  return options[options.length - 1];
}

function getPointedSegmentLabel(wheelElement: HTMLDivElement | null, segments: WheelSegment[]): string {
  return getPointedSegment(wheelElement, segments)?.option.label ?? "";
}

function getPointedSegment(wheelElement: HTMLDivElement | null, segments: WheelSegment[]): WheelSegment | null {
  if (!wheelElement || segments.length === 0) {
    return null;
  }

  const rotation = getCurrentRotationDegrees(wheelElement) ?? 0;
  const localPointerAngle = normalizeDegrees(0 - rotation);
  return getSegmentAtLocalAngle(segments, localPointerAngle);
}

function getSegmentAtLocalAngle(segments: WheelSegment[], localAngle: number): WheelSegment | null {
  if (segments.length === 0) {
    return null;
  }
  return segments.find((segment) => localAngle >= segment.start && localAngle < segment.end) ?? segments[segments.length - 1];
}

function getCurrentRotationDegrees(wheelElement: HTMLDivElement | null): number | null {
  if (!wheelElement) {
    return null;
  }
  const transform = window.getComputedStyle(wheelElement).transform;
  const match = transform.match(/matrix\(([^,]+),\s*([^,]+)/);
  if (!match) {
    return 0;
  }
  const radians = match ? Math.atan2(Number(match[2]), Number(match[1])) : 0;
  return normalizeDegrees((radians * 180) / Math.PI);
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function formatPercent(weight: number, totalWeight: number): string {
  if (totalWeight <= 0) {
    return "0%";
  }
  return `${Math.round((weight / totalWeight) * 100)}%`;
}

function normalizeHex(value: string): string {
  return value.trim().toLowerCase();
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { red: 255, green: 59, blue: 48 };
  }
  return {
    red: parseInt(normalized.slice(0, 2), 16),
    green: parseInt(normalized.slice(2, 4), 16),
    blue: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(color: RgbColor): string {
  return `#${toHex(clampNumber(Math.round(color.red), 0, 255))}${toHex(clampNumber(Math.round(color.green), 0, 255))}${toHex(clampNumber(Math.round(color.blue), 0, 255))}`;
}

function rgbToHsv(color: RgbColor): HsvColor {
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }
  return {
    hue: normalizeDegrees(hue),
    saturation: max === 0 ? 0 : delta / max,
    value: max
  };
}

function hsvToRgb(color: HsvColor): RgbColor {
  const chroma = color.value * color.saturation;
  const x = chroma * (1 - Math.abs(((color.hue / 60) % 2) - 1));
  const m = color.value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (color.hue < 60) {
    red = chroma;
    green = x;
  } else if (color.hue < 120) {
    red = x;
    green = chroma;
  } else if (color.hue < 180) {
    green = chroma;
    blue = x;
  } else if (color.hue < 240) {
    green = x;
    blue = chroma;
  } else if (color.hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }
  return {
    red: Math.round((red + m) * 255),
    green: Math.round((green + m) * 255),
    blue: Math.round((blue + m) * 255)
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function darkenColor(hex: string, factor: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }
  const red = Math.max(0, Math.round(parseInt(normalized.slice(0, 2), 16) * factor));
  const green = Math.max(0, Math.round(parseInt(normalized.slice(2, 4), 16) * factor));
  const blue = Math.max(0, Math.round(parseInt(normalized.slice(4, 6), 16) * factor));
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function getNumberError(config: NumberConfig): string {
  if (!Number.isFinite(config.min) || !Number.isFinite(config.max)) {
    return "范围必须是有效数字。";
  }
  if (config.min > config.max) {
    return "最小值不能大于最大值。";
  }
  if (config.count < 1) {
    return "数量至少为 1。";
  }
  const available = config.max - config.min + 1;
  if (!config.allowRepeats && config.count > available) {
    return "不允许重复时，数量不能超过可用数字个数。";
  }
  return "";
}

function createRandomNumbers(config: NumberConfig): number[] {
  const min = Math.trunc(config.min);
  const max = Math.trunc(config.max);
  const count = Math.trunc(config.count);

  if (config.allowRepeats) {
    return Array.from({ length: count }, () => randomInt(min, max));
  }

  const pool = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default App;
