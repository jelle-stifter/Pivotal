import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { repo } from '../db/repo'
import { opponentTeamId, ownTeamId } from '../lib/ownTeam'
import {
  ABSENCE_LABEL,
  ABSENCE_REASONS,
  cleanPenaltyTakers,
  playingPlayers,
  setAbsence,
  setPenaltyTaker,
} from '../lib/prep'
import type { AbsenceReason, Match } from '../types'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Er ging iets mis')

/**
 * Before the match: who plays (and why the others do not), the coach's own
 * top 3 penalty takers, and the opponent's players (they can also be added
 * during the match).
 */
export default function MatchPrep({ match }: { match: Match }) {
  const ownId = ownTeamId(match)
  const oppId = opponentTeamId(match)
  const own = useLiveQuery(() => db.players.where('teamId').equals(ownId).sortBy('number'), [ownId])
  const opp = useLiveQuery(() => db.players.where('teamId').equals(oppId).sortBy('number'), [oppId])
  const ownTeam = useLiveQuery(() => db.teams.get(ownId), [ownId])
  const oppTeam = useLiveQuery(() => db.teams.get(oppId), [oppId])
  const [error, setError] = useState('')
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [pos, setPos] = useState('')

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const playing = playingPlayers(match, own ?? [])
  const takers = cleanPenaltyTakers(match.penaltyTakers, match.absent)

  function changeAbsence(playerId: string, value: string) {
    const absent = setAbsence(match.absent, playerId, value === '' ? null : (value as AbsenceReason))
    void run(() =>
      repo.updateMatch(match.id, {
        absent,
        // Someone who does not play cannot be a penalty taker.
        penaltyTakers: cleanPenaltyTakers(match.penaltyTakers, absent),
      }),
    )
  }

  function changeTaker(slot: number, playerId: string) {
    void run(() =>
      repo.updateMatch(match.id, { penaltyTakers: setPenaltyTaker(takers, slot, playerId) }),
    )
  }

  async function addOpponent(e: FormEvent) {
    e.preventDefault()
    const n = Number(num)
    if (!Number.isInteger(n) || n < 0) return setError('Vul een rugnummer in.')
    await run(async () => {
      await repo.addPlayer({
        teamId: oppId,
        name: name.trim() || `Speler ${n}`,
        number: n,
        position: pos.trim(),
        isGoalkeeper: false,
      })
      setNum('')
      setName('')
      setPos('')
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}

      <section aria-label="Eigen team">
        <h4 className="section-title mb-2">Eigen team: {ownTeam?.name ?? '…'}</h4>
        {own && own.length === 0 ? (
          <p className="text-slate-600">
            Dit team heeft nog geen spelers. Voeg ze toe onder{' '}
            <a href="#/teams" className="font-semibold underline">
              Teams
            </a>
            .
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {own?.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1"
              >
                <span className="min-w-8 text-lg font-extrabold tabular-nums">{p.number}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <select
                  className="field w-auto"
                  aria-label={`Status van ${p.name}`}
                  value={match.absent?.[p.id] ?? ''}
                  onChange={(e) => changeAbsence(p.id, e.target.value)}
                >
                  <option value="">Speelt</option>
                  {ABSENCE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {ABSENCE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm text-slate-600">
          {playing.length} van {own?.length ?? 0} spelers spelen.
        </p>
      </section>

      <section aria-label="Penaltyschutters">
        <h4 className="section-title mb-2">Top 3 penaltyschutters</h4>
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((slot) => (
            <label key={slot} className="label">
              {slot + 1}e keuze
              <select
                className="field"
                value={takers[slot] ?? ''}
                onChange={(e) => changeTaker(slot, e.target.value)}
              >
                <option value="">Geen</option>
                {playing.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Deze drie staan op het live-scherm bovenaan als snelkeuze bij een 7 meter.
        </p>
      </section>

      <section aria-label="Tegenstander">
        <h4 className="section-title mb-2">Tegenstander: {oppTeam?.name ?? '…'}</h4>
        <p className="mb-2 text-sm text-slate-600">
          Vaak nog onbekend: vul aan wat je weet. Tijdens de wedstrijd kun je ook een nieuw
          rugnummer toevoegen.
        </p>
        {opp && opp.length > 0 && (
          <ul className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {opp.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1"
              >
                <span className="min-w-8 text-lg font-extrabold tabular-nums">{p.number}</span>
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  {p.position ? <span className="text-slate-500"> · {p.position}</span> : null}
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Verwijder ${p.name}`}
                  onClick={() => void run(() => repo.deletePlayer(p.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addOpponent} className="flex flex-wrap items-end gap-2">
          <label className="label w-24">
            Nummer
            <input
              className="field"
              inputMode="numeric"
              value={num}
              onChange={(e) => setNum(e.target.value)}
            />
          </label>
          <label className="label min-w-0 flex-1">
            Naam (optioneel)
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="label w-40">
            Positie (optioneel)
            <input className="field" value={pos} onChange={(e) => setPos(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary">
            Toevoegen
          </button>
        </form>
      </section>
    </div>
  )
}
