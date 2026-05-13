(function(){
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

    // 全局蓝牙对象
    let bluetoothDevice = null;      // 当前选中的设备
    let gattServer = null;           // GATT 服务器实例
    let isConnected = false;

    // ---------- 辅助函数：日志 ----------
    function addLog(message, isError = false) {
        const logDiv = logPanel;
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const prefix = isError ? '❌' : '🔹';
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
        updateUIState(false);
        resetDeviceInfoCard();
        deviceNameSpan.innerText = '—';
        deviceIdSpan.innerText = '—';
        addLog('设备对象已清除，可重新扫描');
    }

    // 处理意外断开事件
    function handleDisconnection(event) {
        addLog(`⚠️ 设备已断开连接 (意外或主动)`, true);
        gattServer = null;
        isConnected = false;
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
            addLog(`✅ GATT 连接成功！`);

            // 1. 枚举服务并显示数量
            await enumerateServices(server);

            // 2. 读取设备信息服务 (制造商等)
            await readDeviceInformation(server);

            // 3. 读取电池电量 (如果支持)
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
            bleStatusSpan.innerText = '❌ 不支持';
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
                'generic_attribute'        // 0x1801
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
            bleStatusSpan.innerText = '❌ 不支持 Web Bluetooth';
            addLog(`⚠️ 当前浏览器不支持 Web Bluetooth API。请在 Android 设备上使用 Chrome 85+ / Edge 等浏览器并确保 HTTPS 环境。`, true);
            scanBtn.disabled = false;  // 仍然可点但会报错
        } else {
            bleStatusSpan.innerText = '✅ 支持 (等待操作)';
            addLog(`✅ Web Bluetooth API 可用，确保蓝牙已开启。`);
            // 额外检测是否安全上下文
            if (!window.isSecureContext) {
                addLog(`⚠️ 当前页面非安全上下文(非HTTPS/localhost)，蓝牙功能可能不可用！`, true);
                bleStatusSpan.innerText = '⚠️ 非安全上下文';
            } else {
                addLog(`🔒 安全上下文验证通过`);
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

    // 标签页切换 & 控件日志
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

        // 辅助: Hue → HSL 字符串
        function hueToHsl(h) {
            return `hsl(${h},100%,50%)`;
        }

        // ===== 文字面板 =====
        const textHue = document.getElementById('textHue');
        const textColorPreview = document.getElementById('textColorPreview');
        document.getElementById('textSendBtn').addEventListener('click', () => {
            const input = document.getElementById('textInput');
            const val = input.value.trim();
            if (val) {
                addLog(`[文字] 发送: ${val}`);
                input.value = '';
            }
        });
        textHue.addEventListener('input', function() {
            const h = parseInt(this.value);
            textColorPreview.style.background = hueToHsl(h);
        });
        textHue.addEventListener('change', function() {
            addLog(`[文字] 颜色 (色相): ${this.value}°`);
        });
        document.getElementById('textBrightness').addEventListener('input', function() {
            document.getElementById('textBrightnessVal').innerText = `${this.value}%`;
        });
        document.getElementById('textBrightness').addEventListener('change', function() {
            addLog(`[文字] 亮度: ${this.value}%`);
        });

        // ===== 灯光面板（频谱控制） =====
        const spectrumGrid = document.getElementById('spectrumGrid');
        const blockColors = [
            '#ef4444','#f97316','#eab308','#22c55e',
            '#14b8a6','#06b6d4','#3b82f6','#6366f1',
            '#a855f7','#ec4899','#f43f5e','#fb923c',
            '#facc15','#4ade80','#2dd4bf','#8b5cf6'
        ];
        let selectedBlock = null;
        const allBlocks = [];
        blockColors.forEach((color, i) => {
            const block = document.createElement('div');
            block.className = 'color-block';
            block.style.background = color;
            block.dataset.index = i;
            block.textContent = `灯效${i + 1}`;
            block.addEventListener('click', () => {
                if (selectedBlock === block) return;
                if (selectedBlock) {
                    selectedBlock.classList.remove('selected');
                }
                block.classList.add('selected');
                selectedBlock = block;
                allBlocks.forEach(b => {
                    if (b !== block) b.classList.add('dimmed');
                    else b.classList.remove('dimmed');
                });
                addLog(`[灯光] 选中灯效${i + 1} (${color})`);
            });
            spectrumGrid.appendChild(block);
            allBlocks.push(block);
        });

        document.getElementById('autoMode').addEventListener('change', function() {
            addLog(`[灯光] 自动模式: ${this.checked ? '开启' : '关闭'}`);
        });

        document.getElementById('timeConfirmBtn').addEventListener('click', () => {
            const input = document.getElementById('timeConstant');
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) {
                addLog(`[灯光] 时间常数设置为: ${val} 秒`);
            }
        });

        // ===== 灯光面板（文字/色相/亮度） =====
        const lightHue = document.getElementById('lightHue');
        const lightColorPreview = document.getElementById('lightColorPreview');
        document.getElementById('lightTextSendBtn').addEventListener('click', () => {
            const input = document.getElementById('lightTextInput');
            const val = input.value.trim();
            if (val) {
                addLog(`[灯光] 发送: ${val}`);
                input.value = '';
            }
        });
        lightHue.addEventListener('input', function() {
            const h = parseInt(this.value);
            lightColorPreview.style.background = hueToHsl(h);
        });
        lightHue.addEventListener('change', function() {
            addLog(`[灯光] 颜色 (色相): ${this.value}°`);
        });
        document.getElementById('lightBrightness').addEventListener('input', function() {
            document.getElementById('lightBrightnessVal').innerText = `${this.value}%`;
        });
        document.getElementById('lightBrightness').addEventListener('change', function() {
            addLog(`[灯光] 亮度: ${this.value}%`);
        });

        // ===== 麦克风面板 (EQ + PA + 音量) =====
        const micEqBands = [
            { label: '25Hz',  min: -12, max: 12, value: 0 },
            { label: '40Hz',  min: -12, max: 12, value: 0 },
            { label: '63Hz',  min: -12, max: 12, value: 0 },
            { label: '100Hz', min: -12, max: 12, value: 0 },
            { label: '160Hz', min: -12, max: 12, value: 0 },
            { label: '250Hz', min: -12, max: 12, value: 0 },
            { label: '400Hz', min: -12, max: 12, value: 0 },
            { label: '630Hz', min: -12, max: 12, value: 0 },
            { label: '1kHz',  min: -12, max: 12, value: 0 },
            { label: '1.6kHz',min: -12, max: 12, value: 0 },
            { label: '2.5kHz',min: -12, max: 12, value: 0 },
            { label: '4KHz',  min: -12, max: 12, value: 0 },
            { label: '6.3KHz',min: -12, max: 12, value: 0 },
            { label: '10KHz', min: -12, max: 12, value: 0 },
            { label: '16kHz', min: -12, max: 12, value: 0 }
        ];
        const micEqContainer = document.getElementById('micEqContainer');

        micEqBands.forEach((band, i) => {
            const el = document.createElement('div');
            el.className = 'mic-eq-band-container';
            el.innerHTML = `
                <input type="range" class="mic-eq-slider" id="micEqSlider${i}" min="${band.min}" max="${band.max}" value="${band.value}" step="1">
                <input type="number" class="mic-eq-value" id="micEqVal${i}" min="${band.min}" max="${band.max}" value="${band.value}" step="1">
                <span class="mic-eq-label">${band.label}</span>
            `;
            micEqContainer.appendChild(el);

            const slider = document.getElementById(`micEqSlider${i}`);
            const input = document.getElementById(`micEqVal${i}`);

            slider.addEventListener('input', () => {
                const v = parseInt(slider.value);
                band.value = v;
                input.value = v;
            });
            slider.addEventListener('change', () => {
                addLog(`[麦克风] EQ ${band.label}: ${band.value}dB`);
            });

            input.addEventListener('input', () => {
                let v = parseInt(input.value);
                if (isNaN(v)) v = 0;
                v = Math.max(-12, Math.min(12, v));
                band.value = v;
                slider.value = v;
                input.value = v;
            });
            input.addEventListener('change', () => {
                addLog(`[麦克风] EQ ${band.label}: ${band.value}dB`);
            });
        });

        // PA 功率控制
        const micPaSlider = document.getElementById('micPaSlider');
        const micPaInput = document.getElementById('micPaInput');
        const micPaVal = document.getElementById('micPaVal');
        function syncMicPa(v) {
            v = Math.max(0, Math.min(64, parseInt(v) || 45));
            micPaSlider.value = v;
            micPaInput.value = v;
            micPaVal.textContent = v;
        }
        micPaSlider.addEventListener('input', () => syncMicPa(micPaSlider.value));
        micPaSlider.addEventListener('change', () => addLog(`[麦克风] PA功率: ${micPaSlider.value}`));
        micPaInput.addEventListener('input', () => syncMicPa(micPaInput.value));
        micPaInput.addEventListener('change', () => addLog(`[麦克风] PA功率: ${micPaInput.value}`));

        // 开机默认音量控制
        const micVolSlider = document.getElementById('micVolSlider');
        const micVolInput = document.getElementById('micVolInput');
        const micVolVal = document.getElementById('micVolVal');
        function syncMicVol(v) {
            v = Math.max(0, Math.min(15, parseInt(v) || 8));
            micVolSlider.value = v;
            micVolInput.value = v;
            micVolVal.textContent = v;
        }
        micVolSlider.addEventListener('input', () => syncMicVol(micVolSlider.value));
        micVolSlider.addEventListener('change', () => addLog(`[麦克风] 开机默认音量: ${micVolSlider.value}`));
        micVolInput.addEventListener('input', () => syncMicVol(micVolInput.value));
        micVolInput.addEventListener('change', () => addLog(`[麦克风] 开机默认音量: ${micVolInput.value}`));

        // ===== 音乐面板 =====
        const musicPrevBtn = document.getElementById('musicPrevBtn');
        const musicPlayBtn = document.getElementById('musicPlayBtn');
        const musicNextBtn = document.getElementById('musicNextBtn');
        const musicMode = document.getElementById('musicMode');
        const musicTempo = document.getElementById('musicTempo');
        const musicTempoVal = document.getElementById('musicTempoVal');
        const musicIntensity = document.getElementById('musicIntensity');
        const musicIntensityVal = document.getElementById('musicIntensityVal');
        const musicSyncLight = document.getElementById('musicSyncLight');
        const musicBeatBtn = document.getElementById('musicBeatBtn');
        const musicStopBtn = document.getElementById('musicStopBtn');
        let musicPlaying = false;

        function setMusicPlaying(playing, actionLabel) {
            musicPlaying = playing;
            musicPlayBtn.innerText = playing ? '⏸ 暂停' : '▶ 播放';
            musicPlayBtn.classList.toggle('primary', !playing);
            addLog(`[音乐] ${actionLabel}，状态: ${playing ? '播放中' : '已暂停'}`);
        }

        musicPlayBtn.addEventListener('click', () => {
            setMusicPlaying(!musicPlaying, musicPlaying ? '暂停' : '播放');
        });

        musicPrevBtn.addEventListener('click', () => {
            addLog('[音乐] 切换到上一首');
        });

        musicNextBtn.addEventListener('click', () => {
            addLog('[音乐] 切换到下一首');
        });

        musicMode.addEventListener('change', function() {
            addLog(`[音乐] 模式切换: ${this.options[this.selectedIndex].text}`);
        });

        musicTempo.addEventListener('input', function() {
            musicTempoVal.innerText = `${this.value}`;
        });
        musicTempo.addEventListener('change', function() {
            addLog(`[音乐] 速度: ${this.value} BPM`);
        });

        musicIntensity.addEventListener('input', function() {
            musicIntensityVal.innerText = `${this.value}%`;
        });
        musicIntensity.addEventListener('change', function() {
            addLog(`[音乐] 节奏强度: ${this.value}%`);
        });

        musicSyncLight.addEventListener('change', function() {
            addLog(`[音乐] 灯效联动: ${this.checked ? '开启' : '关闭'}`);
        });

        musicBeatBtn.addEventListener('click', () => {
            const bpm = parseInt(musicTempo.value, 10);
            const intensity = parseInt(musicIntensity.value, 10);
            addLog(`[音乐] 触发节拍: BPM ${bpm}, 强度 ${intensity}%`);
        });

        musicStopBtn.addEventListener('click', () => {
            setMusicPlaying(false, '停止');
            addLog('[音乐] 已停止并复位到待机状态');
        });

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
        checkBluetoothSupport();
        updateUIState(false);
    }

    init();
})();
