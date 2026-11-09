import { describe, expect, it } from 'vitest'
import {
  seasonCsv,
  seasonFileName,
  actionsCsv,
  csvCell,
  csvFileName,
  playerStatsCsv,
  toCsv,
} from './csv'
import { seasonPlayerRows } from './season'
import type { Action, Match, Player, Team } from '../types'

const teams: Team[] = [
  { id: 'H', name: 'HV Test', schemaVersion: 1 },
  { id: 'A', name: 'Gasten; HC', schemaVersion: 1 },
]
const player = (id: string, teamId: string, number: number, name: string, gk = false): Player => ({
  id, teamId, number, name, position: '', isGoalkeeper: gk, schemaVersion: 1,
})
const players: Player[] = [
  player('hgk', 'H', 1, 'Kees Keeper', true),
  player('h7', 'H', 7, 'Jan "De Man" Jansen'),
  player('agk', 'A', 12, 'Aron Keeper', true),
]
const match: Match = {
  id: 'm', homeTeamId: 'H', awayTeamId: 'A', date: '2026-11-08',
  format: 2, currentPeriod: 2, clockMs: 0, activeGoalkeeper: {}, schemaVersion: 1,
}
let n = 0
const act = (teamId: string, playerId: string, type: Action['type'], clock: number, gk?: string): Action => ({
  id: `a${++n}`, matchId: 'm', teamId, playerId, type, period: 1,
  matchClockMs: clock, createdAt: n, videoTimeMs: null, goalkeeperId: gk, schemaVersion: 1,
})
const actions: Action[] = [
  act('H', 'hgk', 'save', 90_000),
  act('H', 'h7', 'goal', 61_000, 'agk'),
  act('A', 'agk', 'save', 120_000),
]

const strip = (s: string) => s.replace(/^﻿/, '')

describe('csvCell', () => {
  it('quotes delimiter, quotes and newlines', () => {
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"')
  })
  it('leaves plain values and numbers alone, empties null', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(7)).toBe('7')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
  it('neutralises spreadsheet formulas in text but not in numbers', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell(-5)).toBe('-5')
  })
})

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and uses CRLF', () => {
    const out = toCsv(['a', 'b'], [[1, 2]])
    expect(out.charCodeAt(0)).toBe(0xfeff)
    expect(strip(out)).toBe('a;b\r\n1;2\r\n')
  })
  it('keeps non-ASCII characters', () => {
    expect(toCsv(['n'], [['Zoë Müller']])).toContain('Zoë Müller')
  })
})

describe('actionsCsv', () => {
  const lines = strip(actionsCsv({ match, teams, players, actions })).trim().split('\r\n')
  it('has English headers', () => {
    expect(lines[0]).toBe(
      'date;home_team;away_team;period;match_time;team;shirt_number;player;action;goalkeeper_conceded;court_x_pct;court_y_pct',
    )
  })
  it('has one row per action in match order', () => {
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('01:01')
    expect(lines[2]).toContain('01:30')
    expect(lines[3]).toContain('02:00')
  })
  it('escapes team and player names and credits the goalkeeper on goals', () => {
    expect(lines[1]).toContain('"Gasten; HC"')
    expect(lines[1]).toContain('"Jan ""De Man"" Jansen"')
    // columns: ...;action;goalkeeper_conceded;court_x_pct;court_y_pct
    expect(lines[1].endsWith(';goal;Aron Keeper;;')).toBe(true)
    expect(lines[2].endsWith(';save;;;')).toBe(true)
  })
  it('keeps the original columns first and appends the position columns', () => {
    const cols = lines[0].split(';')
    expect(cols.slice(0, 10)).toEqual([
      'date', 'home_team', 'away_team', 'period', 'match_time',
      'team', 'shirt_number', 'player', 'action', 'goalkeeper_conceded',
    ])
    expect(cols.slice(10)).toEqual(['court_x_pct', 'court_y_pct'])
  })
  it('leaves the position empty when none was recorded', () => {
    for (const row of lines.slice(1)) expect(row.endsWith(';;')).toBe(true)
  })
  it('writes the position as whole percentages, only for positioned actions', () => {
    // `actions` is declared as [hgk save 01:30, h7 goal 01:01, agk save 02:00]
    const [hgkSave, h7Goal, agkSave] = actions
    const withPos: Action[] = [
      { ...hgkSave, x: 0, y: 1 },
      { ...h7Goal, x: 0.9, y: 0.304 },
      agkSave,
    ]
    const out = strip(
      actionsCsv({ match, teams, players, actions: withPos }),
    ).trim().split('\r\n')
    // CSV is in match order: 01:01 goal, 01:30 save, 02:00 save
    expect(out[1].endsWith(';goal;Aron Keeper;90;30')).toBe(true)
    expect(out[2].endsWith(';save;;0;100')).toBe(true)
    expect(out[3].endsWith(';save;;;')).toBe(true)
  })
})

/** Split one CSV line on ';', honouring quoted cells (with "" escapes). */
function splitLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ';') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

describe('playerStatsCsv', () => {
  const parse = (acts: Action[]) => {
    const rows = strip(playerStatsCsv({ match, teams, players, actions: acts }))
      .trim()
      .split('\r\n')
      .map(splitLine)
    const head = rows[0]
    return {
      head,
      rows: rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))),
    }
  }
  const { head, rows } = parse(actions)

  it('keeps the original columns in their original order, new ones appended', () => {
    expect(head.slice(0, 12)).toEqual([
      'team', 'shirt_number', 'player', 'is_goalkeeper',
      'goal', 'shot', 'turnover', 'save', 'interception', 'foul',
      'goals_conceded', 'save_percentage',
    ])
    expect(head.slice(12)).toEqual([
      'assist', 'penalty_goal', 'penalty_miss', 'penalty_saved', 'penalty_won',
      'bad_pass', 'technical_foul', 'yellow_card', 'suspension', 'red_card',
      'blue_card', 'total_goals', 'shot_percentage', 'penalty_saves',
      'penalty_goals_conceded', 'penalty_save_percentage', 'total_save_percentage',
    ])
  })
  it('has one row per player, home team first', () => {
    expect(rows).toHaveLength(3)
    expect(rows[0].player).toBe('Kees Keeper')
    expect(rows[2].player).toBe('Aron Keeper')
  })
  it('includes goals conceded and save percentage for keepers only', () => {
    // Aron: 1 save, 1 goal conceded -> 50%
    expect(rows[2]).toMatchObject({ goals_conceded: '1', save_percentage: '50' })
    // Kees: 1 save, 0 conceded -> 100%
    expect(rows[0]).toMatchObject({ goals_conceded: '0', save_percentage: '100' })
    // Field player: blanks
    expect(rows[1]).toMatchObject({ goals_conceded: '', save_percentage: '' })
  })
  it('leaves the percentage empty when no shots were faced', () => {
    const empty = parse([]).rows
    expect(empty[0]).toMatchObject({ goals_conceded: '0', save_percentage: '' })
  })

  it('adds 7-meter, assist, card, goals-total and shot-percentage columns', () => {
    const mk = (playerId: string, teamId: string, type: Action['type'], gk?: string) =>
      act(teamId, playerId, type, 1, gk)
    const extra: Action[] = [
      mk('h7', 'H', 'goal', 'agk'),
      mk('h7', 'H', 'shot'),
      mk('h7', 'H', 'penalty_goal', 'agk'),
      mk('h7', 'H', 'penalty_saved', 'agk'),
      mk('h7', 'H', 'assist'),
      mk('h7', 'H', 'yellow_card'),
      mk('h7', 'H', 'suspension'),
      mk('agk', 'A', 'save'),
    ]
    const r = parse(extra).rows
    const h7 = r.find((x) => x.shirt_number === '7')!
    expect(h7).toMatchObject({
      goal: '1', shot: '1', penalty_goal: '1', penalty_saved: '1',
      assist: '1', yellow_card: '1', suspension: '1',
      total_goals: '2',
      // (1 + 1) / (1 goal + 1 miss + 1 7m goal + 1 7m stopped) = 50%
      shot_percentage: '50',
    })
    // Aron: 1 save, 1 goal + 1 7m goal conceded, 1 7m stopped
    expect(r.find((x) => x.player === 'Aron Keeper')).toMatchObject({
      penalty_saves: '1', penalty_goals_conceded: '1',
      penalty_save_percentage: '50',
      total_save_percentage: String(Math.round((2 / 4) * 100)),
    })
  })
  it('leaves the shot percentage empty for players without attempts', () => {
    expect(rows[0].shot_percentage).toBe('') // Kees: only a save, no attempts
    expect(rows[1].shot_percentage).toBe('100') // Jan: one goal, no misses
  })
})

describe('seasonFileName', () => {
  it('names the file after season and team', () => {
    expect(seasonFileName('2020-2021', 'Lions 2')).toBe('backhand-seizoen-2020-2021-Lions-2.csv')
    expect(seasonFileName(undefined)).toBe('backhand-seizoen-alle-seizoenen.csv')
    expect(seasonFileName('2020-2021', 'Zoë (demo)')).toBe('backhand-seizoen-2020-2021-Zoe-demo.csv')
  })
})

describe('seasonCsv', () => {
  const m2 = { ...match, id: 'm2' }
  const mk = (matchId: string, playerId: string, type: Action['type']): Action => ({
    ...act('H', playerId, type, 1),
    matchId,
  })
  const acts: Action[] = [
    mk('m', 'h7', 'goal'), mk('m', 'h7', 'shot'), mk('m2', 'h7', 'penalty_goal'),
    mk('m2', 'h7', 'assist'), mk('m', 'hgk', 'save'),
  ]
  const rows = seasonPlayerRows(new Set([match.id, m2.id]), acts)
  const out = strip(seasonCsv({ teams, players, rows })).trim().split('\r\n').map(splitLine)
  const head = out[0]
  const body = out.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))

  it('has one row per player with the matches count and all action columns', () => {
    expect(head.slice(0, 5)).toEqual(['team', 'shirt_number', 'player', 'is_goalkeeper', 'matches'])
    expect(head).toContain('penalty_goal')
    expect(head.slice(-2)).toEqual(['total_goals', 'shot_percentage'])
    expect(body).toHaveLength(2)
  })
  it('sums over matches, counts matches, computes goals and shot percentage', () => {
    const jan = body.find((r) => r.shirt_number === '7')!
    expect(jan).toMatchObject({
      matches: '2', goal: '1', shot: '1', penalty_goal: '1', assist: '1',
      total_goals: '2',
      shot_percentage: '67', // (1 + 1) / (1 goal + 1 miss + 1 7m goal)
    })
    expect(body.find((r) => r.shirt_number === '1')).toMatchObject({
      matches: '1', save: '1', shot_percentage: '',
    })
  })
  it('keeps the BOM and CRLF', () => {
    const raw = seasonCsv({ teams, players, rows })
    expect(raw.charCodeAt(0)).toBe(0xfeff)
    expect(raw.includes('\r\n')).toBe(true)
  })
})

describe('csvFileName', () => {
  it('builds a safe file name', () => {
    expect(csvFileName(match, teams, 'acties')).toBe(
      'backhand-HV-Test-Gasten-HC-2026-11-08-acties.csv',
    )
  })
})
