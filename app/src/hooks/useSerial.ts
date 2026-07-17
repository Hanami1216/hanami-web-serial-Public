// 广州智造音响设备有限公司 - 串口EQ均衡器控制应用
// 版本：1.0.0
// React Hook: Web Serial API 通信逻辑

import { useRef, useState, useEffect } from 'react';
import {
  buildFrame,
  parseReceivedFrame,
  SerialCommandType,
  FrameHeader,
} from '../utils/protocol';
import type { ParsedFrame } from '../utils/protocol';
import { actualToDisplay } from '../utils/eqMapping';

// ---------------------------------------------------------------------------
// Web Serial API type declarations (not yet in standard DOM TypeScript lib)
// ---------------------------------------------------------------------------
declare global {
  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }

  interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
    bufferSize?: number;
    flowControl?: string;
  }

  interface SerialPortRequestOptions {
    filters?: Array<{
      usbVendorId?: number;
      usbProductId?: number;
    }>;
  }

  interface Navigator {
    serial: {
      requestPort(
        options?: SerialPortRequestOptions,
      ): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    };
  }
}

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------
export interface UseSerialOptions {
  hexDisplay: boolean;
  showRawData: boolean;
  onReceivedData: (
    pa: number,
    defaultVol: number,
    eqDisplayValues: number[],
  ) => void;
  onReceivedPA: (pa: number) => void;
  onReceivedVolume: (vol: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useSerial(options: UseSerialOptions) {
  // ---- mutable refs (survive renders, no stale closures) ----------------
  const portRef = useRef<SerialPort | null>(null);
  const readerRef =
    useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = useRef(false);
  const receiveBufferRef = useRef<Uint8Array>(new Uint8Array(0));

  // Option refs – updated on every render so async callbacks always read the
  // latest value.
  const hexDisplayRef = useRef(options.hexDisplay);
  const showRawDataRef = useRef(options.showRawData);
  const onReceivedDataRef = useRef(options.onReceivedData);
  const onReceivedPARef = useRef(options.onReceivedPA);
  const onReceivedVolumeRef = useRef(options.onReceivedVolume);

  useEffect(() => {
    hexDisplayRef.current = options.hexDisplay;
    showRawDataRef.current = options.showRawData;
    onReceivedDataRef.current = options.onReceivedData;
    onReceivedPARef.current = options.onReceivedPA;
    onReceivedVolumeRef.current = options.onReceivedVolume;
  });

  // ---- reactive state --------------------------------------------------
  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState('未连接');
  const [statusBg, setStatusBg] = useState('#ecf0f1');
  const [receiveLines, setReceiveLines] = useState<string[]>([]);

  // ---- internal helpers ------------------------------------------------

  /** Append one or more lines to the receive-area display. */
  function addReceiveLines(lines: string[]) {
    setReceiveLines((prev) => [...prev, ...lines]);
  }

  /** Set connection status text + background colour. */
  function setStatus(text: string, bg: string) {
    setStatusText(text);
    setStatusBg(bg);
  }

  /** Format and print a full binary frame to the receive area. */
  function printDataFrame(frame: Uint8Array, isReceived: boolean) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const commandName =
      Object.entries(SerialCommandType).find(
        ([_, value]) => value === frame[2],
      )?.[0] || '未知命令';

    const lines: string[] = [
      '',
      `=== 格式化数据帧信息 ===`,
      `[${timeStr}] ${isReceived ? '接收' : '发送'}数据帧:`,
      `帧头: 0x${frame[0].toString(16).padStart(2, '0')}`,
      `数据长度: ${frame[1]} 字节`,
      `命令: 0x${frame[2].toString(16).padStart(2, '0')} (${commandName})`,
      `参数: ${Array.from(frame.slice(3, -1))
        .map((b) => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ')}`,
      `CRC: 0x${frame[frame.length - 1].toString(16).padStart(2, '0')}`,
      `完整数据帧: ${Array.from(frame)
        .map((b) => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ')}`,
      '=========================',
    ];

    addReceiveLines(lines);
  }

  /**
   * Dispatch a parsed frame to the appropriate callback depending on its
   * command byte.  Mirrors the original handleReceivedFrame() in app.js.
   */
  function handleReceivedFrame(frame: ParsedFrame) {
    console.log(
      `处理帧: 命令: 0x${frame.command.toString(16)}, 参数长度: ${frame.params.length}`,
    );

    switch (frame.command) {
      case SerialCommandType.READ_ALL: {
        console.log('处理READ_ALL命令响应');
        if (frame.params.length < 17) {
          console.error(
            `READ_ALL参数不足: 需要17个，实际${frame.params.length}个`,
          );
          return;
        }
        const pa = frame.params[0];
        const defaultVol = frame.params[1];
        const eqActualValues = frame.params.slice(2, 17);
        const eqDisplayValues = Array.from(eqActualValues).map((val) =>
          actualToDisplay(val),
        );

        console.log(
          `接收到设置: PA=${pa}, 默认音量=${defaultVol}, EQ值(映射后)=[${eqDisplayValues}]`,
        );

        if (pa > 100 || defaultVol > 100) {
          console.warn(
            `接收到的参数可能不合法: PA=${pa}, 默认音量=${defaultVol}`,
          );
        }

        onReceivedDataRef.current(pa, defaultVol, eqDisplayValues);
        break;
      }

      case SerialCommandType.NORMAL_EQ:
        console.log('处理NORMAL_EQ命令响应');
        break;

      case SerialCommandType.PA_SET: {
        console.log('处理PA_SET命令响应');
        if (frame.params.length < 1) {
          console.error('PA_SET参数不足');
          return;
        }
        const paVal = frame.params[0];
        console.log(`接收到功率PA设置确认: PA=${paVal}`);
        if (paVal > 100) {
          console.warn(`接收到的PA值可能不合法: ${paVal}`);
        }
        onReceivedPARef.current(paVal);
        break;
      }

      case SerialCommandType.DEFAULT_VOL: {
        console.log('处理DEFAULT_VOL命令响应');
        if (frame.params.length < 1) {
          console.error('DEFAULT_VOL参数不足');
          return;
        }
        const volValue = frame.params[0];
        console.log(`接收到开机默认音量设置确认: 音量=${volValue}`);
        if (volValue > 100) {
          console.warn(`接收到的音量值可能不合法: ${volValue}`);
        }
        onReceivedVolumeRef.current(volValue);
        break;
      }

      default:
        console.log(
          `未知命令类型: 0x${frame.command.toString(16)}`,
        );
        break;
    }
  }

  /**
   * State-machine buffer processor.
   * Scans the accumulated receive buffer for valid frames (header, length,
   * CRC), parses them and dispatches to handleReceivedFrame.
   *
   * Mirrors processBuffer() in app.js exactly.
   */
  function processBuffer() {
    while (receiveBufferRef.current.length >= 4) {
      const buffer = receiveBufferRef.current;

      // 1. find a valid frame header
      let headerIdx = -1;
      for (let i = 0; i < buffer.length; i++) {
        if (
          buffer[i] === FrameHeader.CHIP ||
          buffer[i] === FrameHeader.HOST
        ) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        console.log('未找到有效帧头，清空缓冲区');
        receiveBufferRef.current = new Uint8Array(0);
        break;
      }

      // 2. drop bytes before the header
      if (headerIdx > 0) {
        console.log(`丢弃帧头前的数据: ${headerIdx}字节`);
        receiveBufferRef.current = buffer.slice(headerIdx);
        continue;
      }

      // 3. need at least 2 bytes for header + length
      if (buffer.length < 2) break;

      const dataLength = buffer[1];

      // 4. sanity check on length field
      if (dataLength > 100) {
        console.log(`异常的数据长度: ${dataLength}，丢弃帧头`);
        receiveBufferRef.current = buffer.slice(1);
        continue;
      }

      // 5. wait for a complete frame
      const expectedLen = dataLength + 3; // header(1) + length(1) + body + crc(1)
      if (buffer.length < expectedLen) break;

      const frameData = buffer.slice(0, expectedLen);
      const frame = parseReceivedFrame(frameData);

      if (frame) {
        try {
          console.log('成功解析帧:', frame.command);
          handleReceivedFrame(frame);
          printDataFrame(frameData, true);
        } catch (frameError) {
          console.error('处理数据帧错误:', frameError);
        }
        receiveBufferRef.current = buffer.slice(expectedLen);
      } else {
        console.log('帧解析失败，跳过一字节继续尝试');
        receiveBufferRef.current = buffer.slice(1);
      }
    }
  }

  /**
   * Async read loop.  Owns the ReadableStreamDefaultReader, accumulates
   * incoming bytes into receiveBufferRef and invokes processBuffer().
   *
   * Mirrors readData() in app.js.
   */
  async function readData() {
    while (
      portRef.current &&
      portRef.current.readable &&
      keepReadingRef.current
    ) {
      try {
        const reader = portRef.current.readable.getReader();
        readerRef.current = reader;

        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('读取完成');
              break;
            }

            // append received bytes to the buffer
            const newBuffer = new Uint8Array(
              receiveBufferRef.current.length + value.length,
            );
            newBuffer.set(receiveBufferRef.current);
            newBuffer.set(value, receiveBufferRef.current.length);
            receiveBufferRef.current = newBuffer;

            // optional raw-data display
            if (showRawDataRef.current) {
              let displayText: string;
              if (hexDisplayRef.current) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString();
                displayText = `[${timeStr} 原始数据] `;
                displayText += Array.from(value)
                  .map((b) =>
                    b.toString(16).padStart(2, '0'),
                  )
                  .join(' ');
              } else {
                displayText = new TextDecoder().decode(value);
              }
              addReceiveLines([displayText]);
            }

            // attempt to parse frames out of the accumulated buffer
            processBuffer();
          }
        } catch (readError) {
          if (keepReadingRef.current) {
            console.error('读取数据错误:', readError);
            setStatus(
              `读取错误: ${(readError as Error).message}`,
              '#e74c3c',
            );
          }
        } finally {
          reader.releaseLock();
          if (readerRef.current === reader) {
            readerRef.current = null;
          }
        }
      } catch (streamError) {
        if (keepReadingRef.current) {
          console.error('获取读取流错误:', streamError);
          setStatus(
            `流错误: ${(streamError as Error).message}`,
            '#e74c3c',
          );
          // prevent tight loop on persistent stream error
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    console.log('读取循环已终止');
  }

  // ---- public API -------------------------------------------------------

  /**
   * Request a serial port from the browser, open it, start the read loop,
   * and auto-send a READ_ALL command 500 ms after a successful connection.
   *
   * Error messages are in Chinese, matching the original app.js.
   */
  async function connect(baudRate: number): Promise<void> {
    setStatus('正在连接...', '#f39c12');

    // 1. request port
    let port: SerialPort;
    try {
      port = await navigator.serial.requestPort();
    } catch (error) {
      const err = error as DOMException;
      if (err.name === 'NotFoundError') {
        throw new Error('未选择串口设备');
      } else if (err.name === 'SecurityError') {
        throw new Error('串口访问被拒绝，请检查浏览器权限设置');
      } else {
        throw new Error(`请求串口失败: ${err.message}`);
      }
    }

    // 2. open port
    try {
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 255,
        flowControl: 'none',
      });
    } catch (error) {
      const err = error as DOMException;
      if (err.name === 'NetworkError') {
        throw new Error(
          '串口被其他程序占用，请关闭其他程序后重试',
        );
      } else if (err.name === 'InvalidStateError') {
        throw new Error('串口已打开，请先断开连接');
      } else {
        throw new Error(`打开串口失败: ${err.message}`);
      }
    }

    portRef.current = port;

    // 3. read device info (best-effort)
    let deviceInfo = '未知设备';
    try {
      const info = port.getInfo();
      if (info && info.usbProductId !== undefined) {
        deviceInfo = `${(info.usbVendorId ?? 0).toString(16)}:${info.usbProductId.toString(16)}`;
      }
    } catch {
      console.warn('获取设备信息失败');
    }

    setStatus(
      `已连接: ${deviceInfo} (${baudRate}bps)`,
      '#2ecc71',
    );
    setIsConnected(true);

    // 4. start read loop
    keepReadingRef.current = true;
    readData();

    // 5. auto-send READ_ALL after a short delay
    setTimeout(async () => {
      if (portRef.current && portRef.current.writable) {
        const frame = buildFrame(
          SerialCommandType.READ_ALL,
          new Uint8Array(0),
        );
        try {
          // sendFrame calls printDataFrame internally
          const p = portRef.current;
          const w = p.writable!;
          const writer = w.getWriter();
          await writer.write(frame);
          writer.releaseLock();
          printDataFrame(frame, false);
        } catch (e) {
          console.warn('自动读取设备信息失败:', e);
        }
      }
    }, 500);
  }

  /**
   * Gracefully tear down the serial connection: stop the read loop, cancel
   * the reader, and close the port.
   */
  async function disconnect(): Promise<void> {
    setStatus('正在断开...', '#f39c12');

    keepReadingRef.current = false;

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (error) {
        console.warn('取消读取失败:', error);
      } finally {
        readerRef.current = null;
      }
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (error) {
        console.warn('关闭串口失败:', error);
      } finally {
        portRef.current = null;
      }
    }

    setStatus('已断开连接', '#ecf0f1');
    setIsConnected(false);
  }

  /**
   * Write a raw Uint8Array frame to the serial port with automatic retry.
   *
   * @param frame      The complete binary frame to send.
   * @param maxRetries Maximum number of retry attempts (default 2).
   *
   * Throws if the port is not connected or if all retries are exhausted.
   */
  async function sendFrame(
    frame: Uint8Array,
    maxRetries = 2,
  ): Promise<void> {
    const p = portRef.current;
    if (!p || !p.writable) {
      throw new Error('串口未连接或不可写');
    }

    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        writer = p.writable.getWriter();
        await writer.write(frame);
        printDataFrame(frame, false);
        return;
      } catch (error) {
        retries++;
        console.warn(`发送失败，第${retries}次重试`, error);
        if (retries > maxRetries) {
          throw new Error(
            `发送数据失败(${retries}次尝试后): ${(error as Error).message}`,
          );
        }
        // exponential back-off
        await new Promise((r) => setTimeout(r, 200 * retries));
      } finally {
        if (writer) {
          try {
            writer.releaseLock();
          } catch {
            /* writer may already be released */
          }
          writer = null;
        }
      }
    }
  }

  /** Clear the received-data textarea. */
  function clearReceiveLines(): void {
    setReceiveLines([]);
  }

  // ---- cleanup on unmount -----------------------------------------------
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
      if (portRef.current) {
        portRef.current.close().catch(() => {});
        portRef.current = null;
      }
    };
  }, []);

  // ---- return value -----------------------------------------------------
  return {
    isConnected,
    statusText,
    statusBg,
    receiveLines,
    connect,
    disconnect,
    sendFrame,
    clearReceiveLines,
    setStatus,
  };
}
