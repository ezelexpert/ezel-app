import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'

const COL_W = 34
const ROW_H = 44
const LABEL_W = 130

const ST_COLORS = {
  activ:   { bg: '#1A3A6B', text: '#fff' },
  elib:    { bg: '#B91C1C', text: '#fff' },
  special: { bg: '#5B21B6', text: '#fff' },
  maint:   { bg: '#B45309', text: '#fff' },
  chirie:  { bg: '#0F766E', text: '#fff' },
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

export default function ReservationTimeline({ apts, curatenii, onEditApt, onAddApt, onNewReservation }) {
  const [calAn, setCalAn] = useState(() => new Date().getFullYear())
  const [calLuna, setCalLuna] = useState(() => new Date().getMonth())
  const [srch, setSrch] = useState('')
  const [flt, setFlt] = useState('')
  const [tooltip, setTooltip] = useState(null)

  // Drag selection state
  const [drag, setDrag] = useState(null) // { aptNr, startDay, endDay, active }
  const [selection, setSelection] = useState(null) // { aptNr, startDay, endDay }
  const dragRef = useRef(null)

  const azi = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const startDate = useMemo(() => {
    const d = new Date(calAn, calLuna, 1); d.setHours(0,0,0,0); return d
  }, [calAn, calLuna])

  const zile = useMemo(() => {
    const nrZile = new Date(calAn, calLuna + 1, 0).getDate()
    return Array.from({ length: nrZile }, (_, i) => addZile(startDate, i))
  }, [calAn, calLuna, startDate])

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

  const segments = useMemo(() => {
    const map = {}
    const endDate = addZile(startDate, zile.length)
    filteredApts.forEach(apt => {
      const segs = []
      if (apt.status !== 'liber' && apt.status !== 'maint') {
        const checkin = apt.data_checkin ? parseDate(apt.data_checkin) : null
        const elib = apt.data_elib ? parseDate(apt.data_elib) : null
        const segStart = checkin || addZile(azi, -60)
        const segEnd = elib || addZile(azi, 60)
        const visStart = segStart < startDate ? startDate : segStart
        const visEnd = segEnd > endDate ? endDate : segEnd
        if (visStart < visEnd) {
          segs.push({
            firma: apt.firma,
            status: apt.status,
            tip_serviciu: apt.tip_serviciu,
            pret: apt.pret,
            elib: apt.data_elib,
            checkin: apt.data_checkin,
            offsetDays: diffDays(startDate, visStart),
            lengthDays: diffDays(visStart, visEnd),
            isStartClipped: segStart < startDate,
            isEndClipped: segEnd > endDate,
            apt
          })
        }
      }
      map[apt.nr] = segs
    })
    return map
  }, [filteredApts, startDate, azi])

  const curMap = useMemo(() => {
    const m = {}
    curatenii.forEach(c => {
      const key = `${c.nr_apt}_${c.data_programata}`
      if (!m[key]) m[key] = []
      m[key].push(c)
    })
    return m
  }, [curatenii])

  // Mouse handlers for drag selection
  const handleMouseDown = useCallback((aptNr, dayIdx, e) => {
    e.preventDefault()
    setSelection(null)
    setDrag({ aptNr, startDay: dayIdx, endDay: dayIdx, active: true })
    dragRef.current = { aptNr, startDay: dayIdx }
  }, [])

  const handleMouseEnter = useCallback((aptNr, dayIdx) => {
    if (!drag?.active || drag.aptNr !== aptNr) return
    setDrag(prev => prev ? { ...prev, endDay: dayIdx } : null)
  }, [drag])

  const handleMouseUp = useCallback(() => {
    if (!drag?.active) return
    const start = Math.min(drag.startDay, drag.endDay)
    const end = Math.max(drag.startDay, drag.endDay)
    const apt = filteredApts.find(a => a.nr === drag.aptNr)

    if (apt && end >= start) {
      const checkinDate = addZile(startDate, start)
      const elibDate = addZile(startDate, end + 1)
      setSelection({ aptNr: drag.aptNr, startDay: start, endDay: end })
      // Deschide modal cu datele pre-completate
      if (onNewReservation) {
        onNewReservation({
          apt,
          data_checkin: dateStr(checkinDate),
          data_elib: dateStr(elibDate),
          zile: end - start + 1
        })
      }
    }
    setDrag(null)
  }, [drag, filteredApts, startDate, onNewReservation])

  useEffect(() => {
    const up = () => { if (drag?.active) handleMouseUp() }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [drag, handleMouseUp])

  const occ = apts.filter(a => a.status === 'activ').length
  const libre = apts.filter(a => a.status === 'liber').length
  const elibCount = apts.filter(a => a.status === 'elib').length
  const total = apts.filter(a => a.status !== 'maint').length
  const pctOcc = total > 0 ? Math.round(occ / total * 100) : 0

  function getDragRange() {
    if (!drag?.active) return null
    return {
      aptNr: drag.aptNr,
      start: Math.min(drag.startDay, drag.endDay),
      end: Math.max(drag.startDay, drag.endDay)
    }
  }
  const dragRange = getDragRange()

  return (
    <div style={{ fontFamily: 'inherit', userSelect: 'none' }}>
      {/* Stats */}
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
          <option value="">Toate statusurile</option>
          <option value="activ">Ocupat</option>
          <option value="liber">Liber</option>
          <option value="elib">Eliberează</option>
          <option value="maint">Mentenanță</option>
        </select>
        <button onClick={() => { let l=calLuna-1,a=calAn; if(l<0){l=11;a--}; setCalLuna(l); setCalAn(a) }}
          style={{ height: 34, width: 34, border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>◀</button>
        <div style={{ height: 34, padding: '0 14px', border: '1.5px solid #1A3A6B', borderRadius: 8, background: '#EEF4FF', color: '#1A3A6B', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', minWidth: 130, justifyContent: 'center' }}>
          {['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'][calLuna]} {calAn}
        </div>
        <button onClick={() => { const now=new Date(); setCalLuna(now.getMonth()); setCalAn(now.getFullYear()) }}
          style={{ height: 34, padding: '0 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#1A3A6B', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Azi</button>
        <button onClick={() => { let l=calLuna+1,a=calAn; if(l>11){l=0;a++}; setCalLuna(l); setCalAn(a) }}
          style={{ height: 34, width: 34, border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>▶</button>
        <button onClick={() => onAddApt && onAddApt()}
          style={{ height: 34, padding: '0 14px', background: '#0F2344', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Apt nou
        </button>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
        💡 Trage pe zilele libere pentru a adăuga o rezervare nouă. Click pe o rezervare existentă pentru a o edita.
      </div>

      {/* Timeline */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff' }}>
        <div style={{ minWidth: LABEL_W + COL_W * zile.length }}>

          {/* Header */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #E2E8F0', padding: '6px 10px', fontSize: 11, color: '#94A3B8', fontWeight: 600, letterSpacing: '.04em' }}>APARTAMENT</div>
            {zile.map((z, i) => {
              const isWe = z.getDay() === 0 || z.getDay() === 6
              const isAzi = z.toDateString() === azi.toDateString()
              return (
                <div key={i} style={{ width: COL_W, minWidth: COL_W, textAlign: 'center', padding: '4px 0',
                  background: isAzi ? '#EEF4FF' : isWe ? '#FFF8F8' : 'transparent',
                  borderRight: '0.5px solid #F1F5F9', borderBottom: isAzi ? '2px solid #1A3A6B' : 'none' }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', height: 12 }}>{i === 0 || z.getDate() === 1 ? LUNI_SC[z.getMonth()] : ''}</div>
                  <div style={{ fontSize: 12, fontWeight: isAzi ? 700 : 500, color: isAzi ? '#1A3A6B' : isWe ? '#FDA4AF' : '#0F2344' }}>{z.getDate()}</div>
                  <div style={{ fontSize: 9, color: isWe ? '#FDA4AF' : '#94A3B8' }}>{ZI_SC[z.getDay()]}</div>
                </div>
              )
            })}
          </div>

          {/* Rows */}
          {filteredApts.map((apt) => {
            const isDbl = apt.tip === 'dublu' || String(apt.nr).startsWith('D')
            const aptSegs = segments[apt.nr] || []
            const isLiber = apt.status === 'liber'
            const isMaint = apt.status === 'maint'
            const isChirie = apt.tip_serviciu === 'chirie'

            return (
              <div key={apt.nr} style={{ display: 'flex', borderBottom: '0.5px solid #F1F5F9', height: ROW_H, position: 'relative' }}>
                {/* Label */}
                <div style={{ width: LABEL_W, minWidth: LABEL_W, borderRight: '1px solid #E2E8F0',
                  padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', background: isLiber ? 'rgba(232,247,239,.35)' : isMaint ? 'rgba(254,243,199,.35)' : '#FAFAFA',
                  position: 'sticky', left: 0, zIndex: 5 }}
                  onClick={() => onEditApt && onEditApt(apt)}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    background: isDbl ? '#EDE9FE' : isLiber ? '#E8F7EF' : '#EEF4FF',
                    color: isDbl ? '#5B21B6' : isLiber ? '#1A7A4A' : '#1A3A6B' }}>
                    {apt.nr}
                  </div>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#0F2344', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {apt.firma || (isLiber ? 'Liber' : isMaint ? 'Mentenanță' : '—')}
                      {isChirie && <span style={{ fontSize: 9, background: '#CCFBF1', color: '#0F766E', padding: '1px 5px', borderRadius: 99, fontWeight: 600 }}>CHR</span>}
                      {apt.prosop && <span style={{ fontSize: 9 }}>🛁</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{apt.pret ? apt.pret + ' RON' : apt.nota || ''}</div>
                  </div>
                </div>

                {/* Celule */}
                <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                  {zile.map((z, zi) => {
                    const ds = dateStr(z)
                    const isWe = z.getDay() === 0 || z.getDay() === 6
                    const isAzi = z.toDateString() === azi.toDateString()
                    const curAzi = curMap[`${apt.nr}_${ds}`]
                    const isDragSelected = dragRange && dragRange.aptNr === apt.nr && zi >= dragRange.start && zi <= dragRange.end
                    const isOccupied = aptSegs.some(s => zi >= s.offsetDays && zi < s.offsetDays + s.lengthDays)

                    return (
                      <div key={zi}
                        style={{ width: COL_W, minWidth: COL_W, height: '100%', position: 'relative',
                          background: isDragSelected ? 'rgba(26,58,107,.15)' : isAzi ? 'rgba(14,165,233,.04)' : isWe ? 'rgba(253,164,175,.04)' : 'transparent',
                          borderRight: '0.5px solid #F1F5F9',
                          cursor: isOccupied ? 'default' : 'crosshair' }}
                        onMouseDown={e => !isOccupied && handleMouseDown(apt.nr, zi, e)}
                        onMouseEnter={() => handleMouseEnter(apt.nr, zi)}>
                        {curAzi?.length > 0 && (
                          <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%',
                            background: curAzi[0].status_curatenie === 'finalizata' ? '#1A7A4A' : curAzi[0].tip_curatenie === 'generala' ? '#B91C1C' : '#1A3A6B', zIndex: 3 }} />
                        )}
                        {isAzi && <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, background: '#0EA5E9', opacity: .5, zIndex: 1, pointerEvents: 'none' }} />}
                      </div>
                    )
                  })}

                  {/* Bare rezervari */}
                  {aptSegs.map((seg, si) => {
                    const colors = ST_COLORS[seg.tip_serviciu === 'chirie' ? 'chirie' : seg.status] || ST_COLORS.activ
                    const left = seg.offsetDays * COL_W + 2
                    const width = seg.lengthDays * COL_W - 4
                    return (
                      <div key={si}
                        onClick={() => onEditApt && onEditApt(seg.apt)}
                        onMouseEnter={e => { e.stopPropagation(); setTooltip({ apt: seg.apt, seg, x: e.clientX, y: e.clientY }) }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{ position: 'absolute', left, top: 6, height: ROW_H - 12, width: Math.max(width, 4),
                          background: colors.bg, zIndex: 4, cursor: 'pointer', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', paddingLeft: 8,
                          borderRadius: `${seg.isStartClipped ? 0 : 6}px ${seg.isEndClipped ? 0 : 6}px ${seg.isEndClipped ? 0 : 6}px ${seg.isStartClipped ? 0 : 6}px`,
                          boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}
                        onMouseOver={e => e.currentTarget.style.opacity = '.85'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                        {!seg.isStartClipped && width > 40 && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                            {seg.firma}
                            {seg.elib ? ` → ${seg.elib.substring(5)}` : ''}
                          </span>
                        )}
                        {seg.isStartClipped && width > 10 && (
                          <span style={{ fontSize: 10, color: colors.text, opacity: .7, pointerEvents: 'none' }}>◀ {seg.firma}</span>
                        )}
                      </div>
                    )
                  })}

                  {/* Preview drag selection */}
                  {dragRange && dragRange.aptNr === apt.nr && (
                    <div style={{ position: 'absolute', left: dragRange.start * COL_W + 2, top: 6, height: ROW_H - 12,
                      width: (dragRange.end - dragRange.start + 1) * COL_W - 4,
                      background: 'rgba(26,58,107,.25)', borderRadius: 6, zIndex: 3, border: '2px dashed #1A3A6B', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 11, color: '#1A3A6B', fontWeight: 600, padding: '0 6px', whiteSpace: 'nowrap' }}>
                        {dragRange.end - dragRange.start + 1} zile
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {filteredApts.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Niciun apartament găsit.
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: '#64748B', alignItems: 'center' }}>
        {[
          { color: '#1A3A6B', label: 'Cazare' },
          { color: '#0F766E', label: 'Chirie' },
          { color: '#B91C1C', label: 'Eliberează' },
          { color: '#5B21B6', label: 'Special' },
          { color: '#B45309', label: 'Mentenanță' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 14, height: 10, borderRadius: 3, background: l.color }}></div>
            {l.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A3A6B' }}></div> Curățenie programată
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A7A4A' }}></div> Finalizată
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B91C1C' }}></div> Generală
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
          background: '#0F2344', color: '#fff', borderRadius: 8, padding: '8px 12px',
          fontSize: 12, zIndex: 9999, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.2)', maxWidth: 220 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>AP {tooltip.apt.nr} {tooltip.apt.tip === 'dublu' ? '(dublu)' : ''}</div>
          <div>{tooltip.apt.firma || '—'}</div>
          {tooltip.apt.tip_serviciu === 'chirie' && <div style={{ color: '#5DCAA5' }}>Chirie</div>}
          {tooltip.apt.pret > 0 && <div>{tooltip.apt.pret} RON/{tooltip.apt.tip_serviciu === 'chirie' ? 'lună' : 'noapte'}</div>}
          {tooltip.apt.data_checkin && <div>Check-in: {tooltip.apt.data_checkin}</div>}
          {tooltip.apt.data_elib && <div>Elib.: {tooltip.apt.data_elib}</div>}
          {tooltip.apt.nota && <div>Notă: {tooltip.apt.nota}</div>}
          {tooltip.apt.nr_locuri && <div>{tooltip.apt.nr_locuri} locuri</div>}
        </div>
      )}
    </div>
  )
}
