import React, { useEffect, useState, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { getCurrentUser } from './lib/supabase';
import MainLayout from './layouts';

// 懒加载路由页面，减小首屏 bundle
const LoginPage = lazy(() => import('./pages/login'));
const DashboardPage = lazy(() => import('./pages/dashboard'));
const MaterialsPage = lazy(() => import('./pages/materials'));
const SuppliersPage = lazy(() => import('./pages/suppliers'));
const InboundPage = lazy(() => import('./pages/inbound'));
const OutboundPage = lazy(() => import('./pages/outbound'));
const InventoryPage = lazy(() => import('./pages/inventory'));
const StocktakingPage = lazy(() => import('./pages/stocktaking'));
const ReportsPage = lazy(() => import('./pages/reports'));
const AdminPage = lazy(() => import('./pages/admin'));
const GuidePage = lazy(() => import('./pages/guide'));

// 页面加载中的 fallback
const PageLoading = () => (
  <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />
);

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
        <Suspense fallback={<PageLoading />}>
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
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
