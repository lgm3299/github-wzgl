import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { supabase, getCurrentUser } from './lib/supabase';
import MainLayout from './layouts';
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import MaterialsPage from './pages/materials';
import SuppliersPage from './pages/suppliers';
import InboundPage from './pages/inbound';
import OutboundPage from './pages/outbound';
import InventoryPage from './pages/inventory';
import StocktakingPage from './pages/stocktaking';
import ReportsPage from './pages/reports';
import AdminPage from './pages/admin';
import GuidePage from './pages/guide';

// 认证保护组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch (error) {
        console.error('AuthGuard checkAuth error:', error);
        setAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (authenticated === null) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <AuthGuard>
              <MainLayout />
            </AuthGuard>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="inbound" element={<InboundPage />} />
            <Route path="outbound" element={<OutboundPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="stocktaking" element={<StocktakingPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="guide" element={<GuidePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
