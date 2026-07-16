import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './store/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { EntryPage } from './pages/Entry';
import { ExitPage } from './pages/Exit';
import { TransactionsPage } from './pages/Transactions';
import { GatesPage } from './pages/Gates';
import { SlotsPage } from './pages/Slots';
import { UsersPage } from './pages/Users';
import { ReportsPage } from './pages/Reports';
import { Simulator } from './pages/Simulator';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route path="/dashboard"    element={<DashboardPage />} />
              <Route path="/entry"        element={<EntryPage />} />
              <Route path="/exit"         element={<ExitPage />} />
              <Route path="/slots"        element={<SlotsPage />} />
              <Route path="/gates"        element={<GatesPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/reports"      element={<ReportsPage />} />
              <Route path="/users"        element={<UsersPage />} />
              <Route path="/simulator"    element={<Simulator />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
