import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InboxPage } from './pages/inbox/InboxPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { PipelinePage } from './pages/pipeline/PipelinePage';
import { EmployeesPage } from './pages/employees/EmployeesPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WhatsAppAccountsPage } from './pages/whatsapp/WhatsAppAccountsPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* CRM App Shell (Strictly Protected Routes) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="pipeline" element={<PipelinePage />} />

              {/* Manager & Admin Elevated Access Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="reports" element={<ReportsPage />} />
              </Route>

              {/* Admin Only Route */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="settings" element={<SettingsPage />} />
                <Route path="whatsapp-accounts" element={<WhatsAppAccountsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
