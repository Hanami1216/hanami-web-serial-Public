# AGENTS.md

AI 编程助手进入本仓库前必读。细节遵循「链接不复制」原则，一律指向 `docs/` 或源码。

## 项目概览

- 专业音频硬件 Web 控制面板：均衡器（EQ）、PA 功放、音量，基于 **Web Serial API** 与 **Web Bluetooth API (BLE)**
- 纯前端静态项目：无后端、无服务端代码、无测试框架、无 lint 配置
- **开发主线在 `app/`**（Vite + React 19 + TS + Tailwind）；`html/` 是已弃用的旧版纯静态页面，仅作协议/逻辑对照参考——**不要修改，更不要把新功能写进 `html/`**
- UI 文案全部中文（面向中文音频行业工程师）

## 常用命令（在 `app/` 目录执行）

| 命令              | 作用                                                            |
| ----------------- | --------------------------------------------------------------- |
| `npm run dev`     | 本地开发（Vite，`server.host: true`，可局域网访问）             |
| `npm run build`   | 类型检查 + 生产构建（`tsc -b && vite build`，产物 `app/dist/`） |
| `npm run preview` | 本地预览生产构建                                                |

- 没有测试命令；提交前以 `npm run build` 的 `tsc -b` 结果作为质量门槛
- 浏览器要求 Chrome/Edge 89+；Web Serial / Bluetooth 需 HTTPS 或 localhost
- 生产构建经 `vite-plugin-javascript-obfuscator` 混淆并移除 console——排障用 dev 模式

## 架构速览

- 入口 `app/src/main.tsx` → `App.tsx`（BrowserRouter，3 条路由）：
  - `/` → `pages/Home.tsx`（着陆页、兼容性检查）
  - `/serial` → `pages/SerialController.tsx`（串口连接 + 15 段 EQ + PA + 默认音量）
  - `/bluetooth` → `pages/BluetoothController.tsx`（BLE 四页签：文字/灯光/麦克风/音乐）
- 业务逻辑集中在两个 Hook：
  - `hooks/useSerial.ts` — Web Serial 收发、帧缓冲状态机、READ_ALL 全量回读、指数退避重试
  - `hooks/useBle.ts`（约 950 行，核心大头）— BLE 扫描连接、GATT 写队列（promise 串行）、支持位图、功能状态同步；挂载时注入 `window.runCmdTest` 回归测试入口
- 协议与常量：
  - `utils/protocol.ts` — 帧结构 / 累加和 CRC / 串口命令枚举
  - `utils/bleCommands.ts` — BLE `CMD` 枚举、GATT UUID、支持位图、命令测试规格
  - `utils/eqMapping.ts` — 参数范围、显示-线值映射、串口 15 段与 BLE 10 段频段表
  - `utils/bleCmdTest.ts` — BLE 命令回归测试框架
- **BLE 协议权威文档**：`docs/蓝牙控制1.0通讯协议技术文档.md`（V1.6，改帧格式 / CMD 前必读）
- 真实回归参照数据：`app/src/data/bleCmdTestResult.json`（含每条命令的参考帧字节，调试协议时有用）

## 必须遵守的协议约定

1. **两套命令体系严禁混用**（同为 0x00：串口=SPLIT_EQ，BLE=SYS_ASK）：
   - 串口：`SerialCommandType` + `buildFrame`（无 Web ID，LEN=params+2）+ `displayToActual/actualToDisplay`
   - BLE：`CMD` + `buildBleFrame`（帧含 Web ID 0x01，LEN=params+1）+ `displayToWireDb/wireToDisplayDb`
2. **CRC 是累加和 mod 256**，不是 CRC-8
3. **EQ 映射**：显示 -12~+12 dB ↔ 线值 0~24（0dB=12）；`tenBandEq` 默认 value 是显示值，发送前必须转线值
4. **危险命令默认跳过**：所有 `*_SAVE`（写 Flash）、`*_RESET`、播放控制类命令，回归测试需 `runCmdTest({ includeDangerous: true })` 才执行
5. **支持位图 15 字节**：`byteIndex = cmd/8`、`bitIndex = cmd%8`，最高支持命令 0x77
6. 连续模式命令（`LIGHT_MODE_0+i`、`TEXT_MODE_0+i`）用基址+偏移计算，不在枚举中逐一列出

## 项目 Skills（`.github/skills/`）

改动落在下列场景时，先加载对应 skill 再动手：

| Skill                                                                        | 何时用                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`ble-cmd-regression`](.github/skills/ble-cmd-regression/SKILL.md)           | 跑 BLE 命令回归测试（`window.runCmdTest`）、比对基准 JSON、危险命令授权与结果解读 |
| [`protocol-command-change`](.github/skills/protocol-command-change/SKILL.md) | 新增/修改串口或 BLE 命令、改帧格式、改 EQ 映射、排查命令不生效                    |

## TypeScript 与代码风格

- tsconfig 严格约束：`verbatimModuleSyntax`（类型导入必须 `import type`）、`erasableSyntaxOnly`（**禁用 enum/namespace**，用 `as const` 对象 + 联合类型）、`noUnusedLocals/Parameters`、strict
- Web Serial / Web Bluetooth 的 TS 类型在 Hook 文件顶部自行 `declare global`，项目未装 @types/w3c-web-serial
- 缩进 2 空格；分号风格不统一（`useSerial.ts` 有分号，页面 / App 无）——跟随所在文件
- 中文注释为主，分节用 `// ===...`；文件头格式 `// 广州智造音响设备有限公司 - ...` + `// 版本：x.x.x`
- 异步回调存 `ref` 并在无依赖 effect 中同步，是项目解决 stale closure 的固定模式，沿用
- 样式：Tailwind（`important: '#root'`、`preflight: false`、`darkMode: 'class'`）+ `index.css` 设计 Token / `.glass-*` 组件类 + `styles/utilities.css`（只放 Tailwind 表达不了的内容：滑块伪元素、toggle、动画）

## 已知坑（动手改代码前先看）

- ⚠️ `app/src/index.css` 目前**没有任何文件 import**（`main.tsx` 只引 `App.tsx`，三个页面只引 `utilities.css`）——Tailwind 指令、设计 Token、`.glass-*` 组件类可能都没进构建。改样式前先确认并修复 import
- `index.css` 与 `utilities.css` 重复定义滑块轨道渐变，变量名还不一致（`--slider-percent` vs `--percent`，页面注入的是 `--percent`）
- `utils/eqMapping.ts` 中 `serialEqBands` 的 16kHz `freq` 误写为 `160000`；串口 15 段频点（25/40/63…）与 BLE 10 段（31/63/125…）是两套表，不要混用
- `vercel.json` 仍是旧静态托管配置（`@vercel/static` + `/` 重写到根 `index.html`），未覆盖 `app/` 的 Vite 部署——调整部署前先确认现状
- `useBle` 暴露的 `registerFeature / getModeGroup / setModeGroup` 疑似重构遗留 API（页面从未调用 `registerFeature`），改动前确认是否还有人用
