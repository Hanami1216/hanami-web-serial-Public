---
name: protocol-command-change
description: '新增或修改串口 / BLE 协议命令的落点清单与约束。当需要加命令、改帧格式、改 EQ 映射、调支持位图，或排查命令不生效、参数被芯片忽略时使用。'
argument-hint: '要新增/修改的命令名与期望行为'
---

# 增改协议命令

本仓库同时维护**两套独立命令体系**（串口 / BLE）。改命令前先确定属于哪一套，再按对应落点逐项改完。

## 何时使用

- 新增一条串口或 BLE 命令
- 修改已有命令的参数结构 / 取值范围
- 命令发出去芯片无反应、参数被忽略
- 调整支持位图或 EQ 频段表

## 第一步：先读权威文档

`docs/蓝牙控制1.0通讯协议技术文档.md`（V1.6）是 BLE 协议的唯一权威来源。改帧格式或 `CMD` 前必读，**不要凭旧代码猜协议**。

## 第二步：判断属于哪一套体系

| | 串口（Web Serial） | BLE（Web Bluetooth） |
|---|---|---|
| 命令定义 | `SerialCommandType`（`utils/protocol.ts`） | `CMD`（`utils/bleCommands.ts`） |
| 帧构造 | `buildFrame(cmd, params)` → `[AA][LEN][CMD][params][CRC]` | `buildBleFrame(cmd, params)` → `[AA][01][LEN][CMD][params][CRC]` |
| LEN | `params.length + 2` | `params.length + 1` |
| 值映射 | `displayToActual` / `actualToDisplay` | `displayToWireDb` / `wireToDisplayDb` |
| 收发 Hook | `hooks/useSerial.ts` | `hooks/useBle.ts` |
| 页面 | `pages/SerialController.tsx` | `pages/BluetoothController.tsx` |

⚠️ 两套都有 `0x00`：串口是 `SPLIT_EQ`，BLE 是 `SYS_ASK`。**严禁跨体系复用常量或帧构造函数。**

## 第三步：逐项改完落点

### 新增 / 修改 BLE 命令

1. `utils/bleCommands.ts` — 在 `CMD` 加键（`as const`，**禁用 enum**），按 Map Byte 分组注释归位；连续模式命令用基址 + 偏移（如 `LIGHT_MODE_0 + i`），不要逐条列出
2. `utils/bleCommands.ts` — 在 `buildCmdTestSpec()` 加测试规格：危险命令必须写 `danger: '原因'`，只写不回的命令标 `noResponse: true`，多帧响应标 `multiFrame: true`
3. 确认命令值 ≤ `0x77`（15 字节位图上限）
4. `hooks/useBle.ts` — 若要读写状态，接入 `applyFeatureState` 对应的 state
5. `pages/BluetoothController.tsx` — 接 UI 控件，发送前用 `displayToWireDb` 转线值
6. 验证：`npm run build` 通过 + 跑 `ble-cmd-regression` skill

### 新增 / 修改串口命令

1. `utils/protocol.ts` — 加 `SerialCommandType` 成员
2. `hooks/useSerial.ts` — 芯片会回复的命令需在 `handleReceivedFrame` 分派
3. `pages/SerialController.tsx` — 接 UI 与发送入口
4. 验证：`npm run build` 通过 + 连真实串口设备核对收发帧

## 第四步：核对值映射

- EQ：显示值 -12~+12 dB ↔ 线值 0~24（0 dB = 12），见 `utils/eqMapping.ts` 的 `ParamRange`
- UI state 存的是**显示值**，构造 params 前必须转线值
- 两套频段表不同，不要混用：`serialEqBands`（15 段，25/40/63…）vs `tenBandEq`（10 段，31/63/125…）

## 常量速查

| 用途 | 位置 |
|---|---|
| `FrameHeader`、`BLE_WEB_ID`、`calculateCRC`、`buildFrame`、`buildBleFrame` | `utils/protocol.ts` |
| `CMD`、`cmdName`、GATT UUID、`isCommandSupported` | `utils/bleCommands.ts` |
| `ParamRange`、`EqBand`、两套频段表 | `utils/eqMapping.ts` |
| 测试规格与回归框架 | `utils/bleCommands.ts`、`utils/bleCmdTest.ts` |

## 常见错误

- 跨体系发命令：表现为「发出去毫无反应」
- LEN 算错：BLE 少算 1 字节，芯片按错误长度解析后静默丢弃
- 把 CRC 当 CRC-8：本协议是**累加和 mod 256**
- 忘记转线值：参数看着对，听感差 12 dB
- 命令值超过 `0x77`：位图查不到，回归测试直接判「硬件不支持」跳过
- 危险命令漏标 `danger`：回归测试会真的写 Flash / 改播放状态
