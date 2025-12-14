import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const BASE_POTS = [
  {
    id: 'pot1',
    label: '1. Torba',
    color: '#1c7ed6',
    accent: '#74c0fc',
    teams: [
      { id: 'man-city', name: 'Manchester City' },
      { id: 'real-madrid', name: 'Real Madrid' },
      { id: 'bayern', name: 'Bayern Munich' },
      { id: 'psg', name: 'Paris Saint-Germain' },
      { id: 'liverpool', name: 'Liverpool' },
      { id: 'barcelona', name: 'Barcelona' },
      { id: 'inter', name: 'Inter' },
      { id: 'arsenal', name: 'Arsenal' },
    ],
  },
  {
    id: 'pot2',
    label: '2. Torba',
    color: '#12b886',
    accent: '#63e6be',
    teams: [
      { id: 'juventus', name: 'Juventus' },
      { id: 'atletico', name: 'Atletico Madrid' },
      { id: 'dortmund', name: 'Borussia Dortmund' },
      { id: 'leipzig', name: 'RB Leipzig' },
      { id: 'porto', name: 'Porto' },
      { id: 'benfica', name: 'Benfica' },
      { id: 'napoli', name: 'Napoli' },
      { id: 'tottenham', name: 'Tottenham' },
    ],
  },
  {
    id: 'pot3',
    label: '3. Torba',
    color: '#f59f00',
    accent: '#ffd43b',
    teams: [
      { id: 'ajax', name: 'Ajax' },
      { id: 'sevilla', name: 'Sevilla' },
      { id: 'ac-milan', name: 'AC Milan' },
      { id: 'lazio', name: 'Lazio' },
      { id: 'shakhtar', name: 'Shakhtar Donetsk' },
      { id: 'monaco', name: 'Monaco' },
      { id: 'leverkusen', name: 'Bayer Leverkusen' },
      { id: 'psv', name: 'PSV Eindhoven' },
    ],
  },
]

const DRAW_SETTINGS = {
  initialDelay: 600,
  revealDelay: 900,
  teamPause: 1200,
}

function App() {
  const [potsConfig, setPotsConfig] = useState(() => clonePots(BASE_POTS))
  const [snapshot, setSnapshot] = useState(() => buildTournament(potsConfig))
  const [revealedMap, setRevealedMap] = useState(() =>
    createInitialRevealedMap(snapshot.teamEntries),
  )
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasUnsavedConfig, setHasUnsavedConfig] = useState(false)
  const [fixtures, setFixtures] = useState(null)
  const [isBulkDrawing, setIsBulkDrawing] = useState(false)

  const timersRef = useRef([])
  const revealedMapRef = useRef(revealedMap)

  const { pots, potOrder, teamEntries, teamMap } = snapshot

  const potMeta = useMemo(() => {
    return pots.reduce((acc, pot) => {
      acc[pot.id] = pot
      return acc
    }, {})
  }, [pots])

  const totalSteps = teamEntries.length * 6
  const completedSteps = useMemo(
    () =>
      teamEntries.reduce((acc, entry) => {
        const revealed = revealedMap[entry.team.id] || []
        return acc + revealed.length
      }, 0),
    [teamEntries, revealedMap],
  )
  const progressPercent = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0
  const completedTeams = teamEntries.filter((entry) => {
    const revealed = revealedMap[entry.team.id] || []
    return revealed.length === entry.revealSequence.length
  }).length
  const isComplete = completedTeams === teamEntries.length && teamEntries.length > 0
  // More tolerant completeness check (use Set and allow >= to avoid transient duplicates)
  const allTeamsComplete =
    teamEntries.length > 0 &&
    teamEntries.every((entry) => {
      const revealed = new Set(revealedMap[entry.team.id] || [])
      const required = (entry.revealSequence && entry.revealSequence.length) || 0
      return revealed.size >= required
    })

  const currentEntry = activeTeamId ? teamMap[activeTeamId] : null
  const currentRevealedOpponents = currentEntry ? revealedMap[currentEntry.team.id] || [] : []
  const currentKnown = activeTeamId ? (revealedMap[activeTeamId]?.length || 0) : 0
  const nextOpponent = currentEntry
    ? getNextRevealItem(currentEntry, revealedMap)
    : null
  const currentPot = currentEntry
    ? potMeta[currentEntry.team.potId] || {
      label: currentEntry.team.potLabel,
      color: '#bae6fd',
    }
    : null

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }

  const sleep = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => resolve(), ms)
      timersRef.current.push(id)
    })

  const registerMatch = useCallback((teamAId, teamBId) => {
    if (!teamAId || !teamBId) {
      return
    }

    setRevealedMap((prev) => {
      const next = { ...prev }

      const ensureList = (id) => {
        const existing = next[id] ? [...next[id]] : []
        next[id] = existing
        return existing
      }

      const addUnique = (id, opponentId) => {
        const list = ensureList(id)
        if (!list.includes(opponentId)) {
          list.push(opponentId)
        }
      }

      addUnique(teamAId, teamBId)
      addUnique(teamBId, teamAId)

      revealedMapRef.current = next
      return next
    })
  }, [])

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    revealedMapRef.current = revealedMap
  }, [revealedMap])

  useEffect(() => {
    if (!isDrawing || !activeTeamId) {
      return
    }

    const entry = teamMap[activeTeamId]
    if (!entry) {
      setIsDrawing(false)
      setActiveTeamId(null)
      return
    }

    const totalSlots = entry.revealSequence.length
    const revealedSet = new Set(revealedMapRef.current[activeTeamId] || [])

    let currentIndex = 0
    const advanceToNext = () => {
      while (
        currentIndex < totalSlots &&
        revealedSet.has(entry.revealSequence[currentIndex].opponent.id)
      ) {
        currentIndex += 1
      }
      return currentIndex
    }

    advanceToNext()

    if (currentIndex >= totalSlots) {
      setIsDrawing(false)
      setActiveTeamId(null)
      return
    }

    clearTimers()
    let cancelled = false

    const schedule = (delay, callback) => {
      const id = setTimeout(() => {
        if (cancelled) {
          return
        }
        callback()
      }, delay)
      timersRef.current.push(id)
    }

    const revealNext = () => {
      const slot = entry.revealSequence[currentIndex]
      registerMatch(activeTeamId, slot.opponent.id)
      revealedSet.add(slot.opponent.id)

      currentIndex += 1
      advanceToNext()

      if (currentIndex < totalSlots) {
        schedule(DRAW_SETTINGS.revealDelay, revealNext)
      } else {
        schedule(DRAW_SETTINGS.teamPause, () => {
          setIsDrawing(false)
          setActiveTeamId(null)
        })
      }
    }

    schedule(DRAW_SETTINGS.initialDelay, revealNext)

    return () => {
      cancelled = true
      clearTimers()
    }
  }, [isDrawing, activeTeamId, teamMap, registerMatch])

  useEffect(() => {
    if (selectedTeamId && !teamMap[selectedTeamId]) {
      setSelectedTeamId('')
    }
  }, [selectedTeamId, teamMap])

  const handleTeamNameChange = (potId, teamId, value) => {
    setPotsConfig((prev) =>
      prev.map((pot) =>
        pot.id !== potId
          ? pot
          : {
            ...pot,
            teams: pot.teams.map((team) =>
              team.id !== teamId ? team : { ...team, name: value },
            ),
          },
      ),
    )
    setHasUnsavedConfig(true)
  }

  const applyConfig = (nextConfig) => {
    const normalized = normalizePots(nextConfig)
    const nextSnapshot = buildTournament(normalized)
    setPotsConfig(normalized)
    setSnapshot(nextSnapshot)
    const initialRevealed = createInitialRevealedMap(nextSnapshot.teamEntries)
    setRevealedMap(initialRevealed)
    revealedMapRef.current = initialRevealed
    setSelectedTeamId('')
    setActiveTeamId(null)
    setIsDrawing(false)
    setHasUnsavedConfig(false)
    clearTimers()
  }

  const handleApplyConfig = () => {
    applyConfig(potsConfig)
  }

  const handleReset = () => {
    clearTimers()
    setIsDrawing(false)
    setActiveTeamId(null)
    const resetMap = createInitialRevealedMap(snapshot.teamEntries)
    setRevealedMap(resetMap)
    revealedMapRef.current = resetMap
  }

  const handleRegenerate = () => {
    clearTimers()
    applyConfig(potsConfig)
  }

  const startDrawForTeam = (teamId) => {
    if (!teamId || isDrawing) {
      return
    }
    const entry = teamMap[teamId]
    if (!entry) {
      return
    }
    const revealedForTeam = new Set(revealedMapRef.current[teamId] || [])
    if (revealedForTeam.size >= entry.revealSequence.length) {
      return
    }
    clearTimers()
    setActiveTeamId(teamId)
    setIsDrawing(true)
  }

  const handleSelectedDraw = () => {
    startDrawForTeam(selectedTeamId)
  }

  const handleBulkDraw = async () => {
    if (isBulkDrawing) return
    setIsBulkDrawing(true)
    clearTimers()
    setIsDrawing(false)
    setActiveTeamId(null)
    try {
      const processed = new Set()
      teamEntries.forEach((entry) => {
        const teamId = entry.team.id
          ; (entry.revealSequence || []).forEach((slot) => {
            const opponentId = slot.opponent.id
            const key = [teamId, opponentId].sort().join('|')
            if (processed.has(key)) {
              return
            }
            processed.add(key)
            registerMatch(teamId, opponentId)
          })
      })
      setActiveTeamId(null)
    } finally {
      setIsBulkDrawing(false)
      clearTimers()
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Şampiyonlar Ligi Kura Simülasyonu</h1>
          <p>
            Her takım üç torbadan da ikişer rakip çeker ve toplam 6 maç oynar.
            Rakipler bir kez karşılaşır, rövanş yoktur.
          </p>
        </div>
        <div className="controls">
          <div className="select-group">
            <label htmlFor="team-selector">Takım seç</label>
            <select
              id="team-selector"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              disabled={isDrawing}
            >
              <option value="">Bir takım seçiniz</option>
              {teamEntries.map((entry) => (
                <option key={entry.team.id} value={entry.team.id}>
                  {entry.team.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSelectedDraw}
            disabled={!selectedTeamId || isDrawing}
          >
            Seçili Takım İçin Kura Çek
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleBulkDraw}
            disabled={isDrawing || isBulkDrawing || teamEntries.length === 0}
          >
            Tümünü Toplu Çek
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleReset}>
            Sıfırla
          </button>
          <button type="button" className="btn btn--accent" onClick={handleRegenerate}>
            Yeni Kura Oluştur
          </button>
        </div>
      </header>

      <TeamConfigurator
        pots={potsConfig}
        onNameChange={handleTeamNameChange}
        onApply={handleApplyConfig}
        disabled={isDrawing}
        hasUnsavedChanges={hasUnsavedConfig}
      />

      <section className="progress-card">
        <div className="progress-header">
          <span>Kura İlerlemesi</span>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="progress-footer">
          <span>
            Tamamlanan maç çiftleri: {completedSteps} / {totalSteps}
          </span>
          <span>
            Kurası biten takımlar: {completedTeams} / {teamEntries.length}
          </span>
        </div>
      </section>

      <section className="fixtures-panel">
        <header className="fixtures-header">
          <h2>Fikstür</h2>
          <div className="fixtures-controls">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                try {
                  const fx = generateFixtures(revealedMap, teamEntries)
                  setFixtures(fx)
                } catch (err) {
                  // Friendly feedback instead of hard crash
                  // eslint-disable-next-line no-alert
                  alert(err?.message || 'Fikstür oluşturulurken hata oluştu')
                }
              }}
              disabled={teamEntries.length === 0 || !allTeamsComplete}
            >
              Fikstür Oluştur
            </button>
          </div>
        </header>

        {fixtures && fixtures.length > 0 ? (
          <div className="fixtures-weeks">
            {fixtures.map((week, wi) => (
              <article key={wi} className="fixtures-week">
                <h3>Hafta {wi + 1}</h3>
                <ul>
                  {week.slots.map((slot, si) => (
                    <li key={si} className="fixture-item">
                      <div className="fixture-time">{slot.day} {slot.time}</div>
                      <div className="fixture-match">
                        <strong>{slot.match.teamA.name}</strong>
                        <span> - </span>
                        <strong>{slot.match.teamB.name}</strong>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="fixtures-empty">Fikstür oluşturulmadı. Tüm takımların kurası tamamlandığında aktifleşir.</p>
        )}
        <details className="fixtures-diagnostics" style={{ marginTop: 12 }}>
          <summary>Fikstür Hata Ayıklama Bilgileri</summary>
          <DiagnosticsBlock revealedMap={revealedMap} teamEntries={teamEntries} />
        </details>
      </section>

      <section className="current-draw" aria-live="polite">
        {currentEntry ? (
          <div className="current-draw__content">
            <div className="current-draw__team">
              <span className="pot-badge" style={{ backgroundColor: currentPot.color }}>
                {currentPot.label}
              </span>
              <h2>{currentEntry.team.name}</h2>
            </div>
            <div className="current-draw__details">
              <span>
                Açıklanan rakipler: {currentKnown} / {currentEntry.revealSequence.length}
              </span>
              {nextOpponent ? (
                <span className="next-opponent">
                  Sıradaki torba: {nextOpponent.potLabel} — {nextOpponent.opponent.name}
                </span>
              ) : (
                <span className="next-opponent">Takım tamamlandı.</span>
              )}
            </div>
          </div>
        ) : isComplete ? (
          <div className="current-draw__content">
            <h2>Tüm eşleşmeler tamamlandı 🎉</h2>
            <p>İstersen yeni bir kura oluşturabilir veya mevcut sonuçları gözden geçirebilirsin.</p>
          </div>
        ) : (
          <div className="current-draw__content">
            <h2>Kura hazır</h2>
            <p>Bir takım seçip “Kura Çek” butonuna bastığında eşleşmeler animasyonlu olarak görünecek.</p>
          </div>
        )}
      </section>

      <section className="pots-grid">
        {pots.map((pot) => (
          <article key={pot.id} className="pot-card">
            <header style={{ '--pot-color': pot.color }}>
              <span style={{ backgroundColor: pot.color }}>{pot.label}</span>
              <h3>{pot.label} Takımları</h3>
            </header>
            <ul>
              {pot.teams.map((team) => (
                <li key={team.id}>{team.name}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="teams-grid">
        {teamEntries.map((entry) => {
          const revealedOpponents = revealedMap[entry.team.id] || []
          const revealedCount = revealedOpponents.length
          const isActive = activeTeamId === entry.team.id && isDrawing
          const completed = revealedCount === entry.revealSequence.length
          const canDraw = !completed && !isDrawing

          return (
            <TeamCard
              key={entry.team.id}
              entry={entry}
              potOrder={potOrder}
              potMeta={potMeta}
              revealedOpponents={revealedOpponents}
              isActive={isActive}
              isComplete={completed}
              canDraw={canDraw}
              onDraw={startDrawForTeam}
            />
          )
        })}
      </section>

      {isDrawing && currentEntry ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <TeamCard
              entry={currentEntry}
              potOrder={potOrder}
              potMeta={potMeta}
              revealedOpponents={currentRevealedOpponents}
              isActive
              isComplete={currentRevealedOpponents.length === currentEntry.revealSequence.length}
              canDraw={false}
              onDraw={undefined}
              showAction={false}
              variant="modal"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App

function TeamCard({
  entry,
  potOrder,
  potMeta,
  revealedOpponents = [],
  isActive,
  isComplete,
  canDraw,
  onDraw,
  showAction = true,
  variant,
}) {
  const revealedSet = useMemo(() => new Set(revealedOpponents), [revealedOpponents])
  const revealedByPot = {}

  entry.revealSequence.forEach((item) => {
    if (revealedSet.has(item.opponent.id)) {
      revealedByPot[item.potId] = (revealedByPot[item.potId] || 0) + 1
    }
  })

  const teamPot = potMeta[entry.team.potId] || {
    label: entry.team.potLabel,
    color: '#475569',
    accent: '#64748b',
  }

  let actionLabel = 'Kura Çek'
  if (isComplete) {
    actionLabel = 'Kura Tamamlandı'
  } else if (isActive) {
    actionLabel = 'Kura Çekiliyor…'
  }

  const cardClasses = [
    'team-card',
    isActive ? 'is-active' : '',
    isComplete ? 'is-complete' : '',
    variant === 'modal' ? 'is-modal' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={cardClasses}>
      <header>
        <span className="pot-badge" style={{ backgroundColor: teamPot.color }}>
          {teamPot.label}
        </span>
        <div className="team-card__title">
          <h2>{entry.team.name}</h2>
          <span className="team-card__meta">
            {revealedOpponents.length} / {entry.revealSequence.length} rakip açıklandı
          </span>
        </div>
      </header>
      <div className="team-card__body">
        {potOrder.map((potId) => {
          const opponents = entry.opponentsByPot[potId]
          const potInfo = potMeta[potId] || {
            label: potId,
            accent: '#64748b',
          }

          return (
            <div key={`${entry.team.id}-${potId}`} className="team-card__row">
              <span className="team-card__row-label">{potInfo.label}</span>
              <div className="team-card__chips">
                {opponents.map((opponent) => {
                  const visible = revealedSet.has(opponent.id)
                  return (
                    <span
                      key={opponent.id}
                      className={`chip ${visible ? 'chip--revealed' : 'chip--pending'}`}
                      style={visible ? { borderColor: potInfo.accent } : undefined}
                    >
                      {visible ? opponent.name : '???'}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {showAction ? (
        <div className="team-card__footer">
          <button
            type="button"
            className={`btn btn--ghost btn--small${!canDraw ? ' btn--disabled' : ''}`}
            onClick={() => onDraw?.(entry.team.id)}
            disabled={!canDraw}
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function TeamConfigurator({ pots, onNameChange, onApply, disabled, hasUnsavedChanges }) {
  return (
    <section className="config-panel">
      <header className="config-panel__header">
        <div>
          <h2>Takım Düzenleyici</h2>
          <p>İsimleri güncelle ve yeni kurayı uygula. Değişiklikler kaydedildikten sonra kura yeniden oluşturulur.</p>
        </div>
        <button
          type="button"
          className="btn btn--accent"
          onClick={onApply}
          disabled={disabled || !hasUnsavedChanges}
        >
          Değişiklikleri Uygula
        </button>
      </header>
      <div className="config-grid">
        {pots.map((pot) => (
          <article key={pot.id} className="config-pot">
            <h3>{pot.label}</h3>
            <div className="config-pot__list">
              {pot.teams.map((team, index) => (
                <label key={team.id} className="config-pot__field">
                  <span>{index + 1}.</span>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(event) => onNameChange(pot.id, team.id, event.target.value)}
                    placeholder={`${pot.label} Takım ${index + 1}`}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function buildTournament(basePots) {
  const attemptLimit = 20
  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    try {
      return generateSnapshot(basePots)
    } catch (error) {
      if (attempt === attemptLimit - 1) {
        console.error('Kura oluşturulamadı, deterministik metoda geçiliyor.', error)
        return generateSnapshot(basePots, true)
      }
    }
  }
  return generateSnapshot(basePots, true)
}

function generateSnapshot(basePots, useDeterministic = false) {
  const rng = Math.random
  const pots = basePots.map((pot) => ({
    ...pot,
    teams: pot.teams.map((team, index) => ({
      ...team,
      name: team.name.trim(),
      potId: pot.id,
      potLabel: pot.label,
      seed: index + 1,
    })),
  }))

  const potOrder = pots.map((pot) => pot.id)
  const potLookup = pots.reduce((acc, pot) => {
    acc[pot.id] = pot
    return acc
  }, {})

  const assignments = {}
  pots.forEach((pot) => {
    pot.teams.forEach((team) => {
      assignments[team.id] = {
        team,
        opponentsByPot: potOrder.reduce((acc, potId) => {
          acc[potId] = []
          return acc
        }, {}),
      }
    })
  })

  const matchSet = new Set()

  const addMatch = (teamA, teamB) => {
    if (teamA.id === teamB.id) {
      return
    }
    const key = [teamA.id, teamB.id].sort().join('|')
    if (matchSet.has(key)) {
      return
    }
    matchSet.add(key)
    assignments[teamA.id].opponentsByPot[teamB.potId].push(teamB)
    assignments[teamB.id].opponentsByPot[teamA.potId].push(teamA)
  }

  pots.forEach((pot) => {
    const order = shuffle([...pot.teams], rng)
    order.forEach((team, index) => {
      const opponent = order[(index + 1) % order.length]
      addMatch(team, opponent)
    })
  })

  for (let i = 0; i < pots.length; i += 1) {
    for (let j = i + 1; j < pots.length; j += 1) {
      const potA = pots[i]
      const potB = pots[j]

      const orderA = shuffle([...potA.teams], rng)
      const perm1 = shuffle([...potB.teams], rng)
      let perm2

      if (useDeterministic) {
        perm2 = rotate([...perm1], 1)
      } else {
        let attempts = 0
        do {
          perm2 = shuffle([...potB.teams], rng)
          attempts += 1
        } while (
          perm2.some((team, index) => team.id === perm1[index].id) &&
          attempts < 30
        )

        if (perm2.some((team, index) => team.id === perm1[index].id)) {
          perm2 = rotate([...perm1], 1)
        }
      }

      orderA.forEach((teamA, index) => {
        addMatch(teamA, perm1[index])
        addMatch(teamA, perm2[index])
      })
    }
  }

  const expectedPerPot = 2
  const isValid = Object.values(assignments).every((entry) =>
    potOrder.every(
      (potId) => entry.opponentsByPot[potId].length === expectedPerPot,
    ),
  )

  if (!isValid) {
    throw new Error('Kurallar ile uyumlu eşleşme bulunamadı')
  }

  const teamEntries = Object.values(assignments).map((entry) => {
    const orderedByPot = {}

    potOrder.forEach((potId) => {
      const opponents = [...entry.opponentsByPot[potId]]
      shuffle(opponents, rng)
      orderedByPot[potId] = opponents
    })

    const revealPotOrder = [
      ...potOrder.filter((potId) => potId !== entry.team.potId),
      entry.team.potId,
    ]

    const revealSequence = revealPotOrder.flatMap((potId) =>
      orderedByPot[potId].map((opponent) => ({
        opponent,
        potId,
        potLabel: potLookup[potId].label,
      })),
    )

    return {
      team: entry.team,
      opponentsByPot: orderedByPot,
      revealSequence,
    }
  })

  teamEntries.sort((a, b) => {
    const potDiff =
      potOrder.indexOf(a.team.potId) - potOrder.indexOf(b.team.potId)
    if (potDiff !== 0) {
      return potDiff
    }
    return a.team.name.localeCompare(b.team.name)
  })

  const teamMap = teamEntries.reduce((acc, entry) => {
    acc[entry.team.id] = entry
    return acc
  }, {})

  return {
    pots,
    potOrder,
    teamEntries,
    teamMap,
  }
}

function createInitialRevealedMap(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.team.id] = []
    return acc
  }, {})
}

function DiagnosticsBlock({ revealedMap, teamEntries }) {
  const diag = computeFixtureDiagnostics(revealedMap, teamEntries)
  return (
    <div style={{ fontSize: 13 }}>
      <div><strong>Toplam bulunan maçlar:</strong> {diag.totalMatches}</div>
      <div><strong>Beklenen maçlar (özet):</strong> {diag.expectedMatches}</div>
      <div><strong>Rebuilt eşleşmeler:</strong> {diag.rebuiltCount}</div>
      <div style={{ marginTop: 8 }}><strong>Örnek eşleşmeler (ilk 12):</strong></div>
      <ul>
        {diag.sampleMatches.map((m, i) => (
          <li key={i}>{m.teamA.name} — {m.teamB.name}</li>
        ))}
      </ul>
      <div style={{ marginTop: 8 }}><strong>Takım bazlı durum (ilk 12):</strong></div>
      <ul>
        {diag.perTeam.slice(0, 12).map((t) => (
          <li key={t.id}>{t.name}: revealed {t.revealed} / expected {t.expected}</li>
        ))}
      </ul>
    </div>
  )
}

function getNextRevealItem(entry, revealedMapObj) {
  const revealed = new Set(revealedMapObj[entry.team.id] || [])
  return entry.revealSequence.find((item) => !revealed.has(item.opponent.id)) || null
}

// Fixtures state and helpers
let DEFAULT_SLOTS = null
function getWeekSlots() {
  if (DEFAULT_SLOTS) return DEFAULT_SLOTS
  // order: Wed22, Wed23, Thu22, Thu23, Fri22, Fri23, Sat21, Sat22, Sat23, Sun21, Sun22, Sun23
  const slots = [
    { day: 'Çarşamba', time: '22:00-23:00' },
    { day: 'Çarşamba', time: '23:00-00:00' },
    { day: 'Perşembe', time: '22:00-23:00' },
    { day: 'Perşembe', time: '23:00-00:00' },
    { day: 'Cuma', time: '22:00-23:00' },
    { day: 'Cuma', time: '23:00-00:00' },
    { day: 'Cumartesi', time: '21:00-22:00' },
    { day: 'Cumartesi', time: '22:00-23:00' },
    { day: 'Cumartesi', time: '23:00-00:00' },
    { day: 'Pazar', time: '21:00-22:00' },
    { day: 'Pazar', time: '22:00-23:00' },
    { day: 'Pazar', time: '23:00-00:00' },
  ]
  DEFAULT_SLOTS = slots
  return slots
}

function buildUniqueMatchesFromMap(revealedMapObj, teamMap) {
  const done = new Set()
  const matches = []
  Object.keys(revealedMapObj).forEach((teamId) => {
    const opponents = revealedMapObj[teamId] || []
    opponents.forEach((oppId) => {
      const key = [teamId, oppId].sort().join('|')
      if (!done.has(key)) {
        done.add(key)
        matches.push({ teamA: teamMap[teamId].team, teamB: teamMap[oppId].team })
      }
    })
  })
  return matches
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateFixtures(revealedMapObj, teamEntriesList) {
  // Build unique matches
  const teamMapLocal = teamEntriesList.reduce((acc, e) => {
    acc[e.team.id] = e
    return acc
  }, {})
  let allMatches = buildUniqueMatchesFromMap(revealedMapObj, teamMapLocal)

  const totalMatches = allMatches.length
  const weeks = 6
  const matchesPerWeek = totalMatches / weeks

  const expectedMatches =
    teamEntriesList.reduce((acc, e) => acc + ((e.revealSequence && e.revealSequence.length) || 0), 0) / 2

  if (!Number.isInteger(matchesPerWeek)) {
    throw new Error('Beklenmeyen toplam maç sayısı; haftalara eşit dağıtılamıyor')
  }

  if (Math.round(expectedMatches) !== expectedMatches) {
    throw new Error('Takım başına düşen maç sayısı beklenenden farklı')
  }

  if (expectedMatches !== totalMatches) {
    // attempt to rebuild matches from teamEntries (authoritative revealSequence)
    const rebuilt = []
    const seen = new Set()
    teamEntriesList.forEach((entry) => {
      const a = entry.team.id
        ; (entry.revealSequence || []).forEach((slot) => {
          const b = slot.opponent.id
          const k = [a, b].sort().join('|')
          if (!seen.has(k)) {
            seen.add(k)
            rebuilt.push({ teamA: teamMapLocal[a].team, teamB: teamMapLocal[b].team })
          }
        })
    })

    if (rebuilt.length === expectedMatches) {
      allMatches = rebuilt
    } else {
      throw new Error(
        `Eşleşme sayısı uyuşmuyor: beklenen ${expectedMatches}, bulunan ${totalMatches}. Rebuilt: ${rebuilt.length}`,
      )
    }
  }

  const matches = shuffleArray([...allMatches])
  const teamIds = teamEntriesList.map((entry) => entry.team.id)
  const matchKey = (a, b) => [a, b].sort().join('|')
  const baseAdjacency = new Map()
  const matchLookup = new Map()

  matches.forEach((match) => {
    const { teamA, teamB } = match
    if (!baseAdjacency.has(teamA.id)) baseAdjacency.set(teamA.id, new Set())
    if (!baseAdjacency.has(teamB.id)) baseAdjacency.set(teamB.id, new Set())
    baseAdjacency.get(teamA.id).add(teamB.id)
    baseAdjacency.get(teamB.id).add(teamA.id)
    matchLookup.set(matchKey(teamA.id, teamB.id), match)
  })

  const cloneAdjacency = (source) => {
    const clone = new Map()
    source.forEach((set, teamId) => {
      clone.set(teamId, new Set(set))
    })
    return clone
  }

  const maxAttempts = 200
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const adjacency = cloneAdjacency(baseAdjacency)
    const weeksArr = []
    let failed = false

    for (let w = 0; w < weeks; w += 1) {
      const result = buildWeekMatching(adjacency, matchLookup, teamIds)
      if (!result) {
        failed = true
        break
      }
      weeksArr.push(result)
    }

    if (!failed && weeksArr.length === weeks) {
      const slotsTemplate = getWeekSlots()
      return weeksArr.map((weekMatches) => {
        const slots = shuffleArray([...slotsTemplate])
        return {
          slots: slots.map((slot, i) => ({ day: slot.day, time: slot.time, match: weekMatches[i] })),
        }
      })
    }
  }

  throw new Error('Fikstür oluşturulamadı; mükemmel dağıtım bulunamadı. Lütfen yeni kura oluşturmayı deneyin.')
}

function buildWeekMatching(adjacency, matchLookup, teamIds) {
  const localAdj = new Map()
  adjacency.forEach((set, teamId) => {
    localAdj.set(teamId, new Set(set))
  })

  const unmatched = new Set(teamIds)
  const matches = []
  const usedEdges = []
  let safetyCounter = 0
  const maxSteps = 60000

  const selectTeam = () => {
    let chosen = null
    let neighbors = []
    let minDegree = Infinity
    unmatched.forEach((teamId) => {
      const opts = [...(localAdj.get(teamId) || [])].filter((opp) => unmatched.has(opp))
      if (opts.length === 0) {
        chosen = teamId
        neighbors = []
        minDegree = 0
        return
      }
      if (opts.length < minDegree) {
        chosen = teamId
        neighbors = opts
        minDegree = opts.length
      }
    })
    return { teamId: chosen, neighbors }
  }

  const backtrack = () => {
    safetyCounter += 1
    if (safetyCounter > maxSteps) {
      return false
    }

    if (unmatched.size === 0) {
      return true
    }

    const { teamId, neighbors } = selectTeam()
    if (!teamId || neighbors.length === 0) {
      return false
    }

    const shuffled = shuffleArray([...neighbors])
    for (const oppId of shuffled) {
      if (!unmatched.has(oppId)) {
        continue
      }
      const key = [teamId, oppId].sort().join('|')
      const match = matchLookup.get(key)
      if (!match) {
        continue
      }

      matches.push(match)
      usedEdges.push([teamId, oppId])
      unmatched.delete(teamId)
      unmatched.delete(oppId)
      localAdj.get(teamId)?.delete(oppId)
      localAdj.get(oppId)?.delete(teamId)

      if (backtrack()) {
        return true
      }

      unmatched.add(teamId)
      unmatched.add(oppId)
      matches.pop()
      usedEdges.pop()
      localAdj.get(teamId)?.add(oppId)
      localAdj.get(oppId)?.add(teamId)
    }

    return false
  }

  const ok = backtrack()
  if (!ok || matches.length !== teamIds.length / 2) {
    return null
  }

  // Commit used edges to adjacency so they are removed for future weeks
  usedEdges.forEach(([a, b]) => {
    adjacency.get(a)?.delete(b)
    adjacency.get(b)?.delete(a)
  })

  return matches
}

function computeFixtureDiagnostics(revealedMapObj, teamEntriesList) {
  const teamMapLocal = teamEntriesList.reduce((acc, e) => {
    acc[e.team.id] = e
    return acc
  }, {})

  const allMatches = buildUniqueMatchesFromMap(revealedMapObj, teamMapLocal)
  const totalMatches = allMatches.length
  const expectedMatches =
    teamEntriesList.reduce((acc, e) => acc + ((e.revealSequence && e.revealSequence.length) || 0), 0) / 2

  // rebuilt from revealSequence
  const rebuilt = []
  const seen = new Set()
  teamEntriesList.forEach((entry) => {
    const a = entry.team.id
      ; (entry.revealSequence || []).forEach((slot) => {
        const b = slot.opponent.id
        const k = [a, b].sort().join('|')
        if (!seen.has(k)) {
          seen.add(k)
          rebuilt.push({ a, b })
        }
      })
  })

  const perTeam = teamEntriesList.map((entry) => ({
    id: entry.team.id,
    name: entry.team.name,
    revealed: (revealedMapObj[entry.team.id] || []).length,
    expected: (entry.revealSequence && entry.revealSequence.length) || 0,
  }))

  return { totalMatches, expectedMatches, rebuiltCount: rebuilt.length, sampleMatches: allMatches.slice(0, 12), perTeam }
}
function shuffle(array, rng = Math.random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

function rotate(array, step = 1) {
  if (array.length === 0) {
    return []
  }
  const offset = ((step % array.length) + array.length) % array.length
  return array.slice(offset).concat(array.slice(0, offset))
}

function clonePots(pots) {
  return pots.map((pot) => ({
    ...pot,
    teams: pot.teams.map((team) => ({ ...team })),
  }))
}

function normalizePots(pots) {
  return pots.map((pot) => ({
    ...pot,
    teams: pot.teams.map((team, index) => {
      const trimmed = (team.name || '').trim()
      return {
        ...team,
        name: trimmed || `${pot.label} Takım ${index + 1}`,
      }
    }),
  }))
}
