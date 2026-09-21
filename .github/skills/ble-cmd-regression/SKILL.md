---
name: ble-cmd-regression
description: 'BLE 命令回归测试的执行与结果解读。当需要验证蓝牙命令、跑回归、使用 window.runCmdTest、核对命令与固件是否一致、比对 ble-cmd-test 结果 JSON，或解释 passed/warned/failed/skipped 时使用。'
argument-hint: '可选：includeDangerous:true / timeoutMs / 要重点核对的命令'
---

# BLE 命令回归测试

驱动 `app/src/utils/bleCmdTest.ts` 的测试框架，逐条发送 BLE 命令并记录收发帧，产出可与基准比对的 JSON 报告。

## 何时使用

- 改完 `CMD` 枚举 / 帧格式 / 值映射后，验证命令仍与固件一致
- 排查「某条命令发出去没反应」
- 把本次结果与基准 `app/src/data/bleCmdTestResult.json` 比对，找回归

## 前置条件

1. `cd app && npm run dev` —— **必须 dev 模式**：生产构建经 `vite-plugin-javascript-obfuscator` 混淆并移除 console，`window.runCmdTest` 不可用
2. Chrome/Edge 打开 `/bluetooth`，扫描并连接目标设备（适用 A6L / A6D / A8D）
3. 等日志出现支持位图同步完成（连接流程：GATT → `SYS_CHIP_SUPPORT_MAP` → `SYS_ASK_MAP`）。位图未就绪会把所有命令判成「硬件不支持」而全部跳过

## 执行

```js
// 常规回归（自动跳过危险命令）
await window.runCmdTest()

// 需要覆盖 Flash 写入 / 复位 / 播放控制时显式授权
await window.runCmdTest({ includeDangerous: true })

// 响应慢或多帧较多时放宽超时
await window.runCmdTest({ timeoutMs: 3000, drainIdleMs: 300 })
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `includeDangerous` | `false` | 是否执行带 `danger` 标记的命令 |
| `timeoutMs` | `2000` | 单条命令等待回复时长；多帧命令总超时为 `timeoutMs × 2` |
| `drainIdleMs` | `150` | 多帧响应的静默收敛窗口 |

跑完自动下载 `ble-cmd-test-<时间戳>.json`，含 `summary`（passed/warned/failed/skipped/total）+ 每条命令的 `txFrame` / `rxFrame`。

## 危险命令清单（默认跳过）

| CMD | 名称 | 跳过原因 |
|---|---|---|
| 0x10 | `EQ_VOL_RESET` | 重置音乐设置 |
| 0x20 ~ 0x24 | `EQ_VOL_PAUSE` / `PREV` / `NEXT` / `MODE` / `PLAY_MODE` | 播放控制会改变设备实际播放状态 |
| 0x27 / 0x37 / 0x57 / 0x6F | `EQ_VOL_SAVE` / `EQ_MIC_SAVE` / `LIGHT_SAVE` / `TEXT_SAVE` | 写入 Flash |
| 0x28 | `EQ_MIC_RESET` | 重置 MIC 设置 |

- Flash 有写入寿命，`*_SAVE` 不要反复跑
- 回归只对**开发机 / 实验设备**做：测试会真实改动音量、音效、灯光、文字内容

## 结果语义

| status | 含义 | 处理 |
|---|---|---|
| `passed` | 收到回复帧；`noResponse` 类命令写出即算通过 | — |
| `warned` | 超时未回复 | 若该命令本就是「只写不回」属正常；否则查固件 / 参数 |
| `failed` | 发送失败（未连接、GATT 写失败） | 查连接状态与写特征 |
| `skipped` | 未执行 | 看 `reason`：`无测试规格` / `硬件不支持` / 危险原因 |

「硬件不支持」由支持位图判定：`byteIndex = cmd/8`、`bitIndex = cmd%8`，共 15 字节，最高覆盖 `0x77`。

## 与基准比对

基准：`app/src/data/bleCmdTestResult.json`（66 条：54 passed / 7 warned / 0 failed / 5 skipped）

1. 比对 `summary` 四项计数是否恶化（**`failed` 必须为 0**）
2. 逐条比对 `txFrame`：发送帧变了说明帧构造或参数改了，先确认是不是有意改动
3. `warned` 条目是否有新增
4. 差异要么修代码，要么更新基准 JSON；更新基准要在提交说明里写清原因

## 注意事项

- 每次连接后的支持位图可能不同（机型 / 固件差异），「跳过」条数随之变化
- 连续模式命令（`LIGHT_MODE_0+i`，i∈[0,16)；`TEXT_MODE_0+i`，i∈[0,7)）由框架自动补齐，枚举里没有
- 命令间隔固定 80ms，**不要并发跑两次** `runCmdTest`
- 测试期间不要拔设备 / 切走页面，否则 `failed` 会激增
