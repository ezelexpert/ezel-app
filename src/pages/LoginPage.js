import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginCuParola, saveUser, isLoggedIn, getRole } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [parola, setParola] = useState('')
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(false)
  const [utilizatoriGasiti, setUtilizatoriGasiti] = useState(null) // lista daca parola e shared

  useEffect(() => {
    if (isLoggedIn()) {
      const rol = getRole()
      navigate(rol === 'admin' ? '/admin' : '/curatenie', { replace: true })
    }
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    if (!parola.trim()) return
    setLoading(true)
    setEroare('')
    setUtilizatoriGasiti(null)

    const rezultat = await loginCuParola(parola.trim())

    if (!rezultat || rezultat.length === 0) {
      setEroare('Parolă incorectă. Încearcă din nou.')
      setLoading(false)
      return
    }

    if (rezultat.length === 1) {
      // Un singur utilizator cu aceasta parola
      saveUser(rezultat[0])
      navigate(rezultat[0].rol === 'admin' ? '/admin' : '/curatenie', { replace: true })
    } else {
      // Mai multi utilizatori cu aceeasi parola (ex: George si Adela au 1998)
      // Afiseaza selector
      setUtilizatoriGasiti(rezultat)
    }

    setLoading(false)
  }

  function selecteazaUtilizator(user) {
    saveUser(user)
    navigate(user.rol === 'admin' ? '/admin' : '/curatenie', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1F3864 0%, #2F5496 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#1F3864', letterSpacing: -1 }}>EZEL</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Sistem de management apartamente</div>
        </div>

        {!utilizatoriGasiti ? (
          // Form parola
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                Parolă
              </label>
              <input
                type="password"
                value={parola}
                onChange={e => { setParola(e.target.value); setEroare('') }}
                placeholder="Introdu parola ta"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 16,
                  border: `1.5px solid ${eroare ? '#F5A0A0' : '#e0e0e0'}`,
                  borderRadius: 10, outline: 'none', boxSizing: 'border-box',
                  background: eroare ? '#FDECEA' : '#fff'
                }}
              />
              {eroare && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 6 }}>⚠️ {eroare}</div>}
            </div>

            <button type="submit" disabled={loading || !parola.trim()}
              style={{
                width: '100%', padding: '13px', background: loading ? '#aaa' : '#1F3864',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer'
              }}>
              {loading ? 'Se verifică...' : 'Intră în aplicație'}
            </button>
          </form>
        ) : (
          // Selector utilizator (parola shared)
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1F3864', marginBottom: 4 }}>Cine ești?</div>
              <div style={{ fontSize: 12, color: '#888' }}>Mai mulți utilizatori au această parolă</div>
            </div>
            {utilizatoriGasiti.map(u => (
              <button key={u.id} onClick={() => selecteazaUtilizator(u)}
                style={{
                  width: '100%', padding: '13px 16px', marginBottom: 8,
                  background: '#fff', border: '1.5px solid #e0e0e0',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'border-color .2s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#1F3864'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: u.rol === 'admin' ? '#1F3864' : '#375623',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700
                }}>
                  {u.nume.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1F3864' }}>{u.nume}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {u.rol === 'admin' ? '👔 Manager' : '🧹 Curățenie'}
                  </div>
                </div>
              </button>
            ))}
            <button onClick={() => { setUtilizatoriGasiti(null); setParola('') }}
              style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid #ddd', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#888', marginTop: 4 }}>
              ← Înapoi
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#bbb' }}>
          EZEL © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
