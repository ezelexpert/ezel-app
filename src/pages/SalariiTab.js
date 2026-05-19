import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LUNI_NUME = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const LEI_PER_APT = 10

export default function SalariiTab() {
  const [date, setDate] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [an, setAn] = useState(now.getFullYear())
  const [luna, setLuna] = useState(now.getMonth())
  const [salariuBaza, setSalariuBaza] = useState({ 'Olar Svitlana': 3000, 'Farcas Adela Georgiana': 3000 })
  const [editSalar, setEditSalar] = useState(false)

  useEffect(() => { load() }, [an, luna])

  async function load() {
    setLoading(true)
    try {
      const lunaStr = `${an}-${String(luna+1).padStart(2,'0')}`
      const { data } = await supabase
        .from('curatenie')
        .select('*')
        .eq('status_curatenie', 'finalizata')
        .gte('data_programata', `${lunaStr}-01`)
        .lte('data_programata', `${lunaStr}-31`)
        .or('deja_curat.is.null,deja_curat.eq.false')
      setDate(data || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  // Calcul per angajata
  const angajate = ['Olar Svitlana', 'Farcas Adela Georgiana']

  const stats = angajate.map(nume => {
    const curateniiFacute = date.filter(c => c.facut_de === nume)
    const neFacut = date.filter(c => !c.facut_de || c.facut_de === '')
    // Curateniile fara autor se impart egal
    const bonus = (curateniiFacute.length * LEI_PER_APT) + (neFacut.length * LEI_PER_APT / 2)
    const baza = salariuBaza[nume] || 3000
    return {
      nume,
      curatenii: curateniiFacute.length,
      neatribuite: neFacut.length,
      bonus: Math.round(bonus),
      baza,
      total: Math.round(baza + bonus)
    }
  })

  const totalCuratenii = date.length
  const totalBonus = stats.reduce((s, a) => s + a.bonus, 0)
  const neatribuite = date.filter(c => !c.facut_de || c.facut_de === '').length

  return (
    <div>
      {/* Selector luna */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <button className="btn" onClick={() => setAn(a=>a-1)}>◀</button>
        <div style={{ fontSize:15, fontWeight:700, color:'#1F3864', minWidth:60, textAlign:'center' }}>{an}</div>
        <button className="btn" onClick={() => setAn(a=>a+1)}>▶</button>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {LUNI_NUME.map((l,i) => (
            <button key={i} onClick={() => setLuna(i)}
              style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #ddd', fontSize:12, cursor:'pointer',
                background: luna===i?'#1F3864':'#fff', color: luna===i?'#fff':'#555', fontWeight: luna===i?600:400 }}>
              {l.substring(0,3)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats totale */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8, marginBottom:16 }}>
        <div style={{ background:'#EBF1FB', borderRadius:10, padding:'10px 12px', border:'1px solid #90B8E8', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#1F3864' }}>{totalCuratenii}</div>
          <div style={{ fontSize:11, color:'#1F3864' }}>Curățenii totale</div>
        </div>
        <div style={{ background:'#E2EFDA', borderRadius:10, padding:'10px 12px', border:'1px solid #C0DD97', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{totalCuratenii * LEI_PER_APT} RON</div>
          <div style={{ fontSize:11, color:'#375623' }}>Total bonusuri</div>
        </div>
        {neatribuite > 0 && (
          <div style={{ background:'#FFF2CC', borderRadius:10, padding:'10px 12px', border:'1px solid #F0C040', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#7B5E00' }}>{neatribuite}</div>
            <div style={{ fontSize:11, color:'#7B5E00' }}>Neatribuite (împărțite egal)</div>
          </div>
        )}
      </div>

      {/* Carduri angajate */}
      {loading ? <div style={{ textAlign:'center', padding:30, color:'#aaa' }}>Se încarcă...</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12, marginBottom:16 }}>
          {stats.map(s => (
            <div key={s.nume} style={{ background:'#fff', border:'1.5px solid #e0e0e0', borderRadius:12, padding:'16px', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'#375623', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
                  {s.nume.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1F3864' }}>{s.nume}</div>
                  <div style={{ fontSize:11, color:'#888' }}>🧹 Curățenie · {LUNI_NUME[luna]} {an}</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#375623' }}>{s.curatenii}</div>
                  <div style={{ fontSize:10, color:'#888' }}>curățenii proprii</div>
                </div>
                <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#7B5E00' }}>{s.bonus} RON</div>
                  <div style={{ fontSize:10, color:'#888' }}>bonus ({LEI_PER_APT} RON/apt)</div>
                </div>
              </div>

              {/* Detaliu calcul */}
              <div style={{ fontSize:11, color:'#888', background:'#f8f9fa', borderRadius:8, padding:'8px 10px', marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span>Salariu bază</span><span style={{ fontWeight:600 }}>{s.baza.toLocaleString()} RON</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span>{s.curatenii} curățenii × {LEI_PER_APT} RON</span>
                  <span style={{ fontWeight:600, color:'#375623' }}>+{s.curatenii * LEI_PER_APT} RON</span>
                </div>
                {neatribuite > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span>{neatribuite} neatribuite ÷ 2</span>
                    <span style={{ fontWeight:600, color:'#7B5E00' }}>+{Math.round(neatribuite * LEI_PER_APT / 2)} RON</span>
                  </div>
                )}
                <div style={{ height:1, background:'#e0e0e0', margin:'6px 0' }}></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:700 }}>TOTAL DE PLĂTIT</span>
                  <span style={{ fontWeight:700, color:'#1F3864', fontSize:13 }}>{s.total.toLocaleString()} RON</span>
                </div>
              </div>

              <div style={{ background:'#1F3864', color:'#fff', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontSize:11, opacity:.7, marginBottom:2 }}>Total salariu {LUNI_NUME[luna]}</div>
                <div style={{ fontSize:22, fontWeight:700 }}>{s.total.toLocaleString()} RON</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editare salariu baza */}
      <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, padding:'12px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: editSalar?10:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555' }}>⚙️ Salariu de bază</div>
          <button onClick={() => setEditSalar(p=>!p)}
            style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #ddd', background:'#fff', cursor:'pointer', color:'#555' }}>
            {editSalar ? 'Închide' : 'Modifică'}
          </button>
        </div>
        {editSalar && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {angajate.map(nume => (
              <div key={nume}>
                <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block' }}>{nume.split(' ')[0]}</label>
                <input type="number" value={salariuBaza[nume]||3000}
                  onChange={e => setSalariuBaza(p => ({...p, [nume]: Number(e.target.value)}))}
                  style={{ width:'100%', padding:'6px 8px', fontSize:13, border:'1.5px solid #ddd', borderRadius:7, outline:'none', fontWeight:600 }} />
              </div>
            ))}
            <div style={{ gridColumn:'1/-1', fontSize:11, color:'#aaa' }}>
              * Salariul de bază se salvează doar pentru sesiunea curentă. Poți seta un default permanent în cod.
            </div>
          </div>
        )}
      </div>

      {/* Nota neatribuite */}
      {neatribuite > 0 && (
        <div style={{ marginTop:12, background:'#FFF2CC', border:'1px solid #F0C040', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#7B5E00' }}>
          ⚠️ {neatribuite} curățenii nu au autor înregistrat (finalizate înainte de implementarea utilizatorilor individuali). Acestea se împart automat egal între cele 2 angajate.
        </div>
      )}
    </div>
  )
}
