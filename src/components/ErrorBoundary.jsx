import { Component } from 'react'
import * as Sentry from '@sentry/react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ColorSplit] Render error:', error.message)
    console.error('[ColorSplit] Stack:', error.stack)
    console.error('[ColorSplit] Component stack:', info?.componentStack)
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-8 gap-5">
          <div className="text-5xl">😕</div>
          <h2
            className="font-display text-2xl text-ink text-center"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            Something went wrong
          </h2>
          <p className="text-ink/50 font-body text-sm text-center leading-relaxed max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
            className="bg-blue-500 text-white font-bold px-8 py-3.5 rounded-2xl font-body active:scale-95 transition-transform"
          >
            Go Home
          </button>
          <p className="text-ink/25 font-body text-xs">
            Check the browser console for details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
