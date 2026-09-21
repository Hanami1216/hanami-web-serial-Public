// 广州智造音响设备有限公司 - 串口EQ均衡器控制应用
// 版本：1.0.0
// React 页面组件

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useSerial } from '../hooks/useSerial';
import {
  serialEqBands,
  ParamRange,
  displayToActual,
} from '../utils/eqMapping';
import type { EqBand } from '../utils/eqMapping';
import {
  buildFrame,
  SerialCommandType,
} from '../utils/protocol';
import '../styles/utilities.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the `--percent` CSS custom property value for a slider. */
function sliderPercent(
  value: number,
  min: number,
  max: number,
): number {
  return ((value - min) / (max - min)) * 100;
}

/** Clamp a number to a [min, max] range. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SerialController() {
  // ---- state -----------------------------------------------------------

  const [eqBands, setEqBands] = useState<EqBand[]>(() =>
    serialEqBands.map((b) => ({ ...b })),
  );
  const [paValue, setPaValue] = useState<number>(ParamRange.PA.DEFAULT);
  const [volume, setVolume] = useState<number>(
    ParamRange.VOLUME.DEFAULT,
  );
  const [baudRate, setBaudRate] = useState('115200');
  const [customBaudRate, setCustomBaudRate] = useState('9600');
  const [hexDisplay, setHexDisplay] = useState(true);
  const [showRawData, setShowRawData] = useState(false);

  const receiveRef = useRef<HTMLTextAreaElement>(null);

  // ---- serial hook -----------------------------------------------------

  const handleReceivedData = useCallback(
    (
      pa: number,
      defaultVol: number,
      eqDisplayValues: number[],
    ) => {
      setPaValue(pa);
      setVolume(defaultVol);
      setEqBands((prev) =>
        prev.map((band, i) => ({
          ...band,
          value:
            i < eqDisplayValues.length
              ? eqDisplayValues[i]
              : band.value,
        })),
      );
    },
    [],
  );

  const handleReceivedPA = useCallback((pa: number) => {
    setPaValue(pa);
  }, []);

  const handleReceivedVolume = useCallback((vol: number) => {
    setVolume(vol);
  }, []);

  const {
    isConnected,
    statusText,
    statusBg,
    receiveLines,
    connect,
    disconnect,
    sendFrame,
    clearReceiveLines: clearReceive,
    setStatus,
  } = useSerial({
    hexDisplay,
    showRawData,
    onReceivedData: handleReceivedData,
    onReceivedPA: handleReceivedPA,
    onReceivedVolume: handleReceivedVolume,
  });

  // ---- auto-scroll receive area ----------------------------------------

  useEffect(() => {
    if (receiveRef.current) {
      receiveRef.current.scrollTop =
        receiveRef.current.scrollHeight;
    }
  }, [receiveLines]);

  // ---- EQ change handler -----------------------------------------------

  function handleEqChange(index: number, rawValue: number) {
    let val = Number.isNaN(rawValue)
      ? ParamRange.EQ.DEFAULT
      : rawValue;
    val = clamp(val, ParamRange.EQ.MIN, ParamRange.EQ.MAX);
    setEqBands((prev) =>
      prev.map((band, i) =>
        i === index ? { ...band, value: val } : band,
      ),
    );
  }

  // ---- PA handlers -----------------------------------------------------

  function handlePaSliderChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const val = clamp(
      parseInt(e.target.value) || ParamRange.PA.DEFAULT,
      ParamRange.PA.MIN,
      ParamRange.PA.MAX,
    );
    setPaValue(val);
  }

  function handlePaInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const val = clamp(
      parseInt(e.target.value) || ParamRange.PA.DEFAULT,
      ParamRange.PA.MIN,
      ParamRange.PA.MAX,
    );
    setPaValue(val);
  }

  // ---- volume handlers -------------------------------------------------

  function handleVolSliderChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const val = clamp(
      parseInt(e.target.value) ||
        ParamRange.VOLUME.DEFAULT,
      ParamRange.VOLUME.MIN,
      ParamRange.VOLUME.MAX,
    );
    setVolume(val);
  }

  function handleVolInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const val = clamp(
      parseInt(e.target.value) ||
        ParamRange.VOLUME.DEFAULT,
      ParamRange.VOLUME.MIN,
      ParamRange.VOLUME.MAX,
    );
    setVolume(val);
  }

  // ---- send functions --------------------------------------------------

  async function handleConnect() {
    try {
      let rate: number;
      if (baudRate === 'custom') {
        rate = parseInt(customBaudRate);
        if (
          Number.isNaN(rate) ||
          rate < 1200 ||
          rate > 4000000
        ) {
          throw new Error('请输入有效的波特率（1200-4000000）');
        }
      } else {
        rate = parseInt(baudRate);
      }
      await connect(rate);
    } catch (error) {
      setStatus(
        `连接错误: ${(error as Error).message}`,
        '#e74c3c',
      );
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
    } catch (error) {
      setStatus(
        `断开连接错误: ${(error as Error).message}`,
        '#e74c3c',
      );
    }
  }

  async function handleSendEq() {
    if (!isConnected) return;
    try {
      const eqDisplayValues = eqBands.map((b) => b.value);
      const actualValues = eqDisplayValues.map((v) =>
        displayToActual(v),
      );
      const params = new Uint8Array(actualValues);
      const frame = buildFrame(
        SerialCommandType.NORMAL_EQ,
        params,
      );
      await sendFrame(frame);
    } catch (error) {
      setStatus(
        `发送错误: ${(error as Error).message}`,
        '#e74c3c',
      );
    }
  }

  async function handleSendPa() {
    if (!isConnected) return;
    try {
      let val = paValue;
      if (
        Number.isNaN(val) ||
        val < ParamRange.PA.MIN ||
        val > ParamRange.PA.MAX
      ) {
        val = ParamRange.PA.DEFAULT;
        setPaValue(val);
      }
      const params = new Uint8Array([val]);
      const frame = buildFrame(
        SerialCommandType.PA_SET,
        params,
      );
      await sendFrame(frame);
      setStatus(
        `功率PA设置已发送: ${val}`,
        '#2ecc71',
      );
      setTimeout(() => {
        setStatus('已连接', '#2ecc71');
      }, 2000);
    } catch (error) {
      setStatus(
        `发送错误: ${(error as Error).message}`,
        '#e74c3c',
      );
    }
  }

  async function handleSendVolume() {
    if (!isConnected) return;
    try {
      let val = volume;
      if (
        Number.isNaN(val) ||
        val < ParamRange.VOLUME.MIN ||
        val > ParamRange.VOLUME.MAX
      ) {
        val = ParamRange.VOLUME.DEFAULT;
        setVolume(val);
      }
      const params = new Uint8Array([val]);
      const frame = buildFrame(
        SerialCommandType.DEFAULT_VOL,
        params,
      );
      await sendFrame(frame);
      setStatus(
        `开机默认音量设置已发送: ${val}`,
        '#2ecc71',
      );
      setTimeout(() => {
        setStatus('已连接', '#2ecc71');
      }, 2000);
    } catch (error) {
      setStatus(
        `发送错误: ${(error as Error).message}`,
        '#e74c3c',
      );
    }
  }

  async function handleReadAll() {
    if (!isConnected) return;
    try {
      const frame = buildFrame(
        SerialCommandType.READ_ALL,
        new Uint8Array(0),
      );
      await sendFrame(frame);
    } catch (error) {
      setStatus(
        `发送错误: ${(error as Error).message}`,
        '#e74c3c',
      );
    }
  }

  function handleReset() {
    // Reset EQ to flat
    setEqBands((prev) =>
      prev.map((band) => ({
        ...band,
        value: ParamRange.EQ.DEFAULT,
      })),
    );
    // Reset PA and volume
    setPaValue(ParamRange.PA.DEFAULT);
    setVolume(ParamRange.VOLUME.DEFAULT);

    setStatus('已重置所有参数到默认值', '#2ecc71');
    setTimeout(() => {
      setStatus(
        isConnected ? '已连接' : '未连接',
        isConnected ? '#2ecc71' : '#ecf0f1',
      );
    }, 2000);
  }

  // ---- baud-rate select -------------------------------------------------

  function handleBaudRateChange(
    e: React.ChangeEvent<HTMLSelectElement>,
  ) {
    setBaudRate(e.target.value);
  }

  // ---- computed styles --------------------------------------------------

  const paPercent = sliderPercent(
    paValue,
    ParamRange.PA.MIN,
    ParamRange.PA.MAX,
  );
  const volPercent = sliderPercent(
    volume,
    ParamRange.VOLUME.MIN,
    ParamRange.VOLUME.MAX,
  );

  const paSliderStyle = {
    '--percent': paPercent,
  } as CSSProperties;

  const volSliderStyle = {
    '--percent': volPercent,
  } as CSSProperties;

  // ---- render -----------------------------------------------------------

  return (
    <div className="font-sans max-w-[1200px] mx-auto p-6 max-sm:p-2 max-sm:h-screen max-sm:overflow-hidden bg-[var(--bg-body)] text-[var(--text-body)]">
      <h1 className="text-center mb-6 mt-0 text-[var(--text-body)] max-sm:text-2xl max-sm:sticky max-sm:top-0 max-sm:bg-[var(--bg-body)] max-sm:z-[100] max-sm:py-2.5 max-sm:m-0">
        串口EQ均衡器
      </h1>

      <div className="flex flex-col gap-6 max-sm:h-[calc(100vh-60px)] max-sm:overflow-y-auto">
        <div className="flex gap-6 flex-wrap max-lg:flex-col h-[calc(100vh-100px)] max-sm:h-auto max-sm:min-h-full">
          {/* ---- Left: EQ Card -------------------------------------- */}
          <div className="glass-panel rounded-xl p-4 max-sm:p-2 flex-1 min-w-[400px] max-lg:min-w-full max-w-full overflow-y-auto flex flex-col">
            <h2 className="text-[var(--text-body)] mt-0 max-sm:text-lg">
              均衡器设置
            </h2>

            <div className="flex gap-5 items-end h-[280px] my-4 overflow-x-auto pb-2.5 max-sm:h-[300px] max-sm:pb-5" id="eqContainer">
              <div className="flex flex-col justify-between h-[240px] pr-2.5 text-xs text-[var(--text-muted)] mb-5 max-sm:hidden">
                <div className="flex items-center h-12">+12dB</div>
                <div className="flex items-center h-12">+6dB</div>
                <div className="flex items-center h-12">0dB</div>
                <div className="flex items-center h-12">-6dB</div>
                <div className="flex items-center h-12">-12dB</div>
              </div>

              {eqBands.map((band, index) => (
                <div className="flex flex-col items-center gap-2 h-full max-sm:min-w-[60px]" key={index}>
                  <div className="flex flex-col items-center h-full relative">
                    <input
                      type="range"
                      id={`eqSlider${index}`}
                      min={ParamRange.EQ.MIN}
                      max={ParamRange.EQ.MAX}
                      step="1"
                      value={band.value}
                      className="eq-slider-vertical w-[50px] h-[220px] px-[5px] my-2.5 max-sm:h-[200px] max-sm:w-[5px] max-sm:mx-[5px] max-sm:my-0"
                      onChange={(e) =>
                        handleEqChange(
                          index,
                          parseInt(e.target.value),
                        )
                      }
                    />
                    <input
                      type="number"
                      id={`eqValue${index}`}
                      min={ParamRange.EQ.MIN}
                      max={ParamRange.EQ.MAX}
                      step="1"
                      value={band.value}
                      className="w-[60px] max-sm:w-[50px] max-sm:text-xs max-sm:p-1 text-center p-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)]"
                      onChange={(e) =>
                        handleEqChange(
                          index,
                          parseInt(e.target.value),
                        )
                      }
                    />
                    <div className="font-bold mt-2 max-sm:mt-0 text-sm max-sm:text-xs text-center text-[var(--text-body)] bg-white/80 px-2 py-1 max-sm:px-1 max-sm:py-0.5 rounded shadow-sm">
                      {band.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 flex-wrap justify-center max-sm:flex-col" />

            <div className="flex gap-2 flex-wrap items-center mb-4 justify-center max-sm:flex-col max-sm:items-stretch"
              style={{ marginTop: '16px' } as CSSProperties}
            >
              <button
                className="glass-btn-primary min-w-[200px] max-sm:w-full px-4 py-2.5 rounded-lg text-sm"
                id="sendEqBtn"
                disabled={!isConnected}
                onClick={handleSendEq}
              >
                发送EQ设置 (命令: 0x01)
              </button>
              <button
                className="glass-btn-secondary min-w-[200px] max-sm:w-full px-4 py-2.5 rounded-lg text-sm"
                id="resetEqBtn"
                onClick={handleReset}
              >
                重置
              </button>
            </div>

            <div className="flex gap-2 flex-wrap items-center mb-4 justify-center max-sm:flex-col max-sm:items-stretch"
              style={{ marginTop: '16px' } as CSSProperties}
            >
              <div className="flex items-center gap-2.5 w-full">
                <label htmlFor="paValue" className="text-sm text-[var(--text-body)] whitespace-nowrap">
                  功率PA设置 (命令: 0x02):
                </label>
                <input
                  type="range"
                  id="paValue"
                  min={ParamRange.PA.MIN}
                  max={ParamRange.PA.MAX}
                  step="1"
                  value={paValue}
                  className="slider-thumb flex-1 h-5"
                  style={paSliderStyle}
                  onChange={handlePaSliderChange}
                />
                <input
                  type="number"
                  id="paValueInput"
                  min={ParamRange.PA.MIN}
                  max={ParamRange.PA.MAX}
                  step="1"
                  value={paValue}
                  className="w-[60px] text-center p-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)]"
                  onChange={handlePaInputChange}
                />
                <button
                  className="glass-btn-primary min-w-[80px] px-4 py-2 rounded-md text-sm"
                  id="sendPaBtn"
                  disabled={!isConnected}
                  onClick={handleSendPa}
                >
                  发送
                </button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center mb-4 justify-center max-sm:flex-col max-sm:items-stretch"
              style={{ marginTop: '16px' } as CSSProperties}
            >
              <div className="flex items-center gap-2.5 w-full">
                <label htmlFor="defaultVolume" className="text-sm text-[var(--text-body)] whitespace-nowrap">
                  开机默认音量 (命令: 0x03):
                </label>
                <input
                  type="range"
                  id="defaultVolume"
                  min={ParamRange.VOLUME.MIN}
                  max={ParamRange.VOLUME.MAX}
                  step="1"
                  value={volume}
                  className="slider-thumb flex-1 h-5"
                  style={volSliderStyle}
                  onChange={handleVolSliderChange}
                />
                <input
                  type="number"
                  id="defaultVolumeInput"
                  min={ParamRange.VOLUME.MIN}
                  max={ParamRange.VOLUME.MAX}
                  step="1"
                  value={volume}
                  className="w-[60px] text-center p-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)]"
                  onChange={handleVolInputChange}
                />
                <button
                  className="glass-btn-primary min-w-[80px] px-4 py-2 rounded-md text-sm"
                  id="sendVolumeBtn"
                  disabled={!isConnected}
                  onClick={handleSendVolume}
                >
                  发送
                </button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center mb-4 justify-center max-sm:flex-col max-sm:items-stretch"
              style={{ marginTop: '16px' } as CSSProperties}
            >
              <button
                className="w-full !bg-green-500 !border-green-500 hover:!bg-green-600 min-w-[200px] max-sm:w-full px-4 py-2.5 rounded-lg text-sm text-white"
                id="readAllBtn"
                disabled={!isConnected}
                onClick={handleReadAll}
              >
                读取全部信息 (命令: 0x80)
              </button>
            </div>
          </div>

          {/* ---- Right: Serial Card --------------------------------- */}
          <div className="glass-panel rounded-xl p-4 max-sm:p-2 flex-1 min-w-[400px] max-lg:min-w-full max-w-full flex flex-col h-full max-sm:min-h-auto">
            <h2 className="text-[var(--text-body)] mt-0 max-sm:text-lg">
              串口通信
            </h2>

            <div className="flex gap-2 flex-wrap items-center mb-4 justify-center max-sm:flex-col max-sm:items-stretch">
              <button
                className="glass-btn-primary min-w-[200px] max-sm:w-full px-4 py-2.5 rounded-lg text-sm"
                id="connectBtn"
                disabled={isConnected}
                onClick={handleConnect}
              >
                连接串口
              </button>
              <button
                className="glass-btn-secondary min-w-[200px] max-sm:w-full px-4 py-2.5 rounded-lg text-sm !bg-[#fff5f5] !border-[#fecaca] !text-[#b91c1c] hover:!bg-[#fee2e2]"
                id="disconnectBtn"
                disabled={!isConnected}
                onClick={handleDisconnect}
              >
                断开连接
              </button>

              <div className="flex gap-2 items-center">
                <select
                  id="baudRate"
                  value={baudRate}
                  onChange={handleBaudRateChange}
                  className="p-2 px-3 rounded-md border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--input-text)] cursor-pointer disabled:bg-[#f5f5f5] disabled:cursor-not-allowed"
                >
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200">115200</option>
                  <option value="custom">自定义</option>
                </select>
                <input
                  type="number"
                  id="customBaudRate"
                  placeholder="自定义波特率"
                  style={
                    ({
                      display:
                        baudRate === 'custom'
                          ? 'block'
                          : 'none',
                    }) as CSSProperties
                  }
                  min="1200"
                  max="4000000"
                  value={customBaudRate}
                  className="w-[120px] p-2 px-3 rounded-md border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--input-text)] disabled:bg-[#f5f5f5] disabled:cursor-not-allowed"
                  onChange={(e) =>
                    setCustomBaudRate(e.target.value)
                  }
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id="hexDisplay"
                  checked={hexDisplay}
                  onChange={(e) =>
                    setHexDisplay(e.target.checked)
                  }
                />
                <label htmlFor="hexDisplay">
                  十六进制显示
                </label>
                <input
                  type="checkbox"
                  id="showRawData"
                  checked={showRawData}
                  onChange={(e) =>
                    setShowRawData(e.target.checked)
                  }
                />
                <label htmlFor="showRawData">
                  显示原始数据
                </label>
              </div>

              <button
                className="glass-btn-secondary min-w-[200px] max-sm:w-full px-4 py-2.5 rounded-lg text-sm"
                id="clearReceiveBtn"
                onClick={clearReceive}
              >
                清空接收区
              </button>
            </div>

            <div
              className="p-3 rounded-md bg-[var(--panel-bg)] mb-4 text-sm text-[var(--text-body)]"
              id="status"
              style={
                { backgroundColor: statusBg } as CSSProperties
              }
            >
              {statusText}
            </div>

            <div className="w-full flex-1 flex flex-col min-h-0">
              <textarea
                id="receiveArea"
                ref={receiveRef}
                readOnly
                value={receiveLines.join('\n')}
                placeholder="接收的数据将显示在这里..."
                className="w-full flex-1 min-h-[100px] p-3 rounded-md border border-[var(--terminal-border)] font-mono resize-none bg-[var(--terminal-bg)] text-[var(--terminal-text)] box-border overflow-y-auto break-words text-sm leading-[1.4]"
              />
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-6 p-4 text-center text-[var(--footer-text)] text-sm border-t border-[var(--footer-border)] bg-[var(--footer-bg)] max-sm:sticky max-sm:bottom-0 max-sm:z-[100] max-sm:m-0">
        <p className="my-1">
          &copy; 2024 广州智造音响设备有限公司 版权所有
        </p>
        <p className="my-1">
          技术支持：
          <a href="mailto:support@example.com" className="text-[var(--btn-primary-bg)] no-underline hover:underline">
            support@example.com
          </a>
        </p>
        <p className="my-1">版本：1.0.0</p>
      </footer>
    </div>
  );
}
