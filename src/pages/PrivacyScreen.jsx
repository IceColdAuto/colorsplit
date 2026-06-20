import { useNavigate } from 'react-router-dom'

export default function PrivacyScreen() {
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
          Privacy
        </h1>
        <p className="font-body text-[13px] text-ink/40 mb-8">Last updated June 2026</p>

        <div className="space-y-6 font-body text-[15px] text-ink/75 leading-relaxed">

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Beta app</h2>
            <p>
              ColorSplit is currently in beta. This privacy notice is a simple summary of current practices — it is not a complete legal document.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">What we collect</h2>
            <p>
              Basic usage data and error reports may be collected to help improve the app. This includes things like crashes, feature usage counts, and general performance — not your artwork or personal information.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Feedback form</h2>
            <p>
              If you fill out the beta feedback form, your responses are used only to improve ColorSplit. They are not shared with third parties or used for advertising.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-ink text-[15px] mb-1.5">Contact</h2>
            <p>
              Questions about privacy? Reach out at{' '}
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
