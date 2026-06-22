import React, { useEffect, useState, useRef, Suspense, lazy, Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Spin, Button, Result } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { getCurrentUser, User, supabase } from './lib/supabase';
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
const RecyclePage = lazy(() => import('./pages/recycle'));
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

// 错误边界组件：捕获 React 渲染错误，防止整页白屏
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 页面渲染错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Result
            status="error"
            title="页面加载失败"
            subTitle={this.state.error?.message || '请检查网络连接后重试'}
            extra={[
              <Button
                type="primary"
                key="retry"
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
              >
                重新加载
              </Button>,
            ]}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

// 认证保护组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(true);
  const location = useLocation();

  // 保持 ref 与 state 同步，避免闭包问题
  useEffect(() => {
    checkingRef.current = checking;
  }, [checking]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let authSubscription: { subscription: { unsubscribe: () => void } } | null = null;

    const checkAuth = async () => {
      try {
        const user: User | null = await getCurrentUser();
        if (isMounted) {
          setAuthenticated(!!user);
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

    // 添加超时保护：如果 10 秒内认证检查未完成，自动设置为未认证
    timeoutId = setTimeout(() => {
      if (isMounted && checkingRef.current) {
        console.warn('[AuthGuard] 认证检查超时');
        setChecking(false);
        setAuthenticated(false);
      }
    }, 10000);

    // 监听 Supabase 认证状态变化（token 刷新、登出等）
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AuthGuard] auth state change:', event);
        if (isMounted) {
          if (event === 'SIGNED_OUT') {
            setAuthenticated(false);
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            setAuthenticated(!!session);
          }
        }
      });
      authSubscription = data;
    }

    checkAuth();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      authSubscription?.subscription.unsubscribe();
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
        <ErrorBoundary>
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
                <Route path="recycle" element={<RecyclePage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="guide" element={<GuidePage />} />
              </Route>
              
              {/* 404 页面 */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
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
