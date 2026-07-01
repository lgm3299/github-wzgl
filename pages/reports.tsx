import React, { useEffect, useState } from 'react';
import { Typography, Card, Row, Col, Statistic, Spin, message, Table, DatePicker, Button, Tag } from 'antd';
import { DatabaseOutlined, ImportOutlined, ExportOutlined, BarChartOutlined, PrinterOutlined } from '@ant-design/icons';
import { getDashboardStats, getOutboundUsageStats } from '@/lib/supabase';
import { printMaterials, exportTableAsHTML, downloadCSV } from '@/lib/importExport';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const result = await getDashboardStats();
        setStats(result || {});
      } catch (error) {
        console.error('获取统计数据失败:', error);
        message.error('获取统计数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const fetchUsageStats = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning('请选择时间范围');
      return;
    }
    setUsageLoading(true);
    try {
      const startDate = dateRange[0].format?.('YYYY-MM-DD');
      const endDate = dateRange[1].format?.('YYYY-MM-DD');
      const result = await getOutboundUsageStats(startDate, endDate);
      setUsageData(result || []);
    } catch (error: any) {
      console.error('获取用量统计失败:', error);
      message.error('获取用量统计失败: ' + (error.message || '未知错误'));
    } finally {
      setUsageLoading(false);
    }
  };

  const handleExportUsage = () => {
    if (usageData.length === 0) {
      message.warning('没有数据可导出');
      return;
    }
    const exportData = usageData.map((item, idx) => ({ ...item, _idx: idx + 1 }));
    const columns = [
      { key: '_idx', label: '排名' },
      { key: 'code', label: '物资编码' },
      { key: 'name', label: '物资名称' },
      { key: 'unit', label: '单位' },
      { key: 'total_quantity', label: '消耗数量' },
    ];
    exportTableAsHTML(exportData, columns, '物资用量统计');
    message.success('导出成功');
  };

  const handlePrintUsage = () => {
    if (usageData.length === 0) {
      message.warning('没有数据可打印');
      return;
    }
    const printData = usageData.map((item, idx) => ({ ...item, _idx: idx + 1 }));
    const columns = [
      { key: '_idx', label: '排名' },
      { key: 'code', label: '物资编码' },
      { key: 'name', label: '物资名称' },
      { key: 'unit', label: '单位' },
      { key: 'total_quantity', label: '消耗数量' },
    ];
    printMaterials(printData, columns);
  };

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

      <Card title="物资用量统计" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            style={{ width: 280 }}
            value={dateRange}
            onChange={(dates) => setDateRange(dates as any)}
          />
          <Button type="primary" icon={<BarChartOutlined />} onClick={fetchUsageStats} loading={usageLoading}>
            查询用量
          </Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrintUsage} disabled={usageData.length === 0}>打印</Button>
          <Button icon={<ExportOutlined />} onClick={handleExportUsage} disabled={usageData.length === 0}>
            导出用量
          </Button>
          <Button onClick={() => { setDateRange(null); setUsageData([]); }}>
            重置
          </Button>
        </div>

        <Table
          rowKey="material_id"
          columns={[
            { title: '排名', key: 'rank', width: 60, render: (_: any, __: any, index: number) => <Tag color={index < 3 ? 'gold' : 'default'}>{index + 1}</Tag> },
            { title: '物资编码', dataIndex: 'code', key: 'code', width: 120 },
            { title: '物资名称', dataIndex: 'name', key: 'name', width: 200 },
            { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
            { title: '消耗数量', dataIndex: 'total_quantity', key: 'total_quantity', width: 120, render: (v: number) => <strong style={{ color: '#1677ff' }}>{v}</strong> },
          ]}
          dataSource={usageData}
          loading={usageLoading}
          pagination={false}
          locale={{ emptyText: '请选择时间范围并点击"查询用量"' }}
          summary={() => {
            if (usageData.length === 0) return null;
            const total = usageData.reduce((sum, item) => sum + (item.total_quantity || 0), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><strong>合计</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2}><strong>{total}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      <Card title="统计说明">
        <ul>
          <li>物资总数: 系统中所有物资档案的数量</li>
          <li>入库记录: 所有入库单的总数</li>
          <li>出库记录: 所有出库单的总数</li>
          <li>供应商总数: 系统中所有供应商的数量</li>
          <li>物资用量统计: 按选择的时间范围统计各物资的出库消耗量</li>
        </ul>
      </Card>
    </div>
  );
};

export default ReportsPage;
