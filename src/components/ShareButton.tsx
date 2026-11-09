import { useState } from 'react'

/** Shares text with the phone's share sheet, or copies it on a computer. */
export default function ShareButton({ text, label = 'Delen' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  }

  return (
    <button type="button" className="btn inline-flex items-center" onClick={() => void share()}>
      {done ? 'Gekopieerd ✓' : label}
    </button>
  )
}
