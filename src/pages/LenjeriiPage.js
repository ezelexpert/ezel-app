import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout, getNume, getUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

const KG_PER_SET = 1.3

function getToday() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

export default function LenjeriiPage() {
  const navigate = useNavigate()
  const [comenzi, setComenzi] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const user = getUser()
  const nume = getNume()

  // Form state
  const [locatie, setLocatie] = useState('')
  const [dataLivrare, setDataLivrare] = useState(getToday())
  const [inputSeturi, setInputSeturi] = useState('')
  const [inputKg, setInputKg] = useState('')
  const [observatii, setObservatii] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('lenjerii_comenzi')
        .select('*')
        .order('data_livrare', { ascending: false })
        .limit(30)
      setComenzi(data || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function adaugaComanda() {
    if (!locatie.trim()) { alert('Introdu locația!'); return }
    if (!dataLivrare) { alert('Selectează data!'); return }
    if (!inputSeturi && !inputKg) { alert('Introdu seturi sau kg!'); return }

    const seturi = inputSeturi ? parseInt(inputSeturi) : Math.round(parseFloat(inputKg) / KG_PER_SET)
    const kg = inputKg ? parseFloat(inputKg) : Math.round(seturi * KG_PER_SET * 10) / 10

    setSaving(true)
    try {
      await supabase.from('lenjerii_comenzi').insert({
        utilizator_id: user?.id,
        nume: nume,
        locatie: locatie.trim(),
        data_livrare: dataLivrare,
        nr_seturi: seturi,
        total_kg: kg,
        status: 'asteptare',
        observatii: observatii.trim()
      })
      setLocatie(''); setInputSeturi(''); setInputKg(''); setObservatii('')
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      load()
    } catch(e) { alert('Eroare. Încearcă din nou.'); console.error(e) }
    setSaving(false)
  }

  async function marcheazaLivrat(id) {
    await supabase.from('lenjerii_comenzi').update({ status: 'livrat' }).eq('id', id)
    setComenzi(prev => prev.map(c => c.id === id ? {...c, status: 'livrat'} : c))
  }

  function formatData(str) {
    if (!str) return '—'
    const d = new Date(str)
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  }

  const azi = getToday()
  const comenziAzi = comenzi.filter(c => c.data_livrare === azi)
  const comenziViitoare = comenzi.filter(c => c.data_livrare > azi && c.status === 'asteptare')
  const comenziTrecute = comenzi.filter(c => c.data_livrare < azi || c.status === 'livrat')

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f8' }}>
      {/* Header */}
      <div style={{ background:'#4527A0', color:'#fff', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>🧺 Lenjerii EZEL</div>
          <div style={{ fontSize:11, opacity:.8 }}>{nume} · {new Date().toLocaleDateString('ro-RO', {weekday:'long', day:'numeric', month:'long'})}</div>
        </div>
        <button style={{ padding:'5px 12px', background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.35)', color:'#fff', borderRadius:7, cursor:'pointer', fontSize:12 }}
          onClick={() => { logout(); navigate('/', { replace: true }) }}>Ieși</button>
      </div>

      <div style={{ padding:14, maxWidth:500, margin:'0 auto' }}>

        {/* Form adaugare */}
        <div style={{ background:'#fff', borderRadius:12, padding:'16px', marginBottom:16, border:'1px solid #e8e8e8', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#4527A0', marginBottom:14 }}>➕ Adaugă lenjerii de adus</div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Locație *</label>
            <input value={locatie} onChange={e => setLocatie(e.target.value)}
              placeholder="ex: Bloc A, Strada X..."
              style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none' }} />
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Data livrare *</label>
            <input type="date" value={dataLivrare} onChange={e => setDataLivrare(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none' }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Nr. seturi</label>
              <input type="number" min="0" value={inputSeturi}
                onChange={e => { setInputSeturi(e.target.value); if(e.target.value) setInputKg(String(Math.round(parseInt(e.target.value)*KG_PER_SET*10)/10)) }}
                placeholder="ex: 10"
                style={{ width:'100%', padding:'8px 10px', fontSize:15, fontWeight:700, border:'1.5px solid #ddd', borderRadius:8, outline:'none', textAlign:'center' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Total kg</label>
              <input type="number" min="0" step="0.1" value={inputKg}
                onChange={e => { setInputKg(e.target.value); if(e.target.value) setInputSeturi(String(Math.round(parseFloat(e.target.value)/KG_PER_SET))) }}
                placeholder="ex: 13"
                style={{ width:'100%', padding:'8px 10px', fontSize:15, fontWeight:700, border:'1.5px solid #ddd', borderRadius:8, outline:'none', textAlign:'center' }} />
            </div>
          </div>

          {inputSeturi && inputKg && (
            <div style={{ background:'#EDE7F6', borderRadius:8, padding:'6px 10px', marginBottom:10, fontSize:12, color:'#4527A0', fontWeight:600 }}>
              {inputSeturi} seturi × {KG_PER_SET} kg = {inputKg} kg total
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Observații (opțional)</label>
            <input value={observatii} onChange={e => setObservatii(e.target.value)}
              placeholder="ex: Lenjerii duble, murdare..."
              style={{ width:'100%', padding:'8px 10px', fontSize:13, border:'1.5px solid #ddd', borderRadius:8, outline:'none' }} />
          </div>

          <button onClick={adaugaComanda} disabled={saving || !locatie || !dataLivrare || (!inputSeturi && !inputKg)}
            style={{ width:'100%', padding:'12px', background: saved?'#375623':(!locatie||!dataLivrare||(!inputSeturi&&!inputKg))?'#aaa':'#4527A0',
              color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {saving ? 'Se salvează...' : saved ? '✅ Salvat!' : '🧺 Adaugă comandă'}
          </button>
        </div>

        {/* Comenzi de azi */}
        {comenziAzi.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#4527A0', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ background:'#4527A0', color:'#fff', padding:'2px 8px', borderRadius:10, fontSize:11 }}>AZI</span>
              {comenziAzi.length} livrări
            </div>
            {comenziAzi.map(c => renderCard(c, true))}
          </div>
        )}

        {/* Comenzi viitoare */}
        {comenziViitoare.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1F3864', marginBottom:8 }}>📅 Viitoare ({comenziViitoare.length})</div>
            {comenziViitoare.map(c => renderCard(c, false))}
          </div>
        )}

        {/* Istoric */}
        {comenziTrecute.length > 0 && (
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8 }}>📋 Istoric</div>
            {comenziTrecute.slice(0,10).map(c => renderCard(c, false))}
          </div>
        )}

        {loading && <div style={{ textAlign:'center', padding:30, color:'#aaa' }}>Se încarcă...</div>}
        {!loading && comenzi.length === 0 && (
          <div style={{ textAlign:'center', padding:'50px 20px', color:'#bbb' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🧺</div>
            <div>Nicio comandă încă. Adaugă prima livrare!</div>
          </div>
        )}
      </div>
    </div>
  )

  function renderCard(c, isToday) {
    return (
      <div key={c.id} style={{ background:'#fff', borderRadius:10, border:`1.5px solid ${isToday?'#C5B3F0':c.status==='livrat'?'#C0DD97':'#e8e8e8'}`,
        borderLeft:`4px solid ${isToday?'#4527A0':c.status==='livrat'?'#375623':'#90B8E8'}`, padding:'12px 14px', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1F3864' }}>📍 {c.locatie}</div>
            <div style={{ fontSize:11, color:'#888', marginTop:2 }}>📅 {formatData(c.data_livrare)}</div>
          </div>
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:10, fontWeight:600,
            background: c.status==='livrat'?'#E2EFDA':'#EDE7F6',
            color: c.status==='livrat'?'#375623':'#4527A0' }}>
            {c.status==='livrat'?'✅ Livrat':'⏳ Așteaptă'}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 10px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#4527A0' }}>{c.nr_seturi}</div>
            <div style={{ fontSize:10, color:'#888' }}>seturi</div>
          </div>
          <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 10px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#4527A0' }}>{c.total_kg} kg</div>
            <div style={{ fontSize:10, color:'#888' }}>total</div>
          </div>
        </div>
        {c.observatii && <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>💬 {c.observatii}</div>}
        {c.status === 'asteptare' && (
          <button onClick={() => marcheazaLivrat(c.id)}
            style={{ width:'100%', padding:'8px', background:'#375623', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            ✅ Marchez ca livrat
          </button>
        )}
      </div>
    )
  }
}
