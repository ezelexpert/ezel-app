import React, { useMemo, useState } from 'react'

const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const ZS = ['Du','Lu','Ma','Mi','Jo','Vi','Sa']

export default function Calendar({ apts, curatenii, calAn, calLuna, onChangeMonth, onCellClick, onAddMulti, onAddUnic, onAutoSchedule, onStergeCuratenii, onMutaCuratenie }) {
  const [modStergere, setModStergere] = useState(false)
  const [selectate, setSelectate] = useState([]) // [{id, nr_apt, zi}]
  const [dragItem, setDragItem] = useState(null) // curatenia trasa
  const [dragOver, setDragOver] = useState(null) // {nr_apt, zi, dataStr}

  const zile = new Date(calAn, calLuna + 1, 0).getDate()
  const today = new Date()
  const todayZi = today.getFullYear()===calAn && today.getMonth()===calLuna ? today.getDate() : -1

  const weekends = useMemo(() => {
    const s = new Set()
    for (let z=1;z<=zile;z++) { const d=new Date(calAn,calLuna,z); if(d.getDay()===0||d.getDay()===6) s.add(z) }
    return s
  }, [calAn, calLuna, zile])

  const calMap = useMemo(() => {
    const m = {}
    curatenii.forEach(c => {
      if (!c.data_programata) return
      const d = new Date(c.data_programata)
      if (d.getFullYear()!==calAn||d.getMonth()!==calLuna) return
      const zi = d.getDate()
      const key = c.nr_apt
      if (!m[key]) m[key] = {}
      if (!m[key][zi]) m[key][zi] = c
    })
    return m
  }, [curatenii, calAn, calLuna])

  const activApts = apts.filter(a => a.status !== 'maint')

  function cellClass(c) {
    if (!c) return ''
    if (c.status_curatenie === 'finalizata') return 'cf'
    if (c.tip_curatenie === 'generala') return 'cg'
    if (c.tip_curatenie === 'intretinere') return 'ci'
    return 'cx'
  }

  function cellContent(c) {
    if (!c) return ''
    if (c.status_curatenie === 'finalizata') return '✓'
    if (c.tip_curatenie === 'generala') return 'G'
    if (c.tip_curatenie === 'intretinere') return 'I'
    return 'X'
  }

  function isSelectata(nr_apt, zi) {
    return selectate.some(s => s.nr_apt === nr_apt && s.zi === zi)
  }

  function toggleSelectare(c, nr_apt, zi) {
    if (!c || c.status_curatenie === 'finalizata') return // nu poti selecta finalizate
    if (isSelectata(nr_apt, zi)) {
      setSelectate(prev => prev.filter(s => !(s.nr_apt === nr_apt && s.zi === zi)))
    } else {
      setSelectate(prev => [...prev, { id: c.id, nr_apt, zi }])
    }
  }

  function anuleazaMod() {
    setModStergere(false)
    setSelectate([])
  }

  async function stergeSelectate() {
    if (selectate.length === 0) return
    if (!window.confirm(`Ștergi ${selectate.length} curățenii selectate?`)) return
    await onStergeCuratenii(selectate.map(s => s.id))
    setSelectate([])
    setModStergere(false)
  }

  return (
    <div>
      {/* Bara butoane */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button className="btn" onClick={() => onChangeMonth(-1)}>◀</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1F3864', minWidth: 125, textAlign: 'center' }}>
            {LUNI[calLuna]} {calAn}
          </div>
          <button className="btn" onClick={() => onChangeMonth(1)}>▶</button>
        </div>

        {!modStergere ? (
          <>
            <button className="btn btn-g" onClick={onAddMulti}>+ Curățenie multiplă</button>
            <button className="btn btn-p" onClick={onAddUnic}>+ Unic</button>
            {onAutoSchedule && <button className="btn" style={{ background:'#E2EFDA', color:'#375623', border:'1px solid #C0DD97' }} onClick={onAutoSchedule}>🤖 Auto-planificare</button>}
            <button className="btn" style={{ background:'#FDECEA', color:'#c0392b', border:'1px solid #F5A0A0' }}
              onClick={() => { setModStergere(true); setSelectate([]) }}>
              🗑 Selectează pentru ștergere
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c0392b', background:'#FDECEA', padding:'5px 10px', borderRadius:8, border:'1px solid #F5A0A0' }}>
              🗑 Mod ștergere activ — click pe curățenii pentru a le selecta
            </div>
            {selectate.length > 0 && (
              <button className="btn" style={{ background:'#c0392b', color:'#fff', border:'none', fontWeight:600 }}
                onClick={stergeSelectate}>
                🗑 Șterge {selectate.length} {selectate.length===1?'curățenie':'curățenii'}
              </button>
            )}
            <button className="btn" onClick={anuleazaMod}>✕ Anulează</button>
          </>
        )}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {[['#FFD700','G Generală'],['#90EE90','I Întreținere'],['#87CEEB','X Urgență'],['#C6EFCE','✓ Finalizată']].map(([bg,lbl]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#555' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: '0.5px solid #ccc' }}></div>
            {lbl}
          </div>
        ))}
        {!modStergere && <div style={{ fontSize: 10, color: '#aaa' }}>Click celulă = adaugă/șterge</div>}
        {modStergere && (
          <div style={{ fontSize: 11, background:'#FDECEA', padding:'2px 8px', borderRadius:6, color:'#c0392b', border:'1px solid #F5A0A0' }}>
            {selectate.length > 0 ? `${selectate.length} selectate` : 'Nicio selecție'}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: `2px solid ${modStergere?'#F5A0A0':'#e0e0e0'}`, background: '#fff', transition:'border-color .2s' }}>
        <table className="cal">
          <thead>
            <tr>
              <th className="ca">AP \ Data</th>
              {Array.from({ length: zile }, (_, i) => i+1).map(z => {
                const dow = new Date(calAn, calLuna, z).getDay()
                return (
                  <th key={z} className={weekends.has(z) ? 'we' : ''}>
                    {String(z).padStart(2,'0')}<br />
                    <span style={{ fontSize: 8, opacity: .7 }}>{ZS[dow]}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {activApts.map(apt => {
              const isDbl = apt.tip==='dublu'||String(apt.nr).startsWith('D')
              return (
                <tr key={apt.nr}>
                  <td className="ca">
                    {apt.nr}{isDbl && <span className="tip-d">2x</span>}
                    <span style={{ fontWeight: 400, color: '#888', fontSize: 9, display: 'block' }}>{apt.firma||'—'}</span>
                  </td>
                  {Array.from({ length: zile }, (_, i) => i+1).map(z => {
                    const c = calMap[apt.nr]?.[z]
                    const isWe = weekends.has(z)
                    const isToday = z === todayZi
                    const dataStr = `${calAn}-${String(calLuna+1).padStart(2,'0')}-${String(z).padStart(2,'0')}`
                    const esteSelectata = modStergere && isSelectata(apt.nr, z)
                    const poateSelecta = modStergere && c && c.status_curatenie !== 'finalizata'

                    const isDragOver = dragOver?.nr_apt === apt.nr && dragOver?.zi === z
                    return (
                      <td key={z}
                        className={`${isWe?'we':''} ${cellClass(c)} ${isToday?'ct':''}`}
                        style={{
                          outline: esteSelectata ? '2px solid #c0392b' : isDragOver ? '2px solid #1F3864' : 'none',
                          background: esteSelectata ? '#FDECEA' : isDragOver ? '#EBF1FB' : undefined,
                          cursor: modStergere ? (poateSelecta ? 'pointer' : 'default') : c ? 'grab' : 'pointer',
                          position: 'relative'
                        }}
                        draggable={!modStergere && !!c && c.status_curatenie !== 'finalizata'}
                        onDragStart={() => { if(c) setDragItem(c) }}
                        onDragEnd={() => { setDragItem(null); setDragOver(null) }}
                        onDragOver={e => { e.preventDefault(); setDragOver({ nr_apt: apt.nr, zi: z, dataStr }) }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={async e => {
                          e.preventDefault()
                          if (dragItem && dataStr !== dragItem.data_programata && onMutaCuratenie) {
                            await onMutaCuratenie(dragItem.id, dataStr)
                          }
                          setDragItem(null); setDragOver(null)
                        }}
                        onClick={() => {
                          if (modStergere) { toggleSelectare(c, apt.nr, z) }
                          else if (!dragItem) { onCellClick(apt.nr, z, dataStr) }
                        }}>
                        {esteSelectata ? '✕' : cellContent(c)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
