export interface RosterEntry {
  number: number
  name: string
  position: string
  isGoalkeeper: boolean
}

export interface RosterParse {
  entries: RosterEntry[]
  errors: string[]
}

const KEEPER_WORDS = new Set(['k', 'keeper', 'gk', 'doelman', 'ja', 'x'])

/**
 * Parses pasted roster lines (e.g. copied from Excel). Per line:
 * `number<sep>name[<sep>position[<sep>keeper]]` with `;`, tab or `,` as
 * separator, or just `number name` separated by spaces.
 */
export function parseRoster(text: string): RosterParse {
  const entries: RosterEntry[] = []
  const errors: string[] = []
  const seen = new Set<number>()

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const parts = /[;\t,]/.test(line)
      ? line.split(/[;\t,]/).map((p) => p.trim())
      : (() => {
          const m = /^(\S+)\s+(.+)$/.exec(line)
          return m ? [m[1], m[2]] : [line]
        })()

    const number = Number(parts[0].replace(/^#/, ''))
    const name = parts[1] ?? ''
    if (parts[0] !== '' && !Number.isInteger(number)) {
      // A header row like "nr;naam" is skipped silently on the first line.
      if (i === 0) return
      errors.push(`Regel ${i + 1}: "${parts[0]}" is geen rugnummer.`)
      return
    }
    if (number < 0 || number > 99 || !name) {
      errors.push(`Regel ${i + 1}: rugnummer (0-99) en naam zijn verplicht.`)
      return
    }
    if (seen.has(number)) {
      errors.push(`Regel ${i + 1}: rugnummer ${number} staat er dubbel in.`)
      return
    }
    seen.add(number)
    const position = parts[2] ?? ''
    const isGoalkeeper =
      KEEPER_WORDS.has((parts[3] ?? '').toLowerCase()) ||
      /^(k|keeper|gk|doelman)$/i.test(position)
    entries.push({
      number,
      name,
      position: /^(k|keeper|gk|doelman)$/i.test(position) ? 'Keeper' : position,
      isGoalkeeper,
    })
  })
  return { entries, errors }
}
