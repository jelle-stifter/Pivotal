import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { pullAll, pushTeam } from '../lib/sync'
import {
  createTeam,
  joinTeam,
  listMembers,
  myMemberships,
  removeMember,
  setJoinOpen,
  setMember,
  type Member,
  type Membership,
  type Role,
} from '../lib/cloud'

const ROLE_LABEL: Record<Role, string> = {
  coach: 'Coach',
  assistant: 'Assistent',
  player: 'Speler',
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Er ging iets mis'
}

const btn =
  'min-h-11 cursor-pointer rounded-lg px-4 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100'
const input = 'min-h-11 w-full rounded-lg border border-slate-300 px-3'

export default function AccountPage() {
  const [memberships, setMemberships] = useState<Membership[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [code, setCode] = useState('')
  const [pickId, setPickId] = useState('')
  const localTeams = useLiveQuery(() => db.teams.orderBy('name').toArray(), [])

  const reload = useCallback(async () => {
    try {
      setMemberships(await myMemberships())
    } catch (e) {
      setError(errorMessage(e))
      setMemberships([])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function run(fn: () => Promise<void>) {
    setError('')
    setNotice('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    await run(async () => {
      const name = await joinTeam(code)
      setCode('')
      setNotice(`Aanmelding voor ${name} verstuurd. Een coach moet je nog goedkeuren.`)
    })
  }

  async function publish(e: FormEvent) {
    e.preventDefault()
    const team = localTeams?.find((t) => t.id === pickId)
    if (!team) return
    await run(async () => {
      await createTeam(team.id, team.name)
      setPickId('')
      setNotice(`${team.name} staat online. Deel de code met je spelers.`)
    })
  }

  const [pulling, setPulling] = useState(false)

  async function pull() {
    setPulling(true)
    setError('')
    setNotice('')
    try {
      const playerOnly = (memberships ?? [])
        .filter((m) => m.role === 'player' && m.status === 'approved')
        .map((m) => m.teamId)
      const r = await pullAll(playerOnly)
      setNotice(
        `Opgehaald: ${r.teams} teams, ${r.players} spelers, ${r.matches} wedstrijden, ${r.actions} acties`,
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPulling(false)
    }
  }

  const onlineIds = new Set(memberships?.map((m) => m.teamId))
  const available = (localTeams ?? []).filter((t) => !onlineIds.has(t.id))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h2 className="text-2xl font-bold">Mijn teams online</h2>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </p>
      )}

      <section aria-labelledby="mine">
        <h3 id="mine" className="mb-3 text-lg font-semibold">
          Teams
        </h3>
        {memberships === null ? (
          <p className="text-sm text-slate-500">Laden…</p>
        ) : memberships.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nog geen online teams. Zet een team online als coach, of meld je aan met een code.
          </p>
        ) : (
          <ul className="space-y-4">
            {memberships.map((m) => (
              <TeamCard key={m.teamId} m={m} onChanged={reload} onlineIds={onlineIds} />
            ))}
          </ul>
        )}
      </section>

      {memberships && memberships.some((m) => m.status === 'approved') && (
        <section aria-labelledby="pull">
          <h3 id="pull" className="mb-1 text-lg font-semibold">
            Ophalen van online
          </h3>
          <p className="mb-3 text-sm text-slate-600">
            Haal de teams, spelers, wedstrijden en acties op die je mag zien. Coach en assistent:
            dit overschrijft lokale wijzigingen van dezelfde wedstrijden, upload dus eerst.
          </p>
          <button
            type="button"
            disabled={pulling}
            onClick={pull}
            className={btn}
            style={{ background: 'var(--brand)' }}
          >
            {pulling ? 'Bezig…' : 'Ophalen'}
          </button>
        </section>
      )}

      <section aria-labelledby="publish">
        <h3 id="publish" className="mb-1 text-lg font-semibold">
          Team online zetten (coach)
        </h3>
        <p className="mb-3 text-sm text-slate-600">
          Kies een team van dit apparaat. Jij wordt coach en krijgt een code voor je spelers.
        </p>
        {available.length === 0 ? (
          <p className="text-sm text-slate-500">Geen teams beschikbaar om online te zetten.</p>
        ) : (
          <form onSubmit={publish} className="flex gap-2">
            <select
              aria-label="Team"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className={input}
            >
              <option value="">Kies een team…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!pickId}
              className={btn}
              style={{ background: 'var(--brand)' }}
            >
              Online zetten
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="join">
        <h3 id="join" className="mb-1 text-lg font-semibold">
          Aanmelden bij een team (speler)
        </h3>
        <p className="mb-3 text-sm text-slate-600">
          Vul de code in die je coach je gaf. Je ziet pas data na goedkeuring.
        </p>
        <form onSubmit={join} className="flex gap-2">
          <input
            aria-label="Teamcode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code, bv. 3F9A1C2B"
            maxLength={8}
            className={input}
          />
          <button
            type="submit"
            disabled={code.trim().length < 4}
            className={btn}
            style={{ background: 'var(--brand)' }}
          >
            Aanmelden
          </button>
        </form>
      </section>
    </div>
  )
}

function TeamCard({
  m,
  onChanged,
  onlineIds,
}: {
  m: Membership
  onChanged: () => Promise<void>
  onlineIds: Set<string>
}) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const isCoach = m.role === 'coach' && m.status === 'approved'
  const isStaff = (m.role === 'coach' || m.role === 'assistant') && m.status === 'approved'

  async function upload() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const r = await pushTeam(m.teamId, onlineIds)
      setResult(`Geüpload: ${r.players} spelers, ${r.matches} wedstrijden, ${r.actions} acties`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(m.teamId))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [m.teamId])

  useEffect(() => {
    // Only coaches can see the whole member list.
    if (isCoach) void load()
  }, [isCoach, load])

  async function act(fn: () => Promise<void>) {
    setError('')
    try {
      await fn()
      await load()
      await onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-base">{m.teamName}</strong>
        <span className="text-sm text-slate-600">
          {ROLE_LABEL[m.role]} · {m.status === 'approved' ? 'goedgekeurd' : 'wacht op goedkeuring'}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {isStaff && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            disabled={busy}
            onClick={upload}
            className="min-h-11 cursor-pointer rounded-lg px-4 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'var(--brand)' }}
          >
            {busy ? 'Bezig…' : 'Upload naar online'}
          </button>
          {result && (
            <span role="status" className="text-emerald-800">
              {result}
            </span>
          )}
        </div>
      )}
      {isCoach && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Code: <code className="rounded bg-slate-100 px-2 py-1 font-bold">{m.inviteCode}</code>
            </span>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={m.joinOpen}
                onChange={(e) => act(() => setJoinOpen(m.teamId, e.target.checked))}
              />
              Aanmelden open
            </label>
          </div>
          <ul className="divide-y divide-slate-100">
            {(members ?? []).map((x) => (
              <li key={x.userId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                <select
                  aria-label={`Rol van ${x.name}`}
                  value={x.role}
                  onChange={(e) =>
                    act(() => setMember(m.teamId, x.userId, { role: e.target.value as Role }))
                  }
                  className="min-h-11 rounded-lg border border-slate-300 px-2"
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {x.role === 'player' && x.status === 'approved' && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={x.canScore}
                      onChange={(e) =>
                        act(() => setMember(m.teamId, x.userId, { can_score: e.target.checked }))
                      }
                    />
                    Mag scoren
                  </label>
                )}
                {x.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => act(() => setMember(m.teamId, x.userId, { status: 'approved' }))}
                    className="min-h-11 rounded-lg px-3 font-semibold text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    Goedkeuren
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => act(() => removeMember(m.teamId, x.userId))}
                  className="min-h-11 rounded-lg px-3 text-red-700"
                >
                  Verwijderen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
