import {
  SCHEMA_VERSION,
  type Action,
  type ActionType,
  type Match,
  type Player,
  type Team,
} from '../types'

/** Small deterministic PRNG so the demo is identical every time. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function gauss(rng: Rng): number {
  const u = Math.max(rng(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

function pickWeighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [item, w] of items) {
    r -= w
    if (r <= 0) return item
  }
  return items[items.length - 1][0]
}

type Role = 'K' | 'LW' | 'LB' | 'CB' | 'RB' | 'RW' | 'PV' | 'DEF'

// Where each role usually shoots from (attack-normalized: opponent goal at x=1).
const SHOOT_SPOT: Record<Exclude<Role, 'K'>, { x: number; y: number; sx: number; sy: number; weight: number }> = {
  LW: { x: 0.96, y: 0.08, sx: 0.02, sy: 0.04, weight: 3 },
  RW: { x: 0.96, y: 0.92, sx: 0.02, sy: 0.04, weight: 3 },
  PV: { x: 0.9, y: 0.5, sx: 0.03, sy: 0.08, weight: 3 },
  LB: { x: 0.78, y: 0.25, sx: 0.05, sy: 0.07, weight: 4 },
  CB: { x: 0.78, y: 0.5, sx: 0.05, sy: 0.06, weight: 3 },
  RB: { x: 0.78, y: 0.75, sx: 0.05, sy: 0.07, weight: 4 },
  DEF: { x: 0.7, y: 0.5, sx: 0.06, sy: 0.15, weight: 0.5 },
}

const HOME_ROSTER: [number, string, Role][] = [
  [1, 'Daan de Vries', 'K'],
  [2, 'Sem Bakker', 'LW'],
  [4, 'Luuk Smit', 'LB'],
  [6, 'Finn Mulder', 'DEF'],
  [7, 'Jesse Visser', 'CB'],
  [9, 'Milan Bos', 'RB'],
  [10, 'Thijs Peters', 'RW'],
  [13, 'Ruben Hoek', 'PV'],
]
const AWAY_ROSTER: [number, string, Role][] = [
  [12, 'Bram Dekker', 'K'],
  [3, 'Joep Jansen', 'LW'],
  [5, 'Max van Dijk', 'LB'],
  [8, 'Tim Brouwer', 'DEF'],
  [11, 'Lars Meijer', 'CB'],
  [14, 'Niels de Groot', 'RB'],
  [15, 'Stijn Hendriks', 'RW'],
  [17, 'Koen Vos', 'PV'],
]

export const DEMO_MATCH_ID = 'demo-match'

export interface DemoData {
  teams: Team[]
  players: Player[]
  /** The most recent demo match (also the first of `matches`). */
  match: Match
  /** All demo matches, most recent first. */
  matches: Match[]
  actions: Action[]
}

/** [penalty goals, penalty saved by keeper, penalty off target] per team. */
type Pens = [number, number, number]

interface MatchCfg {
  id: string
  seed: number
  home: string
  away: string
  /** days before the date passed to buildDemo */
  daysBefore: number
  /** [goals (excl. 7m), penalties] per team id */
  goals: Record<string, number>
  pens: Record<string, Pens>
}

// Most recent first. The first one is the original demo match (31 - 27).
const MATCHES: MatchCfg[] = [
  {
    id: DEMO_MATCH_ID, seed: 20261108, home: 'demo-home', away: 'demo-away', daysBefore: 0,
    goals: { 'demo-home': 28, 'demo-away': 25 },
    pens: { 'demo-home': [3, 1, 1], 'demo-away': [2, 2, 0] },
  },
  {
    id: 'demo-match-2', seed: 20261025, home: 'demo-away', away: 'demo-home', daysBefore: 14,
    goals: { 'demo-home': 24, 'demo-away': 24 },
    pens: { 'demo-home': [3, 1, 0], 'demo-away': [3, 1, 1] },
  },
  {
    id: 'demo-match-3', seed: 20261011, home: 'demo-home', away: 'demo-away', daysBefore: 28,
    goals: { 'demo-home': 20, 'demo-away': 26 },
    pens: { 'demo-home': [2, 1, 1], 'demo-away': [4, 0, 1] },
  },
  {
    id: 'demo-match-4', seed: 20260927, home: 'demo-away', away: 'demo-home', daysBefore: 42,
    goals: { 'demo-home': 30, 'demo-away': 22 },
    pens: { 'demo-home': [2, 2, 0], 'demo-away': [2, 1, 0] },
  },
]

/** yyyy-mm-dd minus n days (UTC, so no daylight-saving surprises). */
function daysBefore(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d - n))
  return t.toISOString().slice(0, 10)
}


/**
 * A finished 2-halves demo match with ~150 actions, each with a court
 * position, so every screen (stats, keepers, heatmap, export) has data.
 * Ids are stable, so loading it twice replaces instead of duplicating.
 */
export function buildDemo(date: string, now: number): DemoData {
  let rng: Rng = mulberry32(MATCHES[0].seed)
  const teams: Team[] = [
    { id: 'demo-home', name: 'HV Pivotal (demo)', schemaVersion: SCHEMA_VERSION },
    { id: 'demo-away', name: 'Gasten HC (demo)', schemaVersion: SCHEMA_VERSION },
  ]
  const role = new Map<string, Role>()
  const players: Player[] = []
  const add = (teamId: string, roster: [number, string, Role][]) => {
    for (const [number, name, r] of roster) {
      const id = `demo-${teamId}-${number}`
      role.set(id, r)
      players.push({
        id, teamId, name, number,
        position: r === 'K' ? 'Keeper' : r,
        isGoalkeeper: r === 'K',
        schemaVersion: SCHEMA_VERSION,
      })
    }
  }
  add('demo-home', HOME_ROSTER)
  add('demo-away', AWAY_ROSTER)

  const of = (teamId: string) => players.filter((p) => p.teamId === teamId)
  const keeperOf = (teamId: string) => of(teamId).find((p) => p.isGoalkeeper)!
  const shooters = (teamId: string) =>
    of(teamId).filter((p) => !p.isGoalkeeper)

  type Draft = {
    teamId: string
    playerId: string
    type: ActionType
    x: number
    y: number
    goalkeeperId?: string
  }
  const generate = (cfg: MatchCfg, index: number): Action[] => {
  rng = mulberry32(cfg.seed)
  const drafts: Draft[] = []

  const shotSpot = (p: Player) => {
    const s = SHOOT_SPOT[role.get(p.id) as Exclude<Role, 'K'>]
    return {
      x: clamp01(s.x + gauss(rng) * s.sx),
      y: clamp01(s.y + gauss(rng) * s.sy),
    }
  }
  const shooter = (teamId: string) =>
    pickWeighted(
      rng,
      shooters(teamId).map((p) => [
        p,
        SHOOT_SPOT[role.get(p.id) as Exclude<Role, 'K'>].weight,
      ]),
    )
  const anyone = (teamId: string) =>
    of(teamId)[Math.floor(rng() * of(teamId).length)]

  // Planned number of actions per team and type. Score = goal + penalty_goal.
  // Penalties won always equal penalties taken.
  const base: Record<string, Partial<Record<ActionType, number>>> = {
    'demo-home': {
      shot: 12, assist: 14, turnover: 8, bad_pass: 4, technical_foul: 3,
      interception: 7, foul: 4, yellow_card: 1, suspension: 2, red_card: 1,
    },
    'demo-away': {
      shot: 14, assist: 12, turnover: 9, bad_pass: 5, technical_foul: 2,
      interception: 6, foul: 5, yellow_card: 2, suspension: 1, blue_card: 1,
    },
  }
  const plan: [string, Partial<Record<ActionType, number>>][] = [
    cfg.home,
    cfg.away,
  ].map((teamId) => {
    const [pg, ps, pm] = cfg.pens[teamId]
    return [
      teamId,
      {
        ...base[teamId],
        goal: cfg.goals[teamId],
        penalty_goal: pg,
        penalty_saved: ps,
        penalty_miss: pm,
        penalty_won: pg + ps + pm,
      },
    ]
  })
  const opponent = (teamId: string) =>
    teamId === 'demo-home' ? 'demo-away' : 'demo-home'

  // 7 m line is at x = 1 - 7/40 in the attack-normalized frame.
  const PENALTY_X = 0.825
  const midCourt = () => ({ x: clamp01(0.3 + rng() * 0.55), y: rng() })

  for (const [teamId, counts] of plan) {
    const opp = opponent(teamId)
    for (const [type, n] of Object.entries(counts) as [ActionType, number][]) {
      for (let i = 0; i < n; i++) {
        let player: Player
        let pos: { x: number; y: number }
        let goalkeeperId: string | undefined
        switch (type) {
          case 'goal':
          case 'shot':
            player = shooter(teamId)
            pos = shotSpot(player)
            if (type === 'goal') goalkeeperId = keeperOf(opp).id
            break
          case 'penalty_goal':
          case 'penalty_saved':
          case 'penalty_miss':
            player = shooter(teamId)
            pos = { x: PENALTY_X, y: clamp01(0.5 + gauss(rng) * 0.01) }
            goalkeeperId = keeperOf(opp).id
            break
          case 'penalty_won':
            player = shooter(teamId)
            pos = { x: clamp01(0.92 + gauss(rng) * 0.03), y: clamp01(0.5 + gauss(rng) * 0.12) }
            break
          case 'assist':
            player = shooter(teamId)
            pos = { x: clamp01(0.7 + gauss(rng) * 0.07), y: clamp01(0.15 + rng() * 0.7) }
            break
          case 'interception':
            player = anyone(teamId)
            pos = { x: clamp01(0.3 + rng() * 0.3), y: rng() }
            break
          case 'foul':
            player = anyone(teamId)
            pos = { x: clamp01(0.22 + gauss(rng) * 0.05), y: clamp01(0.5 + gauss(rng) * 0.25) }
            break
          default: // turnover, bad_pass, technical_foul, cards
            player = anyone(teamId)
            pos = midCourt()
        }
        drafts.push({ teamId, playerId: player.id, type, ...pos, goalkeeperId })
      }
    }
  }
  // Saves by each keeper, near their own goal (x close to 0 in their frame).
  for (const [teamId, n] of [['demo-home', 11], ['demo-away', 10]] as const)
    for (let i = 0; i < n; i++)
      drafts.push({
        teamId, playerId: keeperOf(teamId).id, type: 'save',
        x: clamp01(0.06 + Math.abs(gauss(rng)) * 0.03),
        y: clamp01(0.5 + gauss(rng) * 0.08),
      })

  // Spread over 60 minutes in match order; period 1 = first 30 minutes.
  const times = drafts
    .map(() => Math.floor(rng() * 3_600_000))
    .sort((a, b) => a - b)
  // Shuffle drafts (Fisher-Yates) so action types are mixed over time.
  for (let i = drafts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[drafts[i], drafts[j]] = [drafts[j], drafts[i]]
  }

  const actions: Action[] = drafts.map((d, i) => {
    const a: Action = {
      id: `${cfg.id}-action-${i + 1}`,
      matchId: cfg.id,
      teamId: d.teamId,
      playerId: d.playerId,
      type: d.type,
      period: times[i] < 1_800_000 ? 1 : 2,
      matchClockMs: times[i],
      // Demo matches are "finished": logged at least 6 hours before `now`.
      createdAt: now - (cfg.daysBefore * 24 + 6) * 3_600_000 + index * 1000 + i,
      videoTimeMs: null,
      x: d.x,
      y: d.y,
      schemaVersion: SCHEMA_VERSION,
    }
    if (d.goalkeeperId) a.goalkeeperId = d.goalkeeperId
    return a
  })

  return actions
  }

  const matches: Match[] = MATCHES.map((cfg) => ({
    id: cfg.id,
    homeTeamId: cfg.home,
    awayTeamId: cfg.away,
    date: daysBefore(date, cfg.daysBefore),
    location: cfg.home === 'demo-home' ? 'Sporthal De Kuil' : 'Sporthal Het Anker',
    format: 2 as const,
    currentPeriod: 2,
    clockMs: 3_600_000,
    activeGoalkeeper: {
      home: keeperOf(cfg.home).id,
      away: keeperOf(cfg.away).id,
    },
    homeAttacksRight: false,
    schemaVersion: SCHEMA_VERSION,
  }))
  const actions = MATCHES.flatMap((cfg, i) => generate(cfg, i))

  return { teams, players, match: matches[0], matches, actions }
}
