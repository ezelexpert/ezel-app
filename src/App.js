import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getSession } from './lib/auth'
import LoginPage from './pages/LoginPage' // ramane „eager" — e primul ecran

// Restul paginilor se incarca „la cerere" (code-splitting) -> pornire mai rapida.
const AdminPage = lazy(() => import('./pages/AdminPage'))
const CuratenIePage = lazy(() => import('./pages/CuratenIePage'))
const LenjeriiPage = lazy(() => import('./pages/LenjeriiPage'))
const RaporteazaProblema = lazy(() => import('./pages/RaporteazaProblema'))
const HandymanPage = lazy(() => import('./pages/HandymanPage'))
const ClientPortal = lazy(() => import('./pages/ClientPortal'))

function PrivateRoute({ element, requiredRole }) {
  const session = getSession()
  if (!session) return <Navigate to="/" replace />
  if (requiredRole && session.role !== requiredRole) return <Navigate to="/" replace />
  return element
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1F3864', fontFamily: 'system-ui, sans-serif' }}>Se încarcă...</div>}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          {/* Pagina publica pentru clienti (cod QR) - fara login */}
          <Route path="/raporteaza/:nrApt" element={<RaporteazaProblema />} />
          <Route path="/raporteaza" element={<RaporteazaProblema />} />
          <Route path="/admin" element={<PrivateRoute element={<AdminPage />} requiredRole="admin" />} />
          <Route path="/curatenie" element={<PrivateRoute element={<CuratenIePage />} requiredRole="curatenie" />} />
          <Route path="/lenjerii" element={<PrivateRoute element={<LenjeriiPage />} requiredRole="lenjerii" />} />
          <Route path="/handyman" element={<PrivateRoute element={<HandymanPage />} requiredRole="handyman" />} />
          <Route path="/client" element={<PrivateRoute element={<ClientPortal />} requiredRole="client" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
