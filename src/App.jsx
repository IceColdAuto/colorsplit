import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import ErrorBoundary from './components/ErrorBoundary'
import HomeScreen from './pages/HomeScreen'
import JoinScreen from './pages/JoinScreen'
import LobbyScreen from './pages/LobbyScreen'
import ColoringPagePicker from './pages/ColoringPagePicker'
import SessionSettings from './pages/SessionSettings'
import TearScreen from './pages/TearScreen'
import ReadyCheck from './pages/ReadyCheck'
import ColoringSession from './pages/ColoringSession'
import RevealScreen from './pages/RevealScreen'
import GalleryScreen from './pages/GalleryScreen'

export default function App() {
  return (
    <div className="min-h-screen bg-cream">
      <ErrorBoundary>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/gallery" element={<GalleryScreen />} />
          <Route path="/join" element={<JoinScreen />} />
          <Route path="/join/:code" element={<JoinScreen />} />
          <Route path="/session/:code/lobby" element={<LobbyScreen />} />
          <Route path="/session/:code/pick" element={<ColoringPagePicker />} />
          <Route path="/session/:code/settings" element={<SessionSettings />} />
          <Route path="/session/:code/tear" element={<TearScreen />} />
          <Route path="/session/:code/ready" element={<ReadyCheck />} />
          <Route path="/session/:code/color" element={<ColoringSession />} />
          <Route path="/session/:code" element={<Navigate to="color" replace />} />
          <Route path="/session/:code/reveal" element={<RevealScreen />} />
        </Routes>
      </AnimatePresence>
      </ErrorBoundary>
    </div>
  )
}
