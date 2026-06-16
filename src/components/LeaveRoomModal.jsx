import { motion, AnimatePresence } from 'framer-motion'

/**
 * Dual-purpose modal for multiplayer Leave Room flow.
 *
 * When `abandonedByName` is set   → shows a blocking "room ended" overlay.
 * When `showConfirm` is true      → shows the leave confirmation sheet.
 *
 * Props:
 *   showConfirm      boolean          — show the confirmation sheet
 *   onCancel         fn               — close the confirmation sheet
 *   onConfirm        fn               — player confirmed leave
 *   abandonedByName  string | null    — name of the player who already left
 *   onGoHome         fn               — navigate home from the blocking overlay
 *   title            string           — optional override for confirmation title
 *   subtitle         string           — optional override for confirmation subtitle
 */
export default function LeaveRoomModal({
  showConfirm,
  onCancel,
  onConfirm,
  abandonedByName,
  onGoHome,
  title = 'Leave this room?',
  subtitle = 'You and the other player will stop playing together.',
  confirmLabel = 'Leave room',
}) {
  return (
    <>
      {/* ── Blocking overlay: shown to the remaining player when someone left ── */}
      {abandonedByName && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="bg-cream rounded-3xl p-8 w-full max-w-sm text-center shadow-deep"
          >
            <div className="text-5xl mb-4">👋</div>
            <h2
              className="font-display text-2xl text-ink mb-2"
              style={{ fontFamily: "'Fredoka One', cursive" }}
            >
              {abandonedByName} left.
            </h2>
            <p className="text-ink/50 font-body text-sm mb-6">
              This room has ended.
            </p>
            <button
              onClick={onGoHome}
              className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted font-body active:scale-95 transition-transform"
            >
              Go Home
            </button>
          </motion.div>
        </div>
      )}

      {/* ── Confirmation sheet: shown when the current player taps Leave ── */}
      <AnimatePresence>
        {showConfirm && !abandonedByName && (
          <motion.div
            key="leave-confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-end justify-center z-50"
            onClick={onCancel}
          >
            <motion.div
              key="leave-confirm-sheet"
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="bg-cream w-full max-w-lg rounded-t-3xl p-6"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            >
              <h2
                className="font-display text-2xl text-ink mb-2 text-center"
                style={{ fontFamily: "'Fredoka One', cursive" }}
              >
                {title}
              </h2>
              <p className="text-ink/50 font-body text-sm text-center mb-6">
                {subtitle}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 bg-white text-ink font-semibold py-4 rounded-2xl border border-ink/10 font-body active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 bg-red-500 text-white font-bold py-4 rounded-2xl shadow-lifted font-body active:scale-95 transition-transform"
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
