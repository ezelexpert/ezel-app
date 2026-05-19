import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, getUtilizatori, loginCuNumeSiParola } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [utilizatori, setUtilizatori] = useState([])
  const [selectat, setSelectat] = useState(null) // utilizatorul ales
  const [parola, setParola] = useState('')
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    // Daca e deja logat, redirecteaza
    const s = getSession()
    if (s) {
      navigate(s.role === 'admin' ? '/admin' : '/curatenie', { replace: true })
      return
    }
    // Incarca lista utilizatori
    getUtilizatori().then(list => {
      setUtilizatori(list)
      setLoadingList(false)
    })
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    if (!selectat || !parola.trim()) return
    setLoading(true)
    setEroare('')

    const user = await loginCuNumeSiParola(selectat.id, parola.trim())

    if (!user) {
      setEroare('Parolă incorectă. Încearcă din nou.')
      setLoading(false)
      return
    }

    navigate(user.rol === 'admin' ? '/admin' : '/curatenie', { replace: true })
  }

  const admini = utilizatori.filter(u => u.rol === 'admin')
  const curatenie = utilizatori.filter(u => u.rol === 'curatenie')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1F3864 0%, #2F5496 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 32px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.25)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#1F3864', letterSpacing: -1 }}>EZEL</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Sistem de management apartamente</div>
        </div>

        {loadingList ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>Se încarcă...</div>
        ) : (
          <form onSubmit={handleLogin}>

            {/* Pas 1: Selecteaza numele */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>
                Selectează numele tău
              </label>

              {/* Manageri */}
              {admini.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#aaa', marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase' }}>Manageri</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {admini.map(u => (
                      <div key={u.id} onClick={() => { setSelectat(u); setEroare(''); setParola('') }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          border: `1.5px solid ${selectat?.id === u.id ? '#1F3864' : '#e0e0e0'}`,
                          background: selectat?.id === u.id ? '#EBF1FB' : '#fff',
                          transition: 'all .15s'
                        }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: selectat?.id === u.id ? '#1F3864' : '#f0f0f0',
                          color: selectat?.id === u.id ? '#fff' : '#555',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700
                        }}>
                          {u.nume.split(' ')[0][0]}{u.nume.split(' ')[1]?.[0] || ''}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: selectat?.id === u.id ? '#1F3864' : '#333' }}>
                          {u.nume}
                        </div>
                        {selectat?.id === u.id && (
                          <div style={{ marginLeft: 'auto', color: '#1F3864', fontSize: 16 }}>✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Angajate curatenie */}
              {curatenie.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#aaa', marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase' }}>Curățenie</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {curatenie.map(u => (
                      <div key={u.id} onClick={() => { setSelectat(u); setEroare(''); setParola('') }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          border: `1.5px solid ${selectat?.id === u.id ? '#375623' : '#e0e0e0'}`,
                          background: selectat?.id === u.id ? '#E2EFDA' : '#fff',
                          transition: 'all .15s'
                        }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: selectat?.id === u.id ? '#375623' : '#f0f0f0',
                          color: selectat?.id === u.id ? '#fff' : '#555',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700
                        }}>
                          {u.nume.split(' ')[0][0]}{u.nume.split(' ')[1]?.[0] || ''}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: selectat?.id === u.id ? '#375623' : '#333' }}>
                          {u.nume}
                        </div>
                        {selectat?.id === u.id && (
                          <div style={{ marginLeft: 'auto', color: '#375623', fontSize: 16 }}>✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pas 2: Parola - apare doar dupa selectie */}
            {selectat && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                  Parola ta
                </label>
                <input
                  type="password"
                  value={parola}
                  onChange={e => { setParola(e.target.value); setEroare('') }}
                  placeholder={`Parola pentru ${selectat.nume.split(' ')[0]}`}
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
            )}

            <button type="submit" disabled={loading || !selectat || !parola.trim()}
              style={{
                width: '100%', padding: '13px',
                background: (!selectat || !parola.trim()) ? '#ccc' : selectat?.rol === 'curatenie' ? '#375623' : '#1F3864',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15,
                fontWeight: 600, cursor: (!selectat || !parola.trim()) ? 'not-allowed' : 'pointer'
              }}>
              {loading ? 'Se verifică...' : selectat ? `Intră ca ${selectat.nume.split(' ')[0]}` : 'Selectează numele mai sus'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#bbb' }}>
          EZEL © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
