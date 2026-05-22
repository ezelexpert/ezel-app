import React, { useState, useMemo, useRef } from 'react'

const ZILE_VIZIBILE = 30
const COL_W = 36
const ROW_H = 44
const LABEL_W = 120

const ST_COLORS = {
  activ:   { bg: '#1A3A6B', text: '#fff', light: '#EEF4FF' },
  elib:    { bg: '#B91C1C', text: '#fff', light: '#FEE2E2' },
  special: { bg: '#5B21B6', text: '#fff', light: '#EDE9FE' },
  maint:   { bg: '#B45309', text: '#fff', light: '#FEF3C7' },
  liber:   { bg: '#E2E8F0', text: '#94A3B8', light: '#F8FAFC' },
}

function addZile(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function parseDate(s) {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d) ? null : d
}
function diffDays(a, b) {
  const d1 = new Date(a); d1.setHours(0,0,0,0)
  const d2 = new Date(b); d2.setHours(0,0,0,0)
  return Math.round((d2 - d1) / 86400000)
}

const LUNI_SC = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']
const ZI_SC = ['Du','Lu','Ma','Mi','Jo','Vi','Sa']

export default function ReservationTimeline({ apts, curatenii, onEditApt, onAddApt }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0)
    d.setDate(d.getDate() - 3) // incepe cu 3 zile in urma
    return d
  })
  const [srch, setSrch] = useState('')
  const [flt, setFlt] = useState('')
  const [tooltip, setTooltip] = useState(null)
  const scrollRef = useRef()

  const zile = useMemo(() => {
    return Array.from({ length: ZILE_VIZIBILE }, (_, i) => addZile(startDate, i))
  }, [startDate])

  const azi = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const filteredApts = useMemo(() => {
    return apts.filter(a => {
      const matchQ = !srch || (a.nr + (a.firma||'')).toLowerCase().includes(srch.toLowerCase())
      const matchF = !flt || a.status === flt
      return matchQ && matchF
    }).sort((a, b) => {
      const na = parseInt(a.nr) || 999
      const nb = parseInt(b.nr) || 999
      return na - nb
    })
  }, [apts, srch, flt])

  // Construieste segmentele de rezervare per apartament
  const segments = useMemo(() => {
    const map = {}
    const endDate = addZile(startDate, ZILE_VIZIBILE)

    filteredApts.forEach(apt => {
      const segs = []
      if (apt.status !== 'liber' && apt.status !== 'maint') {
        // Calculeaza start si end vizibil
        const checkin = apt.data_checkin ? parseDate(apt.data_checkin) : null
        const elib = apt.data_elib ? parseDate(apt.data_elib) : null

        const segStart = checkin || addZile(azi, -30) // daca nu stim, asumam de acum 30 zile
        const segEnd = elib || addZile(azi, 60) // daca nu stie elib, asumam inca 60 zile

        // Clip la fereastra vizibila
        const visStart = segStart < startDate ? startDate : segStart
        const visEnd = segEnd > endDate ? endDate : segEnd

        if (visStart < visEnd) {
          const offsetDays = diffDays(startDate, visStart)
          const lengthDays = diffDays(visStart, visEnd)

          segs.push({
            firma: apt.firma,
            status: apt.status,
            pret: apt.pret,
            checkin: apt.data_checkin,
            elib: apt.data_elib,
            offsetDays,
            lengthDays,
            apt
          })
        }
      }
      map[apt.nr] = segs
    })
    return map
  }, [filteredApts, startDate, azi])

  // Curatenii per apt per zi
  const curMap = useMemo(() => {
    const m = {}
    curatenii.forEach(c => {
      const key = `${c.nr_apt}_${c.data_programata}`
      if (!m[key]) m[key] = []
      m[key].push(c)
    })
    return m
  }, [curatenii])

  function navLeft() {
    setStartDate(d => addZile(d, -7))
  }
  function navRight() {
    setStartDate(d => addZile(d, 7))
  }
  function goToazi() {
    const d = new Date(); d.setHours(0,0,0,0)
    d.setDate(d.getDate() - 3)
    setStartDate(d)
  }

  const occ = apts.filter(a => a.status === 'activ').length
  const libre = apts.filter(a => a.status === 'liber').length
  const elibCount = apts.filter(a => a.status === 'elib').length
  const total = apts.filter(a => a.status !== 'maint').length
  const pctOcc = total > 0 ? Math.round(occ / total * 100) : 0

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { val: occ, lbl: 'Ocupate', color: '#1A3A6B', bg: '#EEF4FF' },
          { val: libre, lbl: 'Libere', color: '#1A7A4A', bg: '#E8F7EF' },
          { val: elibCount, lbl: 'Eliberează', color: '#B91C1C', bg: '#FEE2E2' },
          { val: pctOcc + '%', lbl: 'Ocupare', color: '#0F2344', bg: '#F1F5F9' },
        ].map(s => (
          <div key={s.lbl} style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: .7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Caută apartament sau firmă..."
          value={srch} onChange={e => setSrch(e.target.value)}
          style={{ flex: 1, minWidth: 160, height: 34, padding: '0 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <select value={flt} onChange={e => setFlt(e.target.value)}
          style={{ height: 34, padding: '0 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, background: '#fff' }}>
          <option value="">Toate</option>
          <option value="activ">Ocupat</option>
          <option value="liber">Liber</option>
          <option value="elib">Eliberează</option>
          <option value="maint">Mentenanță</option>
        </select>
        <button onClick={navLeft} style={{ height: 34, padding: '0 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>◀</button>
        <button onClick={goToazi} style={{ height: 34, padding: '0 12px', border: '1.5px solid #1A3A6B', borderRadius: 8, background: '#EEF4FF', color: '#1A3A6B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Azi</button>
        <button onClick={navRight} style={{ height: 34, padding: '0 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>▶</button>
        <button onClick={() => onAddApt && onAddApt()}
          style={{ height: 34, padding: '0 14px', background: '#0F2344', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Apt nou
        </button>
      </div>

      {/* Timeline grid */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff' }} ref={scrollRef}>
        <div style={{ minWidth: LABEL_W + COL_W * ZILE_VIZIBILE }}>

          {/* Header - luni */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #E2E8F0', padding: '6px 10px', fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>APARTAMENT</div>
            {zile.map((z, i) => {
              const isFirst = i === 0 || z.getDate() === 1
              return (
                <div key={i} style={{ width: COL_W, minWidth: COL_W, textAlign: 'center', padding: '4px 0', fontSize: 10, borderRight: '0.5px solid #F1F5F9',
                  background: z.getDay() === 0 || z.getDay() === 6 ? '#FFF8F8' : 'transparent',
                  color: z.getDay() === 0 || z.getDay() === 6 ? '#FDA4AF' : '#0F2344',
                  fontWeight: z.toDateString() === azi.toDateString() ? 700 : 400
                }}>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{isFirst ? LUNI_SC[z.getMonth()] : ''}</div>
                  <div style={{ fontSize: 11, fontWeight: z.toDateString() === azi.toDateString() ? 700 : 500 }}>{z.getDate()}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{ZI_SC[z.getDay()]}</div>
                </div>
              )
            })}
          </div>

          {/* Rows */}
          {filteredApts.map((apt, ri) => {
            const isDbl = apt.tip === 'dublu' || String(apt.nr).startsWith('D')
            const aptSegs = segments[apt.nr] || []
            const isLiber = apt.status === 'liber'

            return (
              <div key={apt.nr} style={{ display: 'flex', borderBottom: '0.5px solid #F1F5F9', background: isLiber ? 'rgba(232,247,239,.3)' : 'white', position: 'relative', height: ROW_H }}>
                {/* Label */}
                <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #E2E8F0', padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: isLiber ? 'rgba(232,247,239,.4)' : '#FAFAFA' }}
                  onClick={() => onEditApt && onEditApt(apt)}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: isDbl ? '#EDE9FE' : '#EEF4FF', color: isDbl ? '#5B21B6' : '#1A3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {apt.nr}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#0F2344', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {apt.firma || 'Liber'}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{apt.pret ? apt.pret + ' RON' : apt.status === 'maint' ? 'Mentenanță' : '—'}</div>
                  </div>
                </div>

                {/* Celule zile - fundal */}
                <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                  {zile.map((z, zi) => {
                    const ds = dateStr(z)
                    const isWe = z.getDay() === 0 || z.getDay() === 6
                    const isAzi = z.toDateString() === azi.toDateString()
                    const curAzi = curMap[`${apt.nr}_${ds}`]

                    return (
                      <div key={zi} style={{ width: COL_W, minWidth: COL_W, height: '100%', borderRight: '0.5px solid #F1F5F9', position: 'relative',
                        background: isAzi ? 'rgba(14,165,233,.05)' : isWe ? 'rgba(253,164,175,.05)' : 'transparent' }}>
                        {/* Indicator curatenie */}
                        {curAzi && curAzi.length > 0 && (
                          <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%',
                            background: curAzi[0].status_curatenie === 'finalizata' ? '#1A7A4A' : curAzi[0].tip_curatenie === 'generala' ? '#B91C1C' : '#1A3A6B' }}
                            title={`Curățenie ${curAzi[0].tip_curatenie} - ${curAzi[0].status_curatenie}`} />
                        )}
                        {/* Linie azi */}
                        {isAzi && <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#0EA5E9', opacity: .4 }} />}
                      </div>
                    )
                  })}

                  {/* Bare rezervari */}
                  {aptSegs.map((seg, si) => {
                    const colors = ST_COLORS[seg.status] || ST_COLORS.activ
                    const left = seg.offsetDays * COL_W
                    const width = Math.max(seg.lengthDays * COL_W - 4, COL_W - 4)
                    const isStartVisible = seg.offsetDays >= 0
                    const isEndVisible = seg.offsetDays + seg.lengthDays <= ZILE_VIZIBILE

                    return (
                      <div key={si}
                        onClick={() => onEditApt && onEditApt(seg.apt)}
                        onMouseEnter={e => setTooltip({ apt: seg.apt, seg, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          position: 'absolute',
                          left: left + 2,
                          top: 6,
                          height: ROW_H - 12,
                          width: width,
                          background: colors.bg,
                          borderRadius: `${isStartVisible ? 6 : 0}px ${isEndVisible ? 6 : 0}px ${isEndVisible ? 6 : 0}px ${isStartVisible ? 6 : 0}px`,
                          display: 'flex', alignItems: 'center', paddingLeft: 8,
                          cursor: 'pointer', overflow: 'hidden',
                          boxShadow: '0 1px 4px rgba(0,0,0,.12)',
                          transition: 'opacity .15s',
                          zIndex: 2
                        }}
                        onMouseOver={e => e.currentTarget.style.opacity = '.85'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {seg.firma || seg.status}
                          {seg.elib ? ` → ${seg.elib}` : ''}
                        </span>
                        {seg.apt.prosop && <span style={{ marginLeft: 4, fontSize: 10, opacity: .8, color: colors.text }}>🛁</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {filteredApts.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Niciun apartament găsit.
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: '#64748B' }}>
        {[
          { color: '#1A3A6B', label: 'Ocupat' },
          { color: '#B91C1C', label: 'Eliberează' },
          { color: '#5B21B6', label: 'Special' },
          { color: '#B45309', label: 'Mentenanță' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }}></div>
            {l.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A3A6B' }}></div>
          Curățenie programată
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A7A4A' }}></div>
          Curățenie finalizată
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B91C1C' }}></div>
          Curățenie generală
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, background: '#0F2344', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, zIndex: 1000, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.2)', maxWidth: 200 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>AP {tooltip.apt.nr}</div>
          <div>{tooltip.apt.firma || 'Liber'}</div>
          {tooltip.apt.pret > 0 && <div>{tooltip.apt.pret} RON/noapte</div>}
          {tooltip.apt.data_checkin && <div>Check-in: {tooltip.apt.data_checkin}</div>}
          {tooltip.apt.data_elib && <div>Elib.: {tooltip.apt.data_elib}</div>}
          {tooltip.apt.nota && <div>Nota: {tooltip.apt.nota}</div>}
        </div>
      )}
    </div>
  )
}
