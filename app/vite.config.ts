import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    obfuscator({
      // 只对生产构建生效
      apply: 'build',
      options: {
        compact: true,
        // 控制流扁平化 — 打乱代码执行路径
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        // 注入死代码 — 增加无用逻辑干扰阅读
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.3,
        // 字符串数组化 — 把字符串提取到数组里
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.5,
        // 移除 console
        disableConsoleOutput: true,
        // 标识符混淆
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        // 不混淆 Web Serial / Bluetooth API
        reservedStrings: [
          'navigator.serial',
          'navigator.bluetooth',
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
})
