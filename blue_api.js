(function(){
    // ===== 日志面板开关 =====
    // 设为 true 可在页面上显示实时日志区域（默认隐藏，通过 F12 查看）
    const SHOW_LOG_UI = false;

    // ===== BLE 控制服务 UUID（正式硬件） =====
    // 适用机型：A6L、A6D、A8D
    // 服务: AF00 (PRIMARY_SERVICE)  |  写特征: AF01 (WRITE)  |  通知特征: AF02 (NOTIFY)
    const BLE_SERVICE_UUID = '0000af00-0000-1000-8000-00805f9b34fb';
    const BLE_WRITE_CHARACTERISTIC_UUID = '0000af01-0000-1000-8000-00805f9b34fb';
    const BLE_NOTIFY_CHARACTERISTIC_UUID = '0000af02-0000-1000-8000-00805f9b34fb';

    const FrameHeader = {
        HOST: 0xAA,
        CHIP: 0x55
    };
    const WEB_ID = 0x01;

    // ===== 命令枚举（匹配固件 BLE_msg_type） =====
    const CMD = {
        // === Map Byte 0: 系统功能 ===
        SYS_ASK: 0x00,               // 【未在 Web UI 中实现】
        SYS_CHIP_SUPPORT_MAP: 0x01,  // 握手/支持映射请求
        SYS_ASK_ALL: 0x02,           // 【未在 Web UI 中实现】
        SYS_ASK_CMD: 0x03,           // 【未在 Web UI 中实现】
        SYS_ASK_MAP: 0x04,           // Bit-map 功能请求
        SYS_ASK_BAT: 0x05,           // 【未在 Web UI 中实现】
        SYS_ASK_MCU_ID: 0x06,        // 【未在 Web UI 中实现】
        SYS_ASK_MID: 0x07,           // 【未在 Web UI 中实现】

        // === Map Byte 1: 系统保留 ===
        // 0x08-0x0F: 预留，未使用

        // === Map Byte 2: 音效功能 0（音乐 EQ） ===
        EQ_VOL_RESET: 0x10,
        EQ_VOL_VAL: 0x11,
        EQ_VOL_TRE: 0x12,
        EQ_VOL_MID: 0x13,
        EQ_VOL_BASS: 0x14,
        EQ_VOL_FRE_VAL: 0x15,
        // 0x16-0x17: 未使用

        // === Map Byte 3: 音效功能 1（音效增强） ===
        EQ_VOL_3D: 0x18,
        EQ_Voice_Cut: 0x19,
        EQ_VOL_VB: 0x1A,
        EQ_Voice_EXCITER: 0x1B,
        // 0x1C-0x1F: 未使用

        // === Map Byte 4: 音效功能 2（播放控制） ===
        EQ_VOL_PAUSE: 0x20,          // 【未在 Web UI 中实现】
        EQ_VOL_PREV: 0x21,           // 【未在 Web UI 中实现】
        EQ_VOL_NEXT: 0x22,           // 【未在 Web UI 中实现】
        EQ_VOL_MODE: 0x23,           // 【未在 Web UI 中实现】
        EQ_VOL_PLAY_MODE: 0x24,      // 【未在 Web UI 中实现】
        // 0x25-0x26: 未使用
        EQ_VOL_SAVE: 0x27,

        // === Map Byte 5: MIC 功能 3 ===
        EQ_MIC_RESET: 0x28,
        EQ_MIC_VAL: 0x29,
        EQ_MIC_priority: 0x2A,
        EQ_MIC_FRE_VAL: 0x2B,
        EQ_MIC_ECHO: 0x2C,
        EQ_MIC_REVERB: 0x2D,
        EQ_MIC_Magic_Sound: 0x2E,
        // 0x2F: 未使用

        // === Map Byte 6: MIC 功能 4 ===
        // 0x30-0x36: 未使用
        EQ_MIC_SAVE: 0x37,

        // === Map Byte 7: 灯光功能 0 ===
        LIGHT_AUTO_EN: 0x38,
        LIGHT_MODE_0: 0x39,          // 0x3A-0x3F 为 MODE_1-6（通过 startCmd+i 计算）
        // 0x3A-0x3F: 见 LIGHT_MODE_0

        // === Map Byte 8: 灯光功能 1 ===
        // 0x40-0x47: LIGHT_MODE_7-14（通过 startCmd+i 计算），见 LIGHT_MODE_0

        // === Map Byte 9: 灯光功能 2 ===
        // 0x48: LIGHT_MODE_15（通过 startCmd+i 计算），见 LIGHT_MODE_0
        // 0x49-0x4F: 未使用

        // === Map Byte 10: 灯光功能 3（参数控制） ===
        LIGHT_COLOR_SET: 0x50,
        LIGHT_VAL_SET: 0x51,
        LIGHT_SPEED_SET: 0x52,
        // 0x53-0x56: 未使用
        LIGHT_SAVE: 0x57,

        // === Map Byte 11: 文字功能 0（显示模式） ===
        TEXT_Content: 0x58,
        TEXT_MODE_0: 0x59,           // 0x5A-0x5F 为 MODE_1-6（通过 startCmd+i 计算）
        // 0x5A-0x5F: 见 TEXT_MODE_0

        // === Map Byte 12: 文字功能 1 ===
        // 0x60-0x67: 预留，未使用

        // === Map Byte 13: 文字功能 2（样式参数） ===
        TEXT_COLOR_ONE: 0x68,
        TEXT_COLOR_AUTO_Speed: 0x69,
        TEXT_Scroll_Speed: 0x6A,
        TEXT_LIGHT: 0x6B,
        // 0x6C-0x6E: 未使用
        TEXT_SAVE: 0x6F,
    };

    // DOM 元素
    const scanBtn = document.getElementById('scanBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const readInfoBtn = document.getElementById('readInfoBtn');
    const bleStatusSpan = document.getElementById('bleStatus');
    const deviceNameSpan = document.getElementById('deviceName');
    const batteryLevelSpan = document.getElementById('batteryLevel');
    const manufacturerSpan = document.getElementById('manufacturer');
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

    function setBleStatus(text, connected = false) {
        bleStatusSpan.innerHTML = `<span class="status${connected ? ' connected' : ''}"></span>${text}`;
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

        if (cmd === CMD.SYS_CHIP_SUPPORT_MAP) {
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

        // ===== 调试：枚举设备所有服务与特征 =====
        try {
            const allServices = await server.getPrimaryServices();
            addLog(`══════ 设备服务/特征全枚举 (共 ${allServices.length} 个服务) ══════`);
            for (const svc of allServices) {
                const chars = await svc.getCharacteristics();
                addLog(`  📦 服务: ${svc.uuid}${svc.isPrimary ? ' (PRIMARY)' : ''} — ${chars.length} 个特征`);
                for (const ch of chars) {
                    const props = [];
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
        } catch (enumErr) {
            addLog(`⚠ 服务枚举失败: ${enumErr.message}`, false);
        }

        // ===== 连接控制服务 =====
        try {
            const service = await server.getPrimaryService(BLE_SERVICE_UUID);
            addLog(`✅ 已找到控制服务: ${BLE_SERVICE_UUID}`);

            // 获取该服务下所有特征（用于 fallback）
            const allChars = await service.getCharacteristics();

            // --- 写入特征：优先精确 UUID，失败则自动匹配 ---
            try {
                controlWriteChar = await service.getCharacteristic(BLE_WRITE_CHARACTERISTIC_UUID);
                addLog(`✅ 控制写入特征(精确匹配): ${BLE_WRITE_CHARACTERISTIC_UUID}`);
            } catch (writeUuidErr) {
                addLog(`⚠ 精确匹配写入特征失败: ${writeUuidErr.message}，尝试自动匹配...`, false);
                controlWriteChar = allChars.find(ch =>
                    ch.properties.write || ch.properties.writeWithoutResponse
                ) || null;
                if (controlWriteChar) {
                    addLog(`✅ 控制写入特征(自动匹配): ${controlWriteChar.uuid}`);
                } else {
                    throw new Error('未找到任何可写入的特征');
                }
            }
            // 记录写入特征属性
            const writeProps = [];
            if (controlWriteChar.properties.write) writeProps.push('WRITE');
            if (controlWriteChar.properties.writeWithoutResponse) writeProps.push('WRITE_NO_RESP');
            addLog(`  写入属性: [${writeProps.join(', ')}]`);

            // --- 通知特征：优先精确 UUID，失败则自动匹配 ---
            try {
                controlNotifyChar = await service.getCharacteristic(BLE_NOTIFY_CHARACTERISTIC_UUID);
                addLog(`✅ 控制通知特征(精确匹配): ${BLE_NOTIFY_CHARACTERISTIC_UUID}`);
            } catch (notifyUuidErr) {
                addLog(`⚠ 精确匹配通知特征失败: ${notifyUuidErr.message}，尝试自动匹配...`, false);
                controlNotifyChar = allChars.find(ch =>
                    ch.properties.notify || ch.properties.indicate
                ) || null;
                if (controlNotifyChar) {
                    addLog(`✅ 控制通知特征(自动匹配): ${controlNotifyChar.uuid}`);
                } else {
                    addLog(`⚠ 未找到任何可通知的特征`, false);
                }
            }

            // 启用通知
            if (controlNotifyChar) {
                const notifyProps = [];
                if (controlNotifyChar.properties.notify) notifyProps.push('NOTIFY');
                if (controlNotifyChar.properties.indicate) notifyProps.push('INDICATE');
                addLog(`  通知属性: [${notifyProps.join(', ')}]`);

                if (typeof controlNotifyChar.startNotifications === 'function') {
                    try {
                        await controlNotifyChar.startNotifications();
                        controlNotifyChar.addEventListener('characteristicvaluechanged', handleControlNotify);
                        addLog(`✅ 控制通知特征已启用: ${controlNotifyChar.uuid}`);
                    } catch (startErr) {
                        addLog(`⚠ 启动通知失败: ${startErr.message}`, false);
                    }
                }
            }
            return true;
        } catch (error) {
            addLog(`❌ 控制服务/写入特征连接失败: ${error.message}`, true);
            addLog(`  提示: 请确认设备固件使用了以下 UUID:`, true);
            addLog(`    服务: ${BLE_SERVICE_UUID}`, true);
            addLog(`    写入特征: ${BLE_WRITE_CHARACTERISTIC_UUID}`, true);
            addLog(`    通知特征: ${BLE_NOTIFY_CHARACTERISTIC_UUID}`, true);
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
            const supportSent = await sendCommand(CMD.SYS_CHIP_SUPPORT_MAP, []);
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
                const askMapSent = await sendCommand(CMD.SYS_ASK_MAP, map);
                if (!askMapSent) {
                    addLog('功能状态请求发送失败，跳过状态同步', false);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (featureStateReplyCount === 0) {
                        addLog('功能状态回复超时，跳过状态同步（控件将使用默认值）', false);
                    } else {
                        addLog(`已同步 ${featureStateReplyCount} 个功能状态`);
                    }
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
            setBleStatus('已连接', true);
            if(bluetoothDevice.name) deviceNameSpan.innerText = bluetoothDevice.name;
            else deviceNameSpan.innerText = bluetoothDevice.id || '未知设备';
        } else {
            disconnectBtn.disabled = true;
            readInfoBtn.disabled = true;
            setBleStatus('未连接 / 断开');
            if(!connected && !bluetoothDevice) {
                deviceNameSpan.innerText = '—';
            }
            // 不清除设备名称保留展示最后断开设备名（可选）
        }
    }

    // 重置设备信息卡片（部分信息保留，连接新设备会覆盖）
    function resetDeviceInfoCard() {
        batteryLevelSpan.innerText = '—';
        manufacturerSpan.innerText = '—';
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
            // TODO: 目标硬件(A6L/A6D/A8D)未实现标准 Device Information 服务(0x180A)，此为预期行为
            addLog(`设备信息服务(0x180A): 硬件未实现，跳过`);
            manufacturerSpan.innerText = '—';
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
            // TODO: 目标硬件(A6L/A6D/A8D)未实现标准 Battery Service(0x180F)，此为预期行为
            addLog(`电池服务(0x180F): 硬件未实现，跳过`);
            batteryLevelSpan.innerText = '—';
            return null;
        }
    }

    // 列举所有主要服务 (展示服务数量及UUID)
    async function enumerateServices(server) {
        try {
            const services = await server.getPrimaryServices();
            const serviceUuids = services.map(svc => svc.uuid);
            addLog(`发现 ${services.length} 个主要服务: ${serviceUuids.join(', ')}`);
            return services;
        } catch(e) {
            addLog(`枚举服务失败: ${e.message}`, true);
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
            setBleStatus('不支持');
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
            addLog(`当前服务数量: ${services.length}`);
        } catch (err) {
            addLog(`刷新信息失败: ${err.message}`, true);
        }
    }

    // 检测初始蓝牙支持状态
    function checkBluetoothSupport() {
        if (!navigator.bluetooth) {
            setBleStatus('不支持 Web Bluetooth');
            addLog(`当前浏览器不支持 Web Bluetooth API。请在 Android 设备上使用 Chrome 85+ / Edge 等浏览器并确保 HTTPS 环境。`, true);
            scanBtn.disabled = false;  // 仍然可点但会报错
        } else {
            setBleStatus('支持 (等待操作)');
            addLog(`Web Bluetooth API 可用，确保蓝牙已开启。`);
            // 额外检测是否安全上下文
            if (!window.isSecureContext) {
                addLog(`当前页面非安全上下文(非HTTPS/localhost)，蓝牙功能可能不可用！`, true);
                setBleStatus('非安全上下文');
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
        bindTextContentCommand('textSendBtn', 'textContent', CMD.TEXT_Content);

        const textModeLabels = ['自动切换', '文本显示', '歌词显示', '频谱0', '频谱1', '频谱2', '频谱3'];
        bindExclusiveModes('textModeGrid', textModeLabels, CMD.TEXT_MODE_0, '文字模式');

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
        bindValueCommand({ label: '文字 单色颜色', cmd: CMD.TEXT_COLOR_ONE, toggleId: 'textColorToggle', sliderId: 'textColor', displayId: null, min: 0, max: 255 });
        bindValueCommand({ label: '文字 渐变速度', cmd: CMD.TEXT_COLOR_AUTO_Speed, toggleId: 'textGradientSpeedToggle', sliderId: 'textGradientSpeed', displayId: 'textGradientSpeedVal', min: 0, max: 16 });
        bindValueCommand({ label: '文字 滚动速度', cmd: CMD.TEXT_Scroll_Speed, toggleId: 'textScrollSpeedToggle', sliderId: 'textScrollSpeed', displayId: 'textScrollSpeedVal', min: 0, max: 16 });
        bindValueCommand({ label: '文字 亮度', cmd: CMD.TEXT_LIGHT, toggleId: 'textBrightnessToggle', sliderId: 'textBrightness', displayId: 'textBrightnessVal', min: 0, max: 16 });
        bindButtonCommand('textSaveBtn', '文字 保存设置', CMD.TEXT_SAVE, [1]);

        // ===== 灯光面板 =====
        const lightModeColors = [
            '#ef4444','#f97316','#eab308','#22c55e',
            '#14b8a6','#06b6d4','#3b82f6','#6366f1',
            '#a855f7','#ec4899','#f43f5e','#fb923c',
            '#facc15','#4ade80','#2dd4bf','#8b5cf6'
        ];
        bindExclusiveModes('lightModeGrid', Array.from({ length: 16 }, (_, i) => `模式${i + 1}`), CMD.LIGHT_MODE_0, '灯光模式', lightModeColors);
        bindValueCommand({ label: '灯光 自动模式', cmd: CMD.LIGHT_AUTO_EN, toggleId: 'lightAutoToggle', sliderId: 'lightAutoParam', displayId: 'lightAutoParamVal', min: 5, max: 255 });

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
        bindValueCommand({ label: '灯光 颜色', cmd: CMD.LIGHT_COLOR_SET, toggleId: 'lightColorToggle', sliderId: 'lightColor', displayId: null, min: 0, max: 255 });
        bindValueCommand({ label: '灯光 亮度', cmd: CMD.LIGHT_VAL_SET, toggleId: 'lightBrightnessToggle', sliderId: 'lightBrightness', displayId: 'lightBrightnessVal', min: 0, max: 16 });
        bindValueCommand({ label: '灯光 速度', cmd: CMD.LIGHT_SPEED_SET, toggleId: 'lightSpeedToggle', sliderId: 'lightSpeed', displayId: 'lightSpeedVal', min: 0, max: 16 });
        bindButtonCommand('lightSaveBtn', '灯光 保存设置', CMD.LIGHT_SAVE, [1]);

        // ===== 麦克风面板 =====
        bindValueCommand({ label: '麦克风 MIC音量', cmd: CMD.EQ_MIC_VAL, toggleId: 'micVolToggle', sliderId: 'micVol', displayId: 'micVolVal', min: 0, max: 32 });
        bindValueCommand({ label: '麦克风 MIC优先', cmd: CMD.EQ_MIC_priority, toggleId: 'micPriorityToggle', sliderId: 'micPriorityVal', displayId: 'micPriorityValDisplay', min: 0, max: 32 });
        bindEqControls({ label: '麦克风 EQ', cmd: CMD.EQ_MIC_FRE_VAL, toggleId: 'micEqToggle', containerId: 'micEqWrapper', bands: tenBandEq.map(band => ({ ...band })) });
        bindValueCommand({ label: '麦克风 回声', cmd: CMD.EQ_MIC_ECHO, toggleId: 'micEchoToggle', sliderId: 'micEchoValue', displayId: 'micEchoValueVal', min: 0, max: 32 });
        bindValueCommand({ label: '麦克风 混响', cmd: CMD.EQ_MIC_REVERB, toggleId: 'micReverbToggle', sliderId: 'micReverbSize', displayId: 'micReverbSizeVal', min: 0, max: 32 });
        const micMagicSelect = document.getElementById('micMagicSound');
        const micMagicToggle = document.getElementById('micMagicToggle');
        micMagicSelect?.addEventListener('change', async function() {
            if (this.disabled || micMagicToggle?.disabled) return;
            const enabled = getChecked('micMagicToggle', true) ? 1 : 0;
            const value = toByte(this.value, 0, 5);
            const names = ['关闭','儿童','女声','男声','电音','魔音'];
            const ok = await sendCommand(CMD.EQ_MIC_Magic_Sound, [enabled, value]);
            if (ok) addLog(`[麦克风] 魔音效果: ${names[parseInt(this.value)] || this.value}`);
        });
        micMagicToggle?.addEventListener('change', async function() {
            if (this.disabled || micMagicSelect?.disabled) return;
            const value = toByte(micMagicSelect?.value || 0, 0, 5);
            const ok = await sendCommand(CMD.EQ_MIC_Magic_Sound, [this.checked ? 1 : 0, value]);
            if (ok) addLog(`[麦克风] 魔音效果: ${this.checked ? '开启' : '关闭'} 值=${value}`);
        });
        if (micMagicSelect && micMagicToggle) {
            featureRegistry.set(CMD.EQ_MIC_Magic_Sound, {
                elements: [micMagicSelect, micMagicToggle],
                apply(params = []) {
                    if (params.length > 0) micMagicToggle.checked = params[0] === 1;
                    if (params.length > 1) micMagicSelect.value = String(toByte(params[1], 0, 5));
                }
            });
        }
        bindButtonCommand('micResetBtn', '麦克风 一键恢复默认', CMD.EQ_MIC_RESET, [1]);
        bindButtonCommand('micSaveBtn', '麦克风 保存设置', CMD.EQ_MIC_SAVE, [1]);

        // ===== 音乐面板 =====
        bindValueCommand({ label: '音乐 主音量', cmd: CMD.EQ_VOL_VAL, toggleId: 'musicVolToggle', sliderId: 'musicVol', displayId: 'musicVolVal', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 高音', cmd: CMD.EQ_VOL_TRE, toggleId: 'musicTrebleToggle', sliderId: 'musicTreble', displayId: 'musicTrebleVal', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 中音', cmd: CMD.EQ_VOL_MID, toggleId: 'musicMidToggle', sliderId: 'musicMid', displayId: 'musicMidVal', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 低音', cmd: CMD.EQ_VOL_BASS, toggleId: 'musicBassToggle', sliderId: 'musicBass', displayId: 'musicBassVal', min: 0, max: 32 });
        bindEqControls({ label: '音乐 EQ', cmd: CMD.EQ_VOL_FRE_VAL, toggleId: 'musicEqToggle', containerId: 'musicEqWrapper', bands: tenBandEq.map(band => ({ ...band })) });
        bindValueCommand({ label: '音乐 3D丽音', cmd: CMD.EQ_VOL_3D, toggleId: 'music3dToggle', sliderId: 'music3dVal', displayId: 'music3dValDisplay', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 人声消除', cmd: CMD.EQ_Voice_Cut, toggleId: 'musicVocalCutToggle', sliderId: 'musicVocalCutVal', displayId: 'musicVocalCutValDisplay', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 虚拟低音', cmd: CMD.EQ_VOL_VB, toggleId: 'musicVbToggle', sliderId: 'musicVbVal', displayId: 'musicVbValDisplay', min: 0, max: 32 });
        bindValueCommand({ label: '音乐 人声激励', cmd: CMD.EQ_Voice_EXCITER, toggleId: 'musicExciterToggle', sliderId: 'musicExciterVal', displayId: 'musicExciterValDisplay', min: 0, max: 32 });
        bindButtonCommand('musicResetBtn', '音乐 一键恢复默认', CMD.EQ_VOL_RESET, [1]);
        bindButtonCommand('musicSaveBtn', '音乐 保存设置', CMD.EQ_VOL_SAVE, [1]);
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
