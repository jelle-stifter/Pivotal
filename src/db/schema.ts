import Dexie, { type EntityTable } from 'dexie'
import type { Action, Match, Player, Team } from '../types'

export class PivotalDB extends Dexie {
  teams!: EntityTable<Team, 'id'>
  players!: EntityTable<Player, 'id'>
  matches!: EntityTable<Match, 'id'>
  actions!: EntityTable<Action, 'id'>

  constructor(name = 'pivotal') {
    super(name)
    this.version(1).stores({
      teams: 'id, name',
      players: 'id, teamId, number',
      matches: 'id, date',
      actions: 'id, matchId, teamId, playerId, type, period, createdAt',
    })
  }
}

export const db = new PivotalDB()
