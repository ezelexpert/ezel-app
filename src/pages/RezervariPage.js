import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Utilitare ─────────────────────────────────────────────────
function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function addZile(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function diffZile(a, b) {
  const d1 = new Date(a); d1.setHours(0,0,0,0)
  const d2 = new Date(b); d2.setHours(0,0,0,0)
  return Math.round((d2-d1)/86400000)
}
function parseD(s) { if(!s) return null; const d=new Date(s+'T12:00:00'); return isNaN(d)?null:d }

const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const LUNI_SC = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']
const ZI_SC = ['Du','Lu','Ma','Mi','Jo','Vi','Sa']
const COL_W = 32, ROW_H = 42, LABEL_W = 136

// Culori per tip serviciu
const TIP_COLORS = {
  cazare:   { bg: 'rgba(26,58,107,.42)', text: '#0F2344', border: '#1A3A6B' },
  chirie:   { bg: 'rgba(15,118,110,.42)', text: '#134E4A', border: '#0F766E' },
  rezervat: { bg: 'rgba(180,83,9,.25)', text: '#78350F', border: '#B45309' },
}
// Status suprascrie culoarea
const STATUS_OVERRIDE = {
  elib: { bg: 'rgba(185,28,28,.38)', text: '#7F1D1D', border: '#B91C1C' },
}

// Genereaza culoare unica per firma
function firmaColor(firma) {
  if (!firma) return '#94A3B8'
  let hash = 0
  for (let i = 0; i < firma.length; i++) hash = firma.charCodeAt(i) + ((hash<<5)-hash)
  const h = Math.abs(hash) % 360
  return `hsl(${h},55%,38%)`
}

// ── Componenta principala ─────────────────────────────────────
export default function RezervariPage({ apts, curatenii, onEditApt }) {
  const [view, setView] = useState('timeline') // timeline | lista | heatmap
  const [calAn, setCalAn] = useState(new Date().getFullYear())
  const [calLuna, setCalLuna] = useState(new Date().getMonth())
  const [rezervari, setRezervari] = useState([])
  const [loading, setLoading] = useState(true)
  const [srch, setSrch] = useState('')
  const [fltTip, setFltTip] = useState('')
  const [fltFirma, setFltFirma] = useState('')
  const [tooltip, setTooltip] = useState(null)
  const [modal, setModal] = useState(null) // { tip, apt, checkin, checkout } | null
  const [modalData, setModalData] = useState({})
  const [drag, setDrag] = useState(null)
  const [heatmapZi, setHeatmapZi] = useState(null)
  const [previziuni, setPreviziuni] = useState(null)

  const azi = useMemo(() => { const d=new Date(); d.setHours(0,0,0,0); return d }, [])
  const aziStr = dateStr(azi)

  // Zile din luna curenta
  const zile = useMemo(() => {
    const nrZile = new Date(calAn, calLuna+1, 0).getDate()
    const start = new Date(calAn, calLuna, 1); start.setHours(0,0,0,0)
    return Array.from({ length: nrZile }, (_, i) => addZile(start, i))
  }, [calAn, calLuna])

  const startDate = useMemo(() => new Date(calAn, calLuna, 1), [calAn, calLuna])

  useEffect(() => { loadRezervari() }, [])
  useEffect(() => { calcPreviziuni() }, [apts, rezervari])

  async function loadRezervari() {
    setLoading(true)
    const { data } = await supabase.from('rezervari').select('*').order('data_checkin', { ascending: false })
    setRezervari(data || [])
    setLoading(false)
  }

  // ── Calcul previziuni ─────────────────────────────────────
  function calcPreviziuni() {
    const primaZi = new Date(azi.getFullYear(), azi.getMonth(), 1)
    const ultimaZi = new Date(azi.getFullYear(), azi.getMonth()+1, 0)
    const zileLuna = ultimaZi.getDate()
    const zileRamase = zileLuna - azi.getDate() + 1

    let venitAzi = 0, venitEstimat = 0, venitLunaViit = 0

    apts.filter(a => a.firma && Number(a.pret) > 0).forEach(a => {
      const p = Number(a.pret)
      if (a.tip_serviciu === 'chirie') {
        venitAzi += p
        venitEstimat += p
        if (a.data_elib && a.data_elib > dateStr(ultimaZi)) venitLunaViit += p
      } else {
        const start = a.data_checkin && new Date(a.data_checkin) > primaZi ? new Date(a.data_checkin) : primaZi
        const zileFacute = Math.max(0, diffZile(start, azi))
        venitAzi += zileFacute * p
        venitEstimat += (a.data_elib && a.data_elib <= dateStr(ultimaZi))
          ? zileFacute * p
          : (zileFacute + zileRamase) * p
        if (!a.data_elib || a.data_elib > dateStr(ultimaZi)) venitLunaViit += 28 * p
      }
    })

    // Pipeline (rezervate viitor)
    const pipeline = apts.filter(a => a.status === 'rezervat' && a.rezervat_checkin)
    const venitPipeline = pipeline.reduce((s,a) => s + (Number(a.pret)||0) * 28, 0)

    setPreviziuni({ venitAzi: Math.round(venitAzi), venitEstimat: Math.round(venitEstimat), venitLunaViit: Math.round(venitLunaViit), venitPipeline: Math.round(venitPipeline), pipeline: pipeline.length })
  }

  // ── Segmente timeline ─────────────────────────────────────
  const segments = useMemo(() => {
    const endDate = addZile(startDate, zile.length)
    const map = {}
    const allApts = [...apts].sort((a,b) => (parseInt(a.nr)||999) - (parseInt(b.nr)||999))
    const filtered = allApts.filter(a => {
      const mQ = !srch || (a.nr+(a.firma||'')).toLowerCase().includes(srch.toLowerCase())
      const mT = !fltTip || a.tip_serviciu === fltTip || (fltTip === 'rezervat' && a.status === 'rezervat')
      const mF = !fltFirma || a.firma === fltFirma
      return mQ && mT && mF
    })

    filtered.forEach(apt => {
      const segs = []
      const addSeg = (status, checkin, checkout, isViitor=false) => {
        const segStart = checkin || addZile(azi, -90)
        const segEnd = checkout || addZile(azi, 90)
        const visStart = segStart < startDate ? startDate : segStart
        const visEnd = segEnd > endDate ? endDate : segEnd
        if (visStart >= visEnd) return
        segs.push({
          status, isViitor,
          firma: isViitor ? apt.rezervat_firma : apt.firma,
          tip: apt.tip_serviciu || 'cazare',
          pret: apt.pret,
          elib: apt.data_elib,
          checkin: apt.data_checkin,
          rezervat_checkin: apt.rezervat_checkin,
          offsetDays: diffZile(startDate, visStart),
          lengthDays: diffZile(visStart, visEnd),
          isStartClipped: segStart < startDate,
          isEndClipped: segEnd > endDate,
          apt
        })
      }

      if (apt.status === 'activ' && apt.firma) addSeg('activ', parseD(apt.data_checkin), parseD(apt.data_elib) || addZile(azi,90))
      if (apt.status === 'elib' && apt.firma) addSeg('elib', parseD(apt.data_checkin), parseD(apt.data_elib))
      if (apt.status === 'rezervat') addSeg('rezervat', parseD(apt.rezervat_checkin), addZile(azi,90), true)

      map[apt.nr] = segs
    })
    return { map, filtered }
  }, [apts, startDate, zile, srch, fltTip, fltFirma, azi])

  // ── Drag & select ─────────────────────────────────────────
  const handleMouseDown = useCallback((aptNr, dayIdx, e) => {
    e.preventDefault()
    setDrag({ aptNr, startDay: dayIdx, endDay: dayIdx, active: true })
  }, [])

  const handleMouseEnter = useCallback((aptNr, dayIdx) => {
    if (!drag?.active || drag.aptNr !== aptNr) return
    setDrag(prev => prev ? { ...prev, endDay: dayIdx } : null)
  }, [drag])

  const handleMouseUp = useCallback(() => {
    if (!drag?.active) return
    const start = Math.min(drag.startDay, drag.endDay)
    const end = Math.max(drag.startDay, drag.endDay)
    const apt = segments.filtered.find(a => a.nr === drag.aptNr)
    if (apt) {
      const checkin = dateStr(addZile(startDate, start))
      const checkout = dateStr(addZile(startDate, end+1))
      setModalData({ nr_apt: apt.nr, firma: apt.firma||'', tip_serviciu: apt.tip_serviciu||'cazare', data_checkin: checkin, data_checkout: checkout, pret_noapte: apt.pret||0, status_plata: 'neplatit', tip: 'noua' })
      setModal('rezervare')
    }
    setDrag(null)
  }, [drag, segments, startDate])

  useEffect(() => {
    const up = () => { if (drag?.active) handleMouseUp() }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [drag, handleMouseUp])

  // ── Save rezervare ────────────────────────────────────────
  async function saveRezervare() {
    const { nr_apt, firma, tip_serviciu, data_checkin, data_checkout, pret_noapte, status_plata, observatii, tip, viitor } = modalData
    if (!nr_apt || !data_checkin || !data_checkout) { alert('Completează toate câmpurile!'); return }
    const nrNopti = diffZile(data_checkin, data_checkout)
    const total = nrNopti * Number(pret_noapte)

    if (viitor) {
      // Rezervare viitoare - updateaza apartamentul
      await supabase.from('apartamente').update({
        status: 'rezervat', rezervat_firma: firma, rezervat_checkin: data_checkin
      }).eq('nr', nr_apt)
    } else {
      // Rezervare activa
      await supabase.from('apartamente').update({
        firma, tip_serviciu, data_checkin, status: 'activ', pret: pret_noapte
      }).eq('nr', nr_apt)
      // Salveaza in rezervari
      await supabase.from('rezervari').insert({
        nr_apt, firma, tip_serviciu, data_checkin, data_checkout: data_checkout,
        pret_noapte: Number(pret_noapte), nr_nopti: nrNopti, total,
        status_plata: status_plata||'neplatit', observatii: observatii||''
      })
    }
    setModal(null)
    await loadRezervari()
    window.location.reload()
  }

  // ── Export Excel ──────────────────────────────────────────
  function exportExcel() {
    const rows = [['Nr Apt','Firmă','Tip','Check-in','Check-out','Nopți','Preț/noapte','Total','Status plată','Observații']]
    rezervari.forEach(r => rows.push([r.nr_apt, r.firma, r.tip_serviciu, r.data_checkin, r.data_checkout, r.nr_nopti, r.pret_noapte, r.total, r.status_plata, r.observatii||'']))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a'); el.href=url; el.download=`rezervari-ezel-${aziStr}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  // ── Firme unice ───────────────────────────────────────────
  const firmeUnice = useMemo(() => [...new Set(apts.filter(a=>a.firma).map(a=>a.firma))].sort(), [apts])

  // ── Heatmap data ──────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const data = {}
    const totalApts = apts.filter(a => a.status !== 'maint').length
    for (let luna = 0; luna < 12; luna++) {
      const nrZile = new Date(calAn, luna+1, 0).getDate()
      for (let zi = 1; zi <= nrZile; zi++) {
        const ds = `${calAn}-${String(luna+1).padStart(2,'0')}-${String(zi).padStart(2,'0')}`
        const ocupate = apts.filter(a => {
          if (!a.firma || a.status === 'maint') return false
          const checkin = a.data_checkin || '2020-01-01'
          const elib = a.data_elib || '2099-12-31'
          return ds >= checkin && ds <= elib
        }).length
        data[ds] = totalApts > 0 ? Math.round(ocupate/totalApts*100) : 0
      }
    }
    return data
  }, [apts, calAn])

  function heatColor(pct) {
    if (pct >= 90) return '#1A7A4A'
    if (pct >= 75) return '#65A30D'
    if (pct >= 60) return '#CA8A04'
    if (pct >= 40) return '#EA580C'
    return '#B91C1C'
  }

  const dragRange = drag?.active ? { aptNr: drag.aptNr, start: Math.min(drag.startDay, drag.endDay), end: Math.max(drag.startDay, drag.endDay) } : null

  return (
    <div style={{ fontFamily:'inherit', userSelect:'none' }}>

      {/* ── Previziuni venit ── */}
      {previziuni && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { l:'Venit luna curentă (până azi)', v:`${previziuni.venitAzi.toLocaleString()} RON`, c:'#0F2344', bg:'linear-gradient(135deg,#0F2344,#1A3A6B)', white:true },
            { l:'Estimat până la fin. lunii', v:`${previziuni.venitEstimat.toLocaleString()} RON`, c:'#1A7A4A', bg:'#E8F7EF' },
            { l:'Estimat luna viitoare', v:`${previziuni.venitLunaViit.toLocaleString()} RON`, c:'#B45309', bg:'#FEF3C7' },
            { l:'Pipeline rezervări viitoare', v:`${previziuni.pipeline} apt · ${previziuni.venitPipeline.toLocaleString()} RON`, c:'#5B21B6', bg:'#EDE9FE' },
          ].map(k => (
            <div key={k.l} style={{ borderRadius:16, padding:'14px 16px', background:k.bg||'#fff', border:k.white?'none':'1px solid rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:10, color:k.white?'rgba(255,255,255,.6)':k.c, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5, opacity:k.white?1:.8 }}>{k.l}</div>
              <div style={{ fontSize:16, fontWeight:700, color:k.white?'#fff':k.c, letterSpacing:'-0.5px' }}>{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {/* View toggle */}
        <div style={{ display:'flex', gap:2, background:'#F1F5F9', borderRadius:10, padding:3 }}>
          {[['timeline','📅 Timeline'],['lista','📋 Listă'],['heatmap','🔥 Heatmap']].map(([k,l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                background:view===k?'#fff':'transparent', color:view===k?'#0F2344':'#64748B',
                boxShadow:view===k?'0 1px 3px rgba(0,0,0,.08)':'none', transition:'all .15s' }}>
              {l}
            </button>
          ))}
        </div>

        {view !== 'heatmap' && <>
          <input placeholder="Caută apartament sau firmă..." value={srch} onChange={e=>setSrch(e.target.value)}
            style={{ flex:1, minWidth:140, height:34, padding:'0 10px', border:'1.5px solid #E9EDF4', borderRadius:10, fontSize:13, outline:'none' }} />
          <select value={fltTip} onChange={e=>setFltTip(e.target.value)}
            style={{ height:34, padding:'0 10px', border:'1.5px solid #E9EDF4', borderRadius:10, fontSize:12, background:'#fff' }}>
            <option value="">Toate tipurile</option>
            <option value="cazare">Cazare</option>
            <option value="chirie">Chirie</option>
            <option value="rezervat">Rezervat viitor</option>
          </select>
          <select value={fltFirma} onChange={e=>setFltFirma(e.target.value)}
            style={{ height:34, padding:'0 10px', border:'1.5px solid #E9EDF4', borderRadius:10, fontSize:12, background:'#fff', maxWidth:160 }}>
            <option value="">Toate firmele</option>
            {firmeUnice.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </>}

        {/* Nav luna */}
        {view !== 'lista' && <>
          <button onClick={() => { let l=calLuna-1,a=calAn; if(l<0){l=11;a--}; setCalLuna(l); setCalAn(a) }}
            style={{ height:34, width:34, border:'1.5px solid #E9EDF4', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:16 }}>◀</button>
          <div style={{ height:34, padding:'0 14px', border:'1.5px solid #1A3A6B', borderRadius:10, background:'#EEF4FF', color:'#1A3A6B', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', minWidth:150, justifyContent:'center' }}>
            {view === 'heatmap' ? calAn : `${LUNI[calLuna]} ${calAn}`}
          </div>
          <button onClick={() => { let l=calLuna+1,a=calAn; if(l>11){l=0;a++}; setCalLuna(l); setCalAn(a) }}
            style={{ height:34, width:34, border:'1.5px solid #E9EDF4', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:16 }}>▶</button>
        </>}

        {view === 'lista' && (
          <button onClick={exportExcel} className="btn" style={{ marginLeft:'auto' }}>⬇️ Export CSV</button>
        )}
        <button onClick={() => {
          setModalData({ nr_apt: apts.filter(a=>a.status==='liber')[0]?.nr||'', firma:'', tip_serviciu:'cazare', data_checkin: aziStr, data_checkout:'', pret_noapte:85, status_plata:'neplatit', tip:'noua' })
          setModal('rezervare')
        }} className="btn btn-p">+ Rezervare nouă</button>
      </div>

      {/* ══ VIEW: TIMELINE ══ */}
      {view === 'timeline' && (
        <>
          <div style={{ fontSize:11, color:'#94A3B8', marginBottom:8 }}>
            💡 Trage pe zilele libere pentru rezervare nouă. Click pe bară pentru detalii.
          </div>
          <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E9EDF4', background:'#fff' }}>
            <div style={{ minWidth: LABEL_W + COL_W*zile.length }}>
              {/* Header */}
              <div style={{ display:'flex', borderBottom:'1px solid #E9EDF4', background:'#F8FAFC', position:'sticky', top:0, zIndex:10 }}>
                <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:'1px solid #E9EDF4', padding:'6px 10px', fontSize:11, color:'#94A3B8', fontWeight:600, letterSpacing:'.04em' }}>APARTAMENT</div>
                {zile.map((z,i) => {
                  const isWe = z.getDay()===0||z.getDay()===6
                  const isAzi = z.toDateString()===azi.toDateString()
                  return (
                    <div key={i} style={{ width:COL_W, minWidth:COL_W, textAlign:'center', padding:'3px 0',
                      background:isAzi?'#EEF4FF':isWe?'#FFF8F8':'transparent',
                      borderRight:'0.5px solid #F1F5F9', borderBottom:isAzi?'2px solid #1A3A6B':'none' }}>
                      <div style={{ fontSize:8, color:'#94A3B8', height:10 }}>{i===0||z.getDate()===1?LUNI_SC[z.getMonth()]:''}</div>
                      <div style={{ fontSize:11, fontWeight:isAzi?700:500, color:isAzi?'#1A3A6B':isWe?'#FDA4AF':'#0F2344' }}>{z.getDate()}</div>
                      <div style={{ fontSize:8, color:isWe?'#FDA4AF':'#94A3B8' }}>{ZI_SC[z.getDay()]}</div>
                    </div>
                  )
                })}
              </div>

              {/* Rows */}
              {segments.filtered.map(apt => {
                const aptSegs = segments.map[apt.nr] || []
                const isLiber = apt.status==='liber'
                const isRezervat = apt.status==='rezervat'
                const isDbl = apt.tip==='dublu'||String(apt.nr).startsWith('D')
                return (
                  <div key={apt.nr} style={{ display:'flex', borderBottom:'0.5px solid #F1F5F9', height:ROW_H,
                    background:isLiber?'rgba(232,247,239,.2)':isRezervat?'rgba(253,243,199,.2)':'white' }}>
                    {/* Label */}
                    <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:'1px solid #E9EDF4', padding:'0 10px',
                      display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                      background:isLiber?'rgba(232,247,239,.35)':isRezervat?'rgba(253,243,199,.35)':'#FAFAFA',
                      position:'sticky', left:0, zIndex:5 }}
                      onClick={() => onEditApt && onEditApt(apt)}>
                      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                        background:isDbl?'#EDE9FE':isRezervat?'#FEF3C7':isLiber?'#E8F7EF':'#EEF4FF',
                        color:isDbl?'#5B21B6':isRezervat?'#B45309':isLiber?'#1A7A4A':'#1A3A6B' }}>
                        {apt.nr}
                      </div>
                      <div style={{ overflow:'hidden', flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#0F2344', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {isRezervat ? (apt.rezervat_firma||'Rezervat') : apt.firma||'Liber'}
                        </div>
                        <div style={{ fontSize:10, color:'#94A3B8' }}>
                          {isRezervat ? `Check-in: ${apt.rezervat_checkin}` : apt.pret?`${apt.pret} RON`:apt.nota||''}
                        </div>
                      </div>
                    </div>

                    {/* Celule */}
                    <div style={{ display:'flex', flex:1, position:'relative' }}>
                      {zile.map((z,zi) => {
                        const isWe = z.getDay()===0||z.getDay()===6
                        const isAzi2 = z.toDateString()===azi.toDateString()
                        const isDragSel = dragRange?.aptNr===apt.nr && zi>=dragRange.start && zi<=dragRange.end
                        const isOcc = aptSegs.some(s => zi>=s.offsetDays && zi<s.offsetDays+s.lengthDays)
                        return (
                          <div key={zi} style={{ width:COL_W, minWidth:COL_W, height:'100%', position:'relative',
                            background:isDragSel?'rgba(26,58,107,.12)':isAzi2?'rgba(14,165,233,.03)':isWe?'rgba(253,164,175,.03)':'transparent',
                            borderRight:'0.5px solid #F1F5F9', cursor:isOcc?'default':'crosshair' }}
                            onMouseDown={e => !isOcc && handleMouseDown(apt.nr, zi, e)}
                            onMouseEnter={() => handleMouseEnter(apt.nr, zi)}>
                            {isAzi2 && <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1.5, background:'#0EA5E9', opacity:.4, pointerEvents:'none' }} />}
                          </div>
                        )
                      })}

                      {/* Bare rezervari */}
                      {aptSegs.map((seg,si) => {
                        const colors = seg.status==='elib' ? STATUS_OVERRIDE.elib : TIP_COLORS[seg.isViitor?'rezervat':seg.tip] || TIP_COLORS.cazare
                        const left = seg.offsetDays*COL_W+2
                        const width = Math.max(seg.lengthDays*COL_W-4,4)
                        const firmaC = firmaColor(seg.firma)
                        return (
                          <div key={si}
                            onClick={() => {
                              setModalData({ ...seg.apt, _seg:seg, tip:'detali' })
                              setModal('detali')
                            }}
                            onMouseEnter={e => { e.stopPropagation(); setTooltip({ seg, x:e.clientX, y:e.clientY }) }}
                            onMouseLeave={() => setTooltip(null)}
                            style={{ position:'absolute', left, top:5, height:ROW_H-10, width,
                              background:seg.isViitor?'transparent':colors.bg, zIndex:4, cursor:'pointer',
                              borderRadius:`${seg.isStartClipped?0:8}px ${seg.isEndClipped?0:8}px ${seg.isEndClipped?0:8}px ${seg.isStartClipped?0:8}px`,
                              border:seg.isViitor?`2px dashed ${colors.border}`:`1.5px solid ${colors.border}33`,
                              display:'flex', alignItems:'center', paddingLeft:6, overflow:'hidden',
                              boxShadow:seg.isViitor?'none':'0 1px 4px rgba(0,0,0,.10)' }}
                            onMouseOver={e => e.currentTarget.style.opacity='.8'}
                            onMouseOut={e => e.currentTarget.style.opacity='1'}>
                            {/* Banda firma colorata */}
                            {!seg.isViitor && !seg.isStartClipped && (
                              <div style={{ width:3, height:'70%', borderRadius:99, background:firmaC, marginRight:5, flexShrink:0 }} />
                            )}
                            {width > 36 && (
                              <span style={{ fontSize:10, fontWeight:600, color:colors.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
                                {seg.isViitor ? `📅 ${seg.firma||'Rezervat'}` : seg.firma}
                                {seg.elib && !seg.isEndClipped && width>70 ? ` → ${seg.elib?.substring(5)}` : ''}
                              </span>
                            )}
                          </div>
                        )
                      })}

                      {/* Drag preview */}
                      {dragRange?.aptNr===apt.nr && (
                        <div style={{ position:'absolute', left:dragRange.start*COL_W+2, top:5, height:ROW_H-10,
                          width:(dragRange.end-dragRange.start+1)*COL_W-4,
                          background:'rgba(26,58,107,.18)', borderRadius:8, zIndex:3,
                          border:'2px dashed #1A3A6B', pointerEvents:'none', display:'flex', alignItems:'center', paddingLeft:8 }}>
                          <span style={{ fontSize:11, color:'#1A3A6B', fontWeight:700 }}>
                            {dragRange.end-dragRange.start+1} zile
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {segments.filtered.length===0 && (
                <div style={{ padding:48, textAlign:'center', color:'#94A3B8', fontSize:13 }}>Niciun apartament găsit.</div>
              )}
            </div>
          </div>

          {/* Legenda */}
          <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap', fontSize:11, color:'#64748B', alignItems:'center' }}>
            {[
              { color:'rgba(26,58,107,.42)', border:'#1A3A6B', label:'Cazare' },
              { color:'rgba(15,118,110,.42)', border:'#0F766E', label:'Chirie' },
              { color:'rgba(185,28,28,.38)', border:'#B91C1C', label:'Eliberează' },
              { color:'transparent', border:'#B45309', label:'Rezervat viitor (hașurat)', dashed:true },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:20, height:10, borderRadius:3, background:l.color, border:`1.5px ${l.dashed?'dashed':'solid'} ${l.border}` }} />
                {l.label}
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:3, height:14, borderRadius:99, background:'#1A3A6B' }} />
              Banda colorată = firmă
            </div>
          </div>
        </>
      )}

      {/* ══ VIEW: LISTA ══ */}
      {view === 'lista' && (
        <div>
          {/* Rezervari active */}
          <div style={{ fontWeight:600, color:'#0F2344', marginBottom:10, fontSize:13 }}>Rezervări active</div>
          <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E9EDF4', background:'#fff', marginBottom:20 }}>
            <table className="tbl">
              <thead><tr>
                <th>Apt</th><th>Firmă</th><th>Tip</th><th>Check-in</th><th>Check-out</th>
                <th>Zile rămase</th><th>Preț/noapte</th><th>Total estimat</th><th>Status plată</th>
              </tr></thead>
              <tbody>
                {apts.filter(a => a.firma && ['activ','elib'].includes(a.status))
                  .sort((a,b) => (parseInt(a.nr)||999)-(parseInt(b.nr)||999))
                  .filter(a => (!srch||(a.nr+(a.firma||'')).toLowerCase().includes(srch.toLowerCase())) && (!fltFirma||a.firma===fltFirma) && (!fltTip||a.tip_serviciu===fltTip))
                  .map(a => {
                    const zileRamase = a.data_elib ? diffZile(aziStr, a.data_elib) : null
                    const zileFacute = a.data_checkin ? diffZile(a.data_checkin, aziStr) : 0
                    const total = (Number(a.pret)||0) * Math.max(0, zileFacute)
                    return (
                      <tr key={a.nr} style={{ cursor:'pointer' }} onClick={() => onEditApt && onEditApt(a)}>
                        <td><strong>{a.nr}</strong></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:firmaColor(a.firma), flexShrink:0 }} />
                            {a.firma}
                          </div>
                        </td>
                        <td><span className={a.tip_serviciu==='chirie'?'badge bk':'badge bb'} style={{ fontSize:10 }}>{a.tip_serviciu||'cazare'}</span></td>
                        <td style={{ fontSize:12 }}>{a.data_checkin||'—'}</td>
                        <td style={{ fontSize:12 }}>{a.data_elib||'—'}</td>
                        <td>
                          {zileRamase !== null
                            ? <span style={{ fontWeight:700, color:zileRamase<=3?'#B91C1C':zileRamase<=7?'#B45309':'#1A7A4A' }}>
                                {zileRamase<=0?'Azi':zileRamase===1?'Mâine':`${zileRamase}z`}
                              </span>
                            : <span style={{ color:'#94A3B8' }}>nedefinit</span>}
                        </td>
                        <td style={{ fontWeight:600 }}>{a.pret?`${a.pret} RON`:'—'}</td>
                        <td style={{ fontWeight:700, color:'#1A3A6B' }}>{total>0?`${total.toLocaleString()} RON`:'—'}</td>
                        <td>
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:600,
                            background:a.status_plata==='platit'?'#E8F7EF':'#FEF3C7',
                            color:a.status_plata==='platit'?'#1A7A4A':'#B45309' }}>
                            {a.status_plata==='platit'?'✓ Plătit':'⏳ Neplatit'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {/* Istoric rezervari */}
          <div style={{ fontWeight:600, color:'#0F2344', marginBottom:10, fontSize:13 }}>Istoric rezervări</div>
          <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E9EDF4', background:'#fff' }}>
            <table className="tbl">
              <thead><tr><th>Apt</th><th>Firmă</th><th>Tip</th><th>Check-in</th><th>Check-out</th><th>Nopți</th><th>Total</th><th>Status plată</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'#94A3B8' }}>Se încarcă...</td></tr>
                ) : rezervari.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'#94A3B8' }}>Niciun istoric înregistrat.</td></tr>
                ) : rezervari
                  .filter(r => (!srch||(r.nr_apt+(r.firma||'')).toLowerCase().includes(srch.toLowerCase())) && (!fltFirma||r.firma===fltFirma))
                  .map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.nr_apt}</strong></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:firmaColor(r.firma) }} />{r.firma}
                    </div></td>
                    <td><span className="badge bk" style={{ fontSize:10 }}>{r.tip_serviciu||'cazare'}</span></td>
                    <td style={{ fontSize:12 }}>{r.data_checkin}</td>
                    <td style={{ fontSize:12 }}>{r.data_checkout}</td>
                    <td style={{ textAlign:'center' }}>{r.nr_nopti}</td>
                    <td style={{ fontWeight:700 }}>{Number(r.total||0).toLocaleString()} RON</td>
                    <td><span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:600,
                      background:r.status_plata==='platit'?'#E8F7EF':'#FEF3C7',
                      color:r.status_plata==='platit'?'#1A7A4A':'#B45309' }}>
                      {r.status_plata==='platit'?'✓ Plătit':'⏳ Neplatit'}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ VIEW: HEATMAP ══ */}
      {view === 'heatmap' && (
        <div>
          <div style={{ fontSize:12, color:'#94A3B8', marginBottom:14 }}>
            Ocupare zilnică pe tot anul {calAn}. Click pe o zi pentru detalii.
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'separate', borderSpacing:3 }}>
              <thead>
                <tr>
                  <th style={{ fontSize:11, color:'#94A3B8', fontWeight:500, padding:'0 8px 6px', textAlign:'left', width:60 }}>Luna</th>
                  {Array.from({length:31},(_,i)=>(
                    <th key={i} style={{ fontSize:10, color:'#94A3B8', fontWeight:500, width:22, textAlign:'center', paddingBottom:6 }}>{i+1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length:12},(_,luna) => {
                  const nrZile = new Date(calAn, luna+1, 0).getDate()
                  return (
                    <tr key={luna}>
                      <td style={{ fontSize:11, color:'#475569', fontWeight:500, paddingRight:8, whiteSpace:'nowrap' }}>{LUNI_SC[luna]}</td>
                      {Array.from({length:31},(_,zi) => {
                        if (zi >= nrZile) return <td key={zi} />
                        const ds = `${calAn}-${String(luna+1).padStart(2,'0')}-${String(zi+1).padStart(2,'0')}`
                        const pct = heatmapData[ds] || 0
                        const isAziCell = ds === aziStr
                        return (
                          <td key={zi}
                            onClick={() => setHeatmapZi(ds)}
                            title={`${ds}: ${pct}% ocupare`}
                            style={{ width:22, height:22, borderRadius:5, cursor:'pointer',
                              background: pct===0?'#F1F5F9':heatColor(pct),
                              border:isAziCell?'2px solid #0F2344':'2px solid transparent',
                              opacity: pct===0?0.4:1, transition:'transform .1s' }}
                            onMouseOver={e=>e.currentTarget.style.transform='scale(1.3)'}
                            onMouseOut={e=>e.currentTarget.style.transform='scale(1)'} />
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legenda heatmap */}
          <div style={{ display:'flex', gap:8, marginTop:14, alignItems:'center', fontSize:11, color:'#64748B' }}>
            <span>0%</span>
            {[0,40,60,75,90,100].map(p => (
              <div key={p} style={{ width:16, height:16, borderRadius:4, background:p===0?'#F1F5F9':heatColor(p) }} />
            ))}
            <span>100%</span>
          </div>

          {/* Modal zi heatmap */}
          {heatmapZi && (
            <div className="overlay" onClick={() => setHeatmapZi(null)}>
              <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:380 }}>
                <div className="mhdr">
                  <div className="mtitle">📅 {new Date(heatmapZi+'T12:00:00').toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}</div>
                  <button onClick={() => setHeatmapZi(null)} style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#94A3B8' }}>✕</button>
                </div>
                <div style={{ marginBottom:12 }}>
                  <span style={{ fontWeight:700, fontSize:16, color:'#0F2344' }}>{heatmapData[heatmapZi]||0}%</span>
                  <span style={{ fontSize:12, color:'#94A3B8', marginLeft:6 }}>ocupare</span>
                </div>
                {apts.filter(a => {
                  if (!a.firma) return false
                  const ci = a.data_checkin||'2020-01-01'
                  const el = a.data_elib||'2099-12-31'
                  return heatmapZi >= ci && heatmapZi <= el
                }).map(a => (
                  <div key={a.nr} style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid #F1F5F9', fontSize:12 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:'#EEF4FF', color:'#1A3A6B', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, flexShrink:0 }}>{a.nr}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:'#0F2344' }}>{a.firma}</div>
                      <div style={{ color:'#94A3B8' }}>{a.pret} RON · {a.tip_serviciu}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TOOLTIP ══ */}
      {tooltip && (
        <div style={{ position:'fixed', left:tooltip.x+14, top:tooltip.y-10, background:'#0F2344', color:'#fff',
          borderRadius:10, padding:'8px 12px', fontSize:12, zIndex:9999, pointerEvents:'none',
          boxShadow:'0 4px 16px rgba(0,0,0,.2)', maxWidth:220 }}>
          <div style={{ fontWeight:700, marginBottom:3 }}>AP {tooltip.seg.apt.nr}</div>
          <div>{tooltip.seg.firma||'—'}</div>
          {tooltip.seg.tip && <div style={{ color:'rgba(255,255,255,.7)' }}>{tooltip.seg.tip==='chirie'?'🏠 Chirie':'🌙 Cazare'}</div>}
          {tooltip.seg.pret>0 && <div>{tooltip.seg.pret} RON/{tooltip.seg.tip==='chirie'?'lună':'noapte'}</div>}
          {tooltip.seg.checkin && <div>Check-in: {tooltip.seg.checkin}</div>}
          {tooltip.seg.elib && <div>Elib.: {tooltip.seg.elib}</div>}
          {tooltip.seg.isViitor && <div style={{ color:'#FDE68A', marginTop:3 }}>📅 Rezervare viitoare</div>}
        </div>
      )}

      {/* ══ MODAL REZERVARE NOUA ══ */}
      {modal === 'rezervare' && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mhdr">
              <div className="mtitle">Rezervare nouă</div>
              <button onClick={() => setModal(null)} style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#94A3B8' }}>✕</button>
            </div>
            {/* Toggle activa / viitoare */}
            <div style={{ display:'flex', gap:4, background:'#F1F5F9', borderRadius:10, padding:3, marginBottom:14 }}>
              {[['activa','✅ Activă acum'],['viitoare','📅 Viitoare (pipeline)']].map(([k,l]) => (
                <button key={k} onClick={() => setModalData(p=>({...p,viitor:k==='viitoare'}))}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                    background:(!modalData.viitor&&k==='activa')||(modalData.viitor&&k==='viitoare')?'#fff':'transparent',
                    color:(!modalData.viitor&&k==='activa')||(modalData.viitor&&k==='viitoare')?'#0F2344':'#64748B',
                    boxShadow:(!modalData.viitor&&k==='activa')||(modalData.viitor&&k==='viitoare')?'0 1px 3px rgba(0,0,0,.08)':'none' }}>
                  {l}
                </button>
              ))}
            </div>
            <div className="fg"><label className="fl">Apartament</label>
              <select className="fi" value={modalData.nr_apt} onChange={e=>setModalData(p=>({...p,nr_apt:e.target.value}))}>
                {apts.filter(a=>['liber','rezervat'].includes(a.status)||modalData.viitor).map(a=>(
                  <option key={a.nr} value={a.nr}>AP {a.nr} — {a.firma||a.status}</option>
                ))}
              </select>
            </div>
            <div className="fg"><label className="fl">Firmă client</label>
              <input className="fi" value={modalData.firma} onChange={e=>setModalData(p=>({...p,firma:e.target.value}))} list="firme-list" placeholder="Nume firmă" />
              <datalist id="firme-list">{firmeUnice.map(f=><option key={f} value={f}/>)}</datalist>
            </div>
            <div className="fg"><label className="fl">Tip serviciu</label>
              <div style={{ display:'flex', gap:6 }}>
                {['cazare','chirie'].map(t=>(
                  <div key={t} onClick={()=>setModalData(p=>({...p,tip_serviciu:t}))}
                    style={{ flex:1, padding:'9px 0', borderRadius:10, textAlign:'center', cursor:'pointer', fontWeight:600, fontSize:12, border:'2px solid',
                      borderColor:modalData.tip_serviciu===t?'#0F2344':'#E9EDF4',
                      background:modalData.tip_serviciu===t?'#0F2344':'#fff',
                      color:modalData.tip_serviciu===t?'#fff':'#475569' }}>
                    {t==='cazare'?'🌙 Cazare':'🏠 Chirie'}
                  </div>
                ))}
              </div>
            </div>
            <div className="r2">
              <div className="fg"><label className="fl">Data check-in</label><input type="date" className="fi" value={modalData.data_checkin} onChange={e=>setModalData(p=>({...p,data_checkin:e.target.value}))} /></div>
              {!modalData.viitor && <div className="fg"><label className="fl">Data checkout</label><input type="date" className="fi" value={modalData.data_checkout} onChange={e=>setModalData(p=>({...p,data_checkout:e.target.value}))} /></div>}
            </div>
            {!modalData.viitor && (
              <>
                <div className="fg"><label className="fl">Preț/noapte (RON)</label><input type="number" className="fi" value={modalData.pret_noapte} onChange={e=>setModalData(p=>({...p,pret_noapte:e.target.value}))} /></div>
                {modalData.data_checkin && modalData.data_checkout && (
                  <div style={{ padding:'10px 14px', background:'#EEF4FF', borderRadius:12, fontSize:12, color:'#1A3A6B', marginBottom:10 }}>
                    💡 Total estimat: <strong>{(diffZile(modalData.data_checkin,modalData.data_checkout)*Number(modalData.pret_noapte)).toLocaleString()} RON</strong>
                    {' · '}{diffZile(modalData.data_checkin,modalData.data_checkout)} nopți
                  </div>
                )}
                <div className="fg"><label className="fl">Status plată</label>
                  <select className="fi" value={modalData.status_plata} onChange={e=>setModalData(p=>({...p,status_plata:e.target.value}))}>
                    <option value="neplatit">⏳ Neplatit</option>
                    <option value="platit">✓ Platit</option>
                    <option value="partial">◐ Parțial</option>
                  </select>
                </div>
              </>
            )}
            <div className="fg"><label className="fl">Observații</label><input className="fi" value={modalData.observatii||''} onChange={e=>setModalData(p=>({...p,observatii:e.target.value}))} placeholder="Opțional" /></div>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button className="btn btn-p" style={{ flex:1 }} onClick={saveRezervare}>✓ Salvează</button>
              <button className="btn" onClick={() => setModal(null)}>Anulează</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
