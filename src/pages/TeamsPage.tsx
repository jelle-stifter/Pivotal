import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { repo } from '../db/repo'
import { parseRoster } from '../lib/roster'
import { STAFF_ROLES, addStaff, removeStaff, updateStaff } from '../lib/prep'
import type { Player, Team } from '../types'

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Er ging iets mis'
}

export default function TeamsPage() {
  const teams = useLiveQuery(() => db.teams.orderBy('name').toArray(), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function addTeam(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    await run(async () => {
      const team = await repo.addTeam(name)
      setNewName('')
      setSelectedId(team.id)
    })
  }

  const selected = teams?.find((t) => t.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <h2 className="page-title">Teams</h2>
      <div className="grid items-start gap-6 md:grid-cols-[18rem_1fr]">
      <section className="card" aria-label="Teams">
        <h3 className="section-title mb-3">Teams</h3>
        <form onSubmit={addTeam} className="mb-3 flex gap-2">
          <input
            className="field min-w-0 flex-1"
            placeholder="Nieuw team"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Naam nieuw team"
          />
          <button className="btn btn-primary" type="submit">
            Toevoegen
          </button>
        </form>
        <ul className="space-y-1">
          {teams?.map((t) => (
            <li key={t.id}>
              <button
                className="btn w-full text-left"
                aria-current={t.id === selectedId ? 'true' : undefined}
                style={
                  t.id === selectedId
                    ? {
                        background: 'var(--brand-soft)',
                        borderColor: 'var(--brand)',
                        color: 'var(--brand-strong)',
                      }
                    : undefined
                }
                onClick={() => setSelectedId(t.id)}
              >
                {t.name}
              </button>
            </li>
          ))}
          {teams?.length === 0 && (
            <li className="text-sm text-slate-500">Nog geen teams.</li>
          )}
        </ul>
      </section>

      <section className="card" aria-label="Team details">
        {error && (
          <p role="alert" className="alert mb-4">
            {error}
          </p>
        )}
        {selected ? (
          <TeamDetail
            key={selected.id}
            teamId={selected.id}
            name={selected.name}
            team={selected}
            run={run}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-slate-500">Kies of maak een team.</p>
        )}
      </section>
      </div>
    </div>
  )
}

function TeamDetail({
  teamId,
  name,
  team,
  run,
  onDeleted,
}: {
  teamId: string
  name: string
  team: Team
  run: (fn: () => Promise<unknown>) => Promise<void>
  onDeleted: () => void
}) {
  const players = useLiveQuery(
    () => db.players.where('teamId').equals(teamId).sortBy('number'),
    [teamId],
  )
  const [teamName, setTeamName] = useState(name)
  const [shortName, setShortName] = useState(team.shortName ?? '')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="label">
          Teamnaam
          <input
            className="field"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onBlur={() => {
              const n = teamName.trim()
              if (n && n !== name) void run(() => repo.renameTeam(teamId, n))
              else setTeamName(name)
            }}
          />
        </label>
        <label className="label w-32">
          Korte naam
          <input
            className="field"
            value={shortName}
            maxLength={4}
            placeholder="Bijv. EHV"
            onChange={(e) => setShortName(e.target.value.toUpperCase())}
            onBlur={() => {
              const s = shortName.trim()
              if (s !== (team.shortName ?? '')) void run(() => repo.updateTeam(teamId, { shortName: s || undefined }))
            }}
          />
        </label>
        <button
          className="btn btn-danger"
          onClick={() => {
            void run(async () => {
              const u = await repo.teamUsage(teamId)
              const has = [
                u.players > 0 && `${u.players} speler(s)`,
                u.matches > 0 && `${u.matches} wedstrijd(en)`,
                u.actions > 0 && `${u.actions} actie(s)`,
              ].filter(Boolean)
              const warning = has.length
                ? `Dit team heeft ${has.join(', ')}. Alles wordt definitief verwijderd, ook online. Ben je zeker?`
                : `Team "${name}" verwijderen? Ben je zeker?`
              if (!confirm(warning)) return
              await repo.deleteTeam(teamId)
              onDeleted()
            })
          }}
        >
          Team verwijderen
        </button>
      </div>

      <h3 className="section-title">Spelers</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Nr</th>
            <th>Naam</th>
            <th>Positie</th>
            <th>Keeper</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {players?.map((p) => (
            <PlayerRow key={p.id} player={p} run={run} />
          ))}
          <NewPlayerRow teamId={teamId} run={run} />
        </tbody>
      </table>
      <StaffSection team={team} run={run} />
      <RosterImport teamId={teamId} existing={players?.map((p) => p.number) ?? []} run={run} />
    </div>
  )
}

type Run = (fn: () => Promise<unknown>) => Promise<void>

/** Coaches and other staff: they can get a card or a 2-minute suspension. */
function StaffSection({ team, run }: { team: Team; run: Run }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState(STAFF_ROLES[0])
  const staff = team.staff ?? []
  const save = (next: NonNullable<Team['staff']>) => run(() => repo.updateTeam(team.id, { staff: next }))

  return (
    <section className="space-y-2" aria-label="Staf">
      <h3 className="section-title">Staf en trainers</h3>
      {staff.length === 0 && <p className="text-sm text-slate-500">Nog geen staf.</p>}
      <ul className="space-y-2">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2">
            <input
              className="field min-w-0 flex-1"
              aria-label={`Naam van ${s.name}`}
              defaultValue={s.name}
              onBlur={(e) => {
                const n = e.target.value.trim()
                if (n && n !== s.name) void save(updateStaff(staff, s.id, { name: n }))
                else e.target.value = s.name
              }}
            />
            <select
              className="field w-auto"
              aria-label={`Rol van ${s.name}`}
              value={s.role}
              onChange={(e) => void save(updateStaff(staff, s.id, { role: e.target.value }))}
            >
              {[...new Set([...STAFF_ROLES, s.role])].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              className="btn"
              aria-label={`Verwijder ${s.name}`}
              onClick={() => void save(removeStaff(staff, s.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          void save(addStaff(staff, name, role, crypto.randomUUID()))
          setName('')
        }}
      >
        <input
          className="field min-w-0 flex-1"
          placeholder="Naam staflid"
          aria-label="Naam nieuw staflid"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="field w-auto"
          aria-label="Rol nieuw staflid"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          Toevoegen
        </button>
      </form>
    </section>
  )
}

function PlayerRow({ player, run }: { player: Player; run: Run }) {
  const [num, setNum] = useState(String(player.number))
  const [nm, setNm] = useState(player.name)
  const [pos, setPos] = useState(player.position)

  const save = (patch: Partial<Player>) =>
    run(() => repo.updatePlayer(player.id, patch))

  return (
    <tr>
      <td className="p-1">
        <input
          className="field w-20"
          type="number"
          min={0}
          max={99}
          value={num}
          aria-label={`Rugnummer ${player.name}`}
          onChange={(e) => setNum(e.target.value)}
          onBlur={() => {
            const n = Number(num)
            if (!Number.isInteger(n) || n < 0 || n === player.number)
              setNum(String(player.number))
            else
              void save({ number: n }).then(() => setNum(String(player.number)))
          }}
        />
      </td>
      <td className="p-1">
        <input
          className="field w-full"
          value={nm}
          aria-label={`Naam speler ${player.number}`}
          onChange={(e) => setNm(e.target.value)}
          onBlur={() => {
            const v = nm.trim()
            if (v && v !== player.name) void save({ name: v })
            else setNm(player.name)
          }}
        />
      </td>
      <td className="p-1">
        <input
          className="field w-full"
          value={pos}
          aria-label={`Positie speler ${player.number}`}
          onChange={(e) => setPos(e.target.value)}
          onBlur={() => {
            if (pos !== player.position) void save({ position: pos.trim() })
          }}
        />
      </td>
      <td className="p-1">
        <label className="flex h-11 w-11 items-center justify-center">
          <input
            type="checkbox"
            className="checkbox"
            checked={player.isGoalkeeper}
            aria-label={`Keeper ${player.name}`}
            onChange={(e) => void save({ isGoalkeeper: e.target.checked })}
          />
        </label>
      </td>
      <td className="p-1 text-right">
        <button
          className="btn btn-danger"
          aria-label={`Verwijder ${player.name}`}
          onClick={() => {
            if (confirm(`Speler "${player.name}" verwijderen?`))
              void run(() => repo.deletePlayer(player.id))
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

function NewPlayerRow({ teamId, run }: { teamId: string; run: Run }) {
  const [num, setNum] = useState('')
  const [nm, setNm] = useState('')
  const [pos, setPos] = useState('')
  const [gk, setGk] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const number = Number(num)
    const name = nm.trim()
    if (!name || num === '' || !Number.isInteger(number) || number < 0) return
    await run(async () => {
      await repo.addPlayer({
        teamId,
        number,
        name,
        position: pos.trim(),
        isGoalkeeper: gk,
      })
      setNum('')
      setNm('')
      setPos('')
      setGk(false)
    })
  }

  return (
    <tr style={{ background: 'var(--canvas)' }}>
      <td className="p-1">
        <input
          form="new-player"
          className="field w-20"
          type="number"
          min={0}
          max={99}
          placeholder="Nr"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          aria-label="Rugnummer nieuwe speler"
        />
      </td>
      <td className="p-1">
        <input
          form="new-player"
          className="field w-full"
          placeholder="Naam"
          value={nm}
          onChange={(e) => setNm(e.target.value)}
          aria-label="Naam nieuwe speler"
        />
      </td>
      <td className="p-1">
        <input
          form="new-player"
          className="field w-full"
          placeholder="Positie"
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          aria-label="Positie nieuwe speler"
        />
      </td>
      <td className="p-1">
        <label className="flex h-11 w-11 items-center justify-center">
          <input
            form="new-player"
            type="checkbox"
            className="checkbox"
            checked={gk}
            onChange={(e) => setGk(e.target.checked)}
            aria-label="Nieuwe speler is keeper"
          />
        </label>
      </td>
      <td className="p-1 text-right">
        <form id="new-player" onSubmit={submit}>
          <button className="btn btn-primary" type="submit">
            +
          </button>
        </form>
      </td>
    </tr>
  )
}

function RosterImport({
  teamId,
  existing,
  run,
}: {
  teamId: string
  existing: number[]
  run: Run
}) {
  const [text, setText] = useState('')
  const [report, setReport] = useState<string[]>([])
  const parsed = parseRoster(text)

  async function doImport() {
    const problems = [...parsed.errors]
    let added = 0
    for (const e of parsed.entries) {
      if (existing.includes(e.number)) {
        problems.push(`Rugnummer ${e.number} (${e.name}) bestaat al in dit team en is overgeslagen.`)
        continue
      }
      await run(() => repo.addPlayer({ teamId, ...e }))
      added++
    }
    setReport([`${added} speler${added === 1 ? '' : 's'} toegevoegd.`, ...problems])
    if (problems.length === parsed.errors.length) setText('')
  }

  return (
    <details className="rounded-lg border border-slate-200 p-3">
      <summary className="cursor-pointer font-semibold">
        Spelerslijst plakken (bijv. uit Excel)
      </summary>
      <p className="mt-2 text-sm text-slate-600">
        Eén speler per regel: <code>nummer;naam;positie;K</code>. De laatste twee
        mogen leeg. Tab, komma of puntkomma werken, dus je kunt kolommen uit
        Excel direct plakken.
      </p>
      <textarea
        className="field mt-2 h-32 w-full py-2 font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'1;Daan de Vries;Keeper;K\n7;Jesse Visser;Linksbuiten'}
        aria-label="Spelerslijst"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          className="btn btn-primary"
          disabled={parsed.entries.length === 0}
          onClick={() => void doImport()}
        >
          {parsed.entries.length} speler{parsed.entries.length === 1 ? '' : 's'} importeren
        </button>
        {parsed.errors.length > 0 && (
          <span className="text-sm text-amber-700">{parsed.errors.length} regel(s) met fout</span>
        )}
      </div>
      {report.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700" role="status">
          {report.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </details>
  )
}
