import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUser, getNume, logout } from '../lib/auth'

const NAVY = '#1F3864'

function getToday() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function ora(s) {
  try { return new Date(s).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) } catch (e) { return '' }
}

// Aplicația HANDYMAN — mentenanță, tuns iarba etc.
// Clock-in/out FLEXIBIL (ora nu contează, fără aprobare).
// NU vede nimic de lucru până nu dă Clock In.
export default function HandymanPage() {
  const navigate = useNavigate()
  const user = getUser()
  const nume = getNume()
  const [pontajAzi, setPontajAzi] = useState(null)
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [clockLoading, setClockLoading] = useState(false)
  const [descNoua, setDescNoua] = useState('')
  const [aptNou, setAptNou] = useState('')

  const loadPontaj = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase.from('pontaj').select('*')
        .eq('utilizator_id', user.id).eq('data', getToday()).single()
      setPontajAzi(data || null)
    } catch (e) { setPontajAzi(null) }
  }, [user])

  const loadLucrari = useCallback(async () => {
    const { data } = await supabase.from('mentenanta').select('*')
      .neq('status', 'rezolvat').order('created_at', { ascending: false })
    setLucrari(data || [])
  }, [])

  useEffect(() => {
    if (!user) { navigate('/', { replace: true }); return }
    Promise.all([loadPontaj(), loadLucrari()]).finally(() => setLoading(false))
  }, [user, navigate, loadPontaj, loadLucrari])

  async function clockIn() {
    if (!user) return
    setClockLoading(true)
    try {
      const { data } = await supabase.from('pontaj').insert({
        utilizator_id: user.id, nume, data: getToday(), ora_intrare: new Date().toISOString()
      }).select().single()
      setPontajAzi(data)
      await loadLucrari()
    } catch (e) { console.error(e) }
    setClockLoading(false)
  }

  async function clockOut() {
    if (!pontajAzi) return
    setClockLoading(true)
    try {
      const { data } = await supabase.from('pontaj').update({ ora_iesire: new Date().toISOString() })
        .eq('id', pontajAzi.id).select().single()
      setPontajAzi(data)
    } catch (e) { console.error(e) }
    setClockLoading(false)
  }

  async function marcheaza(item, status) {
    let descriere = item.descriere
    if (status === 'rezolvat') {
      const note = window.prompt('Ce ai făcut? (opțional)')
      if (note === null) return
      if (note.trim()) descriere = `${item.descriere || ''}\n\n✅ Făcut de ${nume}: ${note.trim()}`
    }
    await supabase.from('mentenanta').update({ status, descriere }).eq('id', item.id)
    await loadLucrari()
  }

  async function adaugaLucrare() {
    if (!descNoua.trim()) return
    setClockLoading(true)
    try {
      await supabase.from('mentenanta').insert({
        nr_apt: aptNou.trim() || '-', firma: '',
        descriere: `${descNoua.trim()}\n\n✅ Făcut de ${nume}`,
        status: 'rezolvat', sursa: 'handyman'
      })
      setDescNoua(''); setAptNou('')
      await loadLucrari()
      alert('Lucrare salvată în raport.')
    } catch (e) { console.error(e) }
    setClockLoading(false)
  }

  function iesi() { logout(); navigate('/', { replace: true }) }

  const wrap = { minHeight: '100vh', background: '#F1F5F9', fontFamily: 'system-ui, sans-serif' }

  if (loading) return <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: NAVY }}>Se încarcă...</div></div>

  const clockedIn = pontajAzi && pontajAzi.ora_intrare
  const clockedOut = pontajAzi && pontajAzi.ora_iesire

  // ── Poarta de Clock In: fără pontaj, NU vede nimic ──
  if (!clockedIn) {
    return (
      <div style={{ ...wrap, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ fontWeight: 800, color: NAVY, fontSize: 26 }}>EZEL</div>
        <div style={{ fontSize: 15, color: '#64748B', margin: '6px 0 28px' }}>Salut, {nume}! 👋</div>
        <div style={{ fontSize: 16, color: '#475569', marginBottom: 18, textAlign: 'center', maxWidth: 320 }}>
          Pontează-te ca să vezi lucrările de azi.
        </div>
        <button onClick={clockIn} disabled={clockLoading}
          style={{ padding: '18px 44px', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#1A7A4A', color: '#fff', fontWeight: 800, fontSize: 20 }}>
          {clockLoading ? '...' : '🟢 Clock In'}
        </button>
        <button onClick={iesi} style={{ marginTop: 26, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>Ieși din cont</button>
      </div>
    )
  }

  // ── Ziua încheiată ──
  if (clockedOut) {
    return (
      <div style={{ ...wrap, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>✅</div>
        <div style={{ fontWeight: 800, color: NAVY, fontSize: 22, margin: '8px 0' }}>Ziua încheiată</div>
        <div style={{ color: '#475569', fontSize: 15 }}>
          Clock In: {ora(pontajAzi.ora_intrare)} · Clock Out: {ora(pontajAzi.ora_iesire)}
        </div>
        <button onClick={iesi} style={{ marginTop: 26, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>Ieși din cont</button>
      </div>
    )
  }

  // ── Pontat: vede lucrările + fișa de raportare ──
  return (
    <div style={wrap}>
      <div style={{ background: NAVY, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🔧 {nume}</div>
          <div style={{ fontSize: 12, opacity: .85 }}>Pontat de la {ora(pontajAzi.ora_intrare)}</div>
        </div>
        <button onClick={clockOut} disabled={clockLoading}
          style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#c0392b', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {clockLoading ? '...' : '🔴 Clock Out'}
        </button>
      </div>

      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        {/* Lucrări de rezolvat */}
        <div style={{ fontWeight: 700, color: NAVY, fontSize: 16, marginBottom: 10 }}>Lucrări de rezolvat ({lucrari.length})</div>
        {lucrari.length === 0 && <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 16 }}>Nicio lucrare deschisă. 🎉</div>}
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {lucrari.map(l => (
            <div key={l.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>📍 {l.nr_apt || '-'}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: l.status === 'in_lucru' ? '#FEF3C7' : '#FDECEA', color: l.status === 'in_lucru' ? '#92400E' : '#c0392b' }}>
                  {l.status === 'in_lucru' ? 'în lucru' : 'nou'}
                </span>
                {l.sursa === 'client' && <span style={{ fontSize: 10, color: '#94A3B8' }}>raportat de client</span>}
              </div>
              <div style={{ fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{l.descriere}</div>
              {l.foto_url && <a href={l.foto_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: NAVY }}>📷 Vezi poza</a>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {l.status !== 'in_lucru' && (
                  <button onClick={() => marcheaza(l, 'in_lucru')}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: '1px solid #F0C040', background: '#FFF7E0', color: '#92400E', fontWeight: 600, cursor: 'pointer' }}>
                    În lucru
                  </button>
                )}
                <button onClick={() => marcheaza(l, 'rezolvat')}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: '#1A7A4A', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  ✅ Rezolvat
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Fișă de raportare — adaugă o lucrare făcută (ex: tuns iarba) */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E9EDF4', padding: 14 }}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: 15, marginBottom: 4 }}>📝 Adaugă o lucrare făcută</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Ex: tuns iarba, reparat poartă — intră în raport.</div>
          <input value={aptNou} onChange={e => setAptNou(e.target.value)} placeholder="Locație / apartament (opțional)"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid #CBD5E1', padding: '9px 11px', fontSize: 14, marginBottom: 8 }} />
          <textarea value={descNoua} onChange={e => setDescNoua(e.target.value)} placeholder="Ce ai făcut?" rows={3}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid #CBD5E1', padding: '9px 11px', fontSize: 14, resize: 'vertical' }} />
          <button onClick={adaugaLucrare} disabled={clockLoading || !descNoua.trim()}
            style={{ width: '100%', marginTop: 10, padding: '11px 0', borderRadius: 9, border: 'none', background: NAVY, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Salvează în raport
          </button>
        </div>

        <button onClick={iesi} style={{ display: 'block', margin: '22px auto 30px', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>Ieși din cont</button>
      </div>
    </div>
  )
}
