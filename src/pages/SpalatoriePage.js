import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LUNI = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']
const KG_PER_SET = 1.3

export default function SpalatoriePage() {
  const [date, setDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('saptamana') // 'saptamana' | 'luna' | 'toate'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('spalatorie')
        .select('*')
        .order('data', { ascending: false })
      setDate(data || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  // Filtrare
  const now = new Date()
  const filtered = date.filter(r => {
    const d = new Date(r.data)
    if (view === 'saptamana') {
      const diff = (now - d) / 86400000
      return diff <= 7
    }
    if (view === 'luna') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    return true
  })

  const totalSeturi = filtered.reduce((s,r) => s + (r.total_seturi||0), 0)
  const totalKg = Math.round(filtered.reduce((s,r) => s + (r.total_kg||0), 0) * 10) / 10
  const zileGata = filtered.filter(r => r.toate_gata).length
  const zileFaraBifare = filtered.filter(r => !r.toate_gata).length

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#aaa' }}>Se încarcă...</div>

  return (
    <div>
      {/* View selector */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['saptamana','Ultima săptămână'],['luna','Luna curentă'],['toate','Toate']].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #ddd', fontSize:12, fontWeight:500, cursor:'pointer', background:view===v?'#1F3864':'#fff', color:view===v?'#fff':'#555' }}>
            {l}
          </button>
        ))}
        <button onClick={load} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', fontSize:12, cursor:'pointer', background:'#fff', marginLeft:'auto' }}>↻</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:8, marginBottom:14 }}>
        <div style={{ background:'#EBF1FB', borderRadius:10, padding:'10px 12px', border:'1px solid #90B8E8', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#1F3864' }}>{totalSeturi}</div>
          <div style={{ fontSize:11, color:'#1F3864' }}>seturi spălate</div>
        </div>
        <div style={{ background:'#EDE7F6', borderRadius:10, padding:'10px 12px', border:'1px solid #C5B3F0', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#4527A0' }}>{totalKg} kg</div>
          <div style={{ fontSize:11, color:'#4527A0' }}>total kg</div>
        </div>
        <div style={{ background:'#E2EFDA', borderRadius:10, padding:'10px 12px', border:'1px solid #C0DD97', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#375623' }}>{zileGata}</div>
          <div style={{ fontSize:11, color:'#375623' }}>zile ✅ gata</div>
        </div>
        {zileFaraBifare > 0 && (
          <div style={{ background:'#FDECEA', borderRadius:10, padding:'10px 12px', border:'1px solid #F5A0A0', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#c0392b' }}>{zileFaraBifare}</div>
            <div style={{ fontSize:11, color:'#c0392b' }}>zile nefinalizate</div>
          </div>
        )}
      </div>

      {/* Tabel */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🧺</div>
          <div>Nicio înregistrare pentru perioada selectată.</div>
          <div style={{ fontSize:12, marginTop:8 }}>Angajatele completează spălătoria din aplicația lor.</div>
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#fafafa' }}>
              <th style={{ textAlign:'left', padding:'7px 8px', color:'#666', fontWeight:600, borderBottom:'1.5px solid #eee' }}>Data</th>
              <th style={{ textAlign:'center', padding:'7px 8px', color:'#666', fontWeight:600, borderBottom:'1.5px solid #eee' }}>Seturi</th>
              <th style={{ textAlign:'center', padding:'7px 8px', color:'#666', fontWeight:600, borderBottom:'1.5px solid #eee' }}>Kg</th>
              <th style={{ textAlign:'center', padding:'7px 8px', color:'#666', fontWeight:600, borderBottom:'1.5px solid #eee' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const d = new Date(r.data)
              const isToday = r.data === new Date().toISOString().split('T')[0]
              return (
                <tr key={r.id} style={{ background: isToday ? '#EBF1FB' : 'transparent' }}>
                  <td style={{ padding:'7px 8px', borderBottom:'1px solid #f0f0f0', fontWeight: isToday ? 700 : 400 }}>
                    {isToday ? '🔵 Azi' : `${d.getDate()} ${LUNI[d.getMonth()]}`}
                  </td>
                  <td style={{ padding:'7px 8px', borderBottom:'1px solid #f0f0f0', textAlign:'center', fontWeight:600 }}>
                    {r.total_seturi || 0}
                  </td>
                  <td style={{ padding:'7px 8px', borderBottom:'1px solid #f0f0f0', textAlign:'center', fontWeight:600 }}>
                    {r.total_kg || 0} kg
                  </td>
                  <td style={{ padding:'7px 8px', borderBottom:'1px solid #f0f0f0', textAlign:'center' }}>
                    {r.toate_gata
                      ? <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#E2EFDA', color:'#375623', fontWeight:600 }}>✅ Gata</span>
                      : <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#FDECEA', color:'#c0392b', fontWeight:600 }}>⏳ Neconfirmat</span>
                    }
                  </td>
                </tr>
              )
            })}
            <tr style={{ background:'#f0f4f8', fontWeight:700 }}>
              <td style={{ padding:'8px', fontSize:12 }}>TOTAL</td>
              <td style={{ padding:'8px', textAlign:'center' }}>{totalSeturi}</td>
              <td style={{ padding:'8px', textAlign:'center' }}>{totalKg} kg</td>
              <td style={{ padding:'8px', textAlign:'center', fontSize:11, color:'#375623' }}>{zileGata}/{filtered.length} zile ✅</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
