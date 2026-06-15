import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUser, getNume, logout } from '../lib/auth'

const BLUE = '#075985'

function fmt(s) { try { return new Date(s + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) } catch (e) { return s || '—' } }
function lei(n) { return (Number(n) || 0).toLocaleString('ro-RO') }

const ST = {
  rezervata: { bg: '#FEF3C7', tx: '#92400E', label: 'Viitoare' },
  activa:    { bg: '#DCFCE7', tx: '#166534', label: 'Activă' },
  elib:      { bg: '#FEE2E2', tx: '#B91C1C', label: 'Eliberare' },
}

// Portal CLIENT (firmă) — v1: roster live al cazaților + sold/facturi.
// Datele se filtrează după firma legată de utilizator.
export default function ClientPortal() {
  const navigate = useNavigate()
  const user = getUser()
  const nume = getNume()
  const [firma, setFirma] = useState(null)
  const [rez, setRez] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('roster')

  useEffect(() => {
    if (!user) { navigate('/', { replace: true }); return }
    let activ = true
    ;(async () => {
      const { data: u } = await supabase.from('utilizatori_public').select('firma').eq('id', user.id).single()
      const f = (u && u.firma) ? u.firma : ''
      if (!activ) return
      setFirma(f)
      if (f) {
        const { data } = await supabase.from('rezervari').select('*')
          .eq('firma', f).neq('status', 'anulata')
          .order('data_checkin', { ascending: false })
        if (activ) setRez(data || [])
      }
      if (activ) setLoading(false)
    })()
    return () => { activ = false }
  }, [user, navigate])

  function iesi() { logout(); navigate('/', { replace: true }) }

  const azi = new Date().toISOString().split('T')[0]
  const active = rez.filter(r => r.data_checkout > azi && r.status !== 'anulata')
  const totalFacturat = rez.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const dePlata = rez.filter(r => (r.status_plata || 'neplatit') !== 'platit').reduce((s, r) => s + (Number(r.total) || 0), 0)
  const achitat = totalFacturat - dePlata
  const nrCazati = active.reduce((s, r) => s + (Number(r.nr_locuri) || 0), 0)

  const wrap = { minHeight: '100vh', background: '#F1F5F9', fontFamily: 'system-ui, sans-serif' }
  if (loading) return <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}>Se încarcă...</div>

  return (
    <div style={wrap}>
      <div style={{ background: BLUE, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🏢 {firma || 'Client'}</div>
          <div style={{ fontSize: 12, opacity: .85 }}>Bun venit, {nume}</div>
        </div>
        <button onClick={iesi} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.15)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Ieși</button>
      </div>

      {!firma ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
          Contul tău nu e încă legat de o firmă. Contactează administratorul.
        </div>
      ) : (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
          {/* Sumar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: 14 }}>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Cazați acum</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>{nrCazati}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{active.length} apartamente</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: 14 }}>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>De plată</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#B91C1C' }}>{lei(dePlata)} <span style={{ fontSize: 12 }}>RON</span></div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: 14 }}>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Achitat</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#166534' }}>{lei(achitat)} <span style={{ fontSize: 12 }}>RON</span></div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['roster', '🛏 Cazați'], ['facturi', '💰 Facturi']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: tab === k ? BLUE : '#fff', color: tab === k ? '#fff' : '#475569', borderBottom: tab === k ? 'none' : '1px solid #E9EDF4' }}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'roster' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {active.length === 0 && <div style={{ color: '#94A3B8', fontSize: 14, padding: 10 }}>Niciun cazat activ momentan.</div>}
              {active.map(r => {
                const st = ST[r.status] || { bg: '#E0F2FE', tx: BLUE, label: r.status || '—' }
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 10, background: '#E0F2FE', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>AP {r.nr_apt}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F2344' }}>{fmt(r.data_checkin)} → {fmt(r.data_checkout)}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{r.nr_locuri || '—'} locuri{r.tip_serviciu === 'chirie' ? ' · chirie' : ''}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: st.bg, color: st.tx, fontWeight: 600 }}>{st.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'facturi' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {rez.length === 0 && <div style={{ color: '#94A3B8', fontSize: 14, padding: 10 }}>Nicio factură.</div>}
              {rez.map(r => {
                const platit = (r.status_plata || 'neplatit') === 'platit'
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F2344' }}>AP {r.nr_apt} · {fmt(r.data_checkin)} → {fmt(r.data_checkout)}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>{r.nr_nopti || '?'} nopți</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F2344' }}>{lei(r.total)} RON</div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: platit ? '#166534' : '#B91C1C' }}>{platit ? 'achitat' : 'de plată'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 20 }}>
            Ai o cerere nouă? Momentan contactează-ne direct — formularul de cerere online vine în curând.
          </div>
        </div>
      )}
    </div>
  )
}
