import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import '../styles/utilities.css'

function Home() {
  const [compatible, setCompatible] = useState(true)
  const deviceCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!('serial' in navigator)) {
      setCompatible(false)
    }

    const deviceCard = deviceCardRef.current
    if (!deviceCard) return

    const handleMouseMove = (event: MouseEvent) => {
      const xRatio = ((event.clientX / window.innerWidth) - 0.5) * 2
      const yRatio = ((event.clientY / window.innerHeight) - 0.5) * 2
      const tiltX = yRatio * -1.2
      const tiltY = xRatio * 1.2
      deviceCard.style.transform = `translateY(0) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`
    }

    const handleMouseLeave = () => {
      deviceCard.style.transform = 'translateY(0)'
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div className="page font-sans text-[var(--text-body)] bg-[var(--bg-body)] min-h-screen overflow-x-hidden relative isolate motion-safe:animate-[pageFadeIn_0.65s_cubic-bezier(0.22,1,0.36,1)_both]">
      <main className="w-[min(1120px,calc(100%-48px))] max-sm:w-[min(1120px,calc(100%-28px))] mx-auto">
        <section className="py-[104px] max-sm:pt-[72px] text-center">
          <span className="inline-block mb-[18px] px-3.5 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[10px] text-[var(--text-muted)] text-[13px] tracking-[0.06em]">
            GUANGZHOU ZHIZAO DEVICE CO., LTD.
          </span>
          <h1 className="m-0 text-[clamp(42px,7.2vw,76px)] leading-[1.08] tracking-[-0.032em] font-semibold">
            为专业音频而生的<br />下一代控制界面
          </h1>
          <p className="mt-[18px] mx-auto max-w-[690px] text-[var(--text-muted)] text-[clamp(17px,2.1vw,24px)] leading-[1.5] tracking-[-0.012em]">
            广州智造设备有限公司以极简交互与实时通信能力，打造更精准、更直觉的 EQ 控制体验。
          </p>
          <div className="mt-[34px] max-sm:mt-[26px]">
            <Link
              to="/bluetooth"
              className="appearance-none border-none rounded-full bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] no-underline inline-flex items-center justify-center h-[52px] min-w-[170px] px-7 text-[17px] font-medium tracking-[-0.01em] shadow-[0_6px_14px_rgba(59,130,246,0.23)] transition-all duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_10px_20px_rgba(59,130,246,0.28)] hover:bg-[var(--btn-primary-hover)] active:scale-[0.99] max-sm:w-full"
              id="launchBtn"
              onClick={() => console.log('用户启动了蓝牙控制应用')}
            >
              启动应用（蓝牙）
            </Link>
          </div>
          <div className="mt-[58px] max-sm:mt-9 mx-auto max-w-[820px] p-0.5 rounded-[34px] bg-gradient-to-br from-white/85 to-white/20 shadow-[0_10px_32px_rgba(15,23,42,0.08)]">
            <div
              className="relative rounded-[32px] max-sm:rounded-3xl border border-white/80 bg-gradient-to-br from-white/82 to-white/48 backdrop-blur-3xl p-7 grid grid-cols-[1.15fr_1fr] max-lg:grid-cols-1 gap-[22px] transition-all duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.1)]"
              id="deviceCard"
              ref={deviceCardRef}
            >
              <div className="rounded-3xl max-sm:rounded-3xl p-[22px] bg-gradient-to-br from-[rgba(250,251,255,0.92)] to-[rgba(241,245,250,0.74)] border border-white/85">
                <p className="m-0 text-sm text-[var(--text-muted)] tracking-[0.02em]">
                  实时均衡器 · 10 Band EQ
                </p>
                <div className="mt-5 flex items-end gap-2 h-[132px]" aria-hidden="true">
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '52%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '76%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '40%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '87%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '58%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '72%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '48%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '81%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '61%' }}></span>
                  <span className="flex-1 rounded-full bg-gradient-to-t from-blue-500/20 to-blue-500/80 transition-transform duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height: '69%' }}></span>
                </div>
              </div>
              <div className="grid gap-3.5">
                <div className="h-[46px] rounded-2xl px-4 flex items-center justify-between bg-white/74 border border-white/80 text-[var(--text-muted)] text-[13px]">
                  <span>连接状态</span>
                  <strong className="text-[var(--text-body)] text-sm font-medium">设备在线</strong>
                  <span className="w-[9px] h-[9px] rounded-full bg-green-500 shadow-[0_0_0_6px_rgba(34,197,94,0.14)]" aria-hidden="true"></span>
                </div>
                <div className="h-[46px] rounded-2xl px-4 flex items-center justify-between bg-white/74 border border-white/80 text-[var(--text-muted)] text-[13px]">
                  <span>传输协议</span>
                  <strong className="text-[var(--text-body)] text-sm font-medium">Web Serial</strong>
                </div>
                <div className="h-[46px] rounded-2xl px-4 flex items-center justify-between bg-white/74 border border-white/80 text-[var(--text-muted)] text-[13px]">
                  <span>实时响应</span>
                  <strong className="text-[var(--text-body)] text-sm font-medium">&lt; 20ms</strong>
                </div>
                <div className="h-[46px] rounded-2xl px-4 flex items-center justify-between bg-white/74 border border-white/80 text-[var(--text-muted)] text-[13px]">
                  <span>音频控制</span>
                  <strong className="text-[var(--text-body)] text-sm font-medium">EQ / PA / Gain</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-[52px] max-sm:pt-10" aria-label="功能特性">
          <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-[18px] max-sm:gap-3.5">
            <article className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-[26px_22px] backdrop-blur-[18px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-all duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)] hover:border-white/90">
              <div className="w-[34px] h-[34px] rounded-[10px] border border-black/8 bg-white/75 grid place-items-center text-[#4e5662] text-sm mb-[18px]">EQ</div>
              <h3 className="m-0 text-xl tracking-[-0.015em] font-[550]">精准均衡控制</h3>
              <p className="mt-2.5 mb-0 text-[var(--text-muted)] text-[15px] leading-[1.55]">
                支持 10 频段精细调节，覆盖 ±12dB 范围，兼顾监听与现场扩声需求。
              </p>
            </article>
            <article className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-[26px_22px] backdrop-blur-[18px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-all duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)] hover:border-white/90">
              <div className="w-[34px] h-[34px] rounded-[10px] border border-black/8 bg-white/75 grid place-items-center text-[#4e5662] text-sm mb-[18px]">IO</div>
              <h3 className="m-0 text-xl tracking-[-0.015em] font-[550]">浏览器直连设备</h3>
              <p className="mt-2.5 mb-0 text-[var(--text-muted)] text-[15px] leading-[1.55]">
                基于 Web Serial API，无需额外客户端，在浏览器内完成设备连接与参数同步。
              </p>
            </article>
            <article className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-[26px_22px] backdrop-blur-[18px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-all duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)] hover:border-white/90">
              <div className="w-[34px] h-[34px] rounded-[10px] border border-black/8 bg-white/75 grid place-items-center text-[#4e5662] text-sm mb-[18px]">UI</div>
              <h3 className="m-0 text-xl tracking-[-0.015em] font-[550]">克制的专业界面</h3>
              <p className="mt-2.5 mb-0 text-[var(--text-muted)] text-[15px] leading-[1.55]">
                采用玻璃质感与清晰层级，信息密度适中，长时间操作依旧保持清爽与专注。
              </p>
            </article>
            <article className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-[26px_22px] backdrop-blur-[18px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-all duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)] hover:border-white/90">
              <div className="w-[34px] h-[34px] rounded-[10px] border border-black/8 bg-white/75 grid place-items-center text-[#4e5662] text-sm mb-[18px]">RT</div>
              <h3 className="m-0 text-xl tracking-[-0.015em] font-[550]">实时参数反馈</h3>
              <p className="mt-2.5 mb-0 text-[var(--text-muted)] text-[15px] leading-[1.55]">
                支持功率放大器、音量与核心音频参数联动，快速读取、即时调节、稳定回写。
              </p>
            </article>
          </div>
        </section>

        <section className="py-[34px_0_22px]" aria-label="浏览器兼容提示">
          <div
            className={`rounded-[20px] bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-[16px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] p-5 flex items-start gap-3 transition-all duration-[0.4s] ease-[cubic-bezier(0.22,1,0.36,1)]${!compatible ? ' !bg-[rgba(255,244,244,0.75)] !border-[rgba(255,208,208,0.72)]' : ''}`}
            id="compatibilityCard"
          >
            <span
              className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${!compatible ? '!bg-red-500' : 'bg-[var(--btn-primary-bg)]'}`}
              aria-hidden="true"
            ></span>
            <div>
              <p className="m-0 text-base font-[560] tracking-[-0.01em]" id="compatibilityTitle">
                {compatible ? '浏览器兼容性良好' : '当前浏览器不支持 Web Serial'}
              </p>
              <p className="mt-[7px] mb-0 text-[var(--text-muted)] text-sm leading-[1.5]" id="compatibilityDesc">
                {compatible
                  ? '建议使用 Chrome 89+ 或 Edge 89+ 并在 HTTPS 环境访问，以获得完整串口连接能力。'
                  : '请切换到 Chrome 89+ 或 Edge 89+，并在 HTTPS 环境中访问此页面。'}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="pt-10 pb-[54px] text-center text-[var(--text-muted)] text-xs tracking-[0.01em] leading-[1.8]">
        <div className="w-[min(1120px,calc(100%-48px))] max-sm:w-[min(1120px,calc(100%-28px))] mx-auto">
          <div>© 2026 广州智造设备有限公司. All rights reserved.</div>
          <div>Professional Audio Control Interface · Built with Web Serial API</div>
        </div>
      </footer>
    </div>
  )
}

export default Home
