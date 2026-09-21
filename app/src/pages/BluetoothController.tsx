import { useState, useEffect, useRef } from 'react';
import { useBle } from '../hooks/useBle';
import {
  CMD,
  TEXT_MODE_LABELS,
  LIGHT_MODE_COLORS,
} from '../utils/bleCommands';
import {
  createTenBandEq,
  displayToWireDb,
} from '../utils/eqMapping';
import type { EqBand } from '../utils/eqMapping';
import '../styles/utilities.css';

// =============================================================================
// Helper type for control state tracking (used in stateRef for async handlers)
// =============================================================================
interface ControlState {
  enabled: boolean;
  value: number;
}

// =============================================================================
// Component
// =============================================================================
export default function BluetoothController() {
  const ble = useBle();

  // ======================================================================
  // Shared style fragments (used across helper render functions)
  // ======================================================================

  const btnBase =
    'glass-btn-secondary rounded-full px-5 py-2.5 text-sm font-medium max-sm:w-full max-sm:py-3 max-sm:text-sm';
  const btnPrimary =
    'glass-btn-primary rounded-full px-5 py-2.5 text-sm font-medium max-sm:w-full max-sm:py-3 max-sm:text-sm';
  const btnDanger =
    'glass-btn-danger rounded-full px-5 py-2.5 text-sm font-medium max-sm:w-full max-sm:py-3 max-sm:text-sm';

  const infoCardClass =
    'bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-[20px] p-4 my-4 max-sm:p-3 max-sm:rounded-2xl max-sm:my-3';

  const tabBtnBase =
    'flex-1 bg-transparent border-none border-b-2 border-transparent -mb-0.5 px-3 py-2.5 text-sm font-medium text-slate-500 rounded-none shadow-none cursor-pointer transition-all max-sm:text-xs max-sm:px-1 max-sm:py-2.5 max-sm:whitespace-nowrap max-sm:min-w-0';

  const effectRowClass =
    'flex items-center gap-2.5 py-[7px] border-b border-slate-50 flex-wrap min-h-[40px] last:border-b-0';

  // ======================================================================
  // Alert banner (deprecated – kept for dev visibility)
  // ======================================================================
  // (Removed as it was empty in original)

  // ======================================================================
  // State
  // ======================================================================

  const [activeTab, setActiveTab] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [textColorEnabled, setTextColorEnabled] = useState(false);
  const [textColorValue, setTextColorValue] = useState(128);
  const [textGradientEnabled, setTextGradientEnabled] = useState(false);
  const [textGradientSpeed, setTextGradientSpeed] = useState(8);
  const [textScrollEnabled, setTextScrollEnabled] = useState(false);
  const [textScrollSpeed, setTextScrollSpeed] = useState(8);
  const [textBrightnessEnabled, setTextBrightnessEnabled] = useState(false);
  const [textBrightnessValue, setTextBrightnessValue] = useState(8);
  const [textModeActive, setTextModeActive] = useState<number | null>(null);

  const [lightModeActive, setLightModeActive] = useState<number | null>(null);
  const [lightAutoEnabled, setLightAutoEnabled] = useState(false);
  const [lightAutoParam, setLightAutoParam] = useState(128);
  const [lightColorEnabled, setLightColorEnabled] = useState(false);
  const [lightColorValue, setLightColorValue] = useState(128);
  const [lightBrightnessEnabled, setLightBrightnessEnabled] = useState(false);
  const [lightBrightnessValue, setLightBrightnessValue] = useState(8);
  const [lightSpeedEnabled, setLightSpeedEnabled] = useState(false);
  const [lightSpeedValue, setLightSpeedValue] = useState(8);

  const [micVolEnabled, setMicVolEnabled] = useState(false);
  const [micVolValue, setMicVolValue] = useState(16);
  const [micPriorityEnabled, setMicPriorityEnabled] = useState(false);
  const [micPriorityValue, setMicPriorityValue] = useState(16);
  const [micEqBands, setMicEqBands] = useState<EqBand[]>(() =>
    createTenBandEq(),
  );
  const [micEqEnabled, setMicEqEnabled] = useState(false);
  const [micEchoEnabled, setMicEchoEnabled] = useState(false);
  const [micEchoValue, setMicEchoValue] = useState(16);
  const [micReverbEnabled, setMicReverbEnabled] = useState(false);
  const [micReverbValue, setMicReverbValue] = useState(16);
  const [micMagicEnabled, setMicMagicEnabled] = useState(false);
  const [micMagicValue, setMicMagicValue] = useState(0);

  const [musicVolEnabled, setMusicVolEnabled] = useState(false);
  const [musicVolValue, setMusicVolValue] = useState(16);
  const [musicTrebleEnabled, setMusicTrebleEnabled] = useState(false);
  const [musicTrebleValue, setMusicTrebleValue] = useState(16);
  const [musicMidEnabled, setMusicMidEnabled] = useState(false);
  const [musicMidValue, setMusicMidValue] = useState(16);
  const [musicBassEnabled, setMusicBassEnabled] = useState(false);
  const [musicBassValue, setMusicBassValue] = useState(16);
  const [musicEqBands, setMusicEqBands] = useState<EqBand[]>(() =>
    createTenBandEq(),
  );
  const [musicEqEnabled, setMusicEqEnabled] = useState(false);
  const [music3dEnabled, setMusic3dEnabled] = useState(false);
  const [music3dValue, setMusic3dValue] = useState(16);
  const [musicVocalCutEnabled, setMusicVocalCutEnabled] = useState(false);
  const [musicVocalCutValue, setMusicVocalCutValue] = useState(16);
  const [musicVbEnabled, setMusicVbEnabled] = useState(false);
  const [musicVbValue, setMusicVbValue] = useState(16);
  const [musicExciterEnabled, setMusicExciterEnabled] = useState(false);
  const [musicExciterValue, setMusicExciterValue] = useState(16);

  // Ref for state used inside callbacks
  const stateRef = useRef<Record<number, ControlState>>({});

  // Keep stateRef in sync
  useEffect(() => {
    const m: Record<number, ControlState> = {};
    const set = (cmd: number, enabled: boolean, value: number) => {
      m[cmd] = { enabled, value };
    };
    set(CMD.TEXT_COLOR_ONE, textColorEnabled, textColorValue);
    set(CMD.TEXT_COLOR_AUTO_Speed, textGradientEnabled, textGradientSpeed);
    set(CMD.TEXT_Scroll_Speed, textScrollEnabled, textScrollSpeed);
    set(CMD.TEXT_LIGHT, textBrightnessEnabled, textBrightnessValue);
    set(CMD.LIGHT_COLOR_SET, lightColorEnabled, lightColorValue);
    set(CMD.LIGHT_VAL_SET, lightBrightnessEnabled, lightBrightnessValue);
    set(CMD.LIGHT_SPEED_SET, lightSpeedEnabled, lightSpeedValue);
    set(CMD.LIGHT_AUTO_EN, lightAutoEnabled, lightAutoParam);
    set(CMD.EQ_MIC_VAL, micVolEnabled, micVolValue);
    set(CMD.EQ_MIC_priority, micPriorityEnabled, micPriorityValue);
    set(CMD.EQ_MIC_ECHO, micEchoEnabled, micEchoValue);
    set(CMD.EQ_MIC_REVERB, micReverbEnabled, micReverbValue);
    set(CMD.EQ_MIC_Magic_Sound, micMagicEnabled, micMagicValue);
    set(CMD.EQ_VOL_VAL, musicVolEnabled, musicVolValue);
    set(CMD.EQ_VOL_TRE, musicTrebleEnabled, musicTrebleValue);
    set(CMD.EQ_VOL_MID, musicMidEnabled, musicMidValue);
    set(CMD.EQ_VOL_BASS, musicBassEnabled, musicBassValue);
    set(CMD.EQ_VOL_3D, music3dEnabled, music3dValue);
    set(CMD.EQ_Voice_Cut, musicVocalCutEnabled, musicVocalCutValue);
    set(CMD.EQ_VOL_VB, musicVbEnabled, musicVbValue);
    set(CMD.EQ_Voice_EXCITER, musicExciterEnabled, musicExciterValue);
    stateRef.current = m;
  }, [
    textColorEnabled, textColorValue,
    textGradientEnabled, textGradientSpeed,
    textScrollEnabled, textScrollSpeed,
    textBrightnessEnabled, textBrightnessValue,
    lightColorEnabled, lightColorValue,
    lightBrightnessEnabled, lightBrightnessValue,
    lightSpeedEnabled, lightSpeedValue,
    lightAutoEnabled, lightAutoParam,
    micVolEnabled, micVolValue,
    micPriorityEnabled, micPriorityValue,
    micEchoEnabled, micEchoValue,
    micReverbEnabled, micReverbValue,
    micMagicEnabled, micMagicValue,
    musicVolEnabled, musicVolValue,
    musicTrebleEnabled, musicTrebleValue,
    musicMidEnabled, musicMidValue,
    musicBassEnabled, musicBassValue,
    music3dEnabled, music3dValue,
    musicVocalCutEnabled, musicVocalCutValue,
    musicVbEnabled, musicVbValue,
    musicExciterEnabled, musicExciterValue,
  ]);

  const textModeActiveRef = useRef<number | null>(null);
  const lightModeActiveRef = useRef<number | null>(null);
  const textColorSliderRef = useRef<HTMLInputElement | null>(null);
  const lightColorSliderRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { textModeActiveRef.current = textModeActive; }, [textModeActive]);
  useEffect(() => { lightModeActiveRef.current = lightModeActive; }, [lightModeActive]);

  // ======================================================================
  // Sub-component: effect slider row (label + toggle + slider + value)
  // ======================================================================

  function effectSliderRow(
    label: string,
    cmd: number,
    enabled: boolean,
    value: number,
    setEnabled: (v: boolean) => void,
    setValue: (v: number) => void,
    min: number,
    max: number,
  ) {
    const disabled =
      !ble.controlsEnabled || !ble.supportedCommands.has(cmd);

    const handleToggle = async (checked: boolean) => {
      const s = stateRef.current[cmd] || { enabled: false, value: 0 };
      const ok = await ble.sendCommand(cmd, [checked ? 1 : 0, s.value]);
      if (ok) setEnabled(checked);
    };

    const handleSlider = async (newValue: number) => {
      setValue(newValue);
      const s = stateRef.current[cmd] || { enabled: false, value: 0 };
      await ble.sendCommand(cmd, [s.enabled ? 1 : 0, newValue]);
    };

    return (
      <div className={effectRowClass} key={cmd}>
        <span className="text-[0.82rem] font-medium text-slate-700 min-w-[70px] whitespace-nowrap">{label}</span>
        <div className="shrink-0">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              disabled={disabled}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[100px]">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            onChange={(e) => handleSlider(Number(e.target.value))}
            className="flex-1 min-w-[60px] max-w-[160px]"
          />
          <span className="text-xs text-slate-500 min-w-[28px] text-right">{value}</span>
        </div>
      </div>
    );
  }

  // ======================================================================
  // Helper: color control row (toggle + preview + hue slider)
  // ======================================================================
  function colorControlRow(
    label: string,
    cmd: number,
    enabled: boolean,
    value: number,
    setEnabled: (v: boolean) => void,
    setValue: (v: number) => void,
    sliderRef: { current: HTMLInputElement | null },
  ) {
    const disabled =
      !ble.controlsEnabled || !ble.supportedCommands.has(cmd);
    const hue = Math.round((value / 255) * 360);

    const handleToggle = async (checked: boolean) => {
      const s = stateRef.current[cmd] || { enabled: false, value: 0 };
      const ok = await ble.sendCommand(cmd, [checked ? 1 : 0, s.value]);
      if (ok) setEnabled(checked);
    };

    const handleSlider = async (newValue: number) => {
      setValue(newValue);
      const newHue = Math.round((newValue / 255) * 360);
      if (sliderRef.current) {
        sliderRef.current.style.setProperty(
          '--thumb-color',
          `hsl(${newHue},100%,50%)`,
        );
      }
      const s = stateRef.current[cmd] || { enabled: false, value: 0 };
      await ble.sendCommand(cmd, [s.enabled ? 1 : 0, newValue]);
    };

    return (
      <>
        {/* First row: label + toggle + preview */}
        <div className={effectRowClass} key={`${cmd}-row1`}>
          <span className="text-[0.82rem] font-medium text-slate-700 min-w-[70px] whitespace-nowrap">{label}</span>
          <div className="shrink-0">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                disabled={disabled}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div
            className="w-[140px] h-16 rounded-xl border-2 border-slate-200 shrink-0 transition-all m-1.5 shadow-md"
            style={{ background: `hsl(${hue},100%,50%)` }}
          />
        </div>
        {/* Second row: hue slider + degree display */}
        <div className={effectRowClass} key={`${cmd}-row2`}>
          <span className="text-[0.82rem] font-medium min-w-[70px] whitespace-nowrap" />
          <div className="flex items-center gap-2 flex-1 min-w-[100px]">
            <input
              ref={sliderRef}
              type="range"
              className="hue-slider"
              min={0}
              max={255}
              value={value}
              disabled={disabled}
              onChange={(e) => handleSlider(Number(e.target.value))}
            />
            <span className="text-xs text-slate-500 min-w-[52px] text-center tabular-nums">色相: {hue}°</span>
          </div>
        </div>
      </>
    );
  }

  // ======================================================================
  // Helper: render mode buttons (exclusive selection group)
  // ======================================================================
  function modeButtons(
    containerKey: string,
    labels: string[],
    startCmd: number,
    activeIndex: number | null,
    setActiveIndex: (i: number | null) => void,
    activeIndexRef: { current: number | null },
    colors?: string[],
  ) {
    return (
      <div className="grid grid-cols-4 gap-2 py-1.5 pb-2.5" key={containerKey}>
        {labels.map((label, i) => {
          const cmd = startCmd + i;
          const isActive = activeIndex === i;
          const disabled =
            !ble.controlsEnabled || !ble.supportedCommands.has(cmd);

          const handleClick = async () => {
            if (disabled) return;
            if (activeIndex === i) {
              await ble.sendCommand(cmd, [1]);
              return;
            }
            const ok = await ble.sendCommand(cmd, [1]);
            if (ok) {
              activeIndexRef.current = i;
              setActiveIndex(i);
              ble.addLog(`[${containerKey}] ${label}: 选中`);
            }
          };

          return (
            <button
              key={i}
              className={`bg-slate-50 border-[1.5px] border-slate-200 rounded-[10px] py-2.5 px-1 text-xs font-medium cursor-pointer transition-all text-slate-600 shadow-none text-center active:scale-95${isActive ? ' !bg-blue-500 !border-blue-500 !text-white' : ''}`}
              type="button"
              disabled={disabled}
              onClick={handleClick}
              style={
                colors
                  ? {
                      background: colors[i],
                      color: '#fff',
                      borderColor: 'transparent',
                      opacity: isActive ? '1' : '0.58',
                    }
                  : undefined
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // ======================================================================
  // Helper: action/save button
  // ======================================================================
  function actionButton(
    key: string,
    label: string,
    cmd: number,
    variant: 'primary' | 'danger' = 'primary',
    params: number[] = [1],
  ) {
    const disabled =
      !ble.controlsEnabled || !ble.supportedCommands.has(cmd);

    const handleClick = async () => {
      if (disabled) return;
      const ok = await ble.sendCommand(cmd, params);
      if (ok) ble.addLog(`[${label}] 已发送`);
    };

    return (
      <button
        key={key}
        className={variant === 'primary' ? btnPrimary : btnDanger}
        disabled={disabled}
        onClick={handleClick}
      >
        {label}
      </button>
    );
  }

  // ======================================================================
  // Helper: text content send row
  // ======================================================================
  function textContentRow() {
    const disabled =
      !ble.controlsEnabled ||
      !ble.supportedCommands.has(CMD.TEXT_Content);

    const handleSend = async () => {
      if (disabled || !textContent.trim()) return;
      const bytes = Array.from(new TextEncoder().encode(textContent.trim()));
      const ok = await ble.sendCommand(CMD.TEXT_Content, bytes);
      if (ok) {
        ble.addLog(`[文字] 发送内容: ${textContent.trim()}`);
        setTextContent('');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSend();
    };

    return (
      <div className="flex gap-2 py-2.5 border-b border-slate-50 max-sm:flex-col" key="textContent">
        <input
          type="text"
          id="textContent"
          placeholder="输入文字..."
          value={textContent}
          disabled={disabled}
          onChange={(e) => setTextContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 py-2 px-3 border border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-500 max-sm:w-full max-sm:box-border"
        />
        <button
          id="textSendBtn"
          className={btnPrimary + ' !rounded-[10px] !px-[18px] !py-2 !text-sm shrink-0 max-sm:w-full'}
          disabled={disabled}
          onClick={handleSend}
        >
          发送
        </button>
      </div>
    );
  }

  // ======================================================================
  // Helper: render EQ strip (10 band vertical sliders)
  // ======================================================================
  function eqStrip(
    key: string,
    bands: EqBand[],
    setBands: (bands: EqBand[]) => void,
    cmd: number,
    enabled: boolean,
    setEnabled: (v: boolean) => void,
  ) {
    const disabled =
      !ble.controlsEnabled || !ble.supportedCommands.has(cmd);

    const sendEq = async (newEnabled: boolean, newBands: EqBand[]) => {
      const values = newBands.map((b) => displayToWireDb(b.value));
      const ok = await ble.sendCommand(cmd, [newEnabled ? 1 : 0, ...values]);
      if (ok)
        ble.addLog(
          `[${key}] ${newEnabled ? '开启' : '关闭'} EQ=[${newBands.map((b) => `${b.value}dB`).join(', ')}]`,
        );
    };

    const handleToggle = async (checked: boolean) => {
      setEnabled(checked);
      await sendEq(checked, bands);
    };

    const handleBandChange = (i: number, rawValue: number) => {
      const clamped = Math.max(bands[i].min, Math.min(bands[i].max, Math.round(rawValue)));
      const newBands = bands.map((b, j) => (j === i ? { ...b, value: clamped } : b));
      setBands(newBands);
    };

    const handleBandCommit = async () => {
      await sendEq(enabled, bands);
    };

    const toggleRow = (
      <div className={effectRowClass} key={`${key}-eq-toggle`}>
        <span className="text-[0.82rem] font-medium text-slate-700 min-w-[70px] whitespace-nowrap">{key} EQ</span>
        <div className="shrink-0">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              disabled={disabled}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    );

    const sliderRow = (
      <div className="flex gap-1 items-stretch my-1 overflow-x-auto pb-1" key={`${key}-eq-bands`}>
        <div className="flex flex-col justify-between h-[170px] pr-1 text-[0.6rem] text-slate-400 shrink-0 mb-[22px] min-w-[30px] text-right">
          <span>+12</span>
          <span>+6</span>
          <span>0</span>
          <span>-6</span>
          <span>-12</span>
        </div>
        {bands.map((band, i) => (
          <div className="flex flex-col items-center shrink-0 min-w-[40px]" key={i}>
            <input
              type="range"
              className="eq-slider-vertical w-8 h-[150px] px-0.5 my-1"
              min={band.min}
              max={band.max}
              value={band.value}
              step="1"
              disabled={disabled}
              onChange={(e) => handleBandChange(i, Number(e.target.value))}
              onMouseUp={handleBandCommit}
              onKeyUp={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  handleBandCommit();
                }
              }}
            />
            <input
              type="number"
              className="w-[38px] text-center p-0.5 rounded border border-slate-200 text-[0.65rem] bg-white"
              min={band.min}
              max={band.max}
              value={band.value}
              step="1"
              disabled={disabled}
              onChange={(e) => handleBandChange(i, Number(e.target.value))}
              onBlur={handleBandCommit}
            />
            <span className="font-semibold mt-0.5 text-[0.62rem] text-slate-600">{band.label}</span>
          </div>
        ))}
      </div>
    );

    return [toggleRow, sliderRow];
  }

  // ======================================================================
  // Helper: mic magic sound (toggle + select)
  // ======================================================================
  function micMagicControl() {
    const cmd = CMD.EQ_MIC_Magic_Sound;
    const disabled =
      !ble.controlsEnabled || !ble.supportedCommands.has(cmd);
    const magicNames = ['关闭', '儿童', '女声', '男声', '电音'];

    const handleToggle = async (checked: boolean) => {
      const s = stateRef.current[cmd] || { enabled: false, value: 0 };
      const ok = await ble.sendCommand(cmd, [checked ? 1 : 0, s.value]);
      if (ok) setMicMagicEnabled(checked);
    };

    const handleSelect = async (
      e: React.ChangeEvent<HTMLSelectElement>,
    ) => {
      const newVal = Number(e.target.value);
      setMicMagicValue(newVal);
      const s = stateRef.current[cmd] || { enabled: false, value: 0 };
      const ok = await ble.sendCommand(cmd, [s.enabled ? 1 : 0, newVal]);
      if (ok)
        ble.addLog(
          `[麦克风] 魔音效果: ${magicNames[newVal] || newVal}`,
        );
    };

    return (
      <div className={effectRowClass} key="mic-magic">
        <span className="text-[0.82rem] font-medium text-slate-700 min-w-[70px] whitespace-nowrap">魔音效果</span>
        <div className="shrink-0">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={micMagicEnabled}
              disabled={disabled}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        <select
          className="py-[5px] px-2.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-blue-500"
          value={micMagicValue}
          disabled={disabled}
          onChange={handleSelect}
        >
          {magicNames.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ======================================================================
  // Render
  // ======================================================================
  const bleStatusDotClass = `status-dot${ble.bleStatusConnected ? ' connected' : ''}`;

  return (
    <div className="font-sans bg-[var(--bg-body)] text-[var(--text-body)] min-h-screen p-4 max-sm:p-2">
      <div className="max-w-[700px] mx-auto glass-panel rounded-[28px] max-sm:rounded-2xl max-sm:max-w-full p-5 max-sm:p-3 overflow-hidden">
        <h1 className="text-[1.65rem] max-sm:text-xl font-semibold m-0 mb-1.5 flex items-center gap-2.5 flex-wrap justify-between">
          BLE 蓝牙调试器
          <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-normal">Web Bluetooth API</span>
        </h1>
        <div className="text-slate-500 text-xs mb-5 border-l-[3px] border-blue-500 pl-3">
          支持 Android Chrome / Edge · 扫描 BLE 设备 · 读取设备信息/电池电量
        </div>

        {/* ---- Button group ---- */}
        <div className="flex flex-wrap gap-3 my-5 max-sm:flex-col max-sm:gap-2">
          <button className={btnPrimary} onClick={ble.scanAndConnect}>
            扫描 &amp; 连接设备
          </button>
          <button
            className={btnBase}
            disabled={!ble.isConnected}
            onClick={ble.disconnect}
          >
            断开连接
          </button>
          <button
            className={btnBase}
            disabled={!ble.isConnected}
            onClick={ble.refreshDeviceInfo}
          >
            读取设备信息
          </button>
        </div>

        {/* ---- Device Dashboard ---- */}
        <div className={infoCardClass}>
          <div className="flex justify-between items-center gap-3 mb-3.5 max-sm:flex-col max-sm:items-start max-sm:gap-2.5">
            <div>
              <div className="text-[0.95rem] font-bold text-slate-900">设备状态</div>
              <div className="text-xs text-slate-500 mt-0.5">BLE 连接与基础信息</div>
            </div>
            <div className="min-w-[112px] inline-flex items-center justify-center gap-1.5 px-2.5 py-[7px] rounded-full bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap max-sm:w-full max-sm:justify-start" id="bleStatus">
              <span className={bleStatusDotClass} />
              {ble.bleStatusText}
            </div>
          </div>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2.5 max-sm:gap-2">
            <div className="min-h-[74px] max-sm:min-h-[66px] bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2">
              <span className="text-slate-500 text-xs font-semibold">蓝牙名称</span>
              <span className="text-slate-900 text-sm font-bold leading-[1.25] break-words" id="deviceName">
                {ble.deviceName}
              </span>
            </div>
            <div className="min-h-[74px] max-sm:min-h-[66px] bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2">
              <span className="text-slate-500 text-xs font-semibold">电量</span>
              <span className="text-slate-900 text-sm font-bold font-mono leading-[1.25] break-words" id="batteryLevel">
                {ble.batteryLevel}
              </span>
            </div>
            <div className="min-h-[74px] max-sm:min-h-[66px] bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2">
              <span className="text-slate-500 text-xs font-semibold">制造商</span>
              <span className="text-slate-900 text-sm font-bold leading-[1.25] break-words" id="manufacturer">
                {ble.manufacturer}
              </span>
            </div>
          </div>
        </div>

        {/* ---- Control Card ---- */}
        <div
          className={`${infoCardClass}${!ble.controlsEnabled ? ' opacity-[0.58] [&_input:disabled]:opacity-55 [&_input:disabled]:cursor-not-allowed [&_select:disabled]:opacity-55 [&_select:disabled]:cursor-not-allowed [&_button:disabled]:opacity-55 [&_button:disabled]:cursor-not-allowed' : ''}`}
          id="controlCard"
        >
          {/* Tab Navigation */}
          <div className="flex border-b-2 border-slate-200 max-sm:overflow-x-auto">
            {['text', 'light', 'mic', 'music'].map((tab) => (
              <button
                key={tab}
                className={`${tabBtnBase}${activeTab === tab ? ' !text-blue-500 !border-blue-500 !bg-transparent' : ''}`}
                data-tab={tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'text'
                  ? '文字'
                  : tab === 'light'
                    ? '灯光'
                    : tab === 'mic'
                      ? '麦克风'
                      : '音乐'}
              </button>
            ))}
          </div>

          {/* ====== TEXT PANEL ====== */}
          <div
            className={`${activeTab === 'text' ? '' : 'hidden'} pt-4 max-sm:pt-3`}
            id="panel-text"
          >
            <div className="mt-3.5 first:mt-0">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">文字内容</div>
              {textContentRow()}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">显示模式</div>
              {modeButtons(
                'text',
                TEXT_MODE_LABELS,
                CMD.TEXT_MODE_0,
                textModeActive,
                setTextModeActive,
                textModeActiveRef,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">样式设置</div>
              {colorControlRow(
                '单色颜色',
                CMD.TEXT_COLOR_ONE,
                textColorEnabled,
                textColorValue,
                setTextColorEnabled,
                setTextColorValue,
                textColorSliderRef,
              )}
              {effectSliderRow(
                '渐变速度',
                CMD.TEXT_COLOR_AUTO_Speed,
                textGradientEnabled,
                textGradientSpeed,
                setTextGradientEnabled,
                setTextGradientSpeed,
                0,
                16,
              )}
              {effectSliderRow(
                '滚动速度',
                CMD.TEXT_Scroll_Speed,
                textScrollEnabled,
                textScrollSpeed,
                setTextScrollEnabled,
                setTextScrollSpeed,
                0,
                16,
              )}
              {effectSliderRow(
                '亮度',
                CMD.TEXT_LIGHT,
                textBrightnessEnabled,
                textBrightnessValue,
                setTextBrightnessEnabled,
                setTextBrightnessValue,
                0,
                16,
              )}
            </div>

            <div className="mt-3.5">
              <div className="flex gap-2.5 py-2.5 flex-wrap">
                {actionButton('textSave', '保存设置', CMD.TEXT_SAVE, 'primary')}
              </div>
            </div>
          </div>

          {/* ====== LIGHT PANEL ====== */}
          <div
            className={`${activeTab === 'light' ? '' : 'hidden'} pt-4 max-sm:pt-3`}
            id="panel-light"
          >
            <div className="mt-3.5 first:mt-0">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">灯光模式 (1~16)</div>
              {modeButtons(
                'light',
                Array.from({ length: 16 }, (_, i) => `模式${i + 1}`),
                CMD.LIGHT_MODE_0,
                lightModeActive,
                setLightModeActive,
                lightModeActiveRef,
                LIGHT_MODE_COLORS,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">自动模式</div>
              {effectSliderRow(
                '自动模式',
                CMD.LIGHT_AUTO_EN,
                lightAutoEnabled,
                lightAutoParam,
                setLightAutoEnabled,
                setLightAutoParam,
                5,
                255,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">参数设置</div>
              {colorControlRow(
                '颜色',
                CMD.LIGHT_COLOR_SET,
                lightColorEnabled,
                lightColorValue,
                setLightColorEnabled,
                setLightColorValue,
                lightColorSliderRef,
              )}
              {effectSliderRow(
                '亮度',
                CMD.LIGHT_VAL_SET,
                lightBrightnessEnabled,
                lightBrightnessValue,
                setLightBrightnessEnabled,
                setLightBrightnessValue,
                0,
                16,
              )}
              {effectSliderRow(
                '速度',
                CMD.LIGHT_SPEED_SET,
                lightSpeedEnabled,
                lightSpeedValue,
                setLightSpeedEnabled,
                setLightSpeedValue,
                0,
                16,
              )}
            </div>

            <div className="mt-3.5">
              <div className="flex gap-2.5 py-2.5 flex-wrap">
                {actionButton('lightSave', '保存设置', CMD.LIGHT_SAVE, 'primary')}
              </div>
            </div>
          </div>

          {/* ====== MIC PANEL ====== */}
          <div
            className={`${activeTab === 'mic' ? '' : 'hidden'} pt-4 max-sm:pt-3`}
            id="panel-mic"
          >
            <div className="mt-3.5 first:mt-0">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">MIC 音量控制</div>
              {effectSliderRow(
                'MIC 音量',
                CMD.EQ_MIC_VAL,
                micVolEnabled,
                micVolValue,
                setMicVolEnabled,
                setMicVolValue,
                0,
                32,
              )}
              {effectSliderRow(
                'MIC 优先',
                CMD.EQ_MIC_priority,
                micPriorityEnabled,
                micPriorityValue,
                setMicPriorityEnabled,
                setMicPriorityValue,
                0,
                32,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">均衡器 (EQ) 10 频点</div>
              {eqStrip(
                'MIC',
                micEqBands,
                setMicEqBands,
                CMD.EQ_MIC_FRE_VAL,
                micEqEnabled,
                setMicEqEnabled,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">MIC 效果</div>
              {effectSliderRow(
                '回声',
                CMD.EQ_MIC_ECHO,
                micEchoEnabled,
                micEchoValue,
                setMicEchoEnabled,
                setMicEchoValue,
                0,
                32,
              )}
              {effectSliderRow(
                '混响',
                CMD.EQ_MIC_REVERB,
                micReverbEnabled,
                micReverbValue,
                setMicReverbEnabled,
                setMicReverbValue,
                0,
                32,
              )}
              {micMagicControl()}
            </div>

            <div className="mt-3.5">
              <div className="flex gap-2.5 py-2.5 flex-wrap">
                {actionButton('micReset', '一键恢复默认', CMD.EQ_MIC_RESET, 'danger')}
                {actionButton('micSave', '保存设置', CMD.EQ_MIC_SAVE, 'primary')}
              </div>
            </div>
          </div>

          {/* ====== MUSIC PANEL ====== */}
          <div
            className={`${activeTab === 'music' ? '' : 'hidden'} pt-4 max-sm:pt-3`}
            id="panel-music"
          >
            <div className="mt-3.5 first:mt-0">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">主音量控制</div>
              {effectSliderRow(
                '主音量',
                CMD.EQ_VOL_VAL,
                musicVolEnabled,
                musicVolValue,
                setMusicVolEnabled,
                setMusicVolValue,
                0,
                32,
              )}
              {effectSliderRow(
                '高音',
                CMD.EQ_VOL_TRE,
                musicTrebleEnabled,
                musicTrebleValue,
                setMusicTrebleEnabled,
                setMusicTrebleValue,
                0,
                32,
              )}
              {effectSliderRow(
                '中音',
                CMD.EQ_VOL_MID,
                musicMidEnabled,
                musicMidValue,
                setMusicMidEnabled,
                setMusicMidValue,
                0,
                32,
              )}
              {effectSliderRow(
                '低音',
                CMD.EQ_VOL_BASS,
                musicBassEnabled,
                musicBassValue,
                setMusicBassEnabled,
                setMusicBassValue,
                0,
                32,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">均衡器 (EQ) 10 频点</div>
              {eqStrip(
                '音乐',
                musicEqBands,
                setMusicEqBands,
                CMD.EQ_VOL_FRE_VAL,
                musicEqEnabled,
                setMusicEqEnabled,
              )}
            </div>

            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-600 mb-1.5 py-1.5 border-b border-slate-100">音效增强</div>
              {effectSliderRow(
                '3D 丽音',
                CMD.EQ_VOL_3D,
                music3dEnabled,
                music3dValue,
                setMusic3dEnabled,
                setMusic3dValue,
                0,
                32,
              )}
              {effectSliderRow(
                '人声消除',
                CMD.EQ_Voice_Cut,
                musicVocalCutEnabled,
                musicVocalCutValue,
                setMusicVocalCutEnabled,
                setMusicVocalCutValue,
                0,
                32,
              )}
              {effectSliderRow(
                '虚拟低音',
                CMD.EQ_VOL_VB,
                musicVbEnabled,
                musicVbValue,
                setMusicVbEnabled,
                setMusicVbValue,
                0,
                32,
              )}
              {effectSliderRow(
                '人声激励',
                CMD.EQ_Voice_EXCITER,
                musicExciterEnabled,
                musicExciterValue,
                setMusicExciterEnabled,
                setMusicExciterValue,
                0,
                32,
              )}
            </div>

            <div className="mt-3.5">
              <div className="flex gap-2.5 py-2.5 flex-wrap">
                {actionButton('musicReset', '一键恢复默认', CMD.EQ_VOL_RESET, 'danger')}
                {actionButton('musicSave', '保存设置', CMD.EQ_VOL_SAVE, 'primary')}
              </div>
            </div>
          </div>
        </div>

        {/* ---- Log Panel (hidden by default, use F12 console to view) ---- */}
        <div className="hidden">
          <span>实时日志</span>
          <button
            type="button"
            className="hidden"
            onClick={ble.clearLog}
          >
            清空
          </button>
        </div>
        <div className="hidden" id="logPanel">
          {ble.logEntries.length === 0 ? (
            <div style={{ marginBottom: '4px', wordBreak: 'break-word' }}>
              [系统] 等待操作，点击「扫描 &amp; 连接设备」
            </div>
          ) : (
            ble.logEntries.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: '4px',
                  wordBreak: 'break-word',
                  color: entry.isError ? '#ffb4a2' : undefined,
                }}
              >
                [{new Date(entry.time).toLocaleTimeString('zh-CN', {
                  hour12: false,
                })}] {entry.isError ? '[错误]' : '[信息]'} {entry.msg}
              </div>
            ))
          )}
        </div>

        <hr className="border-none border-t border-[var(--divider)] my-4 max-sm:my-3" />
        <footer className="text-xs text-center text-[var(--footer-text)] mt-6 max-sm:mt-4 max-sm:text-[0.65rem]">
          基于 Web Bluetooth API | 需要用户手势触发 | 测试 BLE (低功耗蓝牙) 设备
        </footer>
      </div>
    </div>
  );
}
