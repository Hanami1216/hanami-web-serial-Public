// BLE CMD 回归测试框架 — 在浏览器控制台调用 runCmdTest() 启动
// 从 blue_api.js 的测试框架移植

import { buildBleFrame, bytesToHex } from './protocol';
import { CMD, cmdName, buildCmdTestSpec } from './bleCommands';
import type { CmdTestSpec } from './bleCommands';

// =============================================================================
// Types
// =============================================================================

interface CmdTestPendingEntry {
  resolve: (value: { params: number[]; rxFrame: string | null }) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface CmdTestDrainState {
  resolve: (frames: DrainFrame[]) => void;
  reject: (reason: unknown) => void;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  overallTimer: ReturnType<typeof setTimeout>;
  frames: DrainFrame[];
  idleMs: number;
}

export interface DrainFrame {
  cmd: number;
  params: number[];
  rxFrame: string;
}

export interface CmdTestDeps {
  /** Mutable ref for pending single-frame response promises (keyed by cmd). */
  cmdTestPendingRef: { current: Map<number, CmdTestPendingEntry> };
  /** Mutable ref for the active multi-frame drain collector, or null. */
  cmdTestDrainStateRef: { current: CmdTestDrainState | null };
  /** Send a BLE command (the hook's write-queue-backed send). */
  sendCommand: (cmd: number, params?: number[]) => Promise<boolean>;
  /** Append a log entry. */
  addLog: (message: string, isError?: boolean) => void;
  /** Whether the BLE connection is still active. */
  isConnected: () => boolean;
  /** Currently supported commands (from the chip support map). */
  getSupportedCommands: () => Set<number>;
}

export interface CmdTestRunner {
  /** Called by the notification handler: resolve a pending single-frame response. */
  resolveCmdTestResponse: (cmd: number, params: number[], rawFrame: Uint8Array) => void;
  /** Called by the notification handler: feed a frame into the multi-frame drain. Returns true if consumed. */
  feedDrainFrame: (cmd: number, params: number[], bytes: Uint8Array) => boolean;
  /** The main test entry point. Callable from the browser console via window.runCmdTest. */
  runCmdTest: (options?: {
    includeDangerous?: boolean;
    timeoutMs?: number;
    drainIdleMs?: number;
  }) => Promise<unknown>;
}

// =============================================================================
// Factory
// =============================================================================

export function createCmdTestRunner(deps: CmdTestDeps): CmdTestRunner {
  const {
    cmdTestPendingRef,
    cmdTestDrainStateRef,
    sendCommand,
    addLog,
    isConnected,
    getSupportedCommands,
  } = deps;

  // Cached test spec — built lazily so buildSupportedMapBytes can be up-to-date
  let cmdTestSpecCache: Record<number, CmdTestSpec> | null = null;

  function getCmdTestSpec(): Record<number, CmdTestSpec> {
    if (!cmdTestSpecCache) {
      // buildSupportedMapBytes depends on getSupportedCommands() which may
      // change between connections, so we rebuild the spec each test run.
      cmdTestSpecCache = buildCmdTestSpec(() => {
        const map = new Array(15).fill(0);
        getSupportedCommands().forEach((cmd) => {
          const bi = Math.floor(cmd / 8);
          const bit = cmd % 8;
          if (bi < 15) map[bi] |= 1 << bit;
        });
        return map;
      });
    }
    return cmdTestSpecCache;
  }

  // ---- Single-frame response ----

  function resolveCmdTestResponse(
    cmd: number,
    params: number[],
    rawFrame: Uint8Array,
  ): void {
    const entry = cmdTestPendingRef.current.get(cmd);
    if (entry) {
      clearTimeout(entry.timer);
      cmdTestPendingRef.current.delete(cmd);
      entry.resolve({ params, rxFrame: bytesToHex(rawFrame) });
    }
  }

  function waitCmdResponse(
    cmd: number,
    timeoutMs: number,
  ): Promise<{ params: number[]; rxFrame: string | null }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cmdTestPendingRef.current.delete(cmd);
        reject(new Error('超时'));
      }, timeoutMs);
      cmdTestPendingRef.current.set(cmd, { resolve, timer });
    });
  }

  // ---- Multi-frame drain ----

  function feedDrainFrame(
    cmd: number,
    params: number[],
    bytes: Uint8Array,
  ): boolean {
    const ds = cmdTestDrainStateRef.current;
    if (!ds) return false;

    ds.frames.push({ cmd, params, rxFrame: bytesToHex(bytes) });

    clearTimeout(ds.idleTimer);
    ds.idleTimer = setTimeout(() => {
      if (cmdTestDrainStateRef.current === ds) {
        cmdTestDrainStateRef.current = null;
      }
      clearTimeout(ds.overallTimer);
      ds.resolve(ds.frames);
    }, ds.idleMs);

    return true;
  }

  function waitDrainComplete(
    idleMs = 150,
    overallTimeoutMs = 5000,
  ): Promise<DrainFrame[]> {
    return new Promise((resolve, reject) => {
      if (cmdTestDrainStateRef.current) {
        clearTimeout(cmdTestDrainStateRef.current.idleTimer);
        clearTimeout(cmdTestDrainStateRef.current.overallTimer);
      }

      const overallTimer = setTimeout(() => {
        if (cmdTestDrainStateRef.current) {
          const ds = cmdTestDrainStateRef.current;
          cmdTestDrainStateRef.current = null;
          clearTimeout(ds.idleTimer);
          const err = new Error(
            `多帧响应总超时 (${overallTimeoutMs}ms)`,
          ) as Error & { frames?: DrainFrame[] };
          err.frames = ds.frames;
          reject(err);
        }
      }, overallTimeoutMs);

      cmdTestDrainStateRef.current = {
        resolve,
        reject,
        idleTimer: undefined,
        overallTimer,
        frames: [],
        idleMs,
      };
    });
  }

  // ---- Download JSON result ----

  function downloadTestResult(result: unknown): void {
    try {
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ble-cmd-test-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`[测试] 📥 结果已下载: ${a.download}`);
    } catch (e) {
      addLog(`[测试] ⚠ 下载结果失败: ${(e as Error).message}`, true);
    }
  }

  // ---- Main runCmdTest ----

  async function runCmdTest(
    options: {
      includeDangerous?: boolean;
      timeoutMs?: number;
      drainIdleMs?: number;
    } = {},
  ): Promise<unknown> {
    const { includeDangerous = false, timeoutMs = 2000, drainIdleMs = 150 } =
      options;

    if (!isConnected()) {
      addLog('[测试] 设备未连接，请先扫描并连接', true);
      return;
    }

    // Rebuild spec so it reflects current supported commands
    cmdTestSpecCache = null;
    const spec = getCmdTestSpec();

    addLog('══════════ CMD 回归测试 开始 ══════════');
    const details: Array<Record<string, unknown>> = [];
    let passed = 0;
    let failed = 0;
    let warned = 0;
    let skipped = 0;
    const t0 = performance.now();

    const entries: Array<[string, number]> = Object.entries(CMD)
      .filter(
        ([n]) => !n.startsWith('LIGHT_MODE_') || n === 'LIGHT_MODE_0',
      )
      .sort((a, b) => a[1] - b[1]);

    const supported = getSupportedCommands();
    const seen = new Set<number>(entries.map((e) => e[1]));
    for (let i = 1; i < 16; i++) seen.add(CMD.LIGHT_MODE_0 + i);
    for (let i = 1; i < 7; i++) seen.add(CMD.TEXT_MODE_0 + i);
    for (const cmd of seen) {
      if (!entries.some((e) => e[1] === cmd)) {
        entries.push([cmdName(cmd), cmd]);
      }
    }
    entries.sort((a, b) => a[1] - b[1]);

    for (const [name, cmd] of entries) {
      const testSpec = spec[cmd];

      if (!testSpec) {
        skipped++;
        details.push({ cmd, name, status: 'skipped', reason: '无测试规格' });
        addLog(`[测试] ⏭ ${name} — 无测试规格，跳过`);
        continue;
      }

      const params: number[] =
        typeof testSpec.params === 'function'
          ? testSpec.params()
          : [...testSpec.params];
      const txFrame = bytesToHex(buildBleFrame(cmd, params));

      if (!supported.has(cmd)) {
        skipped++;
        details.push({
          cmd,
          name,
          status: 'skipped',
          params,
          txFrame,
          reason: '硬件不支持',
        });
        addLog(`[测试] ⏭ ${name} — 硬件不支持，跳过`);
        continue;
      }

      if (testSpec.danger && !includeDangerous) {
        skipped++;
        details.push({
          cmd,
          name,
          status: 'skipped',
          params,
          txFrame,
          reason: testSpec.danger,
        });
        addLog(
          `[测试] ⏭ ${name} — ⚠${testSpec.danger}（传 includeDangerous:true 强制执行）`,
        );
        continue;
      }

      if (testSpec.noResponse) {
        const sent = await sendCommand(cmd, params);
        if (sent) {
          passed++;
          details.push({
            cmd,
            name,
            status: 'passed',
            params,
            txFrame,
            note: '只写命令',
          });
          addLog(`[测试] ✅ ${name} — 发送成功（只写命令）`);
        } else {
          failed++;
          details.push({
            cmd,
            name,
            status: 'failed',
            params,
            txFrame,
            reason: '发送失败',
          });
          addLog(`[测试] ❌ ${name} — 发送失败`, true);
        }
        continue;
      }

      if (testSpec.multiFrame) {
        const drainPromise = waitDrainComplete(drainIdleMs, timeoutMs * 2);
        const sent = await sendCommand(cmd, params);

        if (!sent) {
          if (cmdTestDrainStateRef.current) {
            clearTimeout(cmdTestDrainStateRef.current.idleTimer);
            clearTimeout(cmdTestDrainStateRef.current.overallTimer);
            cmdTestDrainStateRef.current = null;
          }
          failed++;
          details.push({
            cmd,
            name,
            status: 'failed',
            params,
            txFrame,
            reason: '发送失败',
          });
          addLog(`[测试] ❌ ${name} — 发送失败`, true);
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }

        try {
          const frames = await drainPromise;
          passed++;
          details.push({
            cmd,
            name,
            status: 'passed',
            params,
            txFrame,
            multiFrameCount: frames.length,
            multiFrames: frames,
          });
          addLog(`[测试] ✅ ${name} — 收到 ${frames.length} 条响应帧`);
        } catch (err) {
          warned++;
          const errorObj = err as Error & { frames?: DrainFrame[] };
          details.push({
            cmd,
            name,
            status: 'warned',
            params,
            txFrame,
            reason: errorObj.message,
            partialFrames: errorObj.frames,
          });
          addLog(`[测试] ⚠️ ${name} — ${errorObj.message}`);
        }

        await new Promise((r) => setTimeout(r, 80));
        continue;
      }

      // Single-frame response
      const respPromise = waitCmdResponse(cmd, timeoutMs);
      const sent = await sendCommand(cmd, params);

      if (!sent) {
        failed++;
        details.push({
          cmd,
          name,
          status: 'failed',
          params,
          txFrame,
          reason: '发送失败',
        });
        addLog(`[测试] ❌ ${name} — 发送失败`, true);
        cmdTestPendingRef.current.delete(cmd);
        continue;
      }

      try {
        const { params: resp, rxFrame } = await respPromise;
        passed++;
        details.push({
          cmd,
          name,
          status: 'passed',
          params,
          txFrame,
          response: resp,
          rxFrame,
        });
        addLog(`[测试] ✅ ${name} — 回复 PARAMS=[${resp.join(', ')}]`);
      } catch {
        warned++;
        details.push({
          cmd,
          name,
          status: 'warned',
          params,
          txFrame,
          reason: `超时 ${timeoutMs}ms`,
        });
        addLog(
          `[测试] ⚠️ ${name} — 无回复（超时 ${timeoutMs}ms，可能为只写命令）`,
        );
      }

      await new Promise((r) => setTimeout(r, 80));
    }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    const summary = {
      passed,
      warned,
      failed,
      skipped,
      total: passed + warned + failed + skipped,
    };
    addLog('────────── 测试完成 ──────────');
    addLog(
      `  ✅ 通过: ${passed}  ⚠️ 无回复: ${warned}  ❌ 失败: ${failed}  ⏭ 跳过: ${skipped}`,
    );
    addLog(`  总耗时: ${elapsed}s`);
    addLog('══════════════════════════════════');

    const result = {
      timestamp: new Date().toISOString(),
      options: { includeDangerous, timeoutMs, drainIdleMs },
      summary,
      elapsed,
      details,
    };
    downloadTestResult(result);
    return result;
  }

  return {
    resolveCmdTestResponse,
    feedDrainFrame,
    runCmdTest,
  };
}
