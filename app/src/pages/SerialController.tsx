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
import '../styles/serial.css';

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
    <>
      <h1>串口EQ均衡器</h1>
      <div className="container">
        <div className="panel">
          {/* ---- Left: EQ Card -------------------------------------- */}
          <div className="card eq-card">
            <h2>均衡器设置</h2>

            <div
              className="eq-container"
              id="eqContainer"
            >
              <div className="db-scale">
                <div className="db-mark">+12dB</div>
                <div className="db-mark">+6dB</div>
                <div className="db-mark">0dB</div>
                <div className="db-mark">-6dB</div>
                <div className="db-mark">-12dB</div>
              </div>

              {eqBands.map((band, index) => (
                <div
                  className="eq-band-container"
                  key={index}
                >
                  <div className="eq-band">
                    <input
                      type="range"
                      id={`eqSlider${index}`}
                      min={ParamRange.EQ.MIN}
                      max={ParamRange.EQ.MAX}
                      step="1"
                      value={band.value}
                      className="eq-slider"
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
                      className="eq-value"
                      onChange={(e) =>
                        handleEqChange(
                          index,
                          parseInt(e.target.value),
                        )
                      }
                    />
                    <div className="eq-label">
                      {band.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="eq-presets">{/* empty */}</div>

            <div
              className="control-panel"
              style={
                { marginTop: 'var(--spacing-medium)' } as CSSProperties
              }
            >
              <button
                id="sendEqBtn"
                disabled={!isConnected}
                onClick={handleSendEq}
              >
                发送EQ设置 (命令: 0x01)
              </button>
              <button
                id="resetEqBtn"
                onClick={handleReset}
              >
                重置
              </button>
            </div>

            <div
              className="control-panel"
              style={
                { marginTop: 'var(--spacing-medium)' } as CSSProperties
              }
            >
              <div className="pa-control">
                <label htmlFor="paValue">
                  功率PA设置 (命令: 0x02):
                </label>
                <input
                  type="range"
                  id="paValue"
                  min={ParamRange.PA.MIN}
                  max={ParamRange.PA.MAX}
                  step="1"
                  value={paValue}
                  className="pa-slider"
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
                  className="pa-value"
                  onChange={handlePaInputChange}
                />
                <button
                  id="sendPaBtn"
                  disabled={!isConnected}
                  onClick={handleSendPa}
                >
                  发送
                </button>
              </div>
            </div>

            <div
              className="control-panel"
              style={
                { marginTop: 'var(--spacing-medium)' } as CSSProperties
              }
            >
              <div className="volume-control">
                <label htmlFor="defaultVolume">
                  开机默认音量 (命令: 0x03):
                </label>
                <input
                  type="range"
                  id="defaultVolume"
                  min={ParamRange.VOLUME.MIN}
                  max={ParamRange.VOLUME.MAX}
                  step="1"
                  value={volume}
                  className="volume-slider"
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
                  className="volume-value"
                  onChange={handleVolInputChange}
                />
                <button
                  id="sendVolumeBtn"
                  disabled={!isConnected}
                  onClick={handleSendVolume}
                >
                  发送
                </button>
              </div>
            </div>

            <div
              className="control-panel"
              style={
                { marginTop: 'var(--spacing-medium)' } as CSSProperties
              }
            >
              <button
                id="readAllBtn"
                disabled={!isConnected}
                onClick={handleReadAll}
              >
                读取全部信息 (命令: 0x80)
              </button>
            </div>
          </div>

          {/* ---- Right: Serial Card --------------------------------- */}
          <div className="card serial-card">
            <h2>串口通信</h2>

            <div className="control-panel">
              <button
                id="connectBtn"
                disabled={isConnected}
                onClick={handleConnect}
              >
                连接串口
              </button>
              <button
                id="disconnectBtn"
                disabled={!isConnected}
                onClick={handleDisconnect}
              >
                断开连接
              </button>

              <div className="baud-rate-container">
                <select
                  id="baudRate"
                  value={baudRate}
                  onChange={handleBaudRateChange}
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
                  onChange={(e) =>
                    setCustomBaudRate(e.target.value)
                  }
                />
              </div>

              <div className="hex-checkbox">
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
                id="clearReceiveBtn"
                onClick={clearReceive}
              >
                清空接收区
              </button>
            </div>

            <div
              className="status"
              id="status"
              style={
                { backgroundColor: statusBg } as CSSProperties
              }
            >
              {statusText}
            </div>

            <textarea
              id="receiveArea"
              ref={receiveRef}
              readOnly
              value={receiveLines.join('\n')}
              placeholder="接收的数据将显示在这里..."
            />
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>
          &copy; 2024 广州智造音响设备有限公司 版权所有
        </p>
        <p>
          技术支持：
          <a href="mailto:support@example.com">
            support@example.com
          </a>
        </p>
        <p>版本：1.0.0</p>
      </footer>
    </>
  );
}
