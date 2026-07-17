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
  wireToDisplayDb,
} from '../utils/eqMapping';
import type { EqBand } from '../utils/eqMapping';
import '../styles/ble.css';

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
  // Tab state
  // ======================================================================
  const [activeTab, setActiveTab] = useState('text');

  // ======================================================================
  // Text panel state
  // ======================================================================
  const [textContent, setTextContent] = useState('');
  const [textColorEnabled, setTextColorEnabled] = useState(false);
  const [textColorValue, setTextColorValue] = useState(0);
  const [textGradientEnabled, setTextGradientEnabled] = useState(false);
  const [textGradientSpeed, setTextGradientSpeed] = useState(8);
  const [textScrollEnabled, setTextScrollEnabled] = useState(false);
  const [textScrollSpeed, setTextScrollSpeed] = useState(8);
  const [textBrightnessEnabled, setTextBrightnessEnabled] = useState(false);
  const [textBrightnessValue, setTextBrightnessValue] = useState(8);
  const [textModeActive, setTextModeActive] = useState<number | null>(null);

  // ======================================================================
  // Light panel state
  // ======================================================================
  const [lightModeActive, setLightModeActive] = useState<number | null>(null);
  const [lightAutoEnabled, setLightAutoEnabled] = useState(false);
  const [lightAutoParam, setLightAutoParam] = useState(128);
  const [lightColorEnabled, setLightColorEnabled] = useState(false);
  const [lightColorValue, setLightColorValue] = useState(0);
  const [lightBrightnessEnabled, setLightBrightnessEnabled] = useState(false);
  const [lightBrightnessValue, setLightBrightnessValue] = useState(8);
  const [lightSpeedEnabled, setLightSpeedEnabled] = useState(false);
  const [lightSpeedValue, setLightSpeedValue] = useState(8);

  // ======================================================================
  // Mic panel state
  // ======================================================================
  const [micVolEnabled, setMicVolEnabled] = useState(false);
  const [micVolValue, setMicVolValue] = useState(16);
  const [micPriorityEnabled, setMicPriorityEnabled] = useState(false);
  const [micPriorityValue, setMicPriorityValue] = useState(0);
  const [micEqEnabled, setMicEqEnabled] = useState(false);
  const [micEqBands, setMicEqBands] = useState<EqBand[]>(() =>
    createTenBandEq(),
  );
  const [micEchoEnabled, setMicEchoEnabled] = useState(false);
  const [micEchoValue, setMicEchoValue] = useState(0);
  const [micReverbEnabled, setMicReverbEnabled] = useState(false);
  const [micReverbValue, setMicReverbValue] = useState(0);
  const [micMagicEnabled, setMicMagicEnabled] = useState(false);
  const [micMagicValue, setMicMagicValue] = useState(0);

  // ======================================================================
  // Music panel state
  // ======================================================================
  const [musicVolEnabled, setMusicVolEnabled] = useState(false);
  const [musicVolValue, setMusicVolValue] = useState(20);
  const [musicTrebleEnabled, setMusicTrebleEnabled] = useState(false);
  const [musicTrebleValue, setMusicTrebleValue] = useState(16);
  const [musicMidEnabled, setMusicMidEnabled] = useState(false);
  const [musicMidValue, setMusicMidValue] = useState(16);
  const [musicBassEnabled, setMusicBassEnabled] = useState(false);
  const [musicBassValue, setMusicBassValue] = useState(16);
  const [musicEqEnabled, setMusicEqEnabled] = useState(false);
  const [musicEqBands, setMusicEqBands] = useState<EqBand[]>(() =>
    createTenBandEq(),
  );
  const [music3dEnabled, setMusic3dEnabled] = useState(false);
  const [music3dValue, setMusic3dValue] = useState(0);
  const [musicVocalCutEnabled, setMusicVocalCutEnabled] = useState(false);
  const [musicVocalCutValue, setMusicVocalCutValue] = useState(0);
  const [musicVbEnabled, setMusicVbEnabled] = useState(false);
  const [musicVbValue, setMusicVbValue] = useState(0);
  const [musicExciterEnabled, setMusicExciterEnabled] = useState(false);
  const [musicExciterValue, setMusicExciterValue] = useState(0);

  // ======================================================================
  // Refs
  // ======================================================================

  // Refs for hue slider CSS custom properties
  const textColorSliderRef = useRef<HTMLInputElement>(null);
  const lightColorSliderRef = useRef<HTMLInputElement>(null);

  // Refs for mode group active indices (used in registration callbacks)
  const textModeActiveRef = useRef<number | null>(null);
  const lightModeActiveRef = useRef<number | null>(null);

  // Refs for EQ bands (used in registration callbacks for apply)
  const micEqBandsRef = useRef<EqBand[]>(micEqBands);
  const musicEqBandsRef = useRef<EqBand[]>(musicEqBands);

  // Central state ref — tracks current toggle+value for every control
  // so async event handlers always read the latest values.
  const stateRef = useRef<Record<number, ControlState>>({});

  // Sync refs with state (runs every render, no additional re-renders)
  /* eslint-disable react-hooks/rules-of-hooks */
  textModeActiveRef.current = textModeActive;
  lightModeActiveRef.current = lightModeActive;
  micEqBandsRef.current = micEqBands;
  musicEqBandsRef.current = musicEqBands;
  stateRef.current = {
    // Text
    [CMD.TEXT_COLOR_ONE]: { enabled: textColorEnabled, value: textColorValue },
    [CMD.TEXT_COLOR_AUTO_Speed]: {
      enabled: textGradientEnabled,
      value: textGradientSpeed,
    },
    [CMD.TEXT_Scroll_Speed]: {
      enabled: textScrollEnabled,
      value: textScrollSpeed,
    },
    [CMD.TEXT_LIGHT]: {
      enabled: textBrightnessEnabled,
      value: textBrightnessValue,
    },
    // Light
    [CMD.LIGHT_AUTO_EN]: { enabled: lightAutoEnabled, value: lightAutoParam },
    [CMD.LIGHT_COLOR_SET]: {
      enabled: lightColorEnabled,
      value: lightColorValue,
    },
    [CMD.LIGHT_VAL_SET]: {
      enabled: lightBrightnessEnabled,
      value: lightBrightnessValue,
    },
    [CMD.LIGHT_SPEED_SET]: {
      enabled: lightSpeedEnabled,
      value: lightSpeedValue,
    },
    // Mic
    [CMD.EQ_MIC_VAL]: { enabled: micVolEnabled, value: micVolValue },
    [CMD.EQ_MIC_priority]: {
      enabled: micPriorityEnabled,
      value: micPriorityValue,
    },
    [CMD.EQ_MIC_ECHO]: { enabled: micEchoEnabled, value: micEchoValue },
    [CMD.EQ_MIC_REVERB]: { enabled: micReverbEnabled, value: micReverbValue },
    [CMD.EQ_MIC_Magic_Sound]: {
      enabled: micMagicEnabled,
      value: micMagicValue,
    },
    // Music
    [CMD.EQ_VOL_VAL]: { enabled: musicVolEnabled, value: musicVolValue },
    [CMD.EQ_VOL_TRE]: { enabled: musicTrebleEnabled, value: musicTrebleValue },
    [CMD.EQ_VOL_MID]: { enabled: musicMidEnabled, value: musicMidValue },
    [CMD.EQ_VOL_BASS]: { enabled: musicBassEnabled, value: musicBassValue },
    [CMD.EQ_VOL_3D]: { enabled: music3dEnabled, value: music3dValue },
    [CMD.EQ_Voice_Cut]: {
      enabled: musicVocalCutEnabled,
      value: musicVocalCutValue,
    },
    [CMD.EQ_VOL_VB]: { enabled: musicVbEnabled, value: musicVbValue },
    [CMD.EQ_Voice_EXCITER]: {
      enabled: musicExciterEnabled,
      value: musicExciterValue,
    },
  };

  // ======================================================================
  // Registration effect — register ALL features once on mount
  // ======================================================================
  useEffect(() => {
    const reg = ble.registerFeature;

    // --- Text panel features ---
    reg(CMD.TEXT_Content, { apply: () => {} });
    reg(CMD.TEXT_SAVE, { apply: () => {} });

    for (let i = 0; i < 7; i++) {
      const cmd = CMD.TEXT_MODE_0 + i;
      reg(cmd, {
        apply: (params) => {
          if (params[0] === 1) {
            textModeActiveRef.current = i;
            setTextModeActive(i);
          } else if (textModeActiveRef.current === i) {
            textModeActiveRef.current = null;
            setTextModeActive(null);
          }
        },
      });
    }

    reg(CMD.TEXT_COLOR_ONE, {
      apply: (params) => {
        setTextColorEnabled(params[0] === 1);
        if (params.length > 1) setTextColorValue(params[1]);
      },
    });
    reg(CMD.TEXT_COLOR_AUTO_Speed, {
      apply: (params) => {
        setTextGradientEnabled(params[0] === 1);
        if (params.length > 1) setTextGradientSpeed(params[1]);
      },
    });
    reg(CMD.TEXT_Scroll_Speed, {
      apply: (params) => {
        setTextScrollEnabled(params[0] === 1);
        if (params.length > 1) setTextScrollSpeed(params[1]);
      },
    });
    reg(CMD.TEXT_LIGHT, {
      apply: (params) => {
        setTextBrightnessEnabled(params[0] === 1);
        if (params.length > 1) setTextBrightnessValue(params[1]);
      },
    });

    // --- Light panel features ---
    for (let i = 0; i < 16; i++) {
      const cmd = CMD.LIGHT_MODE_0 + i;
      reg(cmd, {
        apply: (params) => {
          if (params[0] === 1) {
            lightModeActiveRef.current = i;
            setLightModeActive(i);
          } else if (lightModeActiveRef.current === i) {
            lightModeActiveRef.current = null;
            setLightModeActive(null);
          }
        },
      });
    }

    reg(CMD.LIGHT_AUTO_EN, {
      apply: (params) => {
        setLightAutoEnabled(params[0] === 1);
        if (params.length > 1) setLightAutoParam(params[1]);
      },
    });
    reg(CMD.LIGHT_COLOR_SET, {
      apply: (params) => {
        setLightColorEnabled(params[0] === 1);
        if (params.length > 1) setLightColorValue(params[1]);
      },
    });
    reg(CMD.LIGHT_VAL_SET, {
      apply: (params) => {
        setLightBrightnessEnabled(params[0] === 1);
        if (params.length > 1) setLightBrightnessValue(params[1]);
      },
    });
    reg(CMD.LIGHT_SPEED_SET, {
      apply: (params) => {
        setLightSpeedEnabled(params[0] === 1);
        if (params.length > 1) setLightSpeedValue(params[1]);
      },
    });
    reg(CMD.LIGHT_SAVE, { apply: () => {} });

    // --- Mic panel features ---
    reg(CMD.EQ_MIC_VAL, {
      apply: (params) => {
        setMicVolEnabled(params[0] === 1);
        if (params.length > 1) setMicVolValue(params[1]);
      },
    });
    reg(CMD.EQ_MIC_priority, {
      apply: (params) => {
        setMicPriorityEnabled(params[0] === 1);
        if (params.length > 1) setMicPriorityValue(params[1]);
      },
    });
    reg(CMD.EQ_MIC_FRE_VAL, {
      apply: (params) => {
        setMicEqEnabled(params[0] === 1);
        if (params.length >= 11) {
          setMicEqBands((prev) =>
            prev.map((band, i) => ({
              ...band,
              value: wireToDisplayDb(params[i + 1]),
            })),
          );
        }
      },
    });
    reg(CMD.EQ_MIC_ECHO, {
      apply: (params) => {
        setMicEchoEnabled(params[0] === 1);
        if (params.length > 1) setMicEchoValue(params[1]);
      },
    });
    reg(CMD.EQ_MIC_REVERB, {
      apply: (params) => {
        setMicReverbEnabled(params[0] === 1);
        if (params.length > 1) setMicReverbValue(params[1]);
      },
    });
    reg(CMD.EQ_MIC_Magic_Sound, {
      apply: (params) => {
        setMicMagicEnabled(params[0] === 1);
        if (params.length > 1) setMicMagicValue(params[1]);
      },
    });
    reg(CMD.EQ_MIC_RESET, { apply: () => {} });
    reg(CMD.EQ_MIC_SAVE, { apply: () => {} });

    // --- Music panel features ---
    reg(CMD.EQ_VOL_VAL, {
      apply: (params) => {
        setMusicVolEnabled(params[0] === 1);
        if (params.length > 1) setMusicVolValue(params[1]);
      },
    });
    reg(CMD.EQ_VOL_TRE, {
      apply: (params) => {
        setMusicTrebleEnabled(params[0] === 1);
        if (params.length > 1) setMusicTrebleValue(params[1]);
      },
    });
    reg(CMD.EQ_VOL_MID, {
      apply: (params) => {
        setMusicMidEnabled(params[0] === 1);
        if (params.length > 1) setMusicMidValue(params[1]);
      },
    });
    reg(CMD.EQ_VOL_BASS, {
      apply: (params) => {
        setMusicBassEnabled(params[0] === 1);
        if (params.length > 1) setMusicBassValue(params[1]);
      },
    });
    reg(CMD.EQ_VOL_FRE_VAL, {
      apply: (params) => {
        setMusicEqEnabled(params[0] === 1);
        if (params.length >= 11) {
          setMusicEqBands((prev) =>
            prev.map((band, i) => ({
              ...band,
              value: wireToDisplayDb(params[i + 1]),
            })),
          );
        }
      },
    });
    reg(CMD.EQ_VOL_3D, {
      apply: (params) => {
        setMusic3dEnabled(params[0] === 1);
        if (params.length > 1) setMusic3dValue(params[1]);
      },
    });
    reg(CMD.EQ_Voice_Cut, {
      apply: (params) => {
        setMusicVocalCutEnabled(params[0] === 1);
        if (params.length > 1) setMusicVocalCutValue(params[1]);
      },
    });
    reg(CMD.EQ_VOL_VB, {
      apply: (params) => {
        setMusicVbEnabled(params[0] === 1);
        if (params.length > 1) setMusicVbValue(params[1]);
      },
    });
    reg(CMD.EQ_Voice_EXCITER, {
      apply: (params) => {
        setMusicExciterEnabled(params[0] === 1);
        if (params.length > 1) setMusicExciterValue(params[1]);
      },
    });
    reg(CMD.EQ_VOL_RESET, { apply: () => {} });
    reg(CMD.EQ_VOL_SAVE, { apply: () => {} });

    // Cleanup
    const unreg = ble.unregisterFeature;
    const allCmds: number[] = [
      CMD.TEXT_Content,
      CMD.TEXT_SAVE,
      ...Array.from({ length: 7 }, (_, i) => CMD.TEXT_MODE_0 + i),
      CMD.TEXT_COLOR_ONE,
      CMD.TEXT_COLOR_AUTO_Speed,
      CMD.TEXT_Scroll_Speed,
      CMD.TEXT_LIGHT,
      ...Array.from({ length: 16 }, (_, i) => CMD.LIGHT_MODE_0 + i),
      CMD.LIGHT_AUTO_EN,
      CMD.LIGHT_COLOR_SET,
      CMD.LIGHT_VAL_SET,
      CMD.LIGHT_SPEED_SET,
      CMD.LIGHT_SAVE,
      CMD.EQ_MIC_VAL,
      CMD.EQ_MIC_priority,
      CMD.EQ_MIC_FRE_VAL,
      CMD.EQ_MIC_ECHO,
      CMD.EQ_MIC_REVERB,
      CMD.EQ_MIC_Magic_Sound,
      CMD.EQ_MIC_RESET,
      CMD.EQ_MIC_SAVE,
      CMD.EQ_VOL_VAL,
      CMD.EQ_VOL_TRE,
      CMD.EQ_VOL_MID,
      CMD.EQ_VOL_BASS,
      CMD.EQ_VOL_FRE_VAL,
      CMD.EQ_VOL_3D,
      CMD.EQ_Voice_Cut,
      CMD.EQ_VOL_VB,
      CMD.EQ_Voice_EXCITER,
      CMD.EQ_VOL_RESET,
      CMD.EQ_VOL_SAVE,
    ];
    return () => {
      allCmds.forEach((c) => unreg(c));
    };
  }, [ble.registerFeature, ble.unregisterFeature]);

  // ======================================================================
  // Reset effect — reset all controls when connection is lost
  // ======================================================================
  useEffect(() => {
    if (!ble.controlsEnabled) {
      setTextColorEnabled(false);
      setTextColorValue(0);
      setTextGradientEnabled(false);
      setTextGradientSpeed(8);
      setTextScrollEnabled(false);
      setTextScrollSpeed(8);
      setTextBrightnessEnabled(false);
      setTextBrightnessValue(8);
      setTextModeActive(null);
      setLightModeActive(null);
      setLightAutoEnabled(false);
      setLightAutoParam(128);
      setLightColorEnabled(false);
      setLightColorValue(0);
      setLightBrightnessEnabled(false);
      setLightBrightnessValue(8);
      setLightSpeedEnabled(false);
      setLightSpeedValue(8);
      setMicVolEnabled(false);
      setMicVolValue(16);
      setMicPriorityEnabled(false);
      setMicPriorityValue(0);
      setMicEqEnabled(false);
      setMicEqBands(createTenBandEq());
      setMicEchoEnabled(false);
      setMicEchoValue(0);
      setMicReverbEnabled(false);
      setMicReverbValue(0);
      setMicMagicEnabled(false);
      setMicMagicValue(0);
      setMusicVolEnabled(false);
      setMusicVolValue(20);
      setMusicTrebleEnabled(false);
      setMusicTrebleValue(16);
      setMusicMidEnabled(false);
      setMusicMidValue(16);
      setMusicBassEnabled(false);
      setMusicBassValue(16);
      setMusicEqEnabled(false);
      setMusicEqBands(createTenBandEq());
      setMusic3dEnabled(false);
      setMusic3dValue(0);
      setMusicVocalCutEnabled(false);
      setMusicVocalCutValue(0);
      setMusicVbEnabled(false);
      setMusicVbValue(0);
      setMusicExciterEnabled(false);
      setMusicExciterValue(0);
    }
  }, [ble.controlsEnabled, ble.resetKey]);

  // ======================================================================
  // Helper: render a standard effect-row with toggle + slider
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
      <div className="effect-row" key={cmd}>
        <span className="effect-label">{label}</span>
        <div className="effect-toggle">
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
        <div className="effect-slider-wrap">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            onChange={(e) => handleSlider(Number(e.target.value))}
          />
          <span className="effect-value">{value}</span>
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
        <div className="effect-row color-row" key={`${cmd}-row1`}>
          <span className="effect-label">{label}</span>
          <div className="effect-toggle">
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
            className="color-preview-box"
            style={{ background: `hsl(${hue},100%,50%)` }}
          />
        </div>
        {/* Second row: hue slider + degree display */}
        <div className="effect-row" key={`${cmd}-row2`}>
          <span className="effect-label" />
          <div className="effect-slider-wrap">
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
            <span className="hue-degree">色相: {hue}°</span>
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
      <div className="mode-grid" key={containerKey}>
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
              className={`mode-btn${isActive ? ' active' : ''}`}
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
    className = 'primary',
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
        className={className}
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
      <div className="send-row" key="textContent">
        <input
          type="text"
          id="textContent"
          placeholder="输入文字..."
          value={textContent}
          disabled={disabled}
          onChange={(e) => setTextContent(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          id="textSendBtn"
          className="primary"
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
      <div className="effect-row" key={`${key}-eq-toggle`}>
        <span className="effect-label">{key} EQ</span>
        <div className="effect-toggle">
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
      <div className="eq-wrapper" key={`${key}-eq-bands`}>
        <div className="eq-db-scale">
          <span>+12</span>
          <span>+6</span>
          <span>0</span>
          <span>-6</span>
          <span>-12</span>
        </div>
        {bands.map((band, i) => (
          <div className="eq-band" key={i}>
            <input
              type="range"
              className="mic-eq-slider"
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
              className="eq-band-value"
              min={band.min}
              max={band.max}
              value={band.value}
              step="1"
              disabled={disabled}
              onChange={(e) => handleBandChange(i, Number(e.target.value))}
              onBlur={handleBandCommit}
            />
            <span className="eq-band-label">{band.label}</span>
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
      <div className="effect-row" key="mic-magic">
        <span className="effect-label">魔音效果</span>
        <div className="effect-toggle">
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
          className="effect-select"
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
  const bleStatusDotClass = `status${ble.bleStatusConnected ? ' connected' : ''}`;

  return (
    <div className="container">
      <h1>
        BLE 蓝牙调试器
        <span className="badge">Web Bluetooth API</span>
      </h1>
      <div className="sub">
        支持 Android Chrome / Edge · 扫描 BLE 设备 · 读取设备信息/电池电量
      </div>

      {/* ---- Button group ---- */}
      <div className="btn-group">
        <button className="primary" onClick={ble.scanAndConnect}>
          扫描 &amp; 连接设备
        </button>
        <button
          disabled={!ble.isConnected}
          onClick={ble.disconnect}
        >
          断开连接
        </button>
        <button
          disabled={!ble.isConnected}
          onClick={ble.refreshDeviceInfo}
        >
          读取设备信息
        </button>
      </div>

      {/* ---- Device Dashboard ---- */}
      <div className="info-card device-dashboard">
        <div className="dashboard-header">
          <div>
            <div className="dashboard-title">设备状态</div>
            <div className="dashboard-subtitle">BLE 连接与基础信息</div>
          </div>
          <div className="dashboard-status" id="bleStatus">
            <span className={bleStatusDotClass} />
            {ble.bleStatusText}
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="metric-tile">
            <span className="metric-label">蓝牙名称</span>
            <span className="metric-value" id="deviceName">
              {ble.deviceName}
            </span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">电量</span>
            <span className="metric-value mono" id="batteryLevel">
              {ble.batteryLevel}
            </span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">制造商</span>
            <span className="metric-value" id="manufacturer">
              {ble.manufacturer}
            </span>
          </div>
        </div>
      </div>

      {/* ---- Control Card ---- */}
      <div
        className={`info-card control-card${!ble.controlsEnabled ? ' controls-disabled' : ''}`}
        id="controlCard"
      >
        {/* Tab Navigation */}
        <div className="tab-nav">
          {['text', 'light', 'mic', 'music'].map((tab) => (
            <button
              key={tab}
              className={`tab-btn${activeTab === tab ? ' active' : ''}`}
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
          className={`tab-panel${activeTab === 'text' ? ' active' : ''}`}
          id="panel-text"
        >
          <div className="panel-section">
            <div className="panel-section-title">文字内容</div>
            {textContentRow()}
          </div>

          <div className="panel-section">
            <div className="panel-section-title">显示模式</div>
            {modeButtons(
              'text',
              TEXT_MODE_LABELS,
              CMD.TEXT_MODE_0,
              textModeActive,
              setTextModeActive,
              textModeActiveRef,
            )}
          </div>

          <div className="panel-section">
            <div className="panel-section-title">样式设置</div>
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

          <div className="panel-section">
            <div className="action-row">
              {actionButton('textSave', '保存设置', CMD.TEXT_SAVE, 'primary')}
            </div>
          </div>
        </div>

        {/* ====== LIGHT PANEL ====== */}
        <div
          className={`tab-panel${activeTab === 'light' ? ' active' : ''}`}
          id="panel-light"
        >
          <div className="panel-section">
            <div className="panel-section-title">灯光模式 (1~16)</div>
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

          <div className="panel-section">
            <div className="panel-section-title">自动模式</div>
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

          <div className="panel-section">
            <div className="panel-section-title">参数设置</div>
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

          <div className="panel-section">
            <div className="action-row">
              {actionButton('lightSave', '保存设置', CMD.LIGHT_SAVE, 'primary')}
            </div>
          </div>
        </div>

        {/* ====== MIC PANEL ====== */}
        <div
          className={`tab-panel${activeTab === 'mic' ? ' active' : ''}`}
          id="panel-mic"
        >
          <div className="panel-section">
            <div className="panel-section-title">MIC 音量控制</div>
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

          <div className="panel-section">
            <div className="panel-section-title">均衡器 (EQ) 10 频点</div>
            {eqStrip(
              'MIC',
              micEqBands,
              setMicEqBands,
              CMD.EQ_MIC_FRE_VAL,
              micEqEnabled,
              setMicEqEnabled,
            )}
          </div>

          <div className="panel-section">
            <div className="panel-section-title">MIC 效果</div>
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

          <div className="panel-section">
            <div className="action-row">
              {actionButton('micReset', '一键恢复默认', CMD.EQ_MIC_RESET, 'danger')}
              {actionButton('micSave', '保存设置', CMD.EQ_MIC_SAVE, 'primary')}
            </div>
          </div>
        </div>

        {/* ====== MUSIC PANEL ====== */}
        <div
          className={`tab-panel${activeTab === 'music' ? ' active' : ''}`}
          id="panel-music"
        >
          <div className="panel-section">
            <div className="panel-section-title">主音量控制</div>
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

          <div className="panel-section">
            <div className="panel-section-title">均衡器 (EQ) 10 频点</div>
            {eqStrip(
              '音乐',
              musicEqBands,
              setMusicEqBands,
              CMD.EQ_VOL_FRE_VAL,
              musicEqEnabled,
              setMusicEqEnabled,
            )}
          </div>

          <div className="panel-section">
            <div className="panel-section-title">音效增强</div>
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

          <div className="panel-section">
            <div className="action-row">
              {actionButton('musicReset', '一键恢复默认', CMD.EQ_VOL_RESET, 'danger')}
              {actionButton('musicSave', '保存设置', CMD.EQ_VOL_SAVE, 'primary')}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Log Panel (hidden by default, use F12 console to view) ---- */}
      <div className="log-title">
        <span>实时日志</span>
        <button
          type="button"
          className="clear-log"
          onClick={ble.clearLog}
        >
          清空
        </button>
      </div>
      <div className="log-area" id="logPanel">
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

      <footer>
        基于 Web Bluetooth API | 需要用户手势触发 | 测试 BLE (低功耗蓝牙) 设备
      </footer>
    </div>
  );
}
