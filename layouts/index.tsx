import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Dropdown,
  theme,
  Avatar,
  Space,
  Typography,
  message,
} from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  ShopOutlined,
  ImportOutlined,
  ExportOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { signOut, getCurrentUser, User } from '@/lib/supabase';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 菜单配置提取为常量，便于维护和修改
const MENU_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/materials', icon: <AppstoreOutlined />, label: '物资档案' },
  { key: '/suppliers', icon: <ShopOutlined />, label: '供应商管理' },
  { key: '/inbound', icon: <ImportOutlined />, label: '入库管理' },
  { key: '/outbound', icon: <ExportOutlined />, label: '出库管理' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  { key: '/stocktaking', icon: <CheckCircleOutlined />, label: '盘点管理' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报表统计' },
  { key: '/admin', icon: <SettingOutlined />, label: '后台管理' },
  { key: '/guide', icon: <BookOutlined />, label: '使用指南' },
];

// 侧边栏宽度配置
const SIDER_WIDTH = 220;
const SIDER_COLLAPSED_WIDTH = 80;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  // 使用useCallback避免函数重复创建
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // 如果用户未登录且不在登录页面，则跳转
      if (!currentUser && location.pathname !== '/login') {
        message.warning('请先登录');
        navigate('/login', { replace: true });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      message.error('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = async () => {
    try {
      await signOut();
      message.success('退出登录成功');
      // 清除用户状态
      setUser(null);
      // 使用navigate而不是window.location，避免整页刷新
      navigate('/login', { replace: true });
    } catch (error: any) {
      console.error('退出登录失败:', error);
      message.error(error?.message || '退出登录失败，请重试');
    }
  };

  // XSS防护：对用户输入进行转义
  const sanitizeUserDisplay = (user: User | null): string => {
    if (!user) return '用户';
    
    // 优先使用full_name，其次email，最后兜底
    const displayName = user.full_name || user.email || '用户';
    
    // 简单的XSS防护：移除潜在的脚本标签
    return displayName.replace(/<script.*?>.*?<\/script>/gi, '');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ 
          background: themeToken.colorBgContainer,
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
        width={SIDER_WIDTH}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Text strong style={{ 
            fontSize: collapsed ? 14 : 16, 
            color: themeToken.colorPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: collapsed ? 60 : 200,
          }}>
            {collapsed ? '物资' : '两江校区后勤物资管理'}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={MENU_ITEMS}
          onClick={(info) => navigate(info.key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: themeToken.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          />
          <Dropdown
            menu={{
              items: [
                { 
                  key: 'logout', 
                  icon: <LogoutOutlined />, 
                  label: '退出登录', 
                  onClick: handleLogout 
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar 
                icon={<UserOutlined />} 
                style={{ backgroundColor: themeToken.colorPrimary }} 
              />
              <Text>{sanitizeUserDisplay(user)}</Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: themeToken.colorBgContainer,
          borderRadius: themeToken.borderRadiusLG,
          minHeight: 280,
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
