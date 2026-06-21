import React, { useEffect, useState, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { getCurrentUser, User } from './lib/supabase';
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
const PageLoading: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

// 认证保护组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true; // 防止组件卸载后设置状态
    
    const checkAuth = async () => {
      try {
        const user: User | null = await getCurrentUser();
        
        if (isMounted) {
          if (user) {
            setAuthenticated(true);
          } else {
            setAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('[AuthGuard] 认证检查失败:', error);
        if (isMounted) {
          setAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };
    
    checkAuth();
    
    // 清理函数：防止内存泄漏
    return () => {
      isMounted = false;
    };
  }, []);

  // 检查中显示加载状态
  if (checking) {
    return <PageLoading />;
  }

  // 未认证则重定向到登录页
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 已认证则渲染子组件
  return <>{children}</>;
};

// 应用根组件
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ConfigProvider 
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#667eea',
          },
        }}
      >
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* 公开路由 */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* 受保护的路由 */}
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
            
            {/* 404 页面 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ConfigProvider>
    </BrowserRouter>
  );
};

// 获取root元素，带安全检查
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('找不到 id="root" 的元素，请检查 HTML 文件');
  throw new Error('Root element not found');
}

// 渲染应用
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
