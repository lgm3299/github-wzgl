import React, { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button, Space, message, DatePicker, Select, Popconfirm } from 'antd';
import { ReloadOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { getInventories, getCategories, deleteInventory } from '@/lib/supabase';
import { downloadCSV } from '@/lib/importExport';

const { Title } = Typography;

const InventoryPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedCategory) params.category_id = selectedCategory;
      if (dateRange?.[0]) params.startDate = dateRange[0].format?.('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format?.('YYYY-MM-DD');
      const result = await getInventories(params);
      setData(result || []);
    } catch (error: any) {
      console.error('获取数据失败:', error.message || error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const result = await getCategories();
      setCategories(result || []);
    } catch {}
  };

  useEffect(() => { fetchData(); fetchCategories(); }, []);

  // 删除库存记录
  const handleDelete = async (id: number) => {
    try {
      await deleteInventory(id);
      message.success('删除成功');
      fetchData();
    } catch (error: any) {
      console.error('删除库存失败:', error);
      const errorMessage = error?.message || error?.hint || '删除失败';
      message.error(`删除失败：${errorMessage}`);
    }
  };

  // 导出库存数据
  const handleExport = () => {
    const columns = [
      { key: 'code', label: '物资编码' },
      { key: 'name', label: '物资名称' },
      { key: 'category', label: '分类' },
      { key: 'quantity', label: '当前库存' },
      { key: 'location', label: '存放位置' },
      { key: 'updated_at', label: '更新时间' },
    ];
    const exportData = data.map(item => ({
      code: item.material?.code || '',
      name: item.material?.name || '',
      category: item.material?.categories?.name || '',
      quantity: item.quantity,
      location: item.location || '',
      updated_at: new Date(item.updated_at).toLocaleString(),
    }));
    downloadCSV(exportData, columns, '库存数据');
    message.success('导出成功');
  };

  const columns = [
    { title: '物资编码', dataIndex: ['material', 'code'], key: 'code', width: 120 },
    { title: '物资名称', dataIndex: ['material', 'name'], key: 'name', width: 150 },
    { title: '分类', dataIndex: ['material', 'categories', 'name'], key: 'category', width: 100, render: (text: string) => text || '-' },
    { title: '当前库存', dataIndex: 'quantity', key: 'quantity', width: 100, render: (v: number) => <Tag color={v > 0 ? 'green' : 'red'}>{v}</Tag> },
    { title: '存放位置', dataIndex: 'location', key: 'location', width: 120 },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180, render: (date: string) => new Date(date).toLocaleString() },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: any) => (
        <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>库存管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          placeholder="选择分类"
          allowClear
          style={{ width: 180 }}
          value={selectedCategory}
          onChange={(value) => { setSelectedCategory(value); fetchData(); }}
        >
          {categories.map((c: any) => (
            <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
          ))}
        </Select>
        <DatePicker.RangePicker
          placeholder={['开始日期', '结束日期']}
          style={{ width: 250 }}
          onChange={(dates) => setDateRange(dates)}
        />
        <Button onClick={() => { setSelectedCategory(''); setDateRange(null); fetchData(); }}>重置</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 1000 }} />
    </div>
  );
};

export default InventoryPage;
