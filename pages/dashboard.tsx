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

/** 最近记录每页条数 */
const RECENT_PAGE_SIZE = 5;

/** 入库/出库单状态映射 */
const statusMap: Record<string, { color: string; text: string }> = {
  draft:      { color: 'default',   text: '草稿' },
  pending:    { color: 'processing', text: '待审批' },
  approved:   { color: 'success',   text: '已审批' },
  completed:  { color: 'blue',      text: '已完成' },
  rejected:   { color: 'error',     text: '已驳回' },
};

const DEFAULT_STATUS = { color: 'default', text: '未知' };

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

      const inbounds = await getInboundOrders({ page: 1, pageSize: RECENT_PAGE_SIZE });
      setRecentInbounds(inbounds || []);

      const outbounds = await getOutboundOrders({ page: 1, pageSize: RECENT_PAGE_SIZE });
      setRecentOutbounds(outbounds || []);
    } catch (error: any) {
      console.error('获取仪表板数据失败:', error?.message || error);
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

  const renderStatus = (status: string) => {
    const conf = statusMap[status] || DEFAULT_STATUS;
    return <Tag color={conf.color}>{conf.text}</Tag>;
  };

  const renderDate = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return '-';
    }
  };

  const inboundColumns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '状态', dataIndex: 'status', key: 'status', render: renderStatus },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: renderDate },
  ];

  const outboundColumns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '领用人', dataIndex: 'recipient', key: 'recipient' },
    { title: '状态', dataIndex: 'status', key: 'status', render: renderStatus },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: renderDate },
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
