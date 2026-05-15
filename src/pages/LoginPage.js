import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getSession } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState('admin')
  const [parola, setParola] = useState('')
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (s) navigate(s.role === 'admin' ? '/admin' : '/curatenie', { replace: true })
  }, [])

  function handleLogin() {
    setLoading(true)
    setErr(false)
    if (login(parola, role)) {
      navigate(role === 'admin' ? '/admin' : '/curatenie', { replace: true })
    } else {
      setErr(true)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 360, boxShadow: '0 2px 24px rgba(0,0,0,.10)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 42, height: 42, background: '#1F3864', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 }}>E</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#1F3864' }}>EZEL</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Gestiune Apartamente</div>
          </div>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: 20 }}>
          {[
            { id: 'admin', icon: '🏢', name: 'Manager / Admin', desc: 'Apartamente, firme, calendar' },
            { id: 'curatenie', icon: '🧹', name: 'Curățenie', desc: 'Vizualizare sarcini curățenie' }
          ].map(r => (
            <div key={r.id} onClick={() => { setRole(r.id); setErr(false) }}
              style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${role === r.id ? '#1F3864' : '#e0e0e0'}`, background: role === r.id ? '#EBF1FB' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, transition: 'all .15s' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: role === r.id ? '#c8d9f0' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{r.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1F3864' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <label className="fl">Parolă</label>
        <input className="fi" type="password" placeholder="Introdu parola..." value={parola}
          onChange={e => { setParola(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ marginBottom: 4 }} />
        {err && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 4 }}>Parolă incorectă. Încearcă din nou.</div>}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 11, background: '#1F3864', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, marginTop: 12, cursor: 'pointer' }}>
          {loading ? 'Se verifică...' : 'Intră →'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 16 }}>
          Sesiunea e valabilă până la miezul nopții
        </div>
      </div>
    </div>
  )
}
