import { db, DEMO_MODE } from './firebase'
import { ref, push } from 'firebase/database'

export function logBetaEvent(name, props = {}) {
  if (DEMO_MODE || !db) return
  push(ref(db, 'beta_events'), { event: name, ts: Date.now(), ...props }).catch(() => {})
}
