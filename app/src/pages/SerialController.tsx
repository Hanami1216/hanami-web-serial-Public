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

/** Compute the `--percent` CSS custom property value for a slider.
 *  返回**无单位数值** 0–100；utilities.css 用 calc(... * 1%) 换算成百分比。 */
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
  /** 状态提示的恢复定时器（连续操作/卸载时清理，避免定时器竞态）。 */
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** 事件回调里需要读到最新的连接状态（避免 stale closure）。 */
  const isConnectedRef = useRef(false);

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

  // ---- keep refs in sync / clean up timers ------------------------------

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(
    () => () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    },
    [],
  );

  /** 提示一条操作结果，2 秒后回落到当前连接状态。 */
  function flashStatus(text: string) {
    setStatus(text, 'var(--status-connected-bg)');
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = setTimeout(() => {
      setStatus(
        isConnectedRef.current ? '已连接' : '未连接',
        isConnectedRef.current
          ? 'var(--status-connected-bg)'
          : 'var(--status-idle-bg)',
      );
    }, 2000);
  }

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
        'var(--status-disconnected-bg)',
      );
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
    } catch (error) {
      setStatus(
        `断开连接错误: ${(error as Error).message}`,
        'var(--status-disconnected-bg)',
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
        'var(--status-disconnected-bg)',
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
      flashStatus(`功率PA设置已发送: ${val}`);
    } catch (error) {
      setStatus(
        `发送错误: ${(error as Error).message}`,
        'var(--status-disconnected-bg)',
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
      flashStatus(`开机默认音量设置已发送: ${val}`);
    } catch (error) {
      setStatus(
        `发送错误: ${(error as Error).message}`,
        'var(--status-disconnected-bg)',
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
        'var(--status-disconnected-bg)',
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

    flashStatus('已重置所有参数到默认值');
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
    <div className="font-sans min-h-screen bg-[var(--bg-body)] text-[var(--text-body)]">
      {/* ---- 顶栏 ---- */}
      <header className="sticky top-0 z-50 border-b border-[var(--header-border)] bg-[var(--header-bg)] px-4 py-3 backdrop-blur-md max-sm:px-3">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2.5">
          <span
            className={`status-dot${isConnected ? ' connected' : ''}`}
          />
          <h1 className="m-0 truncate text-lg font-semibold max-sm:text-base">
            串口EQ均衡器
          </h1>
        </div>
      </header>

      {/* ---- 主体：宽屏两栏，窄屏单栏 ---- */}
      <main className="mx-auto grid max-w-[1400px] gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:p-6 max-sm:gap-4 max-sm:p-3">
        <div className="flex min-w-0 flex-col gap-5 max-sm:gap-4">
          {/* ---- 均衡器卡片 ---- */}
          <section className="glass-panel rounded-xl p-5 max-sm:p-3">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="m-0 text-base font-semibold">
                均衡器设置
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                15 段 · 显示值 -12 ~ +12 dB（0 为平直）
              </span>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-1.5" id="eqContainer">
                {/* 刻度：与滑块行程对齐 */}
                <div className="flex h-[220px] w-[40px] shrink-0 flex-col justify-between pr-2 text-right text-[11px] leading-none text-[var(--eq-scale-text)] max-sm:hidden">
                  <span>+12</span>
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                </div>

                {eqBands.map((band, index) => (
                  <div
                    className="flex w-[52px] shrink-0 flex-col items-center gap-2"
                    key={band.label}
                  >
                    <input
                      type="range"
                      id={`eqSlider${index}`}
                      min={ParamRange.EQ.MIN}
                      max={ParamRange.EQ.MAX}
                      step="1"
                      value={band.value}
                      aria-label={`${band.label} 增益`}
                      className="eq-slider-vertical h-[220px] w-[18px] cursor-pointer"
                      onChange={(e) =>
                        handleEqChange(index, parseInt(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      id={`eqValue${index}`}
                      min={ParamRange.EQ.MIN}
                      max={ParamRange.EQ.MAX}
                      step="1"
                      value={band.value}
                      aria-label={`${band.label} 增益数值`}
                      className="glass-input w-full rounded-md py-1 text-center text-xs"
                      onChange={(e) =>
                        handleEqChange(index, parseInt(e.target.value))
                      }
                    />
                    <div className="text-center text-xs font-medium text-[var(--text-muted)]">
                      {band.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5 max-sm:flex-col">
              <button
                className="glass-btn-primary rounded-lg px-5 py-2.5 text-sm max-sm:w-full"
                id="sendEqBtn"
                disabled={!isConnected}
                onClick={handleSendEq}
              >
                发送 EQ 设置（命令 0x01）
              </button>
              <button
                className="glass-btn-secondary rounded-lg px-5 py-2.5 text-sm max-sm:w-full"
                id="resetEqBtn"
                onClick={handleReset}
              >
                重置为平直
              </button>
            </div>
          </section>

          {/* ---- 音效参数卡片 ---- */}
          <section className="glass-panel rounded-xl p-5 max-sm:p-3">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="m-0 text-base font-semibold">音效参数</h2>
              <span className="text-xs text-[var(--text-muted)]">
                功率 PA 0 ~ 64 · 默认音量 0 ~ 15
              </span>
            </div>

            <div className="flex flex-col gap-4">

              {/* 功率 PA */}
              <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 sm:grid-cols-[132px_minmax(0,1fr)_72px_64px]">
                <label
                  htmlFor="paValue"
                  className="col-span-2 text-sm whitespace-nowrap sm:col-span-1"
                >
                  功率 PA
                </label>
                <input
                  type="range"
                  id="paValue"
                  min={ParamRange.PA.MIN}
                  max={ParamRange.PA.MAX}
                  step="1"
                  value={paValue}
                  aria-label="功率 PA"
                  className="slider-thumb col-span-2 h-2 w-full sm:col-span-1"
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
                  aria-label="功率 PA 数值"
                  className="glass-input w-full rounded-md py-1.5 text-center text-sm"
                  onChange={handlePaInputChange}
                />
                <button
                  className="glass-btn-primary rounded-md px-3 py-2 text-sm"
                  id="sendPaBtn"
                  disabled={!isConnected}
                  onClick={handleSendPa}
                >
                  发送
                </button>
              </div>

              {/* 开机默认音量 */}
              <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 sm:grid-cols-[132px_minmax(0,1fr)_72px_64px]">
                <label
                  htmlFor="defaultVolume"
                  className="col-span-2 text-sm whitespace-nowrap sm:col-span-1"
                >
                  开机默认音量
                </label>
                <input
                  type="range"
                  id="defaultVolume"
                  min={ParamRange.VOLUME.MIN}
                  max={ParamRange.VOLUME.MAX}
                  step="1"
                  value={volume}
                  aria-label="开机默认音量"
                  className="slider-thumb col-span-2 h-2 w-full sm:col-span-1"
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
                  aria-label="开机默认音量数值"
                  className="glass-input w-full rounded-md py-1.5 text-center text-sm"
                  onChange={handleVolInputChange}
                />
                <button
                  className="glass-btn-primary rounded-md px-3 py-2 text-sm"
                  id="sendVolumeBtn"
                  disabled={!isConnected}
                  onClick={handleSendVolume}
                >
                  发送
                </button>
              </div>

              <div className="border-t border-[var(--divider)] pt-4">
                <button
                  className="glass-btn-secondary w-full rounded-lg px-4 py-2.5 text-sm"
                  id="readAllBtn"
                  disabled={!isConnected}
                  onClick={handleReadAll}
                >
                  读取全部信息（命令 0x80）
                </button>
              </div>
            </div>
          </section>
        </div>

          {/* ---- 串口通信卡片 ---- */}
          <aside className="glass-panel rounded-xl p-5 max-sm:p-3">
            <div className="mb-4 flex items-baseline justify-between gap-x-3">
              <h2 className="m-0 text-base font-semibold">串口通信</h2>
              <span className="text-xs text-[var(--text-muted)]">
                {baudRate === 'custom'
                  ? `${customBaudRate || '—'} bps`
                  : `${baudRate} bps`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                className="glass-btn-primary rounded-lg px-4 py-2.5 text-sm"
                id="connectBtn"
                disabled={isConnected}
                onClick={handleConnect}
              >
                连接串口
              </button>
              <button
                className="glass-btn-danger rounded-lg px-4 py-2.5 text-sm"
                id="disconnectBtn"
                disabled={!isConnected}
                onClick={handleDisconnect}
              >
                断开连接
              </button>
            </div>

            {/* 波特率 */}
            <div className="mt-4 grid gap-2">
              <label
                htmlFor="baudRate"
                className="text-xs text-[var(--text-muted)]"
              >
                波特率
              </label>
              <div className="flex gap-2">
                <select
                  id="baudRate"
                  value={baudRate}
                  onChange={handleBaudRateChange}
                  className="glass-input cursor-pointer rounded-md px-3 py-2 text-sm"
                >
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200">115200</option>
                  <option value="custom">自定义</option>
                </select>
                {baudRate === 'custom' && (
                  <input
                    type="number"
                    id="customBaudRate"
                    placeholder="1200 - 4000000"
                    min="1200"
                    max="4000000"
                    value={customBaudRate}
                    aria-label="自定义波特率"
                    className="glass-input min-w-0 flex-1 rounded-md px-3 py-2 text-sm"
                    onChange={(e) =>
                      setCustomBaudRate(e.target.value)
                    }
                  />
                )}
              </div>
            </div>

            {/* 显示选项 */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <label
                htmlFor="hexDisplay"
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  id="hexDisplay"
                  checked={hexDisplay}
                  onChange={(e) =>
                    setHexDisplay(e.target.checked)
                  }
                  className="h-4 w-4 cursor-pointer accent-[var(--btn-primary-bg)]"
                />
                十六进制显示
              </label>
              <label
                htmlFor="showRawData"
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  id="showRawData"
                  checked={showRawData}
                  onChange={(e) =>
                    setShowRawData(e.target.checked)
                  }
                  className="h-4 w-4 cursor-pointer accent-[var(--btn-primary-bg)]"
                />
                显示原始数据
              </label>
            </div>

            <div
              className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm"
              id="status"
              style={
                { backgroundColor: statusBg } as CSSProperties
              }
            >
              <span
                className={`status-dot mt-1 shrink-0${isConnected ? ' connected' : ''}`}
              />
              <span className="min-w-0 break-words">
                {statusText}
              </span>
            </div>

            <textarea
              id="receiveArea"
              ref={receiveRef}
              readOnly
              value={receiveLines.join('\n')}
              placeholder="接收的数据将显示在这里…"
              aria-label="串口接收区"
              className="mt-4 h-[240px] w-full resize-none overflow-y-auto break-words rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 font-mono text-xs leading-[1.5] text-[var(--terminal-text)] outline-none max-sm:h-[180px]"
            />

            <button
              className="glass-btn-secondary mt-3 w-full rounded-lg px-4 py-2.5 text-sm"
              id="clearReceiveBtn"
              onClick={clearReceive}
            >
              清空接收区
            </button>
          </aside>
        </main>

      <footer className="border-t border-[var(--footer-border)] bg-[var(--footer-bg)] px-4 py-6 text-center text-xs text-[var(--footer-text)]">
        <p className="m-0">
          &copy; 2024 广州智造音响设备有限公司 版权所有
        </p>
        <p className="m-0 mt-1">
          技术支持：
          <a
            href="mailto:support@example.com"
            className="text-[var(--btn-primary-bg)] no-underline hover:underline"
          >
            support@example.com
          </a>
          <span className="mx-2">|</span>
          版本 1.0.0
        </p>
      </footer>
    </div>
  );
}
