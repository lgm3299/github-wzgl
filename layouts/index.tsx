import React, { useState, useEffect } from 'react';
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

const menuItems = [
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

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (!currentUser) {
        navigate('/login');
      }
    };
    loadUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      message.success('退出登录成功');
      navigate('/login');
    } catch (error: any) {
      message.error(error.message || '退出登录失败');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: themeToken.colorBgContainer }}
        width={220}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Text strong style={{ fontSize: collapsed ? 14 : 16, color: themeToken.colorPrimary }}>
            {collapsed ? '物资' : '两江校区后勤物资管理'}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(info) => navigate(info.key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: themeToken.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown
            menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: themeToken.colorPrimary }} />
              <Text>{user?.full_name || user?.email || '用户'}</Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: themeToken.colorBgContainer,
          borderRadius: themeToken.borderRadiusLG,
          minHeight: 280,
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
