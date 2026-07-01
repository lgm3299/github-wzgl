import React, { useEffect, useState, useRef } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag,
  Typography, Popconfirm, Row, Col, DatePicker, Alert, Divider
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, CheckOutlined,
  DownloadOutlined, MinusCircleOutlined, SendOutlined, PrinterOutlined
} from '@ant-design/icons';
import { getRecycleOrders, createRecycleOrder, updateRecycleOrderStatus, deleteRecycleOrder, getMaterials, getCurrentUser, getAllOutboundQuantities } from '@/lib/supabase';
import { printMaterials, exportTableAsHTML, downloadCSV } from '@/lib/importExport';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const RECYCLE_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending: { color: 'processing', text: '待确认' },
  completed: { color: 'success', text: '已完成' },
};

const RecyclePage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [inventories, setInventories] = useState<Map<number, number>>(new Map());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [outboundQuantities, setOutboundQuantities] = useState<Record<number, number>>({});

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (dateRange?.[0]) params.startDate = dateRange[0].format?.('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format?.('YYYY-MM-DD');
      const result = await getRecycleOrders(params);
      setData(result || []);
      setPagination(prev => ({ ...prev, current: page, pageSize }));
    } catch (error: any) {
      console.error('获取数据失败:', error.message || error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const matRes = await getMaterials({ pageSize: 1000 });
      const materialsList = matRes?.data || [];
      setMaterials(materialsList);

      const invRes = await getInventories();
      const invMap = new Map<number, number>();
      (invRes || []).forEach((inv: any) => {
        invMap.set(inv.material_id, inv.quantity);
      });
      setInventories(invMap);
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchOptions();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  const handleAdd = async () => {
    form.resetFields();
    setItems([{ material_id: '', quantity: 1 }]);
    if (currentUser?.full_name) {
      form.setFieldsValue({ operator: currentUser.full_name });
    }
    // 预加载所有物资的出库数量
    const qtyMap = await getAllOutboundQuantities();
    setOutboundQuantities(Object.fromEntries(qtyMap));
    setModalOpen(true);
  };

  const handleAddItem = () => {
    setItems([...items, { material_id: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) { message.warning('请至少添加一项物资'); return; }
      const validItems = items.filter(item => item.material_id && item.quantity > 0);
      if (validItems.length === 0) { message.warning('请至少填写一项有效的物资明细'); return; }

      await createRecycleOrder({
        operator: values.operator,
        recycler: values.recycler,
        recycle_date: values.recycle_date?.format?.('YYYY-MM-DD'),
        remark: values.remark,
        items: validItems.map(item => ({
          material_id: item.material_id,
          quantity: item.quantity,
        })),
      });
      message.success('回收单创建成功');
      setModalOpen(false);
      setItems([]);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '创建失败');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await updateRecycleOrderStatus(id, 'completed');
      message.success('回收单已确认');
      fetchData();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try { await deleteRecycleOrder(id); message.success('删除成功'); fetchData(); }
    catch { message.error('删除失败'); }
  };

  const handleExport = () => {
    if (data.length === 0) { message.warning('暂无数据可导出'); return; }
    const exportData: any[] = [];
    for (const order of data) {
      const orderItems = order.recycle_items || [];
      if (orderItems.length === 0) {
        exportData.push({
          order_no: order.order_no,
          recycler: order.recycler,
          operator: order.operator,
          status: RECYCLE_STATUS_MAP[order.status]?.text || order.status,
          recycle_date: order.recycle_date,
          material_name: '',
          quantity: '',
          remark: order.remark || '',
          created_at: new Date(order.created_at).toLocaleString(),
        });
      } else {
        for (const item of orderItems) {
          exportData.push({
            order_no: order.order_no,
            recycler: order.recycler,
            operator: order.operator,
            status: RECYCLE_STATUS_MAP[order.status]?.text || order.status,
            recycle_date: order.recycle_date,
            material_name: item.materials?.name || '未知物资',
            quantity: item.quantity,
            remark: order.remark || '',
            created_at: new Date(order.created_at).toLocaleString(),
          });
        }
      }
    }
    const columns = [
      { key: 'order_no', label: '回收单号' },
      { key: 'recycler', label: '回收人' },
      { key: 'operator', label: '操作人' },
      { key: 'status', label: '状态' },
      { key: 'recycle_date', label: '回收日期' },
      { key: 'material_name', label: '物资名称' },
      { key: 'quantity', label: '数量' },
      { key: 'remark', label: '备注' },
      { key: 'created_at', label: '创建时间' },
    ];
    exportTableAsHTML(exportData, columns, '废旧物资回收记录');
    message.success('导出成功');
  };

  const handlePrint = () => {
    if (data.length === 0) { message.warning('暂无数据可打印'); return; }
    const printData: any[] = [];
    for (const order of data) {
      const orderItems = order.recycle_items || [];
      if (orderItems.length === 0) {
        printData.push({
          order_no: order.order_no,
          recycler: order.recycler,
          operator: order.operator,
          status: RECYCLE_STATUS_MAP[order.status]?.text || order.status,
          recycle_date: order.recycle_date,
          material_name: '',
          quantity: '',
          remark: order.remark || '',
          created_at: new Date(order.created_at).toLocaleString(),
        });
      } else {
        for (const item of orderItems) {
          printData.push({
            order_no: order.order_no,
            recycler: order.recycler,
            operator: order.operator,
            status: RECYCLE_STATUS_MAP[order.status]?.text || order.status,
            recycle_date: order.recycle_date,
            material_name: item.materials?.name || '未知物资',
            quantity: item.quantity,
            remark: order.remark || '',
            created_at: new Date(order.created_at).toLocaleString(),
          });
        }
      }
    }
    const columns = [
      { key: 'order_no', label: '回收单号' },
      { key: 'recycler', label: '回收人' },
      { key: 'operator', label: '操作人' },
      { key: 'status', label: '状态' },
      { key: 'recycle_date', label: '回收日期' },
      { key: 'material_name', label: '物资名称' },
      { key: 'quantity', label: '数量' },
      { key: 'remark', label: '备注' },
      { key: 'created_at', label: '创建时间' },
    ];
    printMaterials(printData, columns);
  };

  const statusMap = RECYCLE_STATUS_MAP;

  const columns = [
    { title: '回收单号', dataIndex: 'order_no', key: 'order_no', width: 150 },
    { title: '回收人', dataIndex: 'recycler', key: 'recycler', width: 120 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    {
      title: '物资名称',
      key: 'material_names',
      width: 160,
      render: (_: any, record: any) => {
        const items = record.recycle_items || [];
        if (items.length === 0) return '-';
        const names = items.map((item: any) => item.materials?.name || '未知物资');
        const display = names.slice(0, 2).join('，');
        return (
          <span>
            {display}
            {names.length > 2 && ` 等 ${names.length} 种`}
          </span>
        );
      },
    },
    {
      title: '数量',
      key: 'total_quantity',
      width: 80,
      render: (_: any, record: any) => {
        const items = record.recycle_items || [];
        if (items.length === 0) return '-';
        const totalQty = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
        return <span>{totalQty}</span>;
      },
    },
    {
      title: '回收日期', dataIndex: 'recycle_date', key: 'recycle_date', width: 120,
      render: (date: string) => date || '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => {
        const st = statusMap[s] || { color: 'default', text: s };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 140,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'pending' && (
            <Popconfirm title="确认完成?" onConfirm={() => handleApprove(record.id)}>
              <Button type="link" size="small" icon={<CheckOutlined />}>确认</Button>
            </Popconfirm>
          )}
          {(record.status === 'draft' || record.status === 'pending') && (
            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: any) => {
    const items = record.recycle_items || [];
    if (items.length === 0) {
      return <div style={{ padding: '8px 0', color: '#999', textAlign: 'center' }}>暂无物资明细</div>;
    }
    const subColumns = [
      { title: '物资名称', dataIndex: ['materials', 'name'], key: 'name', width: 160, render: (v: any) => v || '-' },
      { title: '物资编码', dataIndex: ['materials', 'code'], key: 'code', width: 120, render: (v: any) => v || '-' },
      { title: '单位', dataIndex: ['materials', 'unit'], key: 'unit', width: 80, render: (v: any) => v || '-' },
      { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
      { title: '备注', dataIndex: 'remark', key: 'remark', render: (v: any) => v || '-' },
    ];
    return (
      <Table
        rowKey="id"
        columns={subColumns}
        dataSource={items}
        pagination={false}
        size="small"
        style={{ background: '#fafafa' }}
        summary={() => {
          const totalQty = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}><strong>合计</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1}><strong>{totalQty}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          );
        }}
      />
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>废旧物资回收</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增回收单</Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select placeholder="选择状态" allowClear style={{ width: 140 }} value={selectedStatus} onChange={(v) => { setSelectedStatus(v); fetchData(1); }}>
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="pending">待确认</Select.Option>
          <Select.Option value="completed">已完成</Select.Option>
        </Select>
        <RangePicker placeholder={['开始日期', '结束日期']} style={{ width: 250 }} onChange={(dates) => { setDateRange(dates as any); if (dates && dates[0] && dates[1]) fetchData(1); }} />
        <Button onClick={() => { setSelectedStatus(''); setDateRange(null); fetchData(1); }}>重置</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        expandable={{ expandedRowRender, rowExpandable: (record) => (record.recycle_items?.length || 0) > 0 }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="新增回收单"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setItems([]); }}
        width={900}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="recycler" label="回收人" rules={[{ required: true, message: '请输入回收人' }]}>
                <Input placeholder="请输入回收人姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请输入操作人' }]}>
                <Input placeholder="自动填入" readOnly />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="recycle_date" label="回收日期" rules={[{ required: true, message: '请选择回收日期' }]}>
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>
              回收物资明细 <span style={{ color: '#ff4d4f' }}>*</span>
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddItem}>添加物资</Button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 4, padding: '0 38px 0 30px', color: '#666', fontSize: 12 }}>
            <span style={{ flex: 2 }}>物资名称</span>
            <span style={{ width: 110 }}>数量</span>
            <span style={{ width: 32 }}></span>
          </div>

          <div style={{ marginBottom: 16 }}>
            {items.map((item, index) => {
              const selectedMat = materials.find(m => m.id === item.material_id);
              const unit = selectedMat?.unit || '个';
              // 只显示有出库记录的物资
              const outboundMaterials = materials.filter(m => (outboundQuantities[m.id] || 0) > 0);
              return (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ width: 28, textAlign: 'center', color: '#999', flexShrink: 0 }}>{index + 1}.</span>
                  <div style={{ flex: 2 }}>
                    <Select
                      placeholder={outboundMaterials.length === 0 ? '无已出库物资' : '选择物资'}
                      value={item.material_id || undefined}
                      onChange={(value) => handleItemChange(index, 'material_id', value)}
                      showSearch
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                      notFoundContent="暂无已出库物资，请先完成出库操作"
                    >
                      {outboundMaterials.map((m: any) => (
                        <Option key={m.id} value={m.id}>
                          {m.name}（{m.code}）出库: {outboundQuantities[m.id]}{m.unit || '个'}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div style={{ width: 110 }}>
                    <InputNumber
                      placeholder="数量"
                      value={item.quantity}
                      onChange={(value) => handleItemChange(index, 'quantity', value)}
                      min={1}
                      max={item.material_id ? (outboundQuantities[item.material_id] || 0) : undefined}
                      style={{ width: '100%' }}
                      addonAfter={unit}
                    />
                  </div>
                  <Button
                    type="link" danger icon={<MinusCircleOutlined />}
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    style={{ flexShrink: 0 }}
                  />
                </div>
              );
            })}

            {items.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#999', border: '1px dashed #d9d9d9', borderRadius: 6 }}>
                暂无物资明细，请点击"添加物资"按钮
              </div>
            )}
          </div>

          <Divider />
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RecyclePage;
