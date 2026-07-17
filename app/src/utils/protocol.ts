// 广州智造音响设备有限公司 - 串口EQ均衡器控制应用
// 共享协议层：帧头、CRC、帧结构、命令类型

// 帧头定义
export const FrameHeader = {
  HOST: 0xaa, // 上位机帧头
  CHIP: 0x55, // 芯片帧头
} as const;

// BLE WEB_ID
export const BLE_WEB_ID = 0x01;

// 串口命令类型
export const SerialCommandType = {
  SPLIT_EQ: 0x00, // 拆分字节EQ
  NORMAL_EQ: 0x01, // 正常EQ
  PA_SET: 0x02, // 功率PA设置
  DEFAULT_VOL: 0x03, // 开机默认音量
  READ_ALL: 0x80, // 读取全部信息
} as const;

// CRC校验实现
// 采用简单的累加和校验方法
// 计算过程：将所有需要校验的字节累加，取结果的低8位
export function calculateCRC(data: Uint8Array): number {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    crc += data[i];
  }
  return crc & 0xff;
}

// 构建串口数据帧
// 帧结构：帧头(1字节) + 数据长度(1字节) + 命令(1字节) + 参数(n字节) + CRC(1字节)
export function buildFrame(
  command: number,
  params: Uint8Array,
): Uint8Array {
  const frame = new Uint8Array(params.length + 4);
  frame[0] = FrameHeader.HOST;
  frame[1] = params.length + 2; // 数据长度：包含命令和参数
  frame[2] = command;
  frame.set(params, 3);
  frame[frame.length - 1] = calculateCRC(frame.slice(0, -1));
  return frame;
}

// 构建 BLE 数据帧
// 帧结构：帧头(1) + WEB_ID(1) + 长度(1) + 命令(1) + 参数(n) + CRC(1)
export function buildBleFrame(
  cmd: number,
  params: number[] = [],
): Uint8Array {
  const frame = new Uint8Array(5 + params.length);
  frame[0] = FrameHeader.HOST;
  frame[1] = BLE_WEB_ID;
  frame[2] = 1 + params.length;
  frame[3] = cmd & 0xff;
  for (let i = 0; i < params.length; i++) {
    frame[4 + i] = params[i] & 0xff;
  }
  frame[frame.length - 1] = calculateCRC(frame.slice(0, -1));
  return frame;
}

// 解析接收到的串口数据帧
export interface ParsedFrame {
  command: number;
  params: Uint8Array;
  dataLength: number;
}

export function parseReceivedFrame(data: Uint8Array): ParsedFrame | null {
  if (data.length < 4) return null;

  const frameHeader = data[0];
  const dataLength = data[1];
  const command = data[2];

  if (
    frameHeader !== FrameHeader.CHIP &&
    frameHeader !== FrameHeader.HOST
  ) {
    return null;
  }

  if (data.length !== dataLength + 3) return null;

  const receivedCRC = data[data.length - 1];
  const calculatedCRC = calculateCRC(data.slice(0, -1));
  if (receivedCRC !== calculatedCRC) return null;

  const params = data.slice(3, -1);
  return { command, params, dataLength };
}

// 字节转十六进制字符串
export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

// 安全转换为字节值
export function toByte(value: number, min = 0, max = 255): number {
  const n = Number(value);
  const safe = Number.isFinite(n) ? Math.round(n) : min;
  return Math.max(min, Math.min(max, safe)) & 0xff;
}
