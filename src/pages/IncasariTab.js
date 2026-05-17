import React, { useState, useMemo } from 'react'

const LUNI_NUME = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const TRIMESTRE = ['T1 (Ian-Mar)','T2 (Apr-Iun)','T3 (Iul-Sep)','T4 (Oct-Dec)']

function zileleLunii(an, luna) {
  return new Date(an, luna + 1, 0).getDate()
}

function calcVenitApt(apt, an, luna) {
  const zile = zileleLunii(an, luna)
  if (apt.tip_serviciu === 'chirie') {
    const chirie = Number(apt.pret) || 0
    const utilitati = Number(apt.pret_utilitati) || 0
    return { chirie, utilitati, total: chirie + utilitati, zile: null }
  } else {
    const perNoapte = Number(apt.pret) || 0
    const total = perNoapte * zile
    return { perNoapte, total, zile }
  }
}

export default function IncasariTab({ apts }) {
  const now = new Date()
  const [view, setView] = useState('lunar') // 'lunar' | 'trimestrial' | 'anual'
  const [an, setAn] = useState(now.getFullYear())
  const [luna, setLuna] = useState(now.getMonth())
  const [trimestru, setTrimestru] = useState(Math.floor(now.getMonth() / 3))

  const activeApts = apts.filter(a => a.status === 'activ' && a.firma && Number(a.pret) > 0)
  const cazare = activeApts.filter(a => a.tip_serviciu !== 'chirie')
  const chirie = activeApts.filter(a => a.tip_serviciu === 'chirie')

  // ── LUNAR ─────────────────────────────────────────────────
  const dateLunare = useMemo(() => {
    const zile = zileleLunii(an, luna)
    const byFirma = {}
    activeApts.forEach(a => {
      if (!byFirma[a.firma]) byFirma[a.firma] = { apts: [], total: 0, tip: a.tip_serviciu || 'cazare', plata: a.plata }
      const v = calcVenitApt(a, an, luna)
      byFirma[a.firma].apts.push({ ...a, venit: v })
      byFirma[a.firma].total += v.total
    })
    const totalCazare = cazare.reduce((s, a) => s + calcVenitApt(a, an, luna).total, 0)
    const totalChirie = chirie.reduce((s, a) => s + calcVenitApt(a, an, luna).total, 0)
    return { byFirma, totalCazare, totalChirie, total: totalCazare + totalChirie, zile }
  }, [an, luna, apts])

  // ── TRIMESTRIAL ────────────────────────────────────────────
  const dateTrim = useMemo(() => {
    const lunaStart = trimestru * 3
    const luni = [lunaStart, lunaStart+1, lunaStart+2]
    const byFirma = {}
    luni.forEach(l => {
      activeApts.forEach(a => {
        if (!byFirma[a.firma]) byFirma[a.firma] = { apts: {}, plata: a.plata, tip: a.tip_serviciu || 'cazare' }
        if (!byFirma[a.firma].apts[a.nr]) byFirma[a.firma].apts[a.nr] = { apt: a, luni: [] }
        const v = calcVenitApt(a, an, l)
        byFirma[a.firma].apts[a.nr].luni.push({ luna: l, ...v })
      })
    })
    // Totaluri pe luna
    const totalPeLuna = luni.map(l => ({
      luna: l,
      total: activeApts.reduce((s, a) => s + calcVenitApt(a, an, l).total, 0)
    }))
    const totalTrim = totalPeLuna.reduce((s, l) => s + l.total, 0)
    return { byFirma, totalPeLuna, totalTrim, luni }
  }, [trimestru, an, apts])

  // ── ANUAL ──────────────────────────────────────────────────
  const dateAnuale = useMemo(() => {
    const totalPeLuna = Array.from({length:12}, (_,l) => ({
      luna: l,
      total: activeApts.reduce((s,a) => s + calcVenitApt(a,an,l).total, 0),
      zile: zileleLunii(an, l)
    }))
    const totalAn = totalPeLuna.reduce((s,l) => s + l.total, 0)
    const byFirma = {}
    activeApts.forEach(a => {
      if (!byFirma[a.firma]) byFirma[a.firma] = { total: 0, tip: a.tip_serviciu||'cazare' }
      byFirma[a.firma].total += Array.from({length:12},(_,l) => calcVenitApt(a,an,l).total).reduce((s,v)=>s+v,0)
    })
    return { totalPeLuna, totalAn, byFirma }
  }, [an, apts])

  const styleStat = (bg, border, color) => ({
    background: bg, borderRadius: 10, padding: '10px 12px',
    border: `1px solid ${border}`, textAlign: 'center'
  })

  return (
    <div>
      {/* Selector an */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <button className="btn" onClick={() => setAn(a=>a-1)}>◀</button>
        <div style={{ fontSize:15, fontWeight:700, color:'#1F3864', minWidth:60, textAlign:'center' }}>{an}</div>
        <button className="btn" onClick={() => setAn(a=>a+1)}>▶</button>

        <div style={{ display:'flex', gap:4, marginLeft:8 }}>
          {[['lunar','Lunar'],['trimestrial','Trimestrial'],['anual','Anual']].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #ddd', fontSize:12, fontWeight:500, cursor:'pointer',
                background: view===v?'#1F3864':'#fff', color: view===v?'#fff':'#555' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── LUNAR ── */}
      {view === 'lunar' && (
        <div>
          {/* Selector luna */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:14 }}>
            {LUNI_NUME.map((l,i) => (
              <button key={i} onClick={() => setLuna(i)}
                style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #ddd', fontSize:12, cursor:'pointer',
                  background: luna===i?'#2F5496':'#fff', color: luna===i?'#fff':'#555', fontWeight: luna===i?600:400 }}>{l.substring(0,3)}</button>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:8, marginBottom:14 }}>
            <div style={styleStat('#EBF1FB','#90B8E8','#1F3864')}>
              <div style={{ fontSize:11, color:'#1F3864' }}>Total luna</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#1F3864' }}>{dateLunare.total.toLocaleString()}</div>
              <div style={{ fontSize:10, color:'#888' }}>RON</div>
            </div>
            <div style={styleStat('#E2EFDA','#C0DD97','#375623')}>
              <div style={{ fontSize:11, color:'#375623' }}>Cazare</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#375623' }}>{dateLunare.totalCazare.toLocaleString()}</div>
              <div style={{ fontSize:10, color:'#888' }}>{dateLunare.zile} zile</div>
            </div>
            <div style={styleStat('#EDE7F6','#C5B3F0','#4527A0')}>
              <div style={{ fontSize:11, color:'#4527A0' }}>Chirie</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#4527A0' }}>{dateLunare.totalChirie.toLocaleString()}</div>
              <div style={{ fontSize:10, color:'#888' }}>RON</div>
            </div>
            <div style={styleStat('#fff','#e8e8e8','#555')}>
              <div style={{ fontSize:11, color:'#888' }}>Firme active</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#1F3864' }}>{Object.keys(dateLunare.byFirma).length}</div>
            </div>
          </div>

          {/* Tabel pe firme */}
          <table className="tbl">
            <thead><tr>
              <th>Firma</th><th>Apartamente</th><th>Nr</th><th>Tip</th>
              <th>Pret</th><th>Utilitati</th><th>Zile</th><th>Total</th><th>Plata</th>
            </tr></thead>
            <tbody>
              {Object.entries(dateLunare.byFirma).sort((a,b)=>b[1].total-a[1].total).map(([firma, v]) => (
                v.apts.map((a, i) => (
                  <tr key={a.nr}>
                    {i===0 && <td rowSpan={v.apts.length} style={{ fontWeight:700, verticalAlign:'top', paddingTop:10 }}>{firma}</td>}
                    <td>AP {a.nr}{a.nota?` · ${a.nota}`:''}</td>
                    <td>{i===0?v.apts.length:''}</td>
                    <td><span className={`badge ${a.tip_serviciu==='chirie'?'bp2':'bg2'}`}>{a.tip_serviciu==='chirie'?'Chirie':'Cazare'}</span></td>
                    <td>{a.tip_serviciu==='chirie'?`${Number(a.pret).toLocaleString()} RON/luna`:`${a.pret} RON/noapte`}</td>
                    <td>{a.tip_serviciu==='chirie'&&Number(a.pret_utilitati)>0?`${Number(a.pret_utilitati).toLocaleString()} RON`:'—'}</td>
                    <td>{a.venit.zile||'—'}</td>
                    <td><strong>{a.venit.total.toLocaleString()} RON</strong></td>
                    {i===0 && <td rowSpan={v.apts.length}><span className={`badge ${v.plata==='OP'?'bb':'bk'}`}>{v.plata}</span></td>}
                  </tr>
                ))
              ))}
              <tr style={{ background:'#f0f4f8', fontWeight:700 }}>
                <td colSpan={7}><strong>TOTAL {LUNI_NUME[luna].toUpperCase()} {an}</strong></td>
                <td><strong>{dateLunare.total.toLocaleString()} RON</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── TRIMESTRIAL ── */}
      {view === 'trimestrial' && (
        <div>
          <div style={{ display:'flex', gap:4, marginBottom:14 }}>
            {TRIMESTRE.map((t,i) => (
              <button key={i} onClick={() => setTrimestru(i)}
                style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #ddd', fontSize:12, cursor:'pointer',
                  background: trimestru===i?'#2F5496':'#fff', color: trimestru===i?'#fff':'#555', fontWeight: trimestru===i?600:400 }}>{t}</button>
            ))}
          </div>

          {/* Stats pe luni din trimestru */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {dateTrim.totalPeLuna.map(({luna:l, total}) => (
              <div key={l} style={styleStat('#EBF1FB','#90B8E8')}>
                <div style={{ fontSize:11, color:'#888' }}>{LUNI_NUME[l]}</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#1F3864' }}>{total.toLocaleString()}</div>
                <div style={{ fontSize:10, color:'#aaa' }}>RON · {zileleLunii(an,l)} zile</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#1F3864', color:'#fff', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600 }}>Total {TRIMESTRE[trimestru]} {an}</span>
            <span style={{ fontSize:20, fontWeight:700 }}>{dateTrim.totalTrim.toLocaleString()} RON</span>
          </div>

          {/* Tabel firme pe trimestru */}
          <table className="tbl">
            <thead><tr>
              <th>Firma</th><th>Apt</th><th>Tip</th>
              {dateTrim.luni.map(l => <th key={l}>{LUNI_NUME[l].substring(0,3)}</th>)}
              <th>Total trim.</th>
            </tr></thead>
            <tbody>
              {Object.entries(dateTrim.byFirma).map(([firma, v]) => (
                Object.values(v.apts).map((row, i) => {
                  const totalApt = row.luni.reduce((s,l)=>s+l.total,0)
                  return (
                    <tr key={row.apt.nr}>
                      {i===0&&<td rowSpan={Object.values(v.apts).length} style={{fontWeight:700,verticalAlign:'top',paddingTop:10}}>{firma}</td>}
                      <td>AP {row.apt.nr}</td>
                      <td><span className={`badge ${row.apt.tip_serviciu==='chirie'?'bp2':'bg2'}`}>{row.apt.tip_serviciu==='chirie'?'Chirie':'Cazare'}</span></td>
                      {row.luni.map(l => <td key={l.luna}>{l.total.toLocaleString()}</td>)}
                      <td><strong>{totalApt.toLocaleString()} RON</strong></td>
                    </tr>
                  )
                })
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ANUAL ── */}
      {view === 'anual' && (
        <div>
          <div style={{ background:'#1F3864', color:'#fff', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600 }}>Total {an}</span>
            <span style={{ fontSize:22, fontWeight:700 }}>{dateAnuale.totalAn.toLocaleString()} RON</span>
          </div>

          {/* Grafic simplu pe luni */}
          <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, padding:'14px', marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#888', marginBottom:10 }}>Venit lunar {an}</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
              {dateAnuale.totalPeLuna.map(({luna:l, total}) => {
                const max = Math.max(...dateAnuale.totalPeLuna.map(x=>x.total))
                const h = max > 0 ? Math.round((total/max)*80) : 0
                return (
                  <div key={l} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{ fontSize:9, color:'#888', fontWeight:600 }}>{total>0?Math.round(total/1000)+'k':''}</div>
                    <div style={{ width:'100%', height:h, background: l===now.getMonth()&&an===now.getFullYear()?'#1F3864':'#BDD7EE', borderRadius:'3px 3px 0 0', minHeight:total>0?4:0 }}></div>
                    <div style={{ fontSize:9, color:'#888' }}>{LUNI_NUME[l].substring(0,3)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabel anual pe firme */}
          <table className="tbl">
            <thead><tr><th>Firma</th><th>Tip serviciu</th><th>Total anual estimat</th><th>Media/luna</th></tr></thead>
            <tbody>
              {Object.entries(dateAnuale.byFirma).sort((a,b)=>b[1].total-a[1].total).map(([firma,v]) => (
                <tr key={firma}>
                  <td><strong>{firma}</strong></td>
                  <td><span className={`badge ${v.tip==='chirie'?'bp2':'bg2'}`}>{v.tip==='chirie'?'Chirie':'Cazare'}</span></td>
                  <td><strong>{v.total.toLocaleString()} RON</strong></td>
                  <td>{Math.round(v.total/12).toLocaleString()} RON</td>
                </tr>
              ))}
              <tr style={{ background:'#f0f4f8', fontWeight:700 }}>
                <td colSpan={2}><strong>TOTAL {an}</strong></td>
                <td><strong>{dateAnuale.totalAn.toLocaleString()} RON</strong></td>
                <td>{Math.round(dateAnuale.totalAn/12).toLocaleString()} RON</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
