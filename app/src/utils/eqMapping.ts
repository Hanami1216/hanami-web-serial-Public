// EQ值映射配置 - 控制显示值与实际发送值的对应关系

// 参数范围定义
export const ParamRange = {
  PA: { MIN: 0, MAX: 64, DEFAULT: 45 },
  VOLUME: { MIN: 0, MAX: 15, DEFAULT: 8 },
  EQ: { MIN: -12, MAX: 12, DEFAULT: 0 },
} as const;

// EQ映射常量
const DISPLAY_TO_ACTUAL = {
  MIN: 0, // 显示-12dB对应实际发送值0
  MAX: 24, // 显示+12dB对应实际发送值24
  DEFAULT: 12, // 显示0dB对应实际发送值12
} as const;

// 显示值转换为实际值（-12..+12 → 0..24）
export function displayToActual(displayValue: number): number {
  return Math.round(
    ((displayValue - ParamRange.EQ.MIN) /
      (ParamRange.EQ.MAX - ParamRange.EQ.MIN)) *
      (DISPLAY_TO_ACTUAL.MAX - DISPLAY_TO_ACTUAL.MIN) +
      DISPLAY_TO_ACTUAL.MIN,
  );
}

// 实际值转换为显示值（0..24 → -12..+12）
export function actualToDisplay(actualValue: number): number {
  return Math.round(
    ((actualValue - DISPLAY_TO_ACTUAL.MIN) /
      (DISPLAY_TO_ACTUAL.MAX - DISPLAY_TO_ACTUAL.MIN)) *
      (ParamRange.EQ.MAX - ParamRange.EQ.MIN) +
      ParamRange.EQ.MIN,
  );
}

// BLE版本（略有不同的实现方式，保持兼容）
export function displayToWireDb(displayValue: number): number {
  let v = Math.round(Number(displayValue) + 12);
  if (v < 0) v = 0;
  if (v > 24) v = 24;
  return v & 0xff;
}

export function wireToDisplayDb(wireValue: number): number {
  let v = (wireValue & 0xff) - 12;
  if (v < -12) v = -12;
  if (v > 12) v = 12;
  return v;
}

// 串口EQ频段配置（15段）
export interface EqBand {
  label: string;
  freq: number;
  min: number;
  max: number;
  value: number;
}

export const serialEqBands: EqBand[] = [
  {
    label: '25Hz',
    freq: 25,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '40Hz',
    freq: 40,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '63Hz',
    freq: 63,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '100Hz',
    freq: 100,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '160Hz',
    freq: 160,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '250Hz',
    freq: 250,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '400Hz',
    freq: 400,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '630Hz',
    freq: 630,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '1kHz',
    freq: 1000,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '1.6kHz',
    freq: 1600,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '2.5kHz',
    freq: 2500,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '4KHz',
    freq: 4000,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '6.3KHz',
    freq: 6300,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '10KHz',
    freq: 10000,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
  {
    label: '16kHz',
    freq: 160000,
    min: ParamRange.EQ.MIN,
    max: ParamRange.EQ.MAX,
    value: ParamRange.EQ.DEFAULT,
  },
];

// BLE 10段EQ频段
export const tenBandEq: EqBand[] = [
  { label: '31Hz', freq: 31, min: -12, max: 12, value: 0 },
  { label: '63Hz', freq: 63, min: -12, max: 12, value: 0 },
  { label: '125Hz', freq: 125, min: -12, max: 12, value: 0 },
  { label: '250Hz', freq: 250, min: -12, max: 12, value: 0 },
  { label: '500Hz', freq: 500, min: -12, max: 12, value: 0 },
  { label: '1kHz', freq: 1000, min: -12, max: 12, value: 0 },
  { label: '2kHz', freq: 2000, min: -12, max: 12, value: 0 },
  { label: '4kHz', freq: 4000, min: -12, max: 12, value: 0 },
  { label: '8kHz', freq: 8000, min: -12, max: 12, value: 0 },
  { label: '16kHz', freq: 16000, min: -12, max: 12, value: 0 },
];

// 创建深拷贝的10段EQ配置
export function createTenBandEq(): EqBand[] {
  return tenBandEq.map((b) => ({ ...b }));
}
