import React, { useState } from 'react';
import { Typography, Alert, Space, Divider, Card } from 'antd';
import { BookOutlined, WarningCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const GuidePage: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>系统配置说明</Title>
        </Space>
      </div>

      <Alert
        message="系统尚未配置数据库连接"
        description={
          <div>
            <Paragraph>
              请先在 Supabase 后台注册用户并创建数据表，然后在 Vercel 项目设置中添加环境变量：
            </Paragraph>
            <ul>
              <li><Text code>VITE_SUPABASE_URL</Text></li>
              <li><Text code>VITE_SUPABASE_PUBLISHABLE_KEY</Text></li>
            </ul>
            <Paragraph type="secondary">
              配置完成后刷新页面即可使用。如需查看系统功能说明，请参考上方标签页的详细说明。
            </Paragraph>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
    </div>
  );
};

export default GuidePage;
