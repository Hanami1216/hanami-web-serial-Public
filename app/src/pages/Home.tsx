import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import '../styles/landing.css'

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
    <div className="page">
      <main className="container">
        <section className="hero">
          <span className="hero-eyebrow">GUANGZHOU ZHIZAO DEVICE CO., LTD.</span>
          <h1>为专业音频而生的<br />下一代控制界面</h1>
          <p>广州智造设备有限公司以极简交互与实时通信能力，打造更精准、更直觉的 EQ 控制体验。</p>
          <div className="hero-actions">
            <Link
              to="/bluetooth"
              className="btn-primary"
              id="launchBtn"
              onClick={() => console.log('用户启动了蓝牙控制应用')}
            >
              启动应用（蓝牙）
            </Link>
          </div>
          <div className="device-wrap">
            <div className="device-card" id="deviceCard" ref={deviceCardRef}>
              <div className="device-screen">
                <p className="screen-title">实时均衡器 · 10 Band EQ</p>
                <div className="eq-bars" aria-hidden="true">
                  <span style={{ height: '52%' }}></span>
                  <span style={{ height: '76%' }}></span>
                  <span style={{ height: '40%' }}></span>
                  <span style={{ height: '87%' }}></span>
                  <span style={{ height: '58%' }}></span>
                  <span style={{ height: '72%' }}></span>
                  <span style={{ height: '48%' }}></span>
                  <span style={{ height: '81%' }}></span>
                  <span style={{ height: '61%' }}></span>
                  <span style={{ height: '69%' }}></span>
                </div>
              </div>
              <div className="device-side">
                <div className="status-chip">
                  <span>连接状态</span>
                  <strong>设备在线</strong>
                  <span className="dot" aria-hidden="true"></span>
                </div>
                <div className="status-chip">
                  <span>传输协议</span>
                  <strong>Web Serial</strong>
                </div>
                <div className="status-chip">
                  <span>实时响应</span>
                  <strong>&lt; 20ms</strong>
                </div>
                <div className="status-chip">
                  <span>音频控制</span>
                  <strong>EQ / PA / Gain</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features" aria-label="功能特性">
          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-icon">EQ</div>
              <h3>精准均衡控制</h3>
              <p>支持 10 频段精细调节，覆盖 ±12dB 范围，兼顾监听与现场扩声需求。</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">IO</div>
              <h3>浏览器直连设备</h3>
              <p>基于 Web Serial API，无需额外客户端，在浏览器内完成设备连接与参数同步。</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">UI</div>
              <h3>克制的专业界面</h3>
              <p>采用玻璃质感与清晰层级，信息密度适中，长时间操作依旧保持清爽与专注。</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon">RT</div>
              <h3>实时参数反馈</h3>
              <p>支持功率放大器、音量与核心音频参数联动，快速读取、即时调节、稳定回写。</p>
            </article>
          </div>
        </section>

        <section className="compatibility" aria-label="浏览器兼容提示">
          <div
            className={`notify-card${!compatible ? ' unsupported' : ''}`}
            id="compatibilityCard"
          >
            <span className="notify-indicator" aria-hidden="true"></span>
            <div>
              <p className="notify-title" id="compatibilityTitle">
                {compatible ? '浏览器兼容性良好' : '当前浏览器不支持 Web Serial'}
              </p>
              <p className="notify-desc" id="compatibilityDesc">
                {compatible
                  ? '建议使用 Chrome 89+ 或 Edge 89+ 并在 HTTPS 环境访问，以获得完整串口连接能力。'
                  : '请切换到 Chrome 89+ 或 Edge 89+，并在 HTTPS 环境中访问此页面。'}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <div>© 2026 广州智造设备有限公司. All rights reserved.</div>
          <div>Professional Audio Control Interface · Built with Web Serial API</div>
        </div>
      </footer>
    </div>
  )
}

export default Home
