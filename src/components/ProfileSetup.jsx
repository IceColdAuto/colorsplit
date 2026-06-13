import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AVATAR_COLORS, saveProfile, getDefaultProfileName } from '../lib/profile'
import PencilTip from './PencilTip'

export default function ProfileSetup({ onComplete }) {
  const [step, setStep] = useState(1)  // 1: name, 2: color
  const [username, setUsername] = useState('')
  const [colorId, setColorId] = useState('peach')

  const selectedColor = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS[0]

  function handleNext() {
    if (step === 1) {
      setStep(2)
    } else {
      const name = username.trim() || getDefaultProfileName()
      saveProfile({ username: name, avatarId: 'cat', colorId })
      onComplete({ username: name, avatarId: 'cat', colorId })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-ink/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="w-full max-w-lg bg-cream rounded-t-[32px] px-6 pt-6 pb-10"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-ink/15 rounded-full mx-auto mb-6" />

        {/* Header */}
        <div className="text-center mb-6">
          {/* Pencil preview — color updates live */}
          <div
            className="w-20 h-20 rounded-[22px] flex items-center justify-center mx-auto mb-4 shadow-lifted overflow-hidden"
            style={{ background: selectedColor.hex }}
          >
            <PencilTip size={48} />
          </div>
          <h2 className="font-display text-2xl text-ink mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
            {step === 1 ? "What's your name?" : 'Choose your pencil'}
          </h2>
          <p className="text-ink/45 font-body text-sm">
            {step === 1 ? 'This shows up when you play with others.' : 'Pick a color for your ColorSplit pencil.'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                placeholder={getDefaultProfileName()}
                maxLength={20}
                autoFocus
                className="w-full text-center text-xl font-body bg-white rounded-2xl px-4 py-3.5 border-2 border-ink/10 focus:border-blue-400 outline-none transition-colors text-ink placeholder:text-ink/25 mb-4"
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <p className="text-ink/40 text-xs font-bold uppercase tracking-wider font-body mb-2">Pencil color</p>
              <div className="flex gap-2 mb-4">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setColorId(c.id)}
                    className={`flex-1 h-10 rounded-xl transition-all active:scale-95 border-2 ${
                      colorId === c.id ? 'border-blue-500 scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <div className="flex gap-3">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="bg-white text-ink/60 font-semibold py-4 px-5 rounded-2xl border border-ink/10 font-body active:scale-95 transition-transform"
            >
              ←
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-all font-body text-lg"
          >
            {step === 1 ? 'Next →' : 'Start coloring'}
          </button>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-4">
          {[1, 2].map(s => (
            <div key={s} className={`rounded-full transition-all ${step === s ? 'w-6 h-2 bg-blue-500' : 'w-2 h-2 bg-ink/20'}`} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
