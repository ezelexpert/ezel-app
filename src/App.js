import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getSession } from './lib/auth'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import CuratenIePage from './pages/CuratenIePage'
import LenjeriiPage from './pages/LenjeriiPage'

function PrivateRoute({ element, requiredRole }) {
  const session = getSession()
  if (!session) return <Navigate to="/" replace />
  if (requiredRole && session.role !== requiredRole) return <Navigate to="/" replace />
  return element
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin" element={<PrivateRoute element={<AdminPage />} requiredRole="admin" />} />
        <Route path="/curatenie" element={<PrivateRoute element={<CuratenIePage />} requiredRole="curatenie" />} />
        <Route path="/lenjerii" element={<PrivateRoute element={<LenjeriiPage />} requiredRole="lenjerii" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
