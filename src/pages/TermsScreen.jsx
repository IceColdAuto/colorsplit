import { useNavigate } from 'react-router-dom'

export default function TermsScreen() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cream px-5 py-10 flex flex-col items-center">
      <div className="w-full max-w-[480px]">

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-ink/45 font-body text-[13px] font-semibold mb-8 active:scale-95 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to home
        </button>

        <h1
          className="text-[26px] text-ink mb-1"
          style={{ fontFamily: "'Fredoka One', cursive" }}
        >
          Terms
        </h1>
        <p className="font-body text-[13px] text-ink/40 mb-8">Last updated June 2026</p>

        <div className="space-y-6 font-body text-[15px] text-ink/75 leading-relaxed">

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Beta product</h2>
            <p>
              ColorSplit is a beta product. Features may change, be added, or be removed without notice. These terms are a simple summary of expectations during the beta period — not a complete legal agreement.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Use respectfully</h2>
            <p>
              Please use ColorSplit in good faith. Don't use it to harass others or do anything harmful. Color Together is a shared experience — treat other players the way you'd want to be treated.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Provided as-is</h2>
            <p>
              During the beta, ColorSplit is provided as-is. Things may break, data may be lost, and availability is not guaranteed. We'll do our best, but no warranties are made during this period.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Questions</h2>
            <p>
              Reach out at{' '}
              <a
                href="mailto:colorsplitapp@gmail.com"
                className="text-blue-500 underline underline-offset-2"
              >
                colorsplitapp@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
