import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin } from 'antd';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { getDashboardStats, getInboundOrders, getOutboundOrders } from '@/lib/supabase';

const { Title } = Typography;

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [recentInbounds, setRecentInbounds] = useState([]);
  const [recentOutbounds, setRecentOutbounds] = useState([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const statsData = await getDashboardStats();
      setStats(statsData || {});
      
      const inbounds = await getInboundOrders({ page: 1, pageSize: 5 });
      setRecentInbounds(inbounds || []);
      
      const outbounds = await getOutboundOrders({ page: 1, pageSize: 5 });
      setRecentOutbounds(outbounds || []);
    } catch (error: any) {
      console.error('获取仪表板数据失败:', error.message || error);
      // 使用默认数据
      setStats({
        totalMaterials: 0,
        totalSuppliers: 0,
        totalInbound: 0,
        totalOutbound: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    pending: { color: 'processing', text: '待审批' },
    approved: { color: 'success', text: '已审批' },
    completed: { color: 'blue', text: '已完成' },
  };

  const inboundColumns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
    )},
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (date: string) => new Date(date).toLocaleString() },
  ];

  const outboundColumns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '领用人', dataIndex: 'recipient', key: 'recipient' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
    )},
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (date: string) => new Date(date).toLocaleString() },
  ];

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  return (
    <div>
      <Title level={3}>仪表盘</Title>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="物资总数"
              value={stats.totalMaterials || 0}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="供应商总数"
              value={stats.totalSuppliers || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="入库记录"
              value={stats.totalInbound || 0}
              prefix={<ImportOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="出库记录"
              value={stats.totalOutbound || 0}
              prefix={<ExportOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="最近入库记录">
            <Table
              columns={inboundColumns}
              dataSource={recentInbounds}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近出库记录">
            <Table
              columns={outboundColumns}
              dataSource={recentOutbounds}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
