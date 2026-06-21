import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { signIn } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

// 环境变量或配置文件中的默认值（不要硬编码在代码中）
const DEFAULT_EMAIL_DOMAIN = '@example.com';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      // 构建email：如果用户名不包含@，则添加默认域名
      const email = values.username.includes('@') 
        ? values.username 
        : `${values.username}${DEFAULT_EMAIL_DOMAIN}`;
      
      // 调用登录API
      await signIn(email, values.password);
      
      message.success('登录成功，正在跳转...');
      
      // 使用React Router的navigate而不是window.location，避免整页刷新
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
      
    } catch (error: any) {
      console.error('登录失败:', error);
      
      // 根据错误类型显示不同的错误信息
      let errorMsg = '登录失败，请重试';
      if (error?.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMsg = '用户名或密码错误';
        } else if (error.message.includes('Email not confirmed')) {
          errorMsg = '邮箱未验证，请先验证邮箱';
        } else if (error.message.includes('Too many requests')) {
          errorMsg = '请求过于频繁，请稍后再试';
        } else {
          errorMsg = error.message;
        }
      }
      
      message.error(errorMsg);
      
      // 清空密码框
      form.setFieldValue('password', '');
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ 
        width: 400, 
        borderRadius: 12, 
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        border: 'none',
      }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0, color: '#667eea' }}>
              两江校区后勤物资管理系统
            </Title>
            <Text type="secondary">Material Management System</Text>
          </div>
          
          <Form
            name="login"
            form={form}
            onFinish={onFinish}
            size="large"
            autoComplete="off"
            initialValues={{ username: '', password: '' }}
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
              ]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="请输入用户名" 
                aria-label="用户名"
                allowClear
              />
            </Form.Item>
            
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="请输入密码" 
                aria-label="密码"
                allowClear
              />
            </Form.Item>
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                block 
                loading={loading}
                aria-label="登录按钮"
              >
                登 录
              </Button>
            </Form.Item>
          </Form>
          
          <Text type="secondary" style={{ fontSize: 12 }}>
            建议使用 Chrome 或 Edge 浏览器访问
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
