import { describe, expect, it } from 'vitest'
import { parseRoster } from './roster'

describe('parseRoster', () => {
  it('parses semicolon, tab and space separated lines', () => {
    const r = parseRoster('1;Daan de Vries;Keeper\n7\tJesse Visser\tLinksbuiten\n9 Milan Bos')
    expect(r.errors).toEqual([])
    expect(r.entries).toEqual([
      { number: 1, name: 'Daan de Vries', position: 'Keeper', isGoalkeeper: true },
      { number: 7, name: 'Jesse Visser', position: 'Linksbuiten', isGoalkeeper: false },
      { number: 9, name: 'Milan Bos', position: '', isGoalkeeper: false },
    ])
  })

  it('reads an explicit keeper column and skips a header row', () => {
    const r = parseRoster('nr;naam;positie;keeper\n12;Sem;;K')
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0].isGoalkeeper).toBe(true)
  })

  it('reports duplicates, bad numbers and missing names per line', () => {
    const r = parseRoster('5;A\n5;B\nx;C\n6;\n100;Z')
    expect(r.entries.map((e) => e.number)).toEqual([5])
    expect(r.errors).toHaveLength(4)
    expect(r.errors[0]).toContain('Regel 2')
  })

  it('ignores blank lines', () => {
    expect(parseRoster('\n\n3;Eva\n\n').entries).toHaveLength(1)
  })
})
