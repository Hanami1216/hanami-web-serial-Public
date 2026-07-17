// BLE 命令枚举与辅助函数
// 适用机型：A6L、A6D、A8D

export const CMD = {
  // === Map Byte 0: 系统功能 ===
  SYS_ASK: 0x00,
  SYS_CHIP_SUPPORT_MAP: 0x01,
  SYS_ASK_ALL: 0x02,
  SYS_ASK_CMD: 0x03,
  SYS_ASK_MAP: 0x04,
  SYS_ASK_BAT: 0x05,
  SYS_ASK_MCU_ID: 0x06,
  SYS_ASK_MID: 0x07,

  // === Map Byte 2: 音效功能 0（音乐 EQ） ===
  EQ_VOL_RESET: 0x10,
  EQ_VOL_VAL: 0x11,
  EQ_VOL_TRE: 0x12,
  EQ_VOL_MID: 0x13,
  EQ_VOL_BASS: 0x14,
  EQ_VOL_FRE_VAL: 0x15,

  // === Map Byte 3: 音效功能 1（音效增强） ===
  EQ_VOL_3D: 0x18,
  EQ_Voice_Cut: 0x19,
  EQ_VOL_VB: 0x1a,
  EQ_Voice_EXCITER: 0x1b,

  // === Map Byte 4: 音效功能 2（播放控制） ===
  EQ_VOL_PAUSE: 0x20,
  EQ_VOL_PREV: 0x21,
  EQ_VOL_NEXT: 0x22,
  EQ_VOL_MODE: 0x23,
  EQ_VOL_PLAY_MODE: 0x24,
  EQ_VOL_SAVE: 0x27,

  // === Map Byte 5: MIC 功能 3 ===
  EQ_MIC_RESET: 0x28,
  EQ_MIC_VAL: 0x29,
  EQ_MIC_priority: 0x2a,
  EQ_MIC_FRE_VAL: 0x2b,
  EQ_MIC_ECHO: 0x2c,
  EQ_MIC_REVERB: 0x2d,
  EQ_MIC_Magic_Sound: 0x2e,
  EQ_MIC_SAVE: 0x37,

  // === Map Byte 7: 灯光功能 0 ===
  LIGHT_AUTO_EN: 0x38,
  LIGHT_MODE_0: 0x39,

  // === Map Byte 10: 灯光功能 3（参数控制） ===
  LIGHT_COLOR_SET: 0x50,
  LIGHT_VAL_SET: 0x51,
  LIGHT_SPEED_SET: 0x52,
  LIGHT_SAVE: 0x57,

  // === Map Byte 11: 文字功能 0（显示模式） ===
  TEXT_Content: 0x58,
  TEXT_MODE_0: 0x59,

  // === Map Byte 13: 文字功能 2（样式参数） ===
  TEXT_COLOR_ONE: 0x68,
  TEXT_COLOR_AUTO_Speed: 0x69,
  TEXT_Scroll_Speed: 0x6a,
  TEXT_LIGHT: 0x6b,
  TEXT_SAVE: 0x6f,
} as const;

export type CmdValue = (typeof CMD)[keyof typeof CMD];

// CMD 名称解析表
const CMD_NAMES: Record<number, string> = {};
for (const [name, value] of Object.entries(CMD)) {
  CMD_NAMES[value as number] = name;
}

export function cmdName(cmd: number): string {
  const v = cmd & 0xff;
  const name = CMD_NAMES[v];
  return name
    ? `${name}(0x${v.toString(16).padStart(2, '0').toUpperCase()})`
    : `0x${v.toString(16).padStart(2, '0').toUpperCase()}`;
}

// BLE 服务 UUID
export const BLE_SERVICE_UUID = '0000af00-0000-1000-8000-00805f9b34fb';
export const BLE_WRITE_CHARACTERISTIC_UUID =
  '0000af01-0000-1000-8000-00805f9b34fb';
export const BLE_NOTIFY_CHARACTERISTIC_UUID =
  '0000af02-0000-1000-8000-00805f9b34fb';

// 灯光模式颜色
export const LIGHT_MODE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#2dd4bf',
  '#8b5cf6',
];

// 文字模式标签
export const TEXT_MODE_LABELS = [
  '自动切换',
  '文本显示',
  '歌词显示',
  '频谱0',
  '频谱1',
  '频谱2',
  '频谱3',
];

// 命令测试规格
export interface CmdTestSpec {
  params: number[] | (() => number[]);
  danger?: string;
  noResponse?: boolean;
  multiFrame?: boolean;
}

export function buildCmdTestSpec(
  buildSupportedMapBytes: () => number[],
): Record<number, CmdTestSpec> {
  const EQ_10BAND = [1, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
  const s: Record<number, CmdTestSpec> = {};

  s[CMD.SYS_ASK] = { params: [] };
  s[CMD.SYS_CHIP_SUPPORT_MAP] = { params: [] };
  s[CMD.SYS_ASK_ALL] = { params: [], multiFrame: true };
  s[CMD.SYS_ASK_CMD] = { params: [0x01] };
  s[CMD.SYS_ASK_MAP] = {
    params: () => buildSupportedMapBytes(),
    multiFrame: true,
  };
  s[CMD.SYS_ASK_BAT] = { params: [] };
  s[CMD.SYS_ASK_MCU_ID] = { params: [] };
  s[CMD.SYS_ASK_MID] = { params: [] };

  s[CMD.EQ_VOL_RESET] = { params: [1], danger: '重置音乐设置' };
  s[CMD.EQ_VOL_VAL] = { params: [1, 16] };
  s[CMD.EQ_VOL_TRE] = { params: [1, 16] };
  s[CMD.EQ_VOL_MID] = { params: [1, 16] };
  s[CMD.EQ_VOL_BASS] = { params: [1, 16] };
  s[CMD.EQ_VOL_FRE_VAL] = { params: EQ_10BAND };

  s[CMD.EQ_VOL_3D] = { params: [1, 16] };
  s[CMD.EQ_Voice_Cut] = { params: [1, 16] };
  s[CMD.EQ_VOL_VB] = { params: [1, 16] };
  s[CMD.EQ_Voice_EXCITER] = { params: [1, 16] };

  s[CMD.EQ_VOL_PAUSE] = { params: [1], danger: '暂停播放' };
  s[CMD.EQ_VOL_PREV] = { params: [1], danger: '上一曲' };
  s[CMD.EQ_VOL_NEXT] = { params: [1], danger: '下一曲' };
  s[CMD.EQ_VOL_MODE] = { params: [1], danger: '切换播放模式' };
  s[CMD.EQ_VOL_PLAY_MODE] = { params: [1, 0], danger: '切换播放模式' };
  s[CMD.EQ_VOL_SAVE] = { params: [1], danger: '写入Flash(保存)' };

  s[CMD.EQ_MIC_RESET] = { params: [1], danger: '重置MIC设置' };
  s[CMD.EQ_MIC_VAL] = { params: [1, 16] };
  s[CMD.EQ_MIC_priority] = { params: [1, 16] };
  s[CMD.EQ_MIC_FRE_VAL] = { params: EQ_10BAND };
  s[CMD.EQ_MIC_ECHO] = { params: [1, 16] };
  s[CMD.EQ_MIC_REVERB] = { params: [1, 16] };
  s[CMD.EQ_MIC_Magic_Sound] = { params: [1, 4] };
  s[CMD.EQ_MIC_SAVE] = { params: [1], danger: '写入Flash(保存)' };

  s[CMD.LIGHT_AUTO_EN] = { params: [1, 128] };
  s[CMD.LIGHT_COLOR_SET] = { params: [1, 128] };
  s[CMD.LIGHT_VAL_SET] = { params: [1, 8] };
  s[CMD.LIGHT_SPEED_SET] = { params: [1, 8] };
  s[CMD.LIGHT_SAVE] = { params: [1], danger: '写入Flash(保存)' };

  for (let i = 0; i < 16; i++) {
    s[CMD.LIGHT_MODE_0 + i] = { params: [1] };
  }

  s[CMD.TEXT_Content] = { params: [72, 105] };
  s[CMD.TEXT_COLOR_ONE] = { params: [1, 128] };
  s[CMD.TEXT_COLOR_AUTO_Speed] = { params: [1, 8] };
  s[CMD.TEXT_Scroll_Speed] = { params: [1, 8] };
  s[CMD.TEXT_LIGHT] = { params: [1, 8] };
  s[CMD.TEXT_SAVE] = { params: [1], danger: '写入Flash(保存)' };

  for (let i = 0; i < 7; i++) {
    s[CMD.TEXT_MODE_0 + i] = { params: [1] };
  }

  return s;
}

// 位图辅助
export function isCommandSupported(
  mapBytes: number[],
  cmd: number,
): boolean {
  const byteIndex = Math.floor(cmd / 8);
  const bitIndex = cmd % 8;
  return Boolean(mapBytes[byteIndex] & (1 << bitIndex));
}

export function buildSupportedMapBytes(
  supportedCommands: Set<number>,
): number[] {
  const mapLength = 15;
  const map = new Array(mapLength).fill(0);
  supportedCommands.forEach((cmd) => {
    const byteIndex = Math.floor(cmd / 8);
    const bitIndex = cmd % 8;
    if (byteIndex < mapLength) {
      map[byteIndex] |= 1 << bitIndex;
    }
  });
  return map;
}
