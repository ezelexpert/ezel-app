import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LUNI_NUME = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const LEI_PER_APT = 10
const ANGAJATE = ['Olar Svitlana', 'Farcas Adela Georgiana']

export default function SalariiTab() {
  const [curatenii, setCuratenii] = useState([])
  const [pontaj, setPontaj] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [an, setAn] = useState(now.getFullYear())
  const [luna, setLuna] = useState(now.getMonth())
  const [salariuBaza, setSalariuBaza] = useState({ 'Olar Svitlana': 3000, 'Farcas Adela Georgiana': 3000 })
  const [editSalar, setEditSalar] = useState(false)
  const [costExtra, setCostExtra] = useState({ utilitati: 0, consumabile: 0 })
  const [editCost, setEditCost] = useState(false)

  useEffect(() => { load() }, [an, luna])

  async function load() {
    setLoading(true)
    try {
      const lunaStr = `${an}-${String(luna+1).padStart(2,'0')}`
      const [{ data: cur }, { data: pont }] = await Promise.all([
        supabase.from('curatenie').select('*')
          .eq('status_curatenie', 'finalizata')
          .gte('data_programata', `${lunaStr}-01`)
          .lte('data_programata', `${lunaStr}-31`)
          .or('deja_curat.is.null,deja_curat.eq.false'),
        supabase.from('pontaj').select('*')
          .gte('data', `${lunaStr}-01`)
          .lte('data', `${lunaStr}-31`)
      ])
      setCuratenii(cur || [])
      setPontaj(pont || [])
      try {
        const { data: cfg } = await supabase.from('setari').select('valoare').eq('id', `cost_op:${lunaStr}`).single()
        if (cfg && cfg.valoare) setCostExtra({ utilitati: Number(cfg.valoare.utilitati)||0, consumabile: Number(cfg.valoare.consumabile)||0 })
        else setCostExtra({ utilitati: 0, consumabile: 0 })
      } catch { setCostExtra({ utilitati: 0, consumabile: 0 }) }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  // Grupeaza curateniile pe zile
  const zileUnice = [...new Set(curatenii.map(c => c.data_programata))].sort()

  // Calcul bonus per angajata per zi
  // Regula: daca ambele prezente -> impart egal; daca doar una -> ia tot
  const bonusPerAngajata = { 'Olar Svitlana': 0, 'Farcas Adela Georgiana': 0 }
  const zileLucrate = { 'Olar Svitlana': new Set(), 'Farcas Adela Georgiana': new Set() }
  const curateniiPerAngajata = { 'Olar Svitlana': 0, 'Farcas Adela Georgiana': 0 }

  zileUnice.forEach(data => {
    // Curateniile din ziua asta
    const curAzi = curatenii.filter(c => c.data_programata === data)
    const totalBonus = curAzi.length * LEI_PER_APT

    // Cine a fost prezenta in ziua asta
    const prezente = ANGAJATE.filter(a =>
      pontaj.some(p => p.data === data && p.nume === a && p.ora_intrare)
    )

    if (prezente.length === 0) {
      // Nimeni pontata - impartim egal (curatenii facute fara pontaj)
      ANGAJATE.forEach(a => {
        bonusPerAngajata[a] += totalBonus / 2
      })
    } else if (prezente.length === 1) {
      // Doar una prezenta - ia tot bonusul
      bonusPerAngajata[prezente[0]] += totalBonus
      zileLucrate[prezente[0]].add(data)
    } else {
      // Ambele prezente - impart egal
      prezente.forEach(a => {
        bonusPerAngajata[a] += totalBonus / 2
        zileLucrate[a].add(data)
      })
    }

    // Numara curateniile atribuite individual
    curAzi.forEach(c => {
      if (c.facut_de && ANGAJATE.includes(c.facut_de)) {
        curateniiPerAngajata[c.facut_de]++
      }
    })
  })

  // Zile lucrate din pontaj
  ANGAJATE.forEach(a => {
    const zilePontaj = pontaj.filter(p => p.nume === a && p.ora_intrare)
    zilePontaj.forEach(p => zileLucrate[a].add(p.data))
  })

  const stats = ANGAJATE.map(nume => ({
    nume,
    curatenii: curateniiPerAngajata[nume],
    zileLucrate: zileLucrate[nume].size,
    bonus: Math.round(bonusPerAngajata[nume]),
    baza: salariuBaza[nume] || 3000,
    total: Math.round((salariuBaza[nume] || 3000) + bonusPerAngajata[nume])
  }))

  const totalCuratenii = curatenii.length
  const totalBonus = stats.reduce((s, a) => s + a.bonus, 0)
  const totalSalariiBrute = stats.reduce((s, a) => s + a.baza, 0)
  const costTotalLuna = totalSalariiBrute + totalBonus + Number(costExtra.utilitati||0) + Number(costExtra.consumabile||0)
  const costPerCuratenie = totalCuratenii > 0 ? costTotalLuna / totalCuratenii : 0

  // Pontaj detaliat pe zile
  const pontajAzi = pontaj.filter(p => {
    const azi = new Date().toISOString().split('T')[0]
    return p.data === azi
  })

  function formatOra(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  }

  async function saveCostExtra() {
    const lunaStr = `${an}-${String(luna+1).padStart(2,'0')}`
    try {
      await supabase.from('setari').upsert({ id: `cost_op:${lunaStr}`, valoare: costExtra, updated_at: new Date().toISOString() })
    } catch(e) { console.error(e) }
    setEditCost(false)
  }

  return (
    <div>
      {/* Prezenta azi */}
      <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:8 }}>👥 Prezență azi</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {ANGAJATE.map(a => {
            const p = pontajAzi.find(p => p.nume === a)
            const ePresenta = p && p.ora_intrare && !p.ora_iesire
            const aTerminat = p && p.ora_iesire
            return (
              <div key={a} style={{ flex:1, minWidth:150, padding:'10px 12px', borderRadius:9, border:`1.5px solid ${ePresenta?'#C0DD97':aTerminat?'#90B8E8':'#e0e0e0'}`, background:ePresenta?'#E2EFDA':aTerminat?'#EBF1FB':'#f8f9fa' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#1F3864', marginBottom:4 }}>{a.split(' ')[0]}</div>
                {!p && <div style={{ fontSize:11, color:'#aaa' }}>⬜ Neprezentă</div>}
                {p && p.ora_intrare && !p.ora_iesire && <div style={{ fontSize:11, color:'#375623' }}>🟢 Prezentă de la {formatOra(p.ora_intrare)}</div>}
                {p && p.ora_iesire && <div style={{ fontSize:11, color:'#1F3864' }}>✅ {formatOra(p.ora_intrare)} — {formatOra(p.ora_iesire)}</div>}
              </div>
            )
          })}
        </div>
      </div>

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
          <div style={{ fontSize:11, color:'#375623' }}>Fond bonus total</div>
        </div>
        <div style={{ background:'#EDE7F6', borderRadius:10, padding:'10px 12px', border:'1px solid #C5B3F0', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#4527A0' }}>{zileUnice.length}</div>
          <div style={{ fontSize:11, color:'#4527A0' }}>Zile cu curățenie</div>
        </div>
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
                  <div style={{ fontSize:11, color:'#888' }}>🧹 {LUNI_NUME[luna]} {an} · {s.zileLucrate} zile lucrate</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#375623' }}>{s.curatenii}</div>
                  <div style={{ fontSize:10, color:'#888' }}>curățenii proprii</div>
                </div>
                <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#7B5E00' }}>{s.bonus} RON</div>
                  <div style={{ fontSize:10, color:'#888' }}>bonus calculat</div>
                </div>
              </div>

              <div style={{ fontSize:11, color:'#888', background:'#f8f9fa', borderRadius:8, padding:'8px 10px', marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span>Salariu bază</span><span style={{ fontWeight:600 }}>{s.baza.toLocaleString()} RON</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span>Bonus ({LEI_PER_APT} RON/apt × prezență)</span>
                  <span style={{ fontWeight:600, color:'#375623' }}>+{s.bonus} RON</span>
                </div>
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

      {/* Cost per curatenie */}
      <div style={{ background:'#fff', border:'1.5px solid #1F3864', borderRadius:10, padding:'14px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1F3864' }}>🧮 Cost per curățenie — {LUNI_NUME[luna]} {an}</div>
          <button onClick={() => editCost ? saveCostExtra() : setEditCost(true)}
            style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #ddd', background: editCost?'#1F3864':'#fff', color: editCost?'#fff':'#555', cursor:'pointer' }}>
            {editCost ? '💾 Salvează' : 'Modifică'}
          </button>
        </div>

        {editCost && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block' }}>Utilități spălătorie (RON)</label>
              <input type="number" value={costExtra.utilitati}
                onChange={e => setCostExtra(p => ({...p, utilitati: Number(e.target.value)}))}
                style={{ width:'100%', padding:'6px 8px', fontSize:13, border:'1.5px solid #ddd', borderRadius:7, outline:'none', fontWeight:600 }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block' }}>Consumabile (RON)</label>
              <input type="number" value={costExtra.consumabile}
                onChange={e => setCostExtra(p => ({...p, consumabile: Number(e.target.value)}))}
                style={{ width:'100%', padding:'6px 8px', fontSize:13, border:'1.5px solid #ddd', borderRadius:7, outline:'none', fontWeight:600 }} />
            </div>
          </div>
        )}

        <div style={{ fontSize:12, color:'#555', background:'#f8f9fa', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>Salarii brute</span><span style={{ fontWeight:600 }}>{totalSalariiBrute.toLocaleString()} RON</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>Bonusuri</span><span style={{ fontWeight:600 }}>{totalBonus.toLocaleString()} RON</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>Utilități spălătorie</span><span style={{ fontWeight:600 }}>{Number(costExtra.utilitati||0).toLocaleString()} RON</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>Consumabile</span><span style={{ fontWeight:600 }}>{Number(costExtra.consumabile||0).toLocaleString()} RON</span></div>
          <div style={{ height:1, background:'#e0e0e0', margin:'6px 0' }}></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontWeight:700 }}>Total cheltuieli</span><span style={{ fontWeight:700, color:'#1F3864' }}>{costTotalLuna.toLocaleString()} RON</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, color:'#888', fontSize:11 }}><span>împărțit la {totalCuratenii} curățenii din lună</span><span></span></div>
        </div>

        <div style={{ background:'#1F3864', color:'#fff', borderRadius:8, padding:'12px', textAlign:'center' }}>
          <div style={{ fontSize:11, opacity:.7, marginBottom:2 }}>Cost mediu per curățenie</div>
          <div style={{ fontSize:26, fontWeight:700 }}>{costPerCuratenie.toFixed(2)} RON</div>
        </div>
      </div>

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
            {ANGAJATE.map(nume => (
              <div key={nume}>
                <label style={{ fontSize:11, color:'#666', marginBottom:4, display:'block' }}>{nume.split(' ')[0]}</label>
                <input type="number" value={salariuBaza[nume]||3000}
                  onChange={e => setSalariuBaza(p => ({...p, [nume]: Number(e.target.value)}))}
                  style={{ width:'100%', padding:'6px 8px', fontSize:13, border:'1.5px solid #ddd', borderRadius:7, outline:'none', fontWeight:600 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nota logica bonus */}
      <div style={{ marginTop:10, background:'#EBF1FB', border:'1px solid #90B8E8', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#1F3864' }}>
        💡 <strong>Logica bonus:</strong> Dacă ambele sunt prezente → bonusul zilei se împarte egal. Dacă doar una e prezentă → ia tot bonusul zilei respective. Prezența se determină din pontajul Clock In/Out.
      </div>
    </div>
  )
}
