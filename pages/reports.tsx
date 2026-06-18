import React, { useEffect, useState } from 'react';
import { Typography, Card, Row, Col, Statistic, Spin } from 'antd';
import { DatabaseOutlined, ImportOutlined, ExportOutlined } from '@ant-design/icons';
import { getDashboardStats } from '@/lib/supabase';

const { Title } = Typography;

const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const result = await getDashboardStats();
        setStats(result || {});
      } catch {}
      finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>报表统计</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="物资总数" value={stats.totalMaterials || 0} prefix={<DatabaseOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="入库记录" value={stats.totalInbound || 0} prefix={<ImportOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="出库记录" value={stats.totalOutbound || 0} prefix={<ExportOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="供应商总数" value={stats.totalSuppliers || 0} prefix={<DatabaseOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Card title="统计说明">
        <ul>
          <li>物资总数: 系统中所有物资档案的数量</li>
          <li>入库记录: 所有入库单的总数</li>
          <li>出库记录: 所有出库单的总数</li>
          <li>供应商总数: 系统中所有供应商的数量</li>
        </ul>
      </Card>
    </div>
  );
};

export default ReportsPage;
