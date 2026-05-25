import React, { useState, useEffect, useRef, useMemo } from 'react'

// ── Căutare globală ───────────────────────────────────────────
export default function GlobalSearch({ apts, curatenii, onNavigate, onEditApt }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef()
  const containerRef = useRef()

  // Shortcut '/' pentru deschidere
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50) }
    else { setQuery(''); setSelected(0) }
  }, [open])

  // Click outside
  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Rezultate
  const results = useMemo(() => {
    if (!query.trim() || query.length < 1) return []
    const q = query.toLowerCase()
    const res = []

    // Apartamente
    apts.forEach(a => {
      const score =
        String(a.nr).toLowerCase().startsWith(q) ? 3 :
        (a.firma||'').toLowerCase().includes(q) ? 2 :
        (a.nota||'').toLowerCase().includes(q) ? 1 : 0
      if (score > 0) res.push({
        type: 'apt', score,
        id: `apt-${a.nr}`,
        title: `AP ${a.nr}`,
        subtitle: a.firma || 'Liber',
        meta: a.status === 'activ' ? `${a.pret} RON · Ocupat` : a.status === 'elib' ? `Elib. ${a.data_elib}` : a.status,
        badge: a.status,
        icon: '🚪',
        data: a
      })
    })

    // Firme unice
    const firme = {}
    apts.filter(a => a.firma).forEach(a => {
      if (!firme[a.firma]) firme[a.firma] = { firma: a.firma, apts: [], pret: a.pret }
      firme[a.firma].apts.push(a.nr)
    })
    Object.values(firme).forEach(f => {
      if (f.firma.toLowerCase().includes(q)) res.push({
        type: 'firma', score: 2,
        id: `firma-${f.firma}`,
        title: f.firma,
        subtitle: `${f.apts.length} apartamente active`,
        meta: `AP ${f.apts.slice(0,5).join(', ')}${f.apts.length>5?'...':''}`,
        icon: '🏢',
        data: f
      })
    })

    // Curățenii azi
    const azi = new Date().toISOString().split('T')[0]
    curatenii.filter(c =>
      c.data_programata === azi &&
      ((c.nr_apt+'').includes(q) || (c.firma||'').toLowerCase().includes(q))
    ).forEach(c => res.push({
      type: 'curatenie', score: 1,
      id: `cur-${c.id}`,
      title: `Curățenie AP ${c.nr_apt}`,
      subtitle: c.firma || '—',
      meta: `${c.tip_curatenie} · ${c.status_curatenie}`,
      icon: c.status_curatenie === 'finalizata' ? '✅' : '🧹',
      data: c
    }))

    // Acțiuni rapide
    const actiuni = [
      { q: ['nou','add','adaug'], title: 'Adaugă apartament', subtitle: 'Crează un apartament nou', icon: '➕', action: () => onNavigate('addApt') },
      { q: ['dashboard','acasa'], title: 'Dashboard', subtitle: 'Mergi la pagina principală', icon: '🏠', action: () => onNavigate(11) },
      { q: ['rezervari','rezervare'], title: 'Rezervări', subtitle: 'Vezi timeline rezervări', icon: '📆', action: () => onNavigate(13) },
      { q: ['curatenie','curatenii'], title: 'Curățenii', subtitle: 'Mergi la pagina curățenie', icon: '🧹', action: () => onNavigate('curatenie') },
      { q: ['salarii','salariu','bonus'], title: 'Salarii', subtitle: 'Calculează salariile', icon: '💵', action: () => onNavigate(9) },
      { q: ['setari','settings'], title: 'Setări', subtitle: 'Configurare aplicație', icon: '⚙️', action: () => onNavigate(12) },
      { q: ['pontaj','prezenta'], title: 'Pontaj', subtitle: 'Gestionare prezență', icon: '⏱', action: () => onNavigate(10) },
      { q: ['mentenanta','problema'], title: 'Mentenanță', subtitle: 'Probleme apartamente', icon: '🔧', action: () => onNavigate(6) },
      { q: ['spalatorie','lenjerie'], title: 'Spălătorie', subtitle: 'Raport lenjerii', icon: '🧺', action: () => onNavigate(8) },
      { q: ['incasari','venit','bani'], title: 'Încasări', subtitle: 'Situație financiară', icon: '💰', action: () => onNavigate(4) },
    ]
    actiuni.forEach(a => {
      if (a.q.some(kw => kw.includes(q) || q.includes(kw))) {
        res.push({ type: 'actiune', score: 1, id: `act-${a.title}`, title: a.title, subtitle: a.subtitle, icon: a.icon, action: a.action })
      }
    })

    return res.sort((a, b) => b.score - a.score).slice(0, 10)
  }, [query, apts, curatenii, onNavigate])

  // Navigare cu tastatura
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s+1, results.length-1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s-1, 0)) }
    if (e.key === 'Enter' && results[selected]) { handleSelect(results[selected]) }
  }

  function handleSelect(r) {
    setOpen(false); setQuery('')
    if (r.action) { r.action(); return }
    if (r.type === 'apt') { onEditApt?.(r.data) }
    if (r.type === 'firma') { onNavigate(2) }
    if (r.type === 'curatenie') { onNavigate('curatenie') }
  }

  const BADGE_COLORS = {
    activ: { bg: '#EEF4FF', color: '#1A3A6B' },
    elib:  { bg: '#FEE2E2', color: '#B91C1C' },
    liber: { bg: '#E8F7EF', color: '#1A7A4A' },
    maint: { bg: '#FEF3C7', color: '#B45309' },
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
        background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
        borderRadius: 10, color: 'rgba(255,255,255,.8)', cursor: 'pointer', fontSize: 12,
        transition: 'all .15s' }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,.18)'}
      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}>
      <span style={{ fontSize: 13 }}>🔍</span>
      <span>Caută...</span>
      <kbd style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)',
        borderRadius: 5, padding: '1px 6px', fontSize: 11, fontFamily: 'monospace' }}>/</kbd>
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,35,68,.5)',
      zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80, backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}>
      <div ref={containerRef}
        style={{ width: '100%', maxWidth: 580, background: '#fff', borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
          borderBottom: query && results.length ? '1px solid #E9EDF4' : 'none' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKeyDown}
            placeholder="Caută apartament, firmă, acțiune..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15,
              color: '#0F2344', background: 'transparent' }} />
          {query && (
            <button onClick={() => setQuery('')}
              style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '3px 8px',
                cursor: 'pointer', fontSize: 12, color: '#64748B' }}>✕</button>
          )}
          <kbd style={{ background: '#F1F5F9', border: '1px solid #E9EDF4', borderRadius: 6,
            padding: '2px 8px', fontSize: 11, color: '#64748B', fontFamily: 'monospace', flexShrink: 0 }}>
            Esc
          </kbd>
        </div>

        {/* Rezultate */}
        {query && results.length > 0 && (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {/* Grupare pe tip */}
            {['apt','firma','curatenie','actiune'].map(type => {
              const group = results.filter(r => r.type === type)
              if (!group.length) return null
              const labels = { apt:'Apartamente', firma:'Firme', curatenie:'Curățenii azi', actiune:'Acțiuni rapide' }
              return (
                <div key={type}>
                  <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 600,
                    color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {labels[type]}
                  </div>
                  {group.map((r, gi) => {
                    const globalIdx = results.indexOf(r)
                    const isSelected = globalIdx === selected
                    const bc = BADGE_COLORS[r.badge] || {}
                    return (
                      <div key={r.id}
                        onClick={() => handleSelect(r)}
                        onMouseEnter={() => setSelected(globalIdx)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 18px', cursor: 'pointer', transition: 'background .1s',
                          background: isSelected ? '#EEF4FF' : 'transparent',
                          borderLeft: `3px solid ${isSelected ? '#1A3A6B' : 'transparent'}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: isSelected ? '#1A3A6B' : '#F1F5F9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          {r.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F2344' }}>{r.title}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{r.subtitle}</div>
                        </div>
                        {r.meta && (
                          <div style={{ fontSize: 11, color: '#64748B', textAlign: 'right', flexShrink: 0 }}>
                            {r.meta}
                          </div>
                        )}
                        {r.badge && bc.bg && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99,
                            fontWeight: 600, background: bc.bg, color: bc.color, flexShrink: 0 }}>
                            {r.badge === 'activ' ? 'Ocupat' : r.badge === 'elib' ? 'Elib.' : r.badge === 'liber' ? 'Liber' : r.badge}
                          </span>
                        )}
                        {isSelected && <span style={{ color: '#94A3B8', fontSize: 11, flexShrink: 0 }}>↵</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Gol */}
        {query && results.length === 0 && (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13 }}>Niciun rezultat pentru "{query}"</div>
          </div>
        )}

        {/* Footer hints */}
        {!query && (
          <div style={{ padding: '14px 18px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[['↑↓','Navighează'],['↵','Selectează'],['Esc','Închide']].map(([k,l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94A3B8' }}>
                <kbd style={{ background: '#F1F5F9', border: '1px solid #E9EDF4', borderRadius: 5,
                  padding: '1px 7px', fontFamily: 'monospace', fontSize: 10 }}>{k}</kbd>
                {l}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
              Tasteaza / din orice pagină
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
