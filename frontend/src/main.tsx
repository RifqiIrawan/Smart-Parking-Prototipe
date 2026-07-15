import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { AuthProvider, useAuth } from './store/auth'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { EntryPage } from './pages/Entry'
import { ExitPage } from './pages/Exit'
import { TransactionsPage } from './pages/Transactions'
import { GatesPage } from './pages/Gates'
import { SlotsPage } from './pages/Slots'
import { UsersPage } from './pages/Users'
import { ReportsPage } from './pages/Reports'

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/entry" element={<PrivateRoute><EntryPage /></PrivateRoute>} />
          <Route path="/exit" element={<PrivateRoute><ExitPage /></PrivateRoute>} />
          <Route path="/transactions" element={<PrivateRoute><TransactionsPage /></PrivateRoute>} />
          <Route path="/gates" element={<PrivateRoute><GatesPage /></PrivateRoute>} />
          <Route path="/slots" element={<PrivateRoute><SlotsPage /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
