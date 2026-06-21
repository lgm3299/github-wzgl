import { Navigate } from 'react-router-dom';

/**
 * 首页组件 - 重定向到仪表盘
 * 这是应用的入口路由，自动跳转到主功能页面
 */
export default function IndexPage() {
  return <Navigate to="/dashboard" replace />;
}
