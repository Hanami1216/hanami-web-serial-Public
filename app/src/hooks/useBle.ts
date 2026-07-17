import { useRef, useState, useCallback, useEffect } from 'react';
import {
  buildBleFrame,
  calculateCRC,
  bytesToHex,
  FrameHeader,
  BLE_WEB_ID,
} from '../utils/protocol';
import {
  displayToWireDb,
  wireToDisplayDb,
} from '../utils/eqMapping';
import {
  CMD,
  cmdName,
  isCommandSupported,
  buildSupportedMapBytes,
  BLE_SERVICE_UUID,
  BLE_WRITE_CHARACTERISTIC_UUID,
  BLE_NOTIFY_CHARACTERISTIC_UUID,
} from '../utils/bleCommands';
import { createCmdTestRunner } from '../utils/bleCmdTest';

// Re-export for component use
export { displayToWireDb, wireToDisplayDb };

// =============================================================================
// Minimal Web Bluetooth API type declarations (no @types/web-bluetooth available)
// =============================================================================
interface BleCharProps {
  write: boolean;
  writeWithoutResponse: boolean;
  notify: boolean;
  indicate: boolean;
  read: boolean;
  broadcast: boolean;
  authenticatedSignedWrites: boolean;
}

interface BleChar {
  uuid: string;
  properties: BleCharProps;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<unknown>;
  addEventListener(event: string, handler: (event: Event) => void): void;
  removeEventListener?(event: string, handler: (event: Event) => void): void;
  readValue(): Promise<DataView>;
}

interface BleSvc {
  uuid: string;
  isPrimary: boolean;
  getCharacteristics(): Promise<BleChar[]>;
  getCharacteristic(uuid: string): Promise<BleChar>;
}

interface BleServer {
  connected: boolean;
  connect(): Promise<BleServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BleSvc[]>;
  getPrimaryService(uuid: string): Promise<BleSvc>;
}

interface BleDev {
  id: string;
  name?: string;
  gatt?: BleServer;
  addEventListener(event: string, handler: (event: Event) => void): void;
  removeEventListener(event: string, handler: (event: Event) => void): void;
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        acceptAllDevices?: boolean;
        optionalServices?: string[];
      }): Promise<BleDev>;
    };
  }
}

// =============================================================================
// Exported types for consumers
// =============================================================================
export interface FeatureCallbacks {
  apply: (params: number[]) => void;
  toggle?: (enabled: boolean) => void;
}

export interface LogEntry {
  time: number;
  msg: string;
  isError: boolean;
}

export interface ModeGroup {
  activeIndex: number | null;
}

// =============================================================================
// CMD test framework internal type
// =============================================================================
// =============================================================================
// Hook
// =============================================================================
export function useBle() {
  // ---- Refs (mutable, no re-render) ----
  const bluetoothDeviceRef = useRef<BleDev | null>(null);
  const gattServerRef = useRef<BleServer | null>(null);
  const controlWriteCharRef = useRef<BleChar | null>(null);
  const controlNotifyCharRef = useRef<BleChar | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSupportMapResolveRef = useRef<((params: number[]) => void) | null>(null);
  const pendingSupportMapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featureStateReplyCountRef = useRef(0);
  const supportedCommandsRef = useRef<Set<number>>(new Set());
  const featureRegistryRef = useRef<Map<number, FeatureCallbacks>>(new Map());
  const modeGroupsRef = useRef<Map<string, ModeGroup>>(new Map());
  const disconnectedHandlerRef = useRef<((event: Event) => void) | null>(null);

  // ---- State (UI-reactive) ----
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('—');
  const [batteryLevel, setBatteryLevel] = useState('—');
  const [manufacturer, setManufacturer] = useState('—');
  const [bleStatusText, setBleStatusText] = useState('未初始化');
  const [bleStatusConnected, setBleStatusConnected] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [supportedCommands, setSupportedCommands] = useState<Set<number>>(new Set());
  const [controlsEnabled, setControlsEnabled] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // ---- Register system commands so they appear in the support map ----
  const systemCmds = [
    CMD.SYS_ASK, CMD.SYS_CHIP_SUPPORT_MAP, CMD.SYS_ASK_ALL, CMD.SYS_ASK_CMD,
    CMD.SYS_ASK_MAP, CMD.SYS_ASK_BAT, CMD.SYS_ASK_MCU_ID, CMD.SYS_ASK_MID,
  ];
  systemCmds.forEach((cmd) => {
    if (!featureRegistryRef.current.has(cmd)) {
      featureRegistryRef.current.set(cmd, { apply: () => {} });
    }
  });

  // ======================================================================
  // Helper: addLog
  // ======================================================================
  const addLog = useCallback((message: string, isError = false) => {
    const entry: LogEntry = { time: Date.now(), msg: message, isError };
    setLogEntries((prev) => [...prev, entry]);
    if (isError) console.error(message);
    else console.log(message);
  }, []);

  const clearLog = useCallback(() => {
    setLogEntries([]);
  }, []);

  // ======================================================================
  // BLE status helpers
  // ======================================================================
  const setBleStatus = useCallback((text: string, connected = false) => {
    setBleStatusText(text);
    setBleStatusConnected(connected);
  }, []);

  // ======================================================================
  // Feature registry (callback-based, no DOM elements)
  // ======================================================================
  const registerFeature = useCallback((cmd: number, callbacks: FeatureCallbacks) => {
    featureRegistryRef.current.set(cmd, callbacks);
  }, []);

  const unregisterFeature = useCallback((cmd: number) => {
    featureRegistryRef.current.delete(cmd);
  }, []);

  // ======================================================================
  // Mode groups
  // ======================================================================
  const getModeGroup = useCallback(
    (id: string): ModeGroup | undefined => {
      return modeGroupsRef.current.get(id);
    },
    [],
  );

  const setModeGroupInternal = useCallback((id: string, group: ModeGroup) => {
    modeGroupsRef.current.set(id, group);
  }, []);

  // ======================================================================
  // Write frame helper
  // ======================================================================
  async function writeFrame(
    frame: Uint8Array,
    cmd: number,
    params: number[],
  ): Promise<void> {
    const ch = controlWriteCharRef.current;
    if (!ch) throw new Error('写入特征不可用');
    if (
      ch.properties.write &&
      typeof ch.writeValueWithResponse === 'function'
    ) {
      await ch.writeValueWithResponse(frame);
    } else if (
      ch.properties.writeWithoutResponse &&
      typeof ch.writeValueWithoutResponse === 'function'
    ) {
      await ch.writeValueWithoutResponse(frame);
    } else {
      await ch.writeValue(frame);
    }
    addLog(
      `[发送] ${cmdName(cmd)} PARAMS=[${params.join(', ')}] FRAME=${bytesToHex(frame)}`,
    );
  }

  // ======================================================================
  // sendCommand — queued write via writeQueue promise chain
  // ======================================================================
  const sendCommand = useCallback(
    async (cmd: number, params: number[] = []): Promise<boolean> => {
      const cmdLabel = cmdName(cmd);
      let frame: Uint8Array;
      try {
        frame = buildBleFrame(cmd, params);
      } catch (error) {
        addLog(`[发送失败] ${cmdLabel} ${(error as Error).message}`, true);
        return false;
      }

      if (!gattServerRef.current?.connected || !controlWriteCharRef.current) {
        addLog(
          `[发送失败] 控制特征未连接 ${cmdLabel} PARAMS=[${params.join(', ')}] FRAME=${bytesToHex(frame)}`,
          true,
        );
        return false;
      }

      const task = writeQueueRef.current.then(() =>
        writeFrame(frame, cmd, params),
      );
      writeQueueRef.current = task.catch(() => {});

      try {
        await task;
        return true;
      } catch (error) {
        addLog(
          `[发送失败] ${cmdLabel} ${(error as Error).message} PARAMS=[${params.join(', ')}] FRAME=${bytesToHex(frame)}`,
          true,
        );
        return false;
      }
    },
    [addLog],
  );

  // ======================================================================
  // Notification handler
  // ======================================================================
  function handleControlNotify(event: Event): void {
    const evtTarget = event.target as EventTarget & { value: DataView };
    const value = evtTarget.value;
    const bytes = new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );

    if (bytes.length < 5) {
      addLog(`[接收] 数据过短: ${bytesToHex(bytes)}`, true);
      return;
    }

    const crcExpected = bytes[bytes.length - 1];
    const crcActual = calculateCRC(bytes.slice(0, -1));
    const validHeader = bytes[0] === FrameHeader.CHIP;
    const validWebId = bytes[1] === BLE_WEB_ID;
    const len = bytes[2];
    const cmd = bytes[3];
    const params = Array.from(bytes.slice(4, -1));
    const validLen = len === bytes.length - 4;
    const ok = validHeader && validWebId && validLen && crcExpected === crcActual;

    addLog(
      `[接收${ok ? '' : '异常'}] ${cmdName(cmd)} LEN=${len} PARAMS=[${params.join(', ')}] CRC=${ok ? 'OK' : `ERR(${crcExpected}/${crcActual})`} FRAME=${bytesToHex(bytes)}`,
      !ok,
    );

    if (!ok) return;

    if (cmd === CMD.SYS_CHIP_SUPPORT_MAP) {
      parseSupportMap(params);
      const resolve = pendingSupportMapResolveRef.current;
      if (resolve) {
        resolve(params);
        pendingSupportMapResolveRef.current = null;
      }
      return;
    }

    applyFeatureState(cmd, params);
    if (!feedDrainFrame(cmd, params, bytes)) {
      resolveCmdTestResponse(cmd, params, bytes);
    }
  }

  // ======================================================================
  // Feature state application
  // ======================================================================
  function applyFeatureState(cmd: number, params: number[]): void {
    const feature = featureRegistryRef.current.get(cmd);
    if (!feature) return;
    featureStateReplyCountRef.current++;
    feature.apply(params);
  }

  // ======================================================================
  // Support map parsing
  // ======================================================================
  function parseSupportMap(params: number[]): void {
    const newSet = new Set<number>();
    featureRegistryRef.current.forEach((_, cmd) => {
      if (isCommandSupported(params, cmd)) {
        newSet.add(cmd);
      }
    });
    supportedCommandsRef.current = newSet;
    setSupportedCommands(newSet);
    addLog(`功能表读取完成，支持 ${newSet.size} 个页面功能`);
  }

  // ======================================================================
  // Wait / cancel for support map response
  // ======================================================================
  function waitForSupportMap(timeoutMs = 2500): Promise<number[]> {
    cancelSupportMapWait();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingSupportMapResolveRef.current = null;
        pendingSupportMapTimerRef.current = null;
        reject(new Error('等待功能表回复超时'));
      }, timeoutMs);
      pendingSupportMapTimerRef.current = timer;
      pendingSupportMapResolveRef.current = (params: number[]) => {
        if (pendingSupportMapTimerRef.current) {
          clearTimeout(pendingSupportMapTimerRef.current);
          pendingSupportMapTimerRef.current = null;
        }
        resolve(params);
      };
    });
  }

  function cancelSupportMapWait(): void {
    if (pendingSupportMapTimerRef.current) {
      clearTimeout(pendingSupportMapTimerRef.current);
      pendingSupportMapTimerRef.current = null;
    }
    pendingSupportMapResolveRef.current = null;
  }

  // ======================================================================
  // Enable / disable control panel
  // ======================================================================
  function setControlPanelEnabled(enabled: boolean): void {
    setControlsEnabled(enabled);
    if (!enabled) {
      supportedCommandsRef.current = new Set();
      setSupportedCommands(new Set());
      setResetKey((k) => k + 1);
    }
  }

  function enableSupportedFeatures(): void {
    setControlsEnabled(true);
  }

  // ======================================================================
  // Load supported features from device
  // ======================================================================
  async function loadSupportedFeatures(): Promise<boolean> {
    setControlPanelEnabled(false);
    featureStateReplyCountRef.current = 0;
    if (!controlWriteCharRef.current) {
      addLog('功能读取失败：控制写入特征未连接', true);
      return false;
    }

    try {
      const supportMapPromise = waitForSupportMap();
      const supportSent = await sendCommand(CMD.SYS_CHIP_SUPPORT_MAP, []);
      if (!supportSent) {
        cancelSupportMapWait();
        throw new Error('功能表请求发送失败');
      }
      await supportMapPromise;

      if (supportedCommandsRef.current.size === 0) {
        throw new Error('芯片未返回页面支持功能');
      }

      const map = buildSupportedMapBytes(supportedCommandsRef.current);
      if (map.some((byte) => byte !== 0)) {
        const askMapSent = await sendCommand(CMD.SYS_ASK_MAP, map);
        if (!askMapSent) {
          addLog('功能状态请求发送失败，跳过状态同步', false);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (featureStateReplyCountRef.current === 0) {
            addLog(
              '功能状态回复超时，跳过状态同步（控件将使用默认值）',
              false,
            );
          } else {
            addLog(
              `已同步 ${featureStateReplyCountRef.current} 个功能状态`,
            );
          }
        }
      }

      enableSupportedFeatures();
      addLog('功能读取完成，已按支持功能恢复控制项');
      return true;
    } catch (error) {
      setControlPanelEnabled(false);
      addLog(`功能读取失败：${(error as Error).message}`, true);
      return false;
    }
  }

  // ======================================================================
  // initControlCharacteristics — discover service + characteristics
  // ======================================================================
  async function initControlCharacteristics(server: BleServer): Promise<boolean> {
    controlWriteCharRef.current = null;
    controlNotifyCharRef.current = null;

    // Debug: enumerate all services and characteristics
    try {
      const allServices = await server.getPrimaryServices();
      addLog(
        `══════ 设备服务/特征全枚举 (共 ${allServices.length} 个服务) ══════`,
      );
      for (const svc of allServices) {
        const chars = await svc.getCharacteristics();
        addLog(
          `  📦 服务: ${svc.uuid}${svc.isPrimary ? ' (PRIMARY)' : ''} — ${chars.length} 个特征`,
        );
        for (const ch of chars) {
          const props: string[] = [];
          if (ch.properties.read) props.push('READ');
          if (ch.properties.write) props.push('WRITE');
          if (ch.properties.writeWithoutResponse) props.push('WRITE_NO_RESP');
          if (ch.properties.notify) props.push('NOTIFY');
          if (ch.properties.indicate) props.push('INDICATE');
          if (ch.properties.broadcast) props.push('BROADCAST');
          if (ch.properties.authenticatedSignedWrites) props.push('AUTH_SIGNED');
          addLog(`    ↳ 特征: ${ch.uuid}  [${props.join(', ')}]`);
        }
      }
      addLog(`══════════════════════════════════════════════════════`);
    } catch (_enumErr) {
      addLog(`⚠ 服务枚举失败`, false);
    }

    // Connect to control service
    try {
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      addLog(`✅ 已找到控制服务: ${BLE_SERVICE_UUID}`);

      const allChars = await service.getCharacteristics();

      // Write characteristic: exact UUID match then fallback
      try {
        const wc = await service.getCharacteristic(BLE_WRITE_CHARACTERISTIC_UUID);
        controlWriteCharRef.current = wc;
        addLog(`✅ 控制写入特征(精确匹配): ${BLE_WRITE_CHARACTERISTIC_UUID}`);
      } catch (_writeUuidErr) {
        addLog(`⚠ 精确匹配写入特征失败，尝试自动匹配...`, false);
        const found = allChars.find(
          (ch) => ch.properties.write || ch.properties.writeWithoutResponse,
        );
        if (found) {
          controlWriteCharRef.current = found;
          addLog(`✅ 控制写入特征(自动匹配): ${found.uuid}`);
        } else {
          throw new Error('未找到任何可写入的特征');
        }
      }

      const writeProps: string[] = [];
      if (controlWriteCharRef.current.properties.write) writeProps.push('WRITE');
      if (controlWriteCharRef.current.properties.writeWithoutResponse)
        writeProps.push('WRITE_NO_RESP');
      addLog(`  写入属性: [${writeProps.join(', ')}]`);

      // Notify characteristic: exact UUID match then fallback
      try {
        const nc = await service.getCharacteristic(
          BLE_NOTIFY_CHARACTERISTIC_UUID,
        );
        controlNotifyCharRef.current = nc;
        addLog(
          `✅ 控制通知特征(精确匹配): ${BLE_NOTIFY_CHARACTERISTIC_UUID}`,
        );
      } catch (_notifyUuidErr) {
        addLog(`⚠ 精确匹配通知特征失败，尝试自动匹配...`, false);
        const found = allChars.find(
          (ch) => ch.properties.notify || ch.properties.indicate,
        );
        if (found) {
          controlNotifyCharRef.current = found;
          addLog(`✅ 控制通知特征(自动匹配): ${found.uuid}`);
        } else {
          addLog(`⚠ 未找到任何可通知的特征`, false);
        }
      }

      // Enable notifications
      if (controlNotifyCharRef.current) {
        const notifyProps: string[] = [];
        if (controlNotifyCharRef.current.properties.notify)
          notifyProps.push('NOTIFY');
        if (controlNotifyCharRef.current.properties.indicate)
          notifyProps.push('INDICATE');
        addLog(`  通知属性: [${notifyProps.join(', ')}]`);

        if (typeof controlNotifyCharRef.current.startNotifications === 'function') {
          try {
            await controlNotifyCharRef.current.startNotifications();
            controlNotifyCharRef.current.addEventListener(
              'characteristicvaluechanged',
              handleControlNotify,
            );
            addLog(
              `✅ 控制通知特征已启用: ${controlNotifyCharRef.current.uuid}`,
            );
          } catch (startErr) {
            addLog(
              `⚠ 启动通知失败: ${(startErr as Error).message}`,
              false,
            );
          }
        }
      }
      return true;
    } catch (error) {
      addLog(
        `❌ 控制服务/写入特征连接失败: ${(error as Error).message}`,
        true,
      );
      addLog(
        `  提示: 请确认设备固件使用了以下 UUID:`,
        true,
      );
      addLog(`    服务: ${BLE_SERVICE_UUID}`, true);
      addLog(`    写入特征: ${BLE_WRITE_CHARACTERISTIC_UUID}`, true);
      addLog(`    通知特征: ${BLE_NOTIFY_CHARACTERISTIC_UUID}`, true);
      return false;
    }
  }

  // ======================================================================
  // Device information reading
  // ======================================================================
  async function readDeviceInformation(server: BleServer): Promise<void> {
    try {
      const service = await server.getPrimaryService('device_information');
      addLog('找到设备信息服务 (0x180A)');

      const manufacturerChar = await service.getCharacteristic(
        'manufacturer_name_string',
      );
      const manufacturerValue = await manufacturerChar.readValue();
      const manufacturerStr = new TextDecoder('utf-8').decode(manufacturerValue);
      setManufacturer(manufacturerStr || '—');
      addLog(`制造商: ${manufacturerStr}`);

      try {
        const modelChar = await service.getCharacteristic(
          'model_number_string',
        );
        const modelValue = await modelChar.readValue();
        const model = new TextDecoder('utf-8').decode(modelValue);
        addLog(`型号: ${model}`);
      } catch (_e) {
        addLog('未找到型号特征或读取失败', false);
      }

      try {
        const serialChar = await service.getCharacteristic(
          'serial_number_string',
        );
        const serialVal = await serialChar.readValue();
        const serial = new TextDecoder('utf-8').decode(serialVal);
        addLog(`序列号: ${serial}`);
      } catch (_e) {
        // non-critical
      }
    } catch (_error) {
      addLog('设备信息服务(0x180A): 硬件未实现，跳过');
      setManufacturer('—');
    }
  }

  async function readBatteryLevel(server: BleServer): Promise<number | null> {
    try {
      const batteryService = await server.getPrimaryService('battery_service');
      addLog('找到电池服务 (0x180F)');
      const batteryChar = await batteryService.getCharacteristic(
        'battery_level',
      );
      const value = await batteryChar.readValue();
      const batteryPercent = value.getUint8(0);
      setBatteryLevel(`${batteryPercent}%`);
      addLog(`电池电量: ${batteryPercent}%`);
      return batteryPercent;
    } catch (_e) {
      addLog('电池服务(0x180F): 硬件未实现，跳过');
      setBatteryLevel('—');
      return null;
    }
  }

  // ======================================================================
  // Disconnection handling
  // ======================================================================
  const disconnectDevice = useCallback(async (): Promise<void> => {
    const device = bluetoothDeviceRef.current;
    const server = gattServerRef.current;

    if (server && server.connected) {
      try {
        addLog(`正在断开设备: ${device?.name || device?.id}`);
        await server.disconnect();
        addLog('已断开蓝牙连接');
      } catch (e) {
        addLog(`断开时出错: ${(e as Error).message}`, true);
      }
    }

    if (device && disconnectedHandlerRef.current) {
      device.removeEventListener(
        'gattserverdisconnected',
        disconnectedHandlerRef.current,
      );
    }

    gattServerRef.current = null;
    controlWriteCharRef.current = null;
    controlNotifyCharRef.current = null;
    setControlPanelEnabled(false);
    bluetoothDeviceRef.current = null;
    setIsConnected(false);
    setDeviceName('—');
    setBatteryLevel('—');
    setManufacturer('—');
    setBleStatus('未连接 / 断开');
  }, [addLog]);

  function handleDisconnection(_event: Event): void {
    addLog('设备已断开连接 (意外或主动)', true);
    gattServerRef.current = null;
    controlWriteCharRef.current = null;
    controlNotifyCharRef.current = null;
    setControlPanelEnabled(false);
    bluetoothDeviceRef.current = null;
    setIsConnected(false);
    setBatteryLevel('—');
    setManufacturer('—');
    setBleStatus('未连接 / 断开');
    setDeviceName('—');
  }

  // ======================================================================
  // connectAndSetup — full initialization flow
  // ======================================================================
  async function connectAndSetup(device: BleDev): Promise<boolean> {
    if (!device) {
      addLog('无效设备对象', true);
      return false;
    }

    try {
      addLog(`正在连接设备: ${device.name || device.id} ...`);
      const server = await device.gatt!.connect();
      gattServerRef.current = server;
      setIsConnected(true);
      bluetoothDeviceRef.current = device;

      // Listen for disconnection
      const disconnectHandler = (event: Event) => handleDisconnection(event);
      disconnectedHandlerRef.current = disconnectHandler;
      device.addEventListener('gattserverdisconnected', disconnectHandler);

      setBleStatus('已连接', true);
      if (device.name) setDeviceName(device.name);
      else setDeviceName(device.id || '—');
      addLog('GATT 连接成功');

      // 1. Enumerate services
      try {
        const services = await server.getPrimaryServices();
        addLog(
          `发现 ${services.length} 个主要服务`,
        );
      } catch (_e) {
        addLog('枚举服务失败', true);
      }

      // 2. Init control service
      const controlReady = await initControlCharacteristics(server);
      if (controlReady) {
        await loadSupportedFeatures();
      } else {
        setControlPanelEnabled(false);
      }

      // 3. Read device info
      await readDeviceInformation(server);

      // 4. Read battery
      await readBatteryLevel(server);

      addLog('初始化数据读取完成，可通过「读取设备信息」按钮重新获取。');
      return true;
    } catch (error) {
      addLog(
        `连接或初始化失败: ${(error as Error).message}`,
        true,
      );
      if (device && disconnectedHandlerRef.current) {
        device.removeEventListener(
          'gattserverdisconnected',
          disconnectedHandlerRef.current,
        );
      }
      gattServerRef.current = null;
      setIsConnected(false);
      bluetoothDeviceRef.current = null;
      controlWriteCharRef.current = null;
      controlNotifyCharRef.current = null;
      setControlPanelEnabled(false);
      setBatteryLevel('—');
      setManufacturer('—');
      setBleStatus('未连接 / 断开');
      setDeviceName('—');
      return false;
    }
  }

  // ======================================================================
  // scanAndConnect — request device + connect
  // ======================================================================
  const scanAndConnect = useCallback(async (): Promise<void> => {
    // Disconnect existing
    if (gattServerRef.current?.connected) {
      addLog('当前已有连接，先断开再重新扫描...');
      await disconnectDevice();
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!navigator.bluetooth) {
      addLog(
        '您的浏览器不支持 Web Bluetooth API。请使用 Android Chrome/Edge 等支持 BLE 的浏览器，并确保 HTTPS 环境。',
        true,
      );
      setBleStatus('不支持');
      return;
    }

    addLog('正在请求蓝牙设备，请在弹出的系统选择器中选择目标BLE设备...');
    try {
      const optionalServicesList = [
        'device_information',
        'battery_service',
        'generic_access',
        'generic_attribute',
        BLE_SERVICE_UUID,
      ];

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: optionalServicesList,
      });

      addLog(
        `用户选择了设备: ${device.name || '无名称'} (ID: ${device.id})`,
      );
      setDeviceName(device.name || '未命名设备');

      await connectAndSetup(device);
    } catch (error) {
      const err = error as Error & { name?: string };
      if (err.name === 'NotFoundError') {
        addLog('没有找到设备或用户未选择任何设备', true);
      } else if (err.name === 'SecurityError') {
        addLog(
          '安全错误: 请确保网页使用 HTTPS 协议 (或者 localhost) 并且已开启蓝牙权限',
          true,
        );
      } else if (err.name === 'NotAllowedError') {
        addLog('用户拒绝了蓝牙权限请求', true);
      } else {
        addLog(`扫描/连接出错: ${err.message}`, true);
      }

      if (bluetoothDeviceRef.current === null) {
        setDeviceName('—');
      }
      setBleStatus('未连接 / 断开');
    }
  }, [addLog, disconnectDevice]);

  // ======================================================================
  // Disconnect (public)
  // ======================================================================
  const disconnect = useCallback(async (): Promise<void> => {
    await disconnectDevice();
    addLog('手动断开连接完成');
  }, [addLog, disconnectDevice]);

  // ======================================================================
  // refreshDeviceInfo — re-read manufacturer + battery
  // ======================================================================
  const refreshDeviceInfo = useCallback(async (): Promise<void> => {
    const server = gattServerRef.current;
    if (!server?.connected) {
      addLog('设备未连接，请先扫描连接设备', true);
      return;
    }
    addLog('手动刷新设备信息...');
    try {
      await readDeviceInformation(server);
      await readBatteryLevel(server);
      const services = await server.getPrimaryServices();
      addLog(`当前服务数量: ${services.length}`);
    } catch (err) {
      addLog(`刷新信息失败: ${(err as Error).message}`, true);
    }
  }, [addLog]);

  // ======================================================================
  // Bluetooth support detection
  // ======================================================================
  function checkBluetoothSupport(): void {
    if (!navigator.bluetooth) {
      setBleStatus('不支持 Web Bluetooth');
      addLog(
        '当前浏览器不支持 Web Bluetooth API。请在 Android 设备上使用 Chrome 85+ / Edge 等浏览器并确保 HTTPS 环境。',
        true,
      );
    } else {
      setBleStatus('支持 (等待操作)');
      addLog('Web Bluetooth API 可用，确保蓝牙已开启。');
      if (!window.isSecureContext) {
        addLog(
          '当前页面非安全上下文(非HTTPS/localhost)，蓝牙功能可能不可用！',
          true,
        );
        setBleStatus('非安全上下文');
      } else {
        addLog('安全上下文验证通过');
      }
    }
  }

  // ======================================================================
  // CMD Test Framework (delegated to bleCmdTest.ts)
  // ======================================================================

  const testRunner = createCmdTestRunner({
    cmdTestPendingRef: { current: new Map() },
    cmdTestDrainStateRef: { current: null },
    sendCommand,
    addLog,
    isConnected: () => gattServerRef.current?.connected ?? false,
    getSupportedCommands: () => supportedCommandsRef.current,
  });

  // Wire test functions into the notification handler
  const feedDrainFrame = testRunner.feedDrainFrame;
  const resolveCmdTestResponse = testRunner.resolveCmdTestResponse;

  // (test functions moved to bleCmdTest.ts)

  // ======================================================================
  // Effects
  // ======================================================================

  // Expose runCmdTest on window for console access
  useEffect(() => {
    (window as unknown as Record<string, unknown>).runCmdTest = testRunner.runCmdTest;
    return () => {
      delete (window as unknown as Record<string, unknown>).runCmdTest;
    };
  });

  // Cleanup on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gattServerRef.current?.connected) {
        gattServerRef.current.disconnect();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Check Bluetooth support on mount
  useEffect(() => {
    checkBluetoothSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================================================================
  // Return
  // ======================================================================
  return {
    // State
    isConnected,
    deviceName,
    batteryLevel,
    manufacturer,
    bleStatusText,
    bleStatusConnected,
    logEntries,
    supportedCommands,
    controlsEnabled,
    resetKey,
    // Refs (for advanced use)
    gattServerRef,
    controlWriteCharRef,
    controlNotifyCharRef,
    // Actions
    scanAndConnect,
    disconnect,
    sendCommand,
    addLog,
    clearLog,
    refreshDeviceInfo,
    // Feature registry
    registerFeature,
    unregisterFeature,
    // Mode groups
    getModeGroup: getModeGroup as (id: string) => ModeGroup | undefined,
    setModeGroup: setModeGroupInternal as (id: string, group: ModeGroup) => void,
  };
}

export default useBle;
