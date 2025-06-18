# 广州智造音响设备有限公司 - 串口EQ均衡器

一个基于Web Serial API的音响设备均衡器控制界面，支持串口通信和实时EQ调节。

## 功能特性

- 🎛️ **10频段均衡器控制** - 支持±12dB调节范围
- 🔌 **Web Serial API** - 直接在浏览器中进行串口通信
- 📱 **响应式设计** - 支持桌面端和移动端
- 🎵 **预设音效** - 内置多种音效预设（摇滚、流行、古典等）
- ⚡ **功率PA控制** - 0-64级功率调节
- 🔊 **音量控制** - 开机默认音量设置
- 📊 **实时数据监控** - 串口数据收发显示

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **通信**: Web Serial API
- **部署**: Vercel静态托管
- **兼容性**: Chrome 89+, Edge 89+

## 本地开发

### 环境要求

- 现代浏览器（支持Web Serial API）
- Python 3.x（可选，用于本地服务器）

### 启动项目

```bash
# 克隆项目
git clone <repository-url>
cd hanami-web-serialport

# 方式1: 使用Python启动本地服务器
python -m http.server 3000

# 方式2: 直接打开HTML文件
# 在浏览器中打开 verticalslider-card-v1.0.0.html
```

访问 `http://localhost:3000` 查看应用。

## Vercel部署

### 自动部署（推荐）

1. **连接GitHub**
   - 将代码推送到GitHub仓库
   - 在[Vercel](https://vercel.com)中导入GitHub项目
   - Vercel会自动检测配置并部署

2. **配置说明**
   - `vercel.json` - Vercel部署配置
   - `package.json` - 项目元信息
   - 默认路由指向主应用文件

### 手动部署

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录Vercel
vercel login

# 部署项目
vercel

# 生产环境部署
vercel --prod
```

### 环境变量

无需配置环境变量，这是一个纯前端静态应用。

## 使用说明

### 串口连接

1. 点击"连接串口"按钮
2. 选择对应的串口设备
3. 配置波特率（默认115200）
4. 连接成功后可进行设备通信

### EQ调节

1. 使用垂直滑块调节各频段增益
2. 范围：-12dB 到 +12dB
3. 支持预设音效快速切换
4. 点击"发送EQ设置"应用到设备

### 功率和音量控制

- **功率PA**: 0-64级调节
- **默认音量**: 0-15级设置
- **读取全部**: 获取设备当前所有参数

## 通信协议

| 命令 | 功能 | 数据格式 |
|------|------|----------|
| 0x01 | EQ设置 | 10字节频段数据 |
| 0x02 | 功率PA | 1字节功率值 |
| 0x03 | 默认音量 | 1字节音量值 |
| 0x80 | 读取全部 | 无数据 |

## 浏览器兼容性

- ✅ Chrome 89+
- ✅ Edge 89+
- ❌ Firefox（不支持Web Serial API）
- ❌ Safari（不支持Web Serial API）

## 项目结构

```
├── verticalslider-card-v1.0.0.html  # 主应用文件
├── Html/                            # 其他HTML文件
├── vercel.json                      # Vercel配置
├── package.json                     # 项目配置
├── README.md                        # 项目说明
└── .vscode/                         # VS Code配置
```

## 开发注意事项

1. **HTTPS要求**: Web Serial API需要HTTPS环境
2. **用户手势**: 串口连接需要用户主动触发
3. **权限管理**: 浏览器会请求串口访问权限
4. **错误处理**: 包含完整的串口异常处理

## 许可证

MIT License

## 联系方式

广州智造音响设备有限公司
- 网站: [公司官网]
- 邮箱: [联系邮箱]
- 电话: [联系电话]

---

*本项目为广州智造音响设备有限公司内部开发工具*