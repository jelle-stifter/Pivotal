import type { ActionType } from '../types'

export const ACTION_META: Record<ActionType, { label: string; key: string }> = {
  goal: { label: 'Goal', key: 'G' },
  shot: { label: 'Schot', key: 'S' },
  turnover: { label: 'Balverlies', key: 'T' },
  save: { label: 'Save', key: 'V' },
  interception: { label: 'Onderschepping', key: 'I' },
  foul: { label: 'Fout', key: 'F' },
  assist: { label: 'Assist', key: 'A' },
  penalty_goal: { label: '7m doelpunt', key: 'Shift+G' },
  penalty_miss: { label: '7m niet op doel', key: 'Shift+S' },
  penalty_saved: { label: '7m gestopt', key: 'Shift+V' },
  penalty_won: { label: '7m gekregen', key: 'W' },
  bad_pass: { label: 'Passfout', key: 'P' },
  technical_foul: { label: 'Technische fout', key: 'X' },
  yellow_card: { label: 'Gele kaart', key: 'Y' },
  suspension: { label: '2 minuten', key: 'M' },
  red_card: { label: 'Rode kaart', key: 'R' },
  blue_card: { label: 'Blauwe kaart', key: 'B' },
}

/** How the live action pad is grouped (display only). */
export const ACTION_GROUPS: { title: string; types: ActionType[] }[] = [
  { title: 'Aanval', types: ['goal', 'shot', 'assist'] },
  {
    title: '7 meter',
    types: ['penalty_goal', 'penalty_miss', 'penalty_saved', 'penalty_won'],
  },
  { title: 'Verdediging', types: ['save', 'interception'] },
  {
    title: 'Fouten',
    types: ['turnover', 'bad_pass', 'technical_foul', 'foul'],
  },
  {
    title: 'Straffen',
    types: ['yellow_card', 'suspension', 'red_card', 'blue_card'],
  },
]

/** The original six actions; they keep their position in exports and tables. */
export const CORE_TYPES: ActionType[] = [
  'goal',
  'shot',
  'turnover',
  'save',
  'interception',
  'foul',
]

/** These actions count on the scoreboard. */
export const SCORING_TYPES: ActionType[] = ['goal', 'penalty_goal']

/**
 * Actions where the shot reached the opposing keeper's goal area, so the
 * opposing keeper on court is credited (used for goals conceded / 7m stats).
 */
export const KEEPER_FACED_TYPES: ActionType[] = [
  'goal',
  'penalty_goal',
  'penalty_saved',
  'penalty_miss',
]

/** Dot colours for the court views (distinct hues, shown with a legend). */
export const ACTION_COLOR: Record<ActionType, string> = {
  goal: '#16a34a',
  shot: '#2563eb',
  turnover: '#dc2626',
  save: '#9333ea',
  interception: '#ea580c',
  foul: '#ca8a04',
  assist: '#0891b2',
  penalty_goal: '#166534',
  penalty_miss: '#7c2d12',
  penalty_saved: '#5b21b6',
  penalty_won: '#0d9488',
  bad_pass: '#be185d',
  technical_foul: '#64748b',
  yellow_card: '#eab308',
  suspension: '#f97316',
  red_card: '#991b1b',
  blue_card: '#1d4ed8',
}

const SHIFT_KEYS: Record<string, ActionType> = {
  G: 'penalty_goal',
  S: 'penalty_miss',
  V: 'penalty_saved',
}

/**
 * Map a pressed key to an action. Plain letters pick the normal actions;
 * Shift+G / Shift+S / Shift+V are the 7-meter variants of goal / shot / save.
 */
export function keyToAction(key: string, shift = false): ActionType | undefined {
  const k = key.toUpperCase()
  if (shift) return SHIFT_KEYS[k]
  return (Object.keys(ACTION_META) as ActionType[]).find(
    (t) => ACTION_META[t].key === k,
  )
}
