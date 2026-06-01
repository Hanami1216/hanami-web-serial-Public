(function(){
    // ===== 日志面板开关 =====
    // 设为 true 可在页面上显示实时日志区域（默认隐藏，通过 F12 查看）
    const SHOW_LOG_UI = false;

    // ===== BLE 控制服务 UUID 占位 =====
    // 拿到固件真实 UUID 后只改这里。当前使用常见 FFE0/FFE1 调试占位。
    const BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
    const BLE_WRITE_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
    const BLE_NOTIFY_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

    const FrameHeader = {
        HOST: 0xAA,
        CHIP: 0x55
    };
    const WEB_ID = 0x01;

    // DOM 元素
    const scanBtn = document.getElementById('scanBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const readInfoBtn = document.getElementById('readInfoBtn');
    const bleStatusSpan = document.getElementById('bleStatus');
    const deviceNameSpan = document.getElementById('deviceName');
    const deviceIdSpan = document.getElementById('deviceId');
    const batteryLevelSpan = document.getElementById('batteryLevel');
    const manufacturerSpan = document.getElementById('manufacturer');
    const serviceCountSpan = document.getElementById('serviceCount');
    const logPanel = document.getElementById('logPanel');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const controlCard = document.getElementById('controlCard');

    // 根据开关控制日志面板显示
    if (SHOW_LOG_UI) {
        document.querySelector('.log-title').style.display = '';
        document.querySelector('.log-area').style.display = '';
    }

    // 全局蓝牙对象
    let bluetoothDevice = null;      // 当前选中的设备
    let gattServer = null;           // GATT 服务器实例
    let isConnected = false;
    let controlWriteChar = null;
    let controlNotifyChar = null;
    let writeQueue = Promise.resolve();
    let pendingSupportMapResolve = null;
    let pendingSupportMapTimer = null;
    let featureStateReplyCount = 0;
    let supportedCommands = new Set();
    const featureRegistry = new Map();
    const modeGroups = new Map();

    // ---------- 辅助函数：日志 ----------
    function addLog(message, isError = false) {
        const logDiv = logPanel;
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const prefix = isError ? '[错误]' : '[信息]';
        const colorStyle = isError ? 'color: #ffaa99;' : '';
        const logMsg = `[${timeStr}] ${prefix} ${message}`;
        const logEntry = document.createElement('div');
        logEntry.style.marginBottom = '4px';
        logEntry.style.wordBreak = 'break-word';
        if(isError) logEntry.style.color = '#ffb4a2';
        logEntry.innerText = logMsg;
        logPanel.appendChild(logEntry);
        logPanel.scrollTop = logPanel.scrollHeight;
        // 同时也输出到控制台便于调试
        if(isError) console.error(message);
        else console.log(message);
    }

    function clearLog() {
        logPanel.innerHTML = '';
        addLog('日志已清空，重新记录');
    }

    function toByte(value, min = 0, max = 255) {
        const n = Number(value);
        const safe = Number.isFinite(n) ? Math.round(n) : min;
        return Math.max(min, Math.min(max, safe)) & 0xFF;
    }

    function calculateCRC(bytes) {
        let crc = 0;
        for (const byte of bytes) {
            crc += byte;
        }
        return crc & 0xFF;
    }

    function bytesToHex(bytes) {
        return Array.from(bytes)
            .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
    }

    function buildBleFrame(cmd, params = []) {
        const payload = Array.from(params, item => toByte(item));
        if (payload.length > 254) {
            throw new Error('参数过长，LEN 字段无法容纳');
        }
        const frame = new Uint8Array(5 + payload.length);
        frame[0] = FrameHeader.HOST;
        frame[1] = WEB_ID;
        frame[2] = 1 + payload.length;
        frame[3] = toByte(cmd);
        frame.set(payload, 4);
        frame[frame.length - 1] = calculateCRC(frame.slice(0, -1));
        return frame;
    }

    function displayToWireDb(displayValue) {
        return toByte(Number(displayValue) + 12, 0, 24);
    }

    function wireToDisplayDb(wireValue) {
        return toByte(wireValue, 0, 24) - 12;
    }

    function isCommandSupported(mapBytes, cmd) {
        const byteIndex = Math.floor(cmd / 8);
        const bitIndex = cmd % 8;
        return Boolean(mapBytes[byteIndex] & (1 << bitIndex));
    }

    function resetFeatureControls() {
        document.querySelectorAll('#controlCard input[type="checkbox"]').forEach(input => {
            input.checked = false;
        });
        document.querySelectorAll('#controlCard .mode-btn.active').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.dimmedOpacity) {
                btn.style.opacity = btn.dataset.dimmedOpacity;
            }
        });
        modeGroups.forEach(group => {
            group.activeIndex = null;
        });
    }

    function setControlPanelEnabled(enabled) {
        controlCard?.classList.toggle('controls-disabled', !enabled);
        featureRegistry.forEach((_, cmd) => setFeatureEnabled(cmd, false));
        if (!enabled) {
            supportedCommands = new Set();
            resetFeatureControls();
        }
    }

    function setFeatureEnabled(cmd, enabled) {
        const feature = featureRegistry.get(cmd);
        if (!feature) return;
        feature.elements.forEach(el => {
            if (el) el.disabled = !enabled;
        });
        feature.modeButton?.classList.toggle('disabled', !enabled);
        if (feature.modeButton) {
            feature.modeButton.disabled = !enabled;
        }
    }

    function applyFeatureState(cmd, params = []) {
        const feature = featureRegistry.get(cmd);
        if (!feature) return;
        featureStateReplyCount++;
        feature.apply?.(params);
    }

    function parseSupportMap(params) {
        supportedCommands = new Set();
        featureRegistry.forEach((_, cmd) => {
            if (isCommandSupported(params, cmd)) {
                supportedCommands.add(cmd);
            }
        });
        addLog(`功能表读取完成，支持 ${supportedCommands.size} 个页面功能`);
    }

    function enableSupportedFeatures() {
        controlCard?.classList.remove('controls-disabled');
        featureRegistry.forEach((_, cmd) => {
            setFeatureEnabled(cmd, supportedCommands.has(cmd));
        });
    }

    function buildSupportedMapBytes() {
        const mapLength = 15;
        const map = new Array(mapLength).fill(0);
        supportedCommands.forEach(cmd => {
            const byteIndex = Math.floor(cmd / 8);
            const bitIndex = cmd % 8;
            if (byteIndex < mapLength) {
                map[byteIndex] |= (1 << bitIndex);
            }
        });
        return map;
    }

    async function writeFrame(frame, cmdHex, params = []) {
        if (controlWriteChar.properties?.write && typeof controlWriteChar.writeValueWithResponse === 'function') {
            await controlWriteChar.writeValueWithResponse(frame);
        } else if (controlWriteChar.properties?.writeWithoutResponse && typeof controlWriteChar.writeValueWithoutResponse === 'function') {
            await controlWriteChar.writeValueWithoutResponse(frame);
        } else {
            await controlWriteChar.writeValue(frame);
        }
        addLog(`[发送] CMD=${cmdHex} PARAMS=[${params.join(', ')}] FRAME=${bytesToHex(frame)}`);
    }

    async function sendCommand(cmd, params = []) {
        const cmdHex = `0x${toByte(cmd).toString(16).padStart(2, '0').toUpperCase()}`;
        let frame;

        try {
            frame = buildBleFrame(cmd, params);
        } catch (error) {
            addLog(`[发送失败] CMD=${cmdHex} ${error.message}`, true);
            return false;
        }

        if (!gattServer || !gattServer.connected || !controlWriteChar) {
            addLog(`[发送失败] 控制特征未连接 CMD=${cmdHex} PARAMS=[${params.join(', ')}] FRAME=${bytesToHex(frame)}`, true);
            return false;
        }

        const task = writeQueue.then(() => writeFrame(frame, cmdHex, params));
        writeQueue = task.catch(() => {});

        try {
            await task;
            return true;
        } catch (error) {
            addLog(`[发送失败] CMD=${cmdHex} ${error.message} PARAMS=[${params.join(', ')}] FRAME=${bytesToHex(frame)}`, true);
            return false;
        }
    }

    function handleControlNotify(event) {
        const value = event.target.value;
        const bytes = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
        if (bytes.length < 5) {
            addLog(`[接收] 数据过短: ${bytesToHex(bytes)}`, true);
            return;
        }

        const crcExpected = bytes[bytes.length - 1];
        const crcActual = calculateCRC(bytes.slice(0, -1));
        const validHeader = bytes[0] === FrameHeader.CHIP;
        const validWebId = bytes[1] === WEB_ID;
        const len = bytes[2];
        const cmd = bytes[3];
        const params = Array.from(bytes.slice(4, -1));
        const validLen = len === bytes.length - 4;
        const ok = validHeader && validWebId && validLen && crcExpected === crcActual;
        const cmdHex = `0x${cmd.toString(16).padStart(2, '0').toUpperCase()}`;
        addLog(`[接收${ok ? '' : '异常'}] CMD=${cmdHex} LEN=${len} PARAMS=[${params.join(', ')}] CRC=${ok ? 'OK' : `ERR(${crcExpected}/${crcActual})`} FRAME=${bytesToHex(bytes)}`, !ok);
        if (!ok) return;

        if (cmd === 0x01) {
            parseSupportMap(params);
            pendingSupportMapResolve?.(params);
            pendingSupportMapResolve = null;
            return;
        }

        applyFeatureState(cmd, params);
    }

    async function initControlCharacteristics(server) {
        controlWriteChar = null;
        controlNotifyChar = null;

        try {
            const service = await server.getPrimaryService(BLE_SERVICE_UUID);
            controlWriteChar = await service.getCharacteristic(BLE_WRITE_CHARACTERISTIC_UUID);
            addLog(`控制写入特征已连接: ${BLE_WRITE_CHARACTERISTIC_UUID}`);

            try {
                controlNotifyChar = await service.getCharacteristic(BLE_NOTIFY_CHARACTERISTIC_UUID);
                if (controlNotifyChar && typeof controlNotifyChar.startNotifications === 'function') {
                    await controlNotifyChar.startNotifications();
                    controlNotifyChar.addEventListener('characteristicvaluechanged', handleControlNotify);
                    addLog(`控制通知特征已启用: ${BLE_NOTIFY_CHARACTERISTIC_UUID}`);
                }
            } catch (notifyError) {
                addLog(`控制通知特征未启用: ${notifyError.message}`, false);
            }
            return true;
        } catch (error) {
            addLog(`控制服务/写入特征连接失败，请检查 UUID 占位常量: ${error.message}`, true);
            return false;
        }
    }

    function waitForSupportMap(timeoutMs = 2500) {
        cancelSupportMapWait();
        return new Promise((resolve, reject) => {
            pendingSupportMapTimer = setTimeout(() => {
                pendingSupportMapResolve = null;
                pendingSupportMapTimer = null;
                reject(new Error('等待功能表回复超时'));
            }, timeoutMs);
            pendingSupportMapResolve = params => {
                clearTimeout(pendingSupportMapTimer);
                pendingSupportMapTimer = null;
                resolve(params);
            };
        });
    }

    function cancelSupportMapWait() {
        if (pendingSupportMapTimer) {
            clearTimeout(pendingSupportMapTimer);
            pendingSupportMapTimer = null;
        }
        pendingSupportMapResolve = null;
    }

    async function loadSupportedFeatures() {
        setControlPanelEnabled(false);
        featureStateReplyCount = 0;
        if (!controlWriteChar) {
            addLog('功能读取失败：控制写入特征未连接', true);
            return false;
        }

        try {
            const supportMapPromise = waitForSupportMap();
            const supportSent = await sendCommand(0x01, []);
            if (!supportSent) {
                cancelSupportMapWait();
                throw new Error('功能表请求发送失败');
            }
            await supportMapPromise;
            if (supportedCommands.size === 0) {
                throw new Error('芯片未返回页面支持功能');
            }

            const map = buildSupportedMapBytes();
            if (map.some(byte => byte !== 0)) {
                const askMapSent = await sendCommand(0x04, map);
                if (!askMapSent) throw new Error('功能状态请求发送失败');
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (featureStateReplyCount === 0) {
                    throw new Error('等待功能状态回复超时');
                }
            }

            enableSupportedFeatures();
            addLog('功能读取完成，已按支持功能恢复控制项');
            return true;
        } catch (error) {
            setControlPanelEnabled(false);
            addLog(`功能读取失败：${error.message}`, true);
            return false;
        }
    }

    // 更新界面UI状态 (根据连接状态)
    function updateUIState(connected) {
        if(connected && gattServer && bluetoothDevice) {
            disconnectBtn.disabled = false;
            readInfoBtn.disabled = false;
            scanBtn.disabled = false;   // 允许重新扫描，但会断开当前连接 (逻辑上建议先断开)
            bleStatusSpan.innerHTML = '<span class="status connected"></span> 已连接';
            if(bluetoothDevice.name) deviceNameSpan.innerText = bluetoothDevice.name;
            else deviceNameSpan.innerText = bluetoothDevice.id || '未知设备';
            deviceIdSpan.innerText = bluetoothDevice.id || '—';
        } else {
            disconnectBtn.disabled = true;
            readInfoBtn.disabled = true;
            bleStatusSpan.innerHTML = '<span class="status"></span> 未连接 / 断开';
            if(!connected && !bluetoothDevice) {
                deviceNameSpan.innerText = '—';
                deviceIdSpan.innerText = '—';
            }
            // 不清除设备名称保留展示最后断开设备名（可选）
        }
    }

    // 重置设备信息卡片（部分信息保留，连接新设备会覆盖）
    function resetDeviceInfoCard() {
        batteryLevelSpan.innerText = '—';
        manufacturerSpan.innerText = '—';
        serviceCountSpan.innerText = '—';
    }

    // 断开蓝牙连接
    async function disconnectDevice() {
        if(gattServer && gattServer.connected) {
            try {
                addLog(`正在断开设备: ${bluetoothDevice?.name || bluetoothDevice?.id}`);
                await gattServer.disconnect();
                addLog(`已断开蓝牙连接`);
            } catch(e) {
                addLog(`断开时出错: ${e.message}`, true);
            }
        }
        if(bluetoothDevice) {
            // 移除断开事件监听
            if(bluetoothDevice.removeEventListener) {
                bluetoothDevice.removeEventListener('gattserverdisconnected', handleDisconnection);
            }
        }
        gattServer = null;
        isConnected = false;
        bluetoothDevice = null;
        controlWriteChar = null;
        controlNotifyChar = null;
        setControlPanelEnabled(false);
        updateUIState(false);
        resetDeviceInfoCard();
        deviceNameSpan.innerText = '—';
        deviceIdSpan.innerText = '—';
        addLog('设备对象已清除，可重新扫描');
    }

    // 处理意外断开事件
    function handleDisconnection(event) {
        addLog(`设备已断开连接 (意外或主动)`, true);
        gattServer = null;
        isConnected = false;
        controlWriteChar = null;
        controlNotifyChar = null;
        setControlPanelEnabled(false);
        updateUIState(false);
        resetDeviceInfoCard();
        if(bluetoothDevice) {
            addLog(`设备 ${bluetoothDevice.name || bluetoothDevice.id} 断开 GATT 服务器`);
        }
        bluetoothDevice = null;
    }

    // 读取设备信息服务(制造商名称等)
    async function readDeviceInformation(server) {
        try {
            // 服务UUID: 设备信息服务 0x180A
            const service = await server.getPrimaryService('device_information');
            addLog(`找到设备信息服务 (0x180A)`);

            // 特征: 制造商名称字符串 0x2A29
            const manufacturerChar = await service.getCharacteristic('manufacturer_name_string');
            const manufacturerValue = await manufacturerChar.readValue();
            const manufacturer = new TextDecoder('utf-8').decode(manufacturerValue);
            manufacturerSpan.innerText = manufacturer || '未知';
            addLog(`制造商: ${manufacturer}`);

            // 可选: 读取型号 0x2A24
            try {
                const modelChar = await service.getCharacteristic('model_number_string');
                const modelValue = await modelChar.readValue();
                const model = new TextDecoder('utf-8').decode(modelValue);
                addLog(`型号: ${model}`);
            } catch(e) { addLog(`未找到型号特征或读取失败: ${e.message}`, false); }

            // 序列号 0x2A25
            try {
                const serialChar = await service.getCharacteristic('serial_number_string');
                const serialVal = await serialChar.readValue();
                const serial = new TextDecoder('utf-8').decode(serialVal);
                addLog(`序列号: ${serial}`);
            } catch(e) { /* 非必须 */ }
        } catch(error) {
            addLog(`读取设备信息服务失败: ${error.message}`, true);
            manufacturerSpan.innerText = '不支持/无权限';
        }
    }

    // 读取电池电量
    async function readBatteryLevel(server) {
        try {
            const batteryService = await server.getPrimaryService('battery_service');
            addLog(`找到电池服务 (0x180F)`);
            const batteryChar = await batteryService.getCharacteristic('battery_level');
            const value = await batteryChar.readValue();
            const batteryPercent = value.getUint8(0);
            batteryLevelSpan.innerText = `${batteryPercent}%`;
            addLog(`电池电量: ${batteryPercent}%`);
            return batteryPercent;
        } catch(e) {
            addLog(`未找到电池服务或读取失败: ${e.message}`, false);
            batteryLevelSpan.innerText = '不支持';
            return null;
        }
    }

    // 列举所有主要服务 (展示服务数量及UUID)
    async function enumerateServices(server) {
        try {
            const services = await server.getPrimaryServices();
            const serviceUuids = services.map(svc => svc.uuid);
            serviceCountSpan.innerText = `${services.length} 个`;
            addLog(`发现 ${services.length} 个主要服务: ${serviceUuids.join(', ')}`);
            return services;
        } catch(e) {
            addLog(`枚举服务失败: ${e.message}`, true);
            serviceCountSpan.innerText = '错误';
            return [];
        }
    }

    // 连接并初始化设备数据 (读取设备信息、电池、服务列表)
    async function connectAndSetup(device) {
        if(!device) {
            addLog(`无效设备对象`, true);
            return false;
        }
        try {
            addLog(`正在连接设备: ${device.name || device.id} ...`);
            // 建立GATT连接
            const server = await device.gatt.connect();
            gattServer = server;
            isConnected = true;
            bluetoothDevice = device;

            // 监听断开事件
            device.addEventListener('gattserverdisconnected', handleDisconnection);

            updateUIState(true);
            addLog(`GATT 连接成功`);

            // 1. 枚举服务并显示数量
            await enumerateServices(server);

            // 2. 初始化自定义控制服务/特征
            const controlReady = await initControlCharacteristics(server);
            if (controlReady) {
                await loadSupportedFeatures();
            } else {
                setControlPanelEnabled(false);
            }

            // 3. 读取设备信息服务 (制造商等)
            await readDeviceInformation(server);

            // 4. 读取电池电量 (如果支持)
            await readBatteryLevel(server);

            addLog(`初始化数据读取完成，可通过「读取设备信息」按钮重新获取。`);
            return true;
        } catch (error) {
            addLog(`连接或初始化失败: ${error.message}`, true);
            // 连接失败后重置状态
            if(device) device.removeEventListener('gattserverdisconnected', handleDisconnection);
            gattServer = null;
            isConnected = false;
            bluetoothDevice = null;
            controlWriteChar = null;
            controlNotifyChar = null;
            setControlPanelEnabled(false);
            updateUIState(false);
            resetDeviceInfoCard();
            return false;
        }
    }

    // 扫描设备 + 连接（requestDevice）
    async function scanAndConnect() {
        // 先断开当前任何已连接设备
        if(gattServer && gattServer.connected) {
            addLog(`当前已有连接，先断开再重新扫描...`);
            await disconnectDevice();
            // 等待一点时间确保清理完成
            await new Promise(r => setTimeout(r, 300));
        }

        // 检测浏览器是否支持 Web Bluetooth
        if (!navigator.bluetooth) {
            addLog(`您的浏览器不支持 Web Bluetooth API。请使用 Android Chrome/Edge 等支持 BLE 的浏览器，并确保 HTTPS 环境。`, true);
            bleStatusSpan.innerText = '不支持';
            return;
        }

        addLog(`正在请求蓝牙设备，请在弹出的系统选择器中选择目标BLE设备...`);
        try {
            // 使用 acceptAllDevices: true 以便扫描所有 BLE 设备, 但必须提供 optionalServices 数组告知需要访问哪些服务
            // 为了能读取设备信息、电池服务等，这里预置常用服务 UUID
            const optionalServicesList = [
                'device_information',      // 0x180A
                'battery_service',         // 0x180F
                'generic_access',          // 0x1800
                'generic_attribute',       // 0x1801
                BLE_SERVICE_UUID           // 自定义控制服务
            ];
            // 也可以额外增加一些常见服务 (心率, 骑行等便于测试, 但非必须)
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: optionalServicesList
            });

            addLog(`用户选择了设备: ${device.name || '无名称'} (ID: ${device.id})`);
            deviceNameSpan.innerText = device.name || '未命名设备';
            deviceIdSpan.innerText = device.id;

            // 连接并初始化读取特征
            await connectAndSetup(device);
        } catch (error) {
            if (error.name === 'NotFoundError') {
                addLog(`没有找到设备或用户未选择任何设备`, true);
            } else if (error.name === 'SecurityError') {
                addLog(`安全错误: 请确保网页使用 HTTPS 协议 (或者 localhost) 并且已开启蓝牙权限`, true);
            } else if (error.name === 'NotAllowedError') {
                addLog(`用户拒绝了蓝牙权限请求`, true);
            } else {
                addLog(`扫描/连接出错: ${error.message}`, true);
            }
            // 重置界面状态
            if(bluetoothDevice === null) {
                deviceNameSpan.innerText = '—';
                deviceIdSpan.innerText = '—';
            }
            updateUIState(false);
        }
    }

    // 手动触发重新读取设备信息 + 电池 (无需重新连接)
    async function refreshDeviceInfo() {
        if (!gattServer || !gattServer.connected) {
            addLog(`设备未连接，请先扫描连接设备`, true);
            return;
        }
        if (!bluetoothDevice) {
            addLog(`无效设备对象，请重新连接`, true);
            return;
        }
        addLog(`手动刷新设备信息...`);
        try {
            // 重新读取制造商和电池等
            await readDeviceInformation(gattServer);
            await readBatteryLevel(gattServer);
            // 可选刷新服务数量（也可重新枚举）
            const services = await gattServer.getPrimaryServices();
            serviceCountSpan.innerText = `${services.length} 个`;
            addLog(`当前服务数量: ${services.length}`);
        } catch (err) {
            addLog(`刷新信息失败: ${err.message}`, true);
        }
    }

    // 检测初始蓝牙支持状态
    function checkBluetoothSupport() {
        if (!navigator.bluetooth) {
            bleStatusSpan.innerText = '不支持 Web Bluetooth';
            addLog(`当前浏览器不支持 Web Bluetooth API。请在 Android 设备上使用 Chrome 85+ / Edge 等浏览器并确保 HTTPS 环境。`, true);
            scanBtn.disabled = false;  // 仍然可点但会报错
        } else {
            bleStatusSpan.innerText = '支持 (等待操作)';
            addLog(`Web Bluetooth API 可用，确保蓝牙已开启。`);
            // 额外检测是否安全上下文
            if (!window.isSecureContext) {
                addLog(`当前页面非安全上下文(非HTTPS/localhost)，蓝牙功能可能不可用！`, true);
                bleStatusSpan.innerText = '非安全上下文';
            } else {
                addLog(`安全上下文验证通过`);
            }
        }
    }

    // 绑定按钮事件
    function bindEvents() {
        scanBtn.addEventListener('click', async () => {
            // 每次点击扫描都先确保断开逻辑
            if(gattServer && gattServer.connected) {
                addLog(`检测到已有连接，自动断开后再扫描...`);
                await disconnectDevice();
            }
            await scanAndConnect();
        });

        disconnectBtn.addEventListener('click', async () => {
            await disconnectDevice();
            addLog(`手动断开连接完成`);
        });

        readInfoBtn.addEventListener('click', async () => {
            if(!gattServer || !gattServer.connected) {
                addLog(`当前未连接任何设备，请先扫描连接`, true);
                return;
            }
            await refreshDeviceInfo();
        });

        clearLogBtn.addEventListener('click', () => {
            clearLog();
        });
    }

    // 标签页切换 & 协议控件绑定
    function bindTabEvents() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        function activateTab(tabName) {
            const targetPanel = document.getElementById(`panel-${tabName}`);
            if (!targetPanel) {
                addLog(`未找到目标面板: panel-${tabName}`, true);
                return;
            }
            tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
            tabPanels.forEach(p => p.classList.remove('active'));
            targetPanel.classList.add('active');
        }

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                activateTab(btn.dataset.tab);
            });
        });

        // 更新色相滑块的滑块钮颜色
        function updateHueSlider(slider) {
            const v = parseInt(slider.value);
            const h = Math.round((v / 255) * 360);
            slider.style.setProperty('--thumb-color', `hsl(${h},100%,50%)`);
        }

        function getChecked(id, fallback = true) {
            const el = document.getElementById(id);
            return el ? el.checked : fallback;
        }

        function bindValueCommand({ label, cmd, toggleId, sliderId, displayId, min = 0, max = 255 }) {
            const toggle = document.getElementById(toggleId);
            const slider = document.getElementById(sliderId);
            const display = displayId ? document.getElementById(displayId) : null;
            if (!slider) return;

            const syncDisplay = () => {
                if (display) display.textContent = slider.value;
            };

            const send = async () => {
                if (slider.disabled || toggle?.disabled) return;
                const enabled = getChecked(toggleId, true) ? 1 : 0;
                const value = toByte(slider.value, min, max);
                const ok = await sendCommand(cmd, [enabled, value]);
                if (ok) addLog(`[${label}] ${enabled ? '开启' : '关闭'} 值=${value}`);
            };

            slider.addEventListener('input', () => {
                syncDisplay();
            });
            slider.addEventListener('change', send);
            toggle?.addEventListener('change', send);

            featureRegistry.set(cmd, {
                elements: [toggle, slider].filter(Boolean),
                apply(params = []) {
                    if (toggle && params.length > 0) toggle.checked = params[0] === 1;
                    if (params.length > 1) slider.value = toByte(params[1], min, max);
                    slider.dispatchEvent(new Event('input'));
                    syncDisplay();
                }
            });
        }

        function bindButtonCommand(buttonId, label, cmd, params = [1]) {
            const button = document.getElementById(buttonId);
            button?.addEventListener('click', async () => {
                if (button.disabled) return;
                const ok = await sendCommand(cmd, params);
                if (ok) addLog(`[${label}] 已发送`);
            });

            if (button) {
                featureRegistry.set(cmd, {
                    elements: [button],
                    apply() {}
                });
            }
        }

        function bindTextContentCommand(buttonId, inputId, cmd) {
            const button = document.getElementById(buttonId);
            const input = document.getElementById(inputId);
            button?.addEventListener('click', async () => {
                if (button.disabled || input?.disabled) return;
                const val = input?.value.trim();
                if (!val) return;
                const bytes = Array.from(new TextEncoder().encode(val));
                const ok = await sendCommand(cmd, bytes);
                if (ok) {
                    addLog(`[文字] 发送内容: ${val}`);
                    input.value = '';
                }
            });

            if (button && input) {
                featureRegistry.set(cmd, {
                    elements: [button, input],
                    apply() {}
                });
            }
        }

        function bindExclusiveModes(containerId, labels, startCmd, labelPrefix, colors = null) {
            const grid = document.getElementById(containerId);
            if (!grid) return;

            const group = { activeIndex: null, buttons: [], colors };
            modeGroups.set(containerId, group);

            function setActive(index) {
                group.buttons.forEach((button, i) => {
                    const active = i === index;
                    button.classList.toggle('active', active);
                    if (colors) button.style.opacity = active ? '1' : '0.58';
                });
                group.activeIndex = index;
            }

            labels.forEach((label, i) => {
                const btn = document.createElement('button');
                btn.className = 'mode-btn';
                btn.type = 'button';
                btn.textContent = label;
                btn.dataset.cmd = String(startCmd + i);
                if (colors) {
                    btn.style.background = colors[i];
                    btn.style.color = '#fff';
                    btn.style.borderColor = 'transparent';
                    btn.style.opacity = '0.58';
                    btn.dataset.dimmedOpacity = '0.58';
                }
                btn.addEventListener('click', async () => {
                    if (btn.disabled) return;
                    if (group.activeIndex === i) {
                        const ok = await sendCommand(startCmd + i, [1]);
                        if (ok) addLog(`[${labelPrefix}] ${label}: 已选中`);
                        return;
                    }

                    const previousIndex = group.activeIndex;
                    if (previousIndex !== null) {
                        const offOk = await sendCommand(startCmd + previousIndex, [0]);
                        if (!offOk) return;
                    }

                    const onOk = await sendCommand(startCmd + i, [1]);
                    if (onOk) {
                        setActive(i);
                        addLog(`[${labelPrefix}] ${label}: 选中`);
                    }
                });
                group.buttons.push(btn);
                grid.appendChild(btn);

                featureRegistry.set(startCmd + i, {
                    elements: [btn],
                    modeButton: btn,
                    apply(params = []) {
                        if (params[0] === 1) {
                            setActive(i);
                        } else if (group.activeIndex === i) {
                            setActive(null);
                        }
                    }
                });
            });
        }

        function bindEqControls({ label, cmd, toggleId, containerId, bands }) {
            const toggle = document.getElementById(toggleId);
            const container = document.getElementById(containerId);
            if (!container) return;
            const controls = [toggle].filter(Boolean);
            const sliders = [];
            const inputs = [];

            const send = async () => {
                if (toggle?.disabled || sliders.some(slider => slider.disabled)) return;
                const enabled = getChecked(toggleId, true) ? 1 : 0;
                const values = bands.map(band => displayToWireDb(band.value));
                const ok = await sendCommand(cmd, [enabled, ...values]);
                if (ok) addLog(`[${label}] ${enabled ? '开启' : '关闭'} EQ=[${bands.map(b => `${b.value}dB`).join(', ')}]`);
            };

            toggle?.addEventListener('change', send);
            bands.forEach((band, i) => {
                const el = document.createElement('div');
                el.className = 'eq-band';
                el.innerHTML = `
                    <input type="range" class="mic-eq-slider" id="${containerId}Slider${i}" min="${band.min}" max="${band.max}" value="${band.value}" step="1">
                    <input type="number" class="eq-band-value" id="${containerId}Input${i}" min="${band.min}" max="${band.max}" value="${band.value}" step="1">
                    <span class="eq-band-label">${band.label}</span>
                `;
                container.appendChild(el);

                const slider = document.getElementById(`${containerId}Slider${i}`);
                const input = document.getElementById(`${containerId}Input${i}`);
                sliders.push(slider);
                inputs.push(input);
                controls.push(slider, input);
                const sync = value => {
                    let v = Number(value);
                    if (!Number.isFinite(v)) v = 0;
                    v = Math.max(band.min, Math.min(band.max, Math.round(v)));
                    band.value = v;
                    slider.value = v;
                    input.value = v;
                };

                slider.addEventListener('input', () => sync(slider.value));
                slider.addEventListener('change', send);
                input.addEventListener('input', () => sync(input.value));
                input.addEventListener('change', send);
            });

            featureRegistry.set(cmd, {
                elements: controls.filter(Boolean),
                apply(params = []) {
                    if (toggle && params.length > 0) toggle.checked = params[0] === 1;
                    bands.forEach((band, i) => {
                        if (params.length <= i + 1) return;
                        const displayValue = wireToDisplayDb(params[i + 1]);
                        band.value = displayValue;
                        if (sliders[i]) sliders[i].value = displayValue;
                        if (inputs[i]) inputs[i].value = displayValue;
                    });
                }
            });
        }

        const tenBandEq = [
            { label: '31Hz', min: -12, max: 12, value: 0 },
            { label: '63Hz', min: -12, max: 12, value: 0 },
            { label: '125Hz', min: -12, max: 12, value: 0 },
            { label: '250Hz', min: -12, max: 12, value: 0 },
            { label: '500Hz', min: -12, max: 12, value: 0 },
            { label: '1kHz', min: -12, max: 12, value: 0 },
            { label: '2kHz', min: -12, max: 12, value: 0 },
            { label: '4kHz', min: -12, max: 12, value: 0 },
            { label: '8kHz', min: -12, max: 12, value: 0 },
            { label: '16kHz', min: -12, max: 12, value: 0 }
        ];

        // ===== 文字面板 =====
        bindTextContentCommand('textSendBtn', 'textContent', 0x58);

        const textModeLabels = ['自动切换', '文本显示', '歌词显示', '频谱0', '频谱1', '频谱2', '频谱3'];
        bindExclusiveModes('textModeGrid', textModeLabels, 0x59, '文字模式');

        const textColor = document.getElementById('textColor');
        const textColorPreview = document.getElementById('textColorPreview');
        const textColorHue = document.getElementById('textColorHue');
        if (textColor && textColorPreview) {
            function updateTextColor() {
                const v = parseInt(textColor.value);
                const h = Math.round((v / 255) * 360);
                textColorPreview.style.background = `hsl(${h},100%,50%)`;
                textColorHue.textContent = `色相: ${h}°`;
                updateHueSlider(textColor);
            }
            textColor.addEventListener('input', updateTextColor);
            updateTextColor(); // 初始化
        }
        bindValueCommand({ label: '文字 单色颜色', cmd: 0x68, toggleId: 'textColorToggle', sliderId: 'textColor', displayId: null, min: 0, max: 255 });
        bindValueCommand({ label: '文字 渐变速度', cmd: 0x69, toggleId: 'textGradientSpeedToggle', sliderId: 'textGradientSpeed', displayId: 'textGradientSpeedVal', min: 0, max: 16 });
        bindValueCommand({ label: '文字 滚动速度', cmd: 0x6A, toggleId: 'textScrollSpeedToggle', sliderId: 'textScrollSpeed', displayId: 'textScrollSpeedVal', min: 0, max: 16 });
        bindValueCommand({ label: '文字 亮度', cmd: 0x6B, toggleId: 'textBrightnessToggle', sliderId: 'textBrightness', displayId: 'textBrightnessVal', min: 0, max: 16 });
        bindButtonCommand('textSaveBtn', '文字 保存设置', 0x6F, [1]);

        // ===== 灯光面板 =====
        const lightModeColors = [
            '#ef4444','#f97316','#eab308','#22c55e',
            '#14b8a6','#06b6d4','#3b82f6','#6366f1',
            '#a855f7','#ec4899','#f43f5e','#fb923c',
            '#facc15','#4ade80','#2dd4bf','#8b5cf6'
        ];
        bindExclusiveModes('lightModeGrid', Array.from({ length: 16 }, (_, i) => `模式${i + 1}`), 0x39, '灯光模式', lightModeColors);
        bindValueCommand({ label: '灯光 自动模式', cmd: 0x38, toggleId: 'lightAutoToggle', sliderId: 'lightAutoParam', displayId: 'lightAutoParamVal', min: 5, max: 255 });

        const lightColor = document.getElementById('lightColor');
        const lightColorPreview = document.getElementById('lightColorPreview');
        const lightColorHue = document.getElementById('lightColorHue');
        if (lightColor && lightColorPreview) {
            function updateLightColor() {
                const v = parseInt(lightColor.value);
                const h = Math.round((v / 255) * 360);
                lightColorPreview.style.background = `hsl(${h},100%,50%)`;
                lightColorHue.textContent = `色相: ${h}°`;
                updateHueSlider(lightColor);
            }
            lightColor.addEventListener('input', updateLightColor);
            updateLightColor(); // 初始化
        }
        bindValueCommand({ label: '灯光 颜色', cmd: 0x50, toggleId: 'lightColorToggle', sliderId: 'lightColor', displayId: null, min: 0, max: 255 });
        bindValueCommand({ label: '灯光 亮度', cmd: 0x51, toggleId: 'lightBrightnessToggle', sliderId: 'lightBrightness', displayId: 'lightBrightnessVal', min: 0, max: 16 });
        bindValueCommand({ label: '灯光 速度', cmd: 0x52, toggleId: 'lightSpeedToggle', sliderId: 'lightSpeed', displayId: 'lightSpeedVal', min: 0, max: 16 });
        bindButtonCommand('lightSaveBtn', '灯光 保存设置', 0x57, [1]);

        // ===== 麦克风面板 =====
        bindValueCommand({ label: '麦克风 MIC音量', cmd: 0x29, toggleId: 'micVolToggle', sliderId: 'micVol', displayId: 'micVolVal', min: 0, max: 32 });
        bindValueCommand({ label: '麦克风 MIC优先', cmd: 0x2A, toggleId: 'micPriorityToggle', sliderId: 'micPriorityVal', displayId: 'micPriorityValDisplay', min: 0, max: 32 });
        bindEqControls({ label: '麦克风 EQ', cmd: 0x2B, toggleId: 'micEqToggle', containerId: 'micEqWrapper', bands: tenBandEq.map(band => ({ ...band })) });
        bindValueCommand({ label: '麦克风 回声', cmd: 0x2C, toggleId: 'micEchoToggle', sliderId: 'micEchoValue', displayId: 'micEchoValueVal', min: 0, max: 32 });
        bindValueCommand({ label: '麦克风 混响', cmd: 0x2D, toggleId: 'micReverbToggle', sliderId: 'micReverbSize', displayId: 'micReverbSizeVal', min: 0, max: 32 });
        const micMagicSelect = document.getElementById('micMagicSound');
        const micMagicToggle = document.getElementById('micMagicToggle');
        micMagicSelect?.addEventListener('change', async function() {
            if (this.disabled || micMagicToggle?.disabled) return;
            const enabled = getChecked('micMagicToggle', true) ? 1 : 0;
            const value = toByte(this.value, 0, 5);
            const names = ['关闭','儿童','女声','男声','电音','魔音'];
            const ok = await sendCommand(0x2E, [enabled, value]);
            if (ok) addLog(`[麦克风] 魔音效果: ${names[parseInt(this.value)] || this.value}`);
        });
        micMagicToggle?.addEventListener('change', async function() {
            if (this.disabled || micMagicSelect?.disabled) return;
            const value = toByte(micMagicSelect?.value || 0, 0, 5);
            const ok = await sendCommand(0x2E, [this.checked ? 1 : 0, value]);
            if (ok) addLog(`[麦克风] 魔音效果: ${this.checked ? '开启' : '关闭'} 值=${value}`);
        });
        if (micMagicSelect && micMagicToggle) {
            featureRegistry.set(0x2E, {
                elements: [micMagicSelect, micMagicToggle],
                apply(params = []) {
                    if (params.length > 0) micMagicToggle.checked = params[0] === 1;
                    if (params.length > 1) micMagicSelect.value = String(toByte(params[1], 0, 5));
                }
            });
        }
        bindButtonCommand('micResetBtn', '麦克风 一键恢复默认', 0x28, [1]);
        bindButtonCommand('micSaveBtn', '麦克风 保存设置', 0x37, [1]);

        // ===== 音乐面板 =====
        bindValueCommand({ label: '音乐 主音量', cmd: 0x11, toggleId: 'musicVolToggle', sliderId: 'musicVol', displayId: 'musicVolVal', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 高音', cmd: 0x12, toggleId: 'musicTrebleToggle', sliderId: 'musicTreble', displayId: 'musicTrebleVal', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 中音', cmd: 0x13, toggleId: 'musicMidToggle', sliderId: 'musicMid', displayId: 'musicMidVal', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 低音', cmd: 0x14, toggleId: 'musicBassToggle', sliderId: 'musicBass', displayId: 'musicBassVal', min: 0, max: 32 });
        bindEqControls({ label: '音乐 EQ', cmd: 0x15, toggleId: 'musicEqToggle', containerId: 'musicEqWrapper', bands: tenBandEq.map(band => ({ ...band })) });
        bindValueCommand({ label: '音乐 3D丽音', cmd: 0x18, toggleId: 'music3dToggle', sliderId: 'music3dVal', displayId: 'music3dValDisplay', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 人声消除', cmd: 0x19, toggleId: 'musicVocalCutToggle', sliderId: 'musicVocalCutVal', displayId: 'musicVocalCutValDisplay', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 虚拟低音', cmd: 0x1A, toggleId: 'musicVbToggle', sliderId: 'musicVbVal', displayId: 'musicVbValDisplay', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 人声激励', cmd: 0x1B, toggleId: 'musicExciterToggle', sliderId: 'musicExciterVal', displayId: 'musicExciterValDisplay', min: 0, max: 32 });
        bindButtonCommand('musicResetBtn', '音乐 一键恢复默认', 0x10, [1]);
        bindButtonCommand('musicSaveBtn', '音乐 保存设置', 0x27, [1]);
    }

    // 页面卸载时断开蓝牙（优雅）
    window.addEventListener('beforeunload', () => {
        if(gattServer && gattServer.connected) {
            gattServer.disconnect();
        }
    });

    // 初始化
    function init() {
        bindEvents();
        bindTabEvents();
        setControlPanelEnabled(false);
        checkBluetoothSupport();
        updateUIState(false);
    }

    init();
})();
