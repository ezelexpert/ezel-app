import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, saveUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [tip, setTip] = useState(null)
  const [parola, setParola] = useState('')
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (s) {
      navigate(s.role === 'admin' ? '/admin' : s.role === 'lenjerii' ? '/lenjerii' : '/curatenie', { replace: true })
    }
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    if (!parola.trim()) return
    setLoading(true)
    setEroare('')

    try {
      // Cauta direct in Supabase cu parola
      const roluri = tip === 'admin' ? ['admin'] : ['curatenie', 'lenjerii']
      const { data, error } = await supabase
        .from('utilizatori')
        .select('*')
        .eq('parola', parola.trim())
        .eq('activ', true)
        .in('rol', roluri)

      if (error || !data || data.length === 0) {
        setEroare('Parolă incorectă.')
        setLoading(false)
        return
      }

      const user = data[0]
      saveUser(user)
      navigate(user.rol === 'admin' ? '/admin' : user.rol === 'lenjerii' ? '/lenjerii' : '/curatenie', { replace: true })
    } catch(e) {
      setEroare('Eroare de conexiune. Încearcă din nou.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1F3864 0%, #2F5496 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 32px',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#1F3864', letterSpacing: -1 }}>EZEL</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Sistem de management apartamente</div>
        </div>

        {!tip ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', textAlign: 'center', marginBottom: 16 }}>
              Selectează rolul tău
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setTip('admin')}
                style={{ padding: '16px', borderRadius: 12, border: '1.5px solid #90B8E8', background: '#EBF1FB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1F3864', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👔</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1F3864' }}>Manager</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Acces complet la aplicație</div>
                </div>
              </button>
              <button onClick={() => setTip('curatenie')}
                style={{ padding: '16px', borderRadius: 12, border: '1.5px solid #C0DD97', background: '#E2EFDA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#375623', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🧹</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#375623' }}>Curățenie & Lenjerii</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Curățenii, spălătorie, lenjerii</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <button type="button" onClick={() => { setTip(null); setParola(''); setEroare('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#888', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Înapoi
            </button>
            <div style={{ background: tip === 'admin' ? '#EBF1FB' : '#E2EFDA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{tip === 'admin' ? '👔' : '🧹'}</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: tip === 'admin' ? '#1F3864' : '#375623' }}>
                {tip === 'admin' ? 'Manager' : 'Curățenie & Lenjerii'}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Parola ta</label>
              <input type="password" value={parola}
                onChange={e => { setParola(e.target.value); setEroare('') }}
                placeholder="Introdu parola" autoFocus
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 16,
                  border: `1.5px solid ${eroare ? '#F5A0A0' : '#e0e0e0'}`,
                  borderRadius: 10, outline: 'none', boxSizing: 'border-box',
                  background: eroare ? '#FDECEA' : '#fff'
                }} />
              {eroare && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 6 }}>⚠️ {eroare}</div>}
            </div>
            <button type="submit" disabled={loading || !parola.trim()}
              style={{
                width: '100%', padding: '13px',
                background: !parola.trim() ? '#ccc' : tip === 'curatenie' ? '#375623' : '#1F3864',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 15,
                fontWeight: 600, cursor: !parola.trim() ? 'not-allowed' : 'pointer'
              }}>
              {loading ? 'Se verifică...' : 'Intră în aplicație'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#bbb' }}>EZEL © {new Date().getFullYear()}</div>
      </div>
    </div>
  )
}
