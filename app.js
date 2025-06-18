// 广州智造音响设备有限公司 - 串口EQ均衡器控制应用
// 版本：1.0.0
// 注释都由AI生成，请甄别错误
// 部分函数由AI生成

// 参数范围定义
const ParamRange = {
    PA: {
        MIN: 0,
        MAX: 64,
        DEFAULT: 45
    },
    VOLUME: {
        MIN: 0,
        MAX: 15,
        DEFAULT: 8
    },
    EQ: {
        MIN: -12,
        MAX: 12,
        DEFAULT: 0
    }
};

// EQ值映射配置 - 控制显示值与实际发送值的对应关系
const EQMapping = {
    // 显示值到实际值的映射
    DISPLAY_TO_ACTUAL: {
        MIN: 0,     // 显示-12dB对应实际发送值0
        MAX: 24,    // 显示+12dB对应实际发送值24
        DEFAULT: 12  // 显示0dB对应实际发送值12
    },

    // 显示值转换为实际值
    displayToActual: function (displayValue) {
        // 将-12到+12映射到0到24
        return Math.round(((displayValue - ParamRange.EQ.MIN) /
            (ParamRange.EQ.MAX - ParamRange.EQ.MIN)) *
            (this.DISPLAY_TO_ACTUAL.MAX - this.DISPLAY_TO_ACTUAL.MIN) +
            this.DISPLAY_TO_ACTUAL.MIN);
    },

    // 实际值转换为显示值
    actualToDisplay: function (actualValue) {
        // 将0到24映射到-12到+12
        return Math.round(((actualValue - this.DISPLAY_TO_ACTUAL.MIN) /
            (this.DISPLAY_TO_ACTUAL.MAX - this.DISPLAY_TO_ACTUAL.MIN)) *
            (ParamRange.EQ.MAX - ParamRange.EQ.MIN) +
            ParamRange.EQ.MIN);
    }
};

// 缓存DOM元素引用
let DOM = {};

// 滑块进度条颜色更新函数 - 全局定义确保任何地方都可调用
function updateSliderBg(slider) {
    if (!slider) return;
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const val = Number(slider.value || 0);
    const percent = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--percent', percent);
}

// 统一更新滑块值和进度条颜色的函数
function updateSliderValue(slider, value, inputElem = null) {
    if (!slider) return;

    // 验证并限制值范围
    let min = Number(slider.min || 0);
    let max = Number(slider.max || 100);
    let val = Number(value);

    if (isNaN(val)) {
        // 获取默认值
        if (slider.id === 'paValue') {
            val = ParamRange.PA.DEFAULT;
        } else if (slider.id === 'defaultVolume') {
            val = ParamRange.VOLUME.DEFAULT;
        } else {
            val = 0; // 通用默认值
        }
    }

    // 限制范围
    val = Math.max(min, Math.min(max, val));

    // 更新滑块
    slider.value = val;

    // 更新输入框（如果提供）
    if (inputElem) {
        inputElem.value = val;
    }

    // 更新滑块颜色
    updateSliderBg(slider);

    return val; // 返回处理后的值
}

let port;
let reader;
let keepReading = true;

// DOM元素
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const receiveArea = document.getElementById('receiveArea');
const statusDiv = document.getElementById('status');
const hexDisplay = document.getElementById('hexDisplay');
const showRawData = document.getElementById('showRawData');
const eqContainer = document.getElementById('eqContainer');
const sendEqBtn = document.getElementById('sendEqBtn');
const resetEqBtn = document.getElementById('resetEqBtn');

// 命令类型枚举
const CommandType = {
    SPLIT_EQ: 0x00,    // 拆分字节EQ
    NORMAL_EQ: 0x01,   // 正常EQ
    PA_SET: 0x02,      // 功率PA设置
    DEFAULT_VOL: 0x03, // 开机默认音量
    READ_ALL: 0x80     // 读取全部信息
};

// 帧头定义
const FrameHeader = {
    HOST: 0xAA,        // 上位机帧头
    CHIP: 0x55         // 芯片帧头
};

// EQ频段配置
const eqBands = [
    { label: "25Hz", freq: 25, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "40Hz", freq: 40, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "63Hz", freq: 63, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "100Hz", freq: 100, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "160Hz", freq: 160, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "250Hz", freq: 250, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "400Hz", freq: 400, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "630Hz", freq: 630, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "1kHz", freq: 1000, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "1.6kHz", freq: 1600, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "2.5kHz", freq: 2500, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "4KHz", freq: 4000, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "6.3KHz", freq: 6300, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "10KHz", freq: 10000, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT },
    { label: "16kHz", freq: 160000, min: ParamRange.EQ.MIN, max: ParamRange.EQ.MAX, value: ParamRange.EQ.DEFAULT }
];

// CRC校验实现
// 采用简单的累加和校验方法
// 计算过程：将所有需要校验的字节累加，取结果的低8位
function calculateCRC(data) {
    let crc = 0x00; // 初始值
    for (let i = 0; i < data.length; i++) {
        crc += data[i];
    }
    return crc & 0xFF; // 取最后一个字节(低8位)
}

// 构建数据帧
// 帧结构：帧头(1字节) + 数据长度(1字节) + 命令(1字节) + 参数(n字节) + CRC(1字节)
function buildFrame(command, params) {
    const frame = new Uint8Array(params.length + 4);
    frame[0] = FrameHeader.HOST;    // 帧头：固定为0xAA
    frame[1] = params.length + 2;   // 数据长度：包含命令和参数的长度（不含帧头和校验）
    frame[2] = command;             // 命令字节
    frame.set(params, 3);           // 参数数据

    // 计算校验值：对帧头、长度、命令和参数进行校验
    frame[frame.length - 1] = calculateCRC(frame.slice(0, -1));

    return frame;
}

// 发送帧函数，添加重试机制 maxRetries重试次数
async function sendFrame(frame, maxRetries = 2) {
    if (!port || !port.writable) {
        throw new Error('串口未连接或不可写');
    }

    let writer = null;
    let retries = 0;

    while (retries <= maxRetries) {
        try {
            writer = port.writable.getWriter();
            await writer.write(frame);
            return; // 发送成功，退出函数
        } catch (error) {
            retries++;
            console.warn(`发送失败，第${retries}次重试`, error);

            if (retries > maxRetries) {
                throw new Error(`发送数据失败(${retries}次尝试后): ${error.message}`);
            }

            // 等待一段时间再重试
            await new Promise(r => setTimeout(r, 200 * retries));
        } finally {
            if (writer) {
                writer.releaseLock();
            }
        }
    }
}

// 添加接收缓冲区
let receiveBuffer = new Uint8Array(0);

// 修改readData函数中的数据处理部分
async function readData() {
    while (port && port.readable && keepReading) {
        try {
            reader = port.readable.getReader();

            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        // 流已关闭
                        console.log('读取完成');
                        break;
                    }

                    // 将接收到的数据添加到缓冲区
                    const newBuffer = new Uint8Array(receiveBuffer.length + value.length);
                    newBuffer.set(receiveBuffer);
                    newBuffer.set(value, receiveBuffer.length);
                    receiveBuffer = newBuffer;

                    // 先显示原始数据（如果开启了显示原始数据选项）
                    if (showRawData.checked) {
                        let displayText;
                        if (hexDisplay.checked) {
                            const now = new Date();
                            const timeStr = now.toLocaleTimeString();
                            displayText = `[${timeStr} 原始数据] `;
                            displayText += Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        } else {
                            displayText = new TextDecoder().decode(value);
                        }
                        receiveArea.value += `${displayText}\n`;
                        receiveArea.scrollTop = receiveArea.scrollHeight;
                    }

                    // 然后尝试处理缓冲区中的数据并显示格式化信息
                    processBuffer();
                }
            } catch (readError) {
                if (keepReading) {
                    console.error('读取数据错误:', readError);
                    statusDiv.textContent = `读取错误: ${readError.message}`;
                }
            } finally {
                // 释放读取锁
                reader.releaseLock();
                reader = null;
            }
        } catch (streamError) {
            if (keepReading) {
                console.error('获取读取流错误:', streamError);
                statusDiv.textContent = `流错误: ${streamError.message}`;
                await new Promise(r => setTimeout(r, 1000)); // 避免CPU高负载循环
            }
        }
    }
    console.log('读取循环已终止');
}

// 改进的处理缓冲区函数
function processBuffer() {
    // 在控制台记录当前缓冲区状态（调试用）
    console.log("当前缓冲区:", Array.from(receiveBuffer).map(b =>
        b.toString(16).padStart(2, '0')).join(' '));

    // 至少需要4个字节才能形成最小帧
    while (receiveBuffer.length >= 4) {
        // 寻找有效的帧头
        let frameHeaderIndex = -1;
        for (let i = 0; i < receiveBuffer.length; i++) {
            if (receiveBuffer[i] === FrameHeader.CHIP ||
                receiveBuffer[i] === FrameHeader.HOST) {
                frameHeaderIndex = i;
                break;
            }
        }

        // 没有找到帧头，清空缓冲区
        if (frameHeaderIndex === -1) {
            console.log("未找到有效帧头，清空缓冲区");
            receiveBuffer = new Uint8Array(0);
            break;
        }

        // 如果帧头不在开始位置，丢弃帧头之前的数据
        if (frameHeaderIndex > 0) {
            console.log(`丢弃帧头前的数据: ${frameHeaderIndex}字节`);
            receiveBuffer = receiveBuffer.slice(frameHeaderIndex);
        }

        // 确保至少有帧头和长度字段
        if (receiveBuffer.length < 2) {
            console.log("数据不足，等待更多数据");
            break;
        }

        // 获取数据长度
        const dataLength = receiveBuffer[1];

        // 长度字段检查 - 避免异常大小的帧导致内存问题
        if (dataLength > 100) { // 假设最大帧长度为100字节
            console.log(`异常的数据长度: ${dataLength}，丢弃帧头`);
            receiveBuffer = receiveBuffer.slice(1);
            continue;
        }

        // 检查是否有足够的字节形成完整帧
        const expectedFrameLength = dataLength + 3; // 帧头(1) + 长度字段(1) + 数据(dataLength) + CRC(1)
        if (receiveBuffer.length < expectedFrameLength) {
            console.log(`数据不足，需要${expectedFrameLength}字节，当前有${receiveBuffer.length}字节`);
            break; // 等待更多数据
        }

        // 提取完整帧
        const frameData = receiveBuffer.slice(0, expectedFrameLength);

        // 记录日志（调试用）
        console.log("尝试解析的帧数据:", Array.from(frameData).map(b =>
            b.toString(16).padStart(2, '0')).join(' '));

        // 尝试解析帧
        const frame = parseReceivedFrame(frameData);
        if (frame) {
            try {
                console.log("成功解析帧:", frame.command);
                // 成功解析，处理帧数据
                handleReceivedFrame(frame);
                // 打印数据帧详细信息
                printDataFrame(frameData, true);
            } catch (frameError) {
                console.error('处理数据帧错误:', frameError);
            }
        } else {
            console.log('帧解析失败，跳过一字节继续尝试');
            // 帧解析失败，可能是数据格式错误，尝试跳过一个字节重新定位
            receiveBuffer = receiveBuffer.slice(1);
            continue;
        }

        // 移除已处理的帧数据
        receiveBuffer = receiveBuffer.slice(expectedFrameLength);
    }
}

// 解析接收到的数据帧
function parseReceivedFrame(data) {
    if (data.length < 4) {
        console.log("数据太短，无法形成有效帧");
        return null;
    }

    const frameHeader = data[0];     // 帧头
    const dataLength = data[1];      // 数据长度
    const command = data[2];         // 命令字节

    // 记录详细信息（调试用）
    console.log(`尝试解析帧: 帧头:0x${frameHeader.toString(16)}, 长度:${dataLength}, 命令:0x${command.toString(16)}`);

    // 验证帧头
    if (frameHeader !== FrameHeader.CHIP && frameHeader !== FrameHeader.HOST) {
        console.error(`无效的帧头: 0x${frameHeader.toString(16)}`);
        return null;
    }

    // 验证数据长度
    if (data.length !== dataLength + 3) {
        console.error(`数据长度不匹配: 帧长度${data.length}, 预期长度${dataLength + 3}`);
        return null;
    }

    // 验证CRC校验
    const receivedCRC = data[data.length - 1];
    const calculatedCRC = calculateCRC(data.slice(0, -1));

    if (receivedCRC !== calculatedCRC) {
        console.error(`CRC校验失败: 接收值:0x${receivedCRC.toString(16)}, 计算值:0x${calculatedCRC.toString(16)}`);
        console.log(`CRC计算数据: ${Array.from(data.slice(0, -1)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        return null;
    }

    // 提取参数
    const params = data.slice(3, -1);
    console.log(`成功解析帧，参数: ${Array.from(params).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    return {
        command,
        params,
        dataLength
    };
}

// 初始化状态
statusDiv.textContent = '未连接';
statusDiv.style.backgroundColor = '#ecf0f1';

// 构建EQ数据帧 - 修改为使用映射值
function buildEQFrame(eqDisplayValues) {
    // 确保有15个频点值，且都是正确映射的实际值
    if (eqDisplayValues.length !== 15) {
        console.warn(`EQ值数量不正确：预期15个，实际${eqDisplayValues.length}个`);
        // 如果不足15个，补充默认值
        if (eqDisplayValues.length < 15) {
            const paddedValues = new Array(15).fill(EQMapping.DISPLAY_TO_ACTUAL.DEFAULT);
            eqDisplayValues.forEach((val, index) => {
                if (index < 15) paddedValues[index] = EQMapping.displayToActual(val); // 转换为实际值
            });
            eqDisplayValues = paddedValues;
        } else {
            // 如果超过15个，截取前15个并转换
            eqDisplayValues = eqDisplayValues.slice(0, 15).map(val => EQMapping.displayToActual(val));
        }
    } else {
        // 确保所有值都转换为实际发送值
        eqDisplayValues = eqDisplayValues.map(val => EQMapping.displayToActual(val));
    }

    const params = new Uint8Array(eqDisplayValues);
    console.log(`发送EQ数据(映射后): [${Array.from(params)}]`);
    return buildFrame(CommandType.NORMAL_EQ, params);
}

// 构建PA设置数据帧
function buildPAFrame(value) {
    // 验证参数范围
    if (isNaN(value) || value < ParamRange.PA.MIN || value > ParamRange.PA.MAX) {
        console.error(`功率PA值无效: ${value}，应在${ParamRange.PA.MIN}-${ParamRange.PA.MAX}范围内`);
        value = Math.max(ParamRange.PA.MIN, Math.min(ParamRange.PA.MAX, isNaN(value) ? ParamRange.PA.DEFAULT : value));
    }

    // 确保是整数
    value = Math.round(value);

    console.log(`发送功率PA设置: ${value}`);
    const params = new Uint8Array([value]);
    return buildFrame(CommandType.PA_SET, params);
}

// 构建开机默认音量数据帧
function buildDefaultVolumeFrame(value) {
    // 验证参数范围
    if (isNaN(value) || value < ParamRange.VOLUME.MIN || value > ParamRange.VOLUME.MAX) {
        console.error(`默认音量值无效: ${value}，应在${ParamRange.VOLUME.MIN}-${ParamRange.VOLUME.MAX}范围内`);
        value = Math.max(ParamRange.VOLUME.MIN, Math.min(ParamRange.VOLUME.MAX, isNaN(value) ? ParamRange.VOLUME.DEFAULT : value));
    }

    // 确保是整数
    value = Math.round(value);

    console.log(`发送开机默认音量设置: ${value}`);
    const params = new Uint8Array([value]);
    return buildFrame(CommandType.DEFAULT_VOL, params);
}

// 构建读取全部信息数据帧
function buildReadAllFrame() {
    return buildFrame(CommandType.READ_ALL, new Uint8Array(0));
}

// 处理接收到的数据帧
function handleReceivedFrame(frame) {
    console.log(`处理帧: 命令: 0x${frame.command.toString(16)}, 参数长度: ${frame.params.length}`);

    switch (frame.command) {
        case CommandType.READ_ALL:
            console.log("处理READ_ALL命令响应");
            if (frame.params.length < 17) { // 需要至少PA(1) + 默认音量(1) + 15个EQ值
                console.error(`READ_ALL参数不足: 需要17个，实际${frame.params.length}个`);
                return;
            }

            const pa = frame.params[0];
            const defaultVol = frame.params[1];
            // 将接收到的实际EQ值转换回显示值
            const eqActualValues = frame.params.slice(2, 17); // 获取15个EQ原始值
            const eqDisplayValues = Array.from(eqActualValues).map(val =>
                EQMapping.actualToDisplay(val));

            console.log(`接收到设置: PA=${pa}, 默认音量=${defaultVol}, EQ值(映射前)=[${Array.from(eqActualValues)}], EQ值(映射后)=[${eqDisplayValues}]`);

            // 检查参数是否合法
            if (pa > 100 || defaultVol > 100) {
                console.warn(`接收到的参数可能不合法: PA=${pa}, 默认音量=${defaultVol}`);
            }

            // 直接更新UI - 让updateUIWithReceivedData处理所有更新
            updateUIWithReceivedData(pa, defaultVol, eqDisplayValues);
            break;

        case CommandType.NORMAL_EQ:
            console.log("处理NORMAL_EQ命令响应");
            break;

        case CommandType.PA_SET:
            console.log("处理PA_SET命令响应");
            if (frame.params.length < 1) {
                console.error("PA_SET参数不足");
                return;
            }

            const paVal = frame.params[0];
            console.log(`接收到功率PA设置确认: PA=${paVal}`);

            // 检查参数是否合法
            if (paVal > 100) {
                console.warn(`接收到的PA值可能不合法: ${paVal}`);
            }

            // 更新UI
            updateSliderValue(DOM.paValue, paVal, DOM.paValueInput);

            // 显示成功消息
            statusDiv.textContent = `功率PA设置成功: ${paVal}`;
            statusDiv.style.backgroundColor = '#2ecc71';
            setTimeout(() => {
                statusDiv.textContent = '已连接';
                statusDiv.style.backgroundColor = '#2ecc71';
            }, 2000);
            break;

        case CommandType.DEFAULT_VOL:
            console.log("处理DEFAULT_VOL命令响应");
            if (frame.params.length < 1) {
                console.error("DEFAULT_VOL参数不足");
                return;
            }

            const volValue = frame.params[0];
            console.log(`接收到开机默认音量设置确认: 音量=${volValue}`);

            // 检查参数是否合法
            if (volValue > 100) {
                console.warn(`接收到的音量值可能不合法: ${volValue}`);
            }

            // 更新UI
            updateSliderValue(DOM.defaultVolume, volValue, DOM.defaultVolumeInput);

            // 显示成功消息
            statusDiv.textContent = `默认音量设置成功: ${volValue}`;
            statusDiv.style.backgroundColor = '#2ecc71';
            setTimeout(() => {
                statusDiv.textContent = '已连接';
                statusDiv.style.backgroundColor = '#2ecc71';
            }, 2000);
            break;

        default:
            console.log(`未知命令类型: 0x${frame.command.toString(16)}`);
            break;
    }
}

// 更新UI显示 - 参数eqValues现在是已转换为显示值的值
function updateUIWithReceivedData(pa, defaultVol, eqDisplayValues) {
    // 更新PA和音量值
    updateSliderValue(DOM.paValue, pa, DOM.paValueInput);
    updateSliderValue(DOM.defaultVolume, defaultVol, DOM.defaultVolumeInput);

    // 更新EQ值显示，确保使用整数并在显示范围内
    eqDisplayValues.forEach((value, index) => {
        // 将值转换为整数并限制在显示范围内
        const intValue = Math.max(ParamRange.EQ.MIN,
            Math.min(ParamRange.EQ.MAX,
                Math.round(value)));

        const slider = document.getElementById(`eqSlider${index}`);
        const valueInput = document.getElementById(`eqValue${index}`);
        if (slider && valueInput) {
            slider.value = intValue;
            valueInput.value = intValue;
            // 同时更新内存中的数据模型
            if (index < eqBands.length) {
                eqBands[index].value = intValue;
            }
            // 更新EQ滑块颜色
            updateSliderBg(slider);
        }
    });
}

// 统一的滑块和输入框事件处理
function setupSliderPair(slider, inputElem, paramRange) {
    if (!slider || !inputElem) return;

    // 滑块值变化
    slider.addEventListener('input', () => {
        updateSliderValue(slider, slider.value, inputElem);
    });

    // 输入框值变化
    inputElem.addEventListener('input', () => {
        updateSliderValue(slider, inputElem.value, inputElem);
    });

    // 初始化
    slider.min = paramRange.MIN;
    slider.max = paramRange.MAX;
    slider.step = "1";
    slider.value = paramRange.DEFAULT;

    inputElem.min = paramRange.MIN;
    inputElem.max = paramRange.MAX;
    inputElem.step = "1";
    inputElem.value = paramRange.DEFAULT;

    // 初始化滑块颜色
    updateSliderBg(slider);
}

// 初始化EQ界面
function initEqBands() {
    eqBands.forEach((band, index) => {
        const bandContainer = document.createElement('div');
        bandContainer.className = 'eq-band-container';

        bandContainer.innerHTML = `
            <div class="eq-band">
                <input type="range" id="eqSlider${index}" min="${ParamRange.EQ.MIN}" max="${ParamRange.EQ.MAX}" 
                       step="1" value="${ParamRange.EQ.DEFAULT}" class="eq-slider">
                <input type="number" id="eqValue${index}" min="${ParamRange.EQ.MIN}" max="${ParamRange.EQ.MAX}" 
                       step="1" value="${ParamRange.EQ.DEFAULT}" class="eq-value">
                <div class="eq-label">${band.label}</div>
            </div>
        `;

        eqContainer.appendChild(bandContainer);

        // 绑定事件
        const slider = document.getElementById(`eqSlider${index}`);
        const valueInput = document.getElementById(`eqValue${index}`);

        slider.addEventListener('input', () => {
            let val = parseInt(slider.value);
            if (isNaN(val)) val = ParamRange.EQ.DEFAULT;
            if (val < ParamRange.EQ.MIN) val = ParamRange.EQ.MIN;
            if (val > ParamRange.EQ.MAX) val = ParamRange.EQ.MAX;

            band.value = val;
            valueInput.value = val;
            updateSliderBg(slider); // 更新EQ滑块颜色
        });

        valueInput.addEventListener('input', () => {
            let val = parseInt(valueInput.value);
            if (isNaN(val)) val = ParamRange.EQ.DEFAULT;
            if (val < ParamRange.EQ.MIN) val = ParamRange.EQ.MIN;
            if (val > ParamRange.EQ.MAX) val = ParamRange.EQ.MAX;

            band.value = val;
            slider.value = val;
            valueInput.value = val;
            updateSliderBg(slider); // 更新EQ滑块颜色
        });
    });
}

//  设置EQ预设 - 所有值都是整数
function setEqPreset(preset) {
    switch (preset) {
        case 'flat':
            eqBands.forEach(band => band.value = ParamRange.EQ.DEFAULT);
            break;
    }

    // 更新UI
    eqBands.forEach((band, index) => {
        const slider = document.getElementById(`eqSlider${index}`);
        const valueInput = document.getElementById(`eqValue${index}`);
        if (slider && valueInput) {
            slider.value = band.value;
            valueInput.value = band.value;
        }
    });
}

// 打印数据帧详细信息
function printDataFrame(frame, isReceived = false) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    let frameInfo = `\n=== 格式化数据帧信息 ===\n[${timeStr}] ${isReceived ? '接收' : '发送'}数据帧:\n`;

    // 帧头
    frameInfo += `帧头: 0x${frame[0].toString(16).padStart(2, '0')}\n`;

    // 数据长度
    frameInfo += `数据长度: ${frame[1]} 字节\n`;

    // 命令
    const commandName = Object.entries(CommandType).find(([_, value]) => value === frame[2])?.[0] || '未知命令';
    frameInfo += `命令: 0x${frame[2].toString(16).padStart(2, '0')} (${commandName})\n`;

    // 参数
    frameInfo += `参数: ${Array.from(frame.slice(3, -1)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}\n`;

    // CRC
    frameInfo += `CRC: 0x${frame[frame.length - 1].toString(16).padStart(2, '0')}\n`;

    // 原始数据
    frameInfo += `完整数据帧: ${Array.from(frame).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}\n`;
    frameInfo += '=========================\n';

    receiveArea.value += frameInfo;
    receiveArea.scrollTop = receiveArea.scrollHeight;
}

// 初始化应用
function initializeApp() {
    // 添加波特率选择框和自定义输入框的DOM元素
    const baudRateSelect = document.getElementById('baudRate');
    const customBaudRateInput = document.getElementById('customBaudRate');

    // 监听波特率选择变化
    baudRateSelect.addEventListener('change', () => {
        if (baudRateSelect.value === 'custom') {
            customBaudRateInput.style.display = 'block';
            customBaudRateInput.focus();
        } else {
            customBaudRateInput.style.display = 'none';
        }
    });

    // 添加新的DOM元素
    const paValue = document.getElementById('paValue');
    const paValueInput = document.getElementById('paValueInput');
    const sendPaBtn = document.getElementById('sendPaBtn');
    const defaultVolume = document.getElementById('defaultVolume');
    const defaultVolumeInput = document.getElementById('defaultVolumeInput');
    const sendVolumeBtn = document.getElementById('sendVolumeBtn');
    const readAllBtn = document.getElementById('readAllBtn');
    const clearReceiveBtn = document.getElementById('clearReceiveBtn');

    // 添加清空接收区按钮的事件处理
    clearReceiveBtn.addEventListener('click', () => {
        receiveArea.value = '';
        console.log('接收区已清空');
    });

    // 修改连接串口的事件处理
    connectBtn.addEventListener('click', async () => {
        try {
            // 更新状态
            statusDiv.textContent = '正在连接...';
            statusDiv.style.backgroundColor = '#f39c12';
            connectBtn.disabled = true;

            try {
                // 请求串口权限
                port = await navigator.serial.requestPort({
                    // 可选：指定支持的USB设备ID
                    // filters: [
                    //     { usbVendorId: 0x2341, usbProductId: 0x0043 } // 示例：Arduino Uno
                    // ]
                });
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    throw new Error('未选择串口设备');
                } else if (error.name === 'SecurityError') {
                    throw new Error('串口访问被拒绝，请检查浏览器权限设置');
                } else {
                    throw new Error(`请求串口失败: ${error.message}`);
                }
            }

            // 获取并验证波特率
            let baudRate;
            try {
                if (baudRateSelect.value === 'custom') {
                    baudRate = parseInt(customBaudRateInput.value);
                    if (isNaN(baudRate) || baudRate < 1200 || baudRate > 4000000) {
                        throw new Error('请输入有效的波特率（1200-4000000）');
                    }
                } else {
                    baudRate = parseInt(baudRateSelect.value);
                }
            } catch (error) {
                throw new Error(`波特率设置错误: ${error.message}`);
            }

            try {
                // 配置并打开串口
                await port.open({
                    baudRate,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none',
                    bufferSize: 255,
                    flowControl: 'none'
                });
            } catch (error) {
                if (error.name === 'NetworkError') {
                    throw new Error('串口被其他程序占用，请关闭其他程序后重试');
                } else if (error.name === 'InvalidStateError') {
                    throw new Error('串口已打开，请先断开连接');
                } else {
                    throw new Error(`打开串口失败: ${error.message}`);
                }
            }

            // 连接成功，更新UI
            let deviceInfo = '未知设备';
            try {
                const info = port.getInfo ? port.getInfo() : null;
                if (info && info.usbProductId) {
                    deviceInfo = `${info.usbVendorId.toString(16)}:${info.usbProductId.toString(16)}`;
                }
            } catch (e) {
                console.warn('获取设备信息失败:', e);
            }

            statusDiv.textContent = `已连接: ${deviceInfo} (${baudRate}bps)`;
            statusDiv.style.backgroundColor = '#2ecc71';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            sendEqBtn.disabled = false;
            sendPaBtn.disabled = false;
            sendVolumeBtn.disabled = false;
            readAllBtn.disabled = false;
            baudRateSelect.disabled = true;
            if (baudRateSelect.value === 'custom') {
                customBaudRateInput.disabled = false;
            }

            // 开始读取数据
            keepReading = true;
            readData();

            // 连接后自动读取设备信息
            try {
                setTimeout(async () => {
                    if (port && port.writable) {
                        const frame = buildReadAllFrame();
                        await sendFrame(frame);
                        printDataFrame(frame, false);
                    }
                }, 500);
            } catch (e) {
                console.warn('自动读取设备信息失败:', e);
            }
        } catch (error) {
            // 处理所有连接过程中的错误
            console.error('串口连接错误:', error);
            statusDiv.textContent = `连接错误: ${error.message}`;
            statusDiv.style.backgroundColor = '#e74c3c';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;

            // 清理资源
            if (port) {
                try {
                    await port.close();
                } catch (e) {
                    console.error('关闭串口失败:', e);
                }
                port = null;
            }
        }
    });

    // 修改断开连接的事件处理
    disconnectBtn.addEventListener('click', async () => {
        try {
            // 更新状态
            statusDiv.textContent = '正在断开...';
            statusDiv.style.backgroundColor = '#f39c12';
            disconnectBtn.disabled = true;

            // 停止读取循环
            keepReading = false;

            // 取消读取操作
            if (reader) {
                try {
                    await reader.cancel();
                } catch (error) {
                    console.warn('取消读取失败:', error);
                } finally {
                    reader = null;
                }
            }

            // 关闭串口
            if (port) {
                try {
                    await port.close();
                } catch (error) {
                    console.warn('关闭串口失败:', error);
                } finally {
                    port = null;
                }
            }

            // 更新UI状态
            statusDiv.textContent = '已断开连接';
            statusDiv.style.backgroundColor = '#ecf0f1';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            sendEqBtn.disabled = true;
            sendPaBtn.disabled = true;
            sendVolumeBtn.disabled = true;
            readAllBtn.disabled = true;
            baudRateSelect.disabled = false;
            if (baudRateSelect.value === 'custom') {
                customBaudRateInput.disabled = false;
            }
        } catch (error) {
            // 处理断开过程中的错误
            console.error('断开连接错误:', error);
            statusDiv.textContent = `断开连接错误: ${error.message}`;
            statusDiv.style.backgroundColor = '#e74c3c';
            disconnectBtn.disabled = false;
        }
    });

    // 修改sendEqBtn点击事件处理
    sendEqBtn.addEventListener('click', async () => {
        if (!port || !port.writable) {
            statusDiv.textContent = '端口不可写';
            return;
        }

        try {
            // 获取显示值，构建帧时会自动转换为实际值
            const eqDisplayValues = eqBands.map(band => band.value);
            console.log(`发送EQ数据(显示值): [${eqDisplayValues}]`);
            const frame = buildEQFrame(eqDisplayValues);
            await sendFrame(frame);

            // 打印数据帧详细信息
            printDataFrame(frame, false);
        } catch (error) {
            statusDiv.textContent = `发送错误: ${error.message}`;
        }
    });

    // 重置EQ设置
    resetEqBtn.addEventListener('click', () => {
        // 重置EQ设置setEqPreset 
        setEqPreset('flat');

        // 重置PA值到默认值
        updateSliderValue(DOM.paValue, ParamRange.PA.DEFAULT, DOM.paValueInput);

        // 重置音量值到默认值
        updateSliderValue(DOM.defaultVolume, ParamRange.VOLUME.DEFAULT, DOM.defaultVolumeInput);

        // 显示重置信息
        statusDiv.textContent = '已重置所有参数到默认值';
        statusDiv.style.backgroundColor = '#2ecc71';
        setTimeout(() => {
            if (port) {
                statusDiv.textContent = '已连接';
                statusDiv.style.backgroundColor = '#2ecc71';
            } else {
                statusDiv.textContent = '未连接';
                statusDiv.style.backgroundColor = '#ecf0f1';
            }
        }, 2000);
    });

    // 绑定PA控制事件
    paValue.addEventListener('input', () => {
        let val = parseInt(paValue.value);
        if (isNaN(val)) val = ParamRange.PA.DEFAULT;
        if (val < ParamRange.PA.MIN) val = ParamRange.PA.MIN;
        if (val > ParamRange.PA.MAX) val = ParamRange.PA.MAX;

        paValueInput.value = val;
        updateSliderBg(paValue); // 确保滑块颜色更新
    });

    paValueInput.addEventListener('input', () => {
        let val = parseInt(paValueInput.value);
        if (isNaN(val)) val = ParamRange.PA.DEFAULT;
        if (val < ParamRange.PA.MIN) val = ParamRange.PA.MIN;
        if (val > ParamRange.PA.MAX) val = ParamRange.PA.MAX;

        paValue.value = val;
        paValueInput.value = val;
        updateSliderBg(paValue); // 确保滑块颜色更新
    });

    // 绑定默认音量控制事件
    defaultVolume.addEventListener('input', () => {
        let val = parseInt(defaultVolume.value);
        if (isNaN(val)) val = ParamRange.VOLUME.DEFAULT;
        if (val < ParamRange.VOLUME.MIN) val = ParamRange.VOLUME.MIN;
        if (val > ParamRange.VOLUME.MAX) val = ParamRange.VOLUME.MAX;

        defaultVolumeInput.value = val;
        updateSliderBg(defaultVolume); // 确保滑块颜色更新
    });

    defaultVolumeInput.addEventListener('input', () => {
        let val = parseInt(defaultVolumeInput.value);
        if (isNaN(val)) val = ParamRange.VOLUME.DEFAULT;
        if (val < ParamRange.VOLUME.MIN) val = ParamRange.VOLUME.MIN;
        if (val > ParamRange.VOLUME.MAX) val = ParamRange.VOLUME.MAX;

        defaultVolume.value = val;
        defaultVolumeInput.value = val;
        updateSliderBg(defaultVolume); // 确保滑块颜色更新
    });

    // 发送PA设置
    sendPaBtn.addEventListener('click', async () => {
        if (!port || !port.writable) {
            statusDiv.textContent = '端口不可写';
            statusDiv.style.backgroundColor = '#e74c3c';
            return;
        }

        try {
            // 获取并验证值
            let value = parseInt(paValue.value);
            if (isNaN(value) || value < ParamRange.PA.MIN || value > ParamRange.PA.MAX) {
                console.warn(`无效的PA值: ${paValue.value}，将使用默认值${ParamRange.PA.DEFAULT}`);
                value = ParamRange.PA.DEFAULT;
                paValue.value = value;
                paValueInput.value = value;
            }

            // 更新状态
            statusDiv.textContent = `正在发送功率PA设置: ${value}...`;
            statusDiv.style.backgroundColor = '#f39c12';

            // 构建并发送数据帧
            const frame = buildPAFrame(value);
            await sendFrame(frame);

            // 打印数据帧详细信息
            printDataFrame(frame, false);

            // 更新状态
            statusDiv.textContent = `功率PA设置已发送: ${value}`;
            statusDiv.style.backgroundColor = '#2ecc71';
        } catch (error) {
            console.error('发送PA设置错误:', error);
            statusDiv.textContent = `发送错误: ${error.message}`;
            statusDiv.style.backgroundColor = '#e74c3c';
        }
    });

    // 发送默认音量设置
    sendVolumeBtn.addEventListener('click', async () => {
        if (!port || !port.writable) {
            statusDiv.textContent = '端口不可写';
            statusDiv.style.backgroundColor = '#e74c3c';
            return;
        }

        try {
            // 获取并验证值
            let value = parseInt(defaultVolume.value);
            if (isNaN(value) || value < ParamRange.VOLUME.MIN || value > ParamRange.VOLUME.MAX) {
                console.warn(`无效的音量值: ${defaultVolume.value}，将使用默认值${ParamRange.VOLUME.DEFAULT}`);
                value = ParamRange.VOLUME.DEFAULT;
                defaultVolume.value = value;
                defaultVolumeInput.value = value;
            }

            // 更新状态
            statusDiv.textContent = `正在发送开机默认音量设置: ${value}...`;
            statusDiv.style.backgroundColor = '#f39c12';

            // 构建并发送数据帧
            const frame = buildDefaultVolumeFrame(value);
            await sendFrame(frame);

            // 打印数据帧详细信息
            printDataFrame(frame, false);

            // 更新状态
            statusDiv.textContent = `开机默认音量设置已发送: ${value}`;
            statusDiv.style.backgroundColor = '#2ecc71';
        } catch (error) {
            console.error('发送默认音量设置错误:', error);
            statusDiv.textContent = `发送错误: ${error.message}`;
            statusDiv.style.backgroundColor = '#e74c3c';
        }
    });

    // 读取全部信息
    readAllBtn.addEventListener('click', async () => {
        if (!port || !port.writable) {
            statusDiv.textContent = '端口不可写';
            return;
        }

        try {
            const frame = buildReadAllFrame();
            await sendFrame(frame);
            printDataFrame(frame, false);
        } catch (error) {
            statusDiv.textContent = `发送错误: ${error.message}`;
        }
    });

    // 初始化EQ界面
    initEqBands();
}

// DOMContentLoaded事件处理
document.addEventListener('DOMContentLoaded', function () {
    // 缓存常用DOM元素引用
    DOM.paValue = document.getElementById('paValue');
    DOM.paValueInput = document.getElementById('paValueInput');
    DOM.defaultVolume = document.getElementById('defaultVolume');
    DOM.defaultVolumeInput = document.getElementById('defaultVolumeInput');
    DOM.statusDiv = document.getElementById('status');

    // 统一设置PA和音量滑块
    setupSliderPair(DOM.paValue, DOM.paValueInput, ParamRange.PA);
    setupSliderPair(DOM.defaultVolume, DOM.defaultVolumeInput, ParamRange.VOLUME);

    // 初始化EQ滑块颜色
    for (let i = 0; i < eqBands.length; i++) {
        updateSliderBg(document.getElementById(`eqSlider${i}`));
    }

    // 初始化应用
    initializeApp();
});