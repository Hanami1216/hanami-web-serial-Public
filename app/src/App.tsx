import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SerialController from './pages/SerialController'
import BluetoothController from './pages/BluetoothController'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/serial" element={<SerialController />} />
        <Route path="/bluetooth" element={<BluetoothController />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
