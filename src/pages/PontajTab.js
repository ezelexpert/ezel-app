import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getNume } from '../lib/auth'

const ANGAJATE = ['Olar Svitlana', 'Farcas Adela Georgiana']
const LUNI_NUME = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

export default function PontajTab() {
  const [cereri, setCereri] = useState([])
  const [pontaj, setPontaj] = useState([])
  const [loading, setLoading] = useState(true)
  const [subtab, setSubtab] = useState('azi') // 'azi' | 'cereri' | 'lunar'
  const now = new Date()
  const [an, setAn] = useState(now.getFullYear())
  const [luna, setLuna] = useState(now.getMonth())
  const numeManager = getNume()

  useEffect(() => { load() }, [an, luna, subtab])

  async function load() {
    setLoading(true)
    try {
      const azi = now.toISOString().split('T')[0]
      const lunaStr = `${an}-${String(luna+1).padStart(2,'0')}`

      const [{ data: cer }, { data: pont }] = await Promise.all([
        supabase.from('pontaj_cereri').select('*').eq('status', 'asteptare').order('created_at', { ascending: false }),
        supabase.from('pontaj').select('*')
          .gte('data', subtab === 'azi' ? azi : `${lunaStr}-01`)
          .lte('data', subtab === 'azi' ? azi : `${lunaStr}-31`)
          .order('data', { ascending: false })
      ])
      setCereri(cer || [])
      setPontaj(pont || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function formatOra(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  }

  function formatData(str) {
    if (!str) return '—'
    const d = new Date(str)
    return `${d.getDate()} ${LUNI_NUME[d.getMonth()].substring(0,3)}`
  }

  async function aprobaCerere(cerere) {
    try {
      // Actualizeaza cererea
      await supabase.from('pontaj_cereri').update({
        status: 'aprobat', aprobat_de: numeManager
      }).eq('id', cerere.id)

      // Aplica in pontaj
      if (cerere.tip === 'intrare') {
        // Verifica daca exista deja pontaj pt ziua asta
        const { data: existing } = await supabase.from('pontaj')
          .select('id').eq('utilizator_id', cerere.utilizator_id).eq('data', cerere.data).single()
        if (existing) {
          await supabase.from('pontaj').update({ ora_intrare: cerere.ora_solicitata }).eq('id', existing.id)
        } else {
          await supabase.from('pontaj').insert({
            utilizator_id: cerere.utilizator_id, nume: cerere.nume,
            data: cerere.data, ora_intrare: cerere.ora_solicitata
          })
        }
      } else {
        // Clock out - actualizeaza pontajul existent
        const { data: existing } = await supabase.from('pontaj')
          .select('id').eq('utilizator_id', cerere.utilizator_id).eq('data', cerere.data).single()
        if (existing) {
          await supabase.from('pontaj').update({ ora_iesire: cerere.ora_solicitata }).eq('id', existing.id)
        }
      }
      load()
      alert(`✅ Aprobat! Pontajul ${cerere.tip === 'intrare' ? 'de intrare' : 'de ieșire'} pentru ${cerere.nume.split(' ')[0]} a fost actualizat.`)
    } catch(e) { console.error(e); alert('Eroare la aprobare.') }
  }

  async function respingeCerere(cerere) {
    if (!window.confirm(`Respingi cererea de ${cerere.tip} pentru ${cerere.nume.split(' ')[0]}?`)) return
    await supabase.from('pontaj_cereri').update({
      status: 'respins', aprobat_de: numeManager
    }).eq('id', cerere.id)
    load()
  }

  // Pontaj de azi
  const pontajAzi = pontaj.filter(p => p.data === now.toISOString().split('T')[0])

  // Calcul ore lucrate
  function calcOre(p) {
    if (!p.ora_intrare || !p.ora_iesire) return null
    const diff = (new Date(p.ora_iesire) - new Date(p.ora_intrare)) / 3600000
    // Scade pauza 12:00-12:30 daca e in interval
    const intrare = new Date(p.ora_intrare)
    const iesire = new Date(p.ora_iesire)
    const pauza12 = new Date(intrare); pauza12.setHours(12, 0, 0, 0)
    const pauza1230 = new Date(intrare); pauza1230.setHours(12, 30, 0, 0)
    let ore = diff
    if (intrare <= pauza12 && iesire >= pauza1230) ore -= 0.5
    return Math.round(ore * 10) / 10
  }

  return (
    <div>
      {/* Subtabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14, borderBottom:'1.5px solid #e0e0e0', paddingBottom:0 }}>
        {[['azi','👥 Azi'],['cereri',`📋 Cereri${cereri.length>0?` (${cereri.length})`:''}`],['lunar','📅 Lunar']].map(([k,l]) => (
          <div key={k} onClick={() => setSubtab(k)}
            style={{ padding:'9px 14px', fontSize:13, cursor:'pointer', fontWeight:500,
              color: subtab===k?'#1F3864':'#888',
              borderBottom: subtab===k?'2.5px solid #1F3864':'2.5px solid transparent' }}>
            {l}
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:30, color:'#aaa' }}>Se încarcă...</div> : (
        <>
          {/* AZI */}
          {subtab === 'azi' && (
            <div>
              <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
                {now.toLocaleDateString('ro-RO', { weekday:'long', day:'numeric', month:'long' })}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:10 }}>
                {ANGAJATE.map(a => {
                  const p = pontajAzi.find(p => p.nume === a)
                  const ore = p ? calcOre(p) : null
                  const ePresenta = p && p.ora_intrare && !p.ora_iesire
                  const aTerminat = p && p.ora_iesire
                  return (
                    <div key={a} style={{ background:'#fff', border:`1.5px solid ${ePresenta?'#C0DD97':aTerminat?'#90B8E8':'#e0e0e0'}`, borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                        <div style={{ width:40, height:40, borderRadius:10, background:ePresenta?'#375623':aTerminat?'#1F3864':'#f0f0f0', color:ePresenta||aTerminat?'#fff':'#aaa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>
                          {a.split(' ')[0][0]}{a.split(' ')[1]?.[0]||''}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#1F3864' }}>{a.split(' ')[0]}</div>
                          <div style={{ fontSize:11, color:'#888' }}>{a.split(' ').slice(1).join(' ')}</div>
                        </div>
                        <div style={{ marginLeft:'auto' }}>
                          {!p && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:10, background:'#f0f0f0', color:'#aaa' }}>⬜ Absent</span>}
                          {ePresenta && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:10, background:'#E2EFDA', color:'#375623', fontWeight:600 }}>🟢 Prezent</span>}
                          {aTerminat && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:10, background:'#EBF1FB', color:'#1F3864', fontWeight:600 }}>✅ Gata</span>}
                        </div>
                      </div>
                      {p && (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:12 }}>
                          <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 8px', textAlign:'center' }}>
                            <div style={{ fontWeight:600 }}>{formatOra(p.ora_intrare)}</div>
                            <div style={{ fontSize:10, color:'#888' }}>Intrare</div>
                          </div>
                          <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 8px', textAlign:'center' }}>
                            <div style={{ fontWeight:600 }}>{formatOra(p.ora_iesire)}</div>
                            <div style={{ fontSize:10, color:'#888' }}>Ieșire</div>
                          </div>
                          <div style={{ background:'#f8f9fa', borderRadius:7, padding:'6px 8px', textAlign:'center' }}>
                            <div style={{ fontWeight:600, color: ore >= 8 ? '#375623' : '#c0392b' }}>{ore ? `${ore}h` : '—'}</div>
                            <div style={{ fontSize:10, color:'#888' }}>Ore</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CERERI */}
          {subtab === 'cereri' && (
            <div>
              {cereri.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 20px', color:'#bbb' }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
                  <div>Nicio cerere de aprobare.</div>
                </div>
              ) : cereri.map(c => (
                <div key={c.id} style={{ background:'#fff', border:'1.5px solid #F0C040', borderLeft:'4px solid #F0C040', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1F3864' }}>{c.nume.split(' ')[0]}</div>
                      <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                        Cerere de <strong>{c.tip === 'intrare' ? 'Clock In' : 'Clock Out'}</strong> în afara programului
                      </div>
                    </div>
                    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:10, background:'#FFF2CC', color:'#7B5E00', fontWeight:600 }}>⏳ Așteaptă</span>
                  </div>
                  <div style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', marginBottom:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                    <div><span style={{ color:'#888' }}>Data: </span><strong>{formatData(c.data)}</strong></div>
                    <div><span style={{ color:'#888' }}>Ora: </span><strong>{formatOra(c.ora_solicitata)}</strong></div>
                    <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#888' }}>Motiv: </span><em>{c.motiv || '—'}</em></div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => aprobaCerere(c)}
                      style={{ flex:1, padding:'8px', borderRadius:8, border:'1.5px solid #C0DD97', background:'#E2EFDA', color:'#375623', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                      ✅ Aprobă
                    </button>
                    <button onClick={() => respingeCerere(c)}
                      style={{ flex:1, padding:'8px', borderRadius:8, border:'1.5px solid #F5A0A0', background:'#FDECEA', color:'#c0392b', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                      ❌ Respinge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LUNAR */}
          {subtab === 'lunar' && (
            <div>
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

              {ANGAJATE.map(a => {
                const pontajA = pontaj.filter(p => p.nume === a)
                const totalOre = pontajA.reduce((s, p) => s + (calcOre(p) || 0), 0)
                const zileLucrate = pontajA.filter(p => p.ora_intrare).length
                return (
                  <div key={a} style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:'14px', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'#375623', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>
                        {a.split(' ')[0][0]}{a.split(' ')[1]?.[0]||''}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700 }}>{a}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{LUNI_NUME[luna]} {an}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:16, fontWeight:700, color:'#1F3864' }}>{Math.round(totalOre * 10) / 10}h</div>
                        <div style={{ fontSize:10, color:'#888' }}>{zileLucrate} zile</div>
                      </div>
                    </div>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'#f8f9fa' }}>
                          <th style={{ padding:'5px 8px', textAlign:'left', color:'#666', fontWeight:600, borderBottom:'1px solid #eee' }}>Data</th>
                          <th style={{ padding:'5px 8px', textAlign:'center', color:'#666', fontWeight:600, borderBottom:'1px solid #eee' }}>Intrare</th>
                          <th style={{ padding:'5px 8px', textAlign:'center', color:'#666', fontWeight:600, borderBottom:'1px solid #eee' }}>Ieșire</th>
                          <th style={{ padding:'5px 8px', textAlign:'center', color:'#666', fontWeight:600, borderBottom:'1px solid #eee' }}>Ore</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pontajA.sort((x,y) => x.data > y.data ? -1 : 1).map(p => {
                          const ore = calcOre(p)
                          return (
                            <tr key={p.id}>
                              <td style={{ padding:'5px 8px', borderBottom:'1px solid #f5f5f5' }}>{formatData(p.data)}</td>
                              <td style={{ padding:'5px 8px', borderBottom:'1px solid #f5f5f5', textAlign:'center' }}>
                                <input type="time" defaultValue={p.ora_intrare ? new Date(p.ora_intrare).toTimeString().substring(0,5) : ''}
                                  onBlur={async e => {
                                    if (!e.target.value) return
                                    const [h, m] = e.target.value.split(':')
                                    const d = new Date(p.data + 'T12:00:00')
                                    d.setHours(parseInt(h), parseInt(m), 0, 0)
                                    await supabase.from('pontaj').update({ ora_intrare: d.toISOString() }).eq('id', p.id)
                                    load()
                                  }}
                                  style={{ border:'1px solid #ddd', borderRadius:6, padding:'2px 4px', fontSize:12, width:72 }} />
                              </td>
                              <td style={{ padding:'5px 8px', borderBottom:'1px solid #f5f5f5', textAlign:'center' }}>
                                <input type="time" defaultValue={p.ora_iesire ? new Date(p.ora_iesire).toTimeString().substring(0,5) : ''}
                                  onBlur={async e => {
                                    if (!e.target.value) return
                                    const [h, m] = e.target.value.split(':')
                                    const d = new Date(p.data + 'T12:00:00')
                                    d.setHours(parseInt(h), parseInt(m), 0, 0)
                                    await supabase.from('pontaj').update({ ora_iesire: d.toISOString() }).eq('id', p.id)
                                    load()
                                  }}
                                  style={{ border:'1px solid #ddd', borderRadius:6, padding:'2px 4px', fontSize:12, width:72 }} />
                              </td>
                              <td style={{ padding:'5px 8px', borderBottom:'1px solid #f5f5f5', textAlign:'center', fontWeight:600, color: ore && ore < 7.5 ? '#c0392b' : '#375623' }}>
                                {ore ? `${ore}h` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                        {pontajA.length === 0 && (
                          <tr><td colSpan={4} style={{ padding:16, textAlign:'center', color:'#aaa' }}>Nicio înregistrare</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
