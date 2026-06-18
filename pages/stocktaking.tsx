import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, DatePicker, Row, Col, Divider, Alert, Steps, Radio } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, DownloadOutlined, SearchOutlined, SaveOutlined, SendOutlined, FileTextOutlined } from '@ant-design/icons';
import { getStocktakingOrders, createStocktakingOrder, updateStocktakingOrder, getMaterials, getInventories, getCurrentUser } from '@/lib/supabase';
import { downloadCSV } from '@/lib/importExport';

const { Title } = Typography;
const { Option } = Select;

// 盘点状态映射常量
const STOCKTAKING_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  in_progress: { color: 'processing', text: '盘点中' },
  completed: { color: 'success', text: '已完成' },
};

interface StocktakingItem {
  material_id: string;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  remark: string;
}

const StocktakingPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [inventories, setInventories] = useState<Map<number, number>>(new Map());
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // 盘点创建步骤
  const [currentStep, setCurrentStep] = useState(0);
  const [stocktakingForm] = Form.useForm();
  const [selectedMaterials, setSelectedMaterials] = useState<string>('all'); // 'all' or 'custom'
  const [customMaterials, setCustomMaterials] = useState<number[]>([]);
  const [stocktakingItems, setStocktakingItems] = useState<StocktakingItem[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentStocktaking, setCurrentStocktaking] = useState<any>(null);
  const [actualQuantities, setActualQuantities] = useState<Map<number, number>>(new Map());
  const [itemRemarks, setItemRemarks] = useState<Map<number, string>>(new Map());

  // 加载当前用户
  useEffect(() => {
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

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      const result = await getStocktakingOrders(params);
      
      // 展开为扁平结构
      const flatData: any[] = [];
      const orders = result || [];
      
      for (const order of orders) {
        const items = order.stocktaking_items || [];
        if (items.length === 0) {
          flatData.push({
            ...order,
            material_name: '-',
            material_quantity: '-',
            difference: '-',
          });
        } else {
          for (const item of items) {
            flatData.push({
              ...order,
              material_name: item.materials?.name || '未知物资',
              material_quantity: `${item.actual_quantity || 0}个`,
              difference: item.difference || 0,
            });
          }
        }
      }
      
      setData(flatData);
      setPagination(prev => ({ ...prev, current: page, pageSize }));
    } catch { message.error('获取数据失败'); }
    finally { setLoading(false); }
  };

  const fetchOptions = async () => {
    try {
      const matRes = await getMaterials({ pageSize: 1000 });
      setMaterials(matRes || []);
      
      // 获取库存数据
      const invRes = await getInventories();
      const invMap = new Map<number, number>();
      if (invRes) {
        invRes.forEach((inv: any) => {
          invMap.set(inv.material_id, inv.quantity);
        });
      }
      setInventories(invMap);
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  useEffect(() => { 
    fetchData(); 
    fetchOptions(); 
  }, []);

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    fetchData(1);
  };

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      fetchData(1);
    }
  };

  // 创建盘点单 - 简化逻辑
  const handleCreateStocktaking = async () => {
    try {
      const values = await stocktakingForm.validateFields();
      
      // 确定盘点物资列表
      let targetMaterials: any[] = [];
      if (selectedMaterials === 'all') {
        targetMaterials = materials.filter((m: any) => (inventories.get(m.id) || 0) > 0);
      } else {
        targetMaterials = materials.filter((m: any) => customMaterials.includes(m.id));
      }
      
      if (targetMaterials.length === 0) {
        message.warning('没有需要盘点的物资');
        return;
      }
      
      // 准备盘点明细
      const items: any[] = targetMaterials.map((mat: any) => ({
        material_id: mat.id,
        system_quantity: inventories.get(mat.id) || 0,
        actual_quantity: actualQuantities.get(mat.id) || 0,
        difference: 0,
        remark: itemRemarks.get(mat.id) || '',
      }));
      
      // 创建盘点单
      const orderData = {
        operator: values.operator || currentUser?.full_name || '管理员',
        remark: values.remark,
        items,
      };
      
      await createStocktakingOrder(orderData);
      message.success(`盘点单创建成功，共${items.length}项物资`);
      setCreateModalOpen(false);
      setCurrentStep(0);
      stocktakingForm.resetFields();
      setCustomMaterials([]);
      setActualQuantities(new Map());
      setItemRemarks(new Map());
      fetchData();
    } catch (error: any) {
      console.error('创建盘点单失败:', error);
      if (error.errorFields && error.errorFields.length > 0) {
        message.warning('请填写完整的表单信息');
      } else {
        message.error(error.message || '创建失败');
      }
    }
  };

  // 查看盘点明细
  const handleViewDetails = async (record: any) => {
    try {
      const result = await getStocktakingOrders({ page: 1, pageSize: 1000 });
      const orders = Array.isArray(result) ? result : (result?.data || []);
      const stocktaking = orders.find((s: any) => s.id === record.id);
      
      if (!stocktaking) {
        message.warning('盘点单不存在');
        return;
      }
      
      setCurrentStocktaking(stocktaking);
      setDetailModalOpen(true);
    } catch (error: any) {
      console.error('获取盘点明细失败:', error.message);
      message.error('获取盘点明细失败');
    }
  };

  // 完成盘点
  const handleComplete = async (id: number) => {
    try {
      const result = await getStocktakingOrders({ page: 1, pageSize: 1000 });
      const orders = Array.isArray(result) ? result : (result?.data || []);
      const stocktaking = orders.find((s: any) => s.id === id);
      
      if (!stocktaking) {
        message.error('盘点单不存在');
        return;
      }
      
      const items = stocktaking.stocktaking_items || [];
      const hasActualQuantity = items.every((item: any) => item.actual_quantity > 0);
      
      if (!hasActualQuantity) {
        message.warning('请确保所有物资都已填写实际盘点数量');
        return;
      }
      
      // 计算差异并更新
      const updatedItems = items.map((item: any) => ({
        ...item,
        difference: (item.actual_quantity || 0) - (item.system_quantity || 0),
      }));
      
      await updateStocktakingOrder(id, { 
        status: 'completed',
        items: updatedItems,
      });
      
      message.success('盘点完成，差异已计算');
      fetchData();
    } catch (error: any) {
      console.error('完成盘点失败:', error.message);
      message.error('操作失败');
    }
  };

  // 导出盘点数据
  const handleExport = () => {
    const columns = [
      { key: 'order_no', label: '盘点单号' },
      { key: 'material_name', label: '物资名称' },
      { key: 'system_quantity', label: '系统库存' },
      { key: 'material_quantity', label: '实际盘点' },
      { key: 'difference', label: '差异' },
      { key: 'status', label: '状态' },
      { key: 'created_at', label: '创建时间' },
    ];
    const exportData = data.map(item => ({
      order_no: item.order_no,
      material_name: item.material_name,
      system_quantity: '-',
      material_quantity: item.material_quantity,
      difference: item.difference,
      status: item.status,
      created_at: new Date(item.created_at).toLocaleString(),
    }));
    downloadCSV(exportData, columns, '盘点记录');
    message.success('导出成功');
  };

  const statusMap = STOCKTAKING_STATUS_MAP;

  const columns = [
    { title: '盘点单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => { const st = statusMap[s] || { color: 'default', text: s }; return <Tag color={st.color}>{st.text}</Tag>; },
    },
    {
      title: '物资名称',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 150,
    },
    {
      title: '实际数量',
      dataIndex: 'material_quantity',
      key: 'material_quantity',
      width: 100,
    },
    {
      title: '差异',
      dataIndex: 'difference',
      key: 'difference',
      width: 80,
      render: (diff: number) => {
        if (diff > 0) return <span style={{ color: '#ff4d4f' }}>+{diff}</span>;
        if (diff < 0) return <span style={{ color: '#52c41a' }}>{diff}</span>;
        return '-';
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (date: string) => new Date(date).toLocaleString() },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleViewDetails(record)}>查看明细</Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record.id)}>完成</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>盘点管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCurrentStep(0); setCreateModalOpen(true); }}>
            创建盘点单
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          placeholder="选择状态"
          allowClear
          style={{ width: 140 }}
          value={selectedStatus}
          onChange={handleStatusChange}
        >
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="in_progress">盘点中</Select.Option>
          <Select.Option value="completed">已完成</Select.Option>
        </Select>
        <DatePicker.RangePicker
          placeholder={['开始日期', '结束日期']}
          style={{ width: 250 }}
          onChange={handleDateRangeChange}
        />
        <Button onClick={() => { setSelectedStatus(''); setDateRange(null); fetchData(1); }}>重置</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          showPrevNextButtons: true, showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize) }} />

      {/* 创建盘点单模态框 */}
      <Modal
        title="创建盘点单"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); setCurrentStep(0); }}
        width={800}
        footer={null}
      >
        <Steps
          current={currentStep}
          style={{ marginBottom: 24 }}
          items={[
            { title: '选择物资' },
            { title: '填写盘点数量' },
            { title: '确认创建' },
          ]}
        />

        {currentStep === 0 && (
          <div>
            <Alert
              message="提示"
              description="选择要盘点的物资范围。可以选择所有有库存的物资，或手动选择特定物资。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form form={stocktakingForm} layout="vertical">
              <Form.Item name="operator" label="操作人" initialValue={currentUser?.full_name || '管理员'}>
                <Input placeholder="请输入操作人姓名" />
              </Form.Item>
              
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="请输入备注信息（可选）" />
              </Form.Item>

              <Form.Item label="选择物资范围" required>
                <Radio.Group 
                  value={selectedMaterials} 
                  onChange={(e) => setSelectedMaterials(e.target.value)}
                  style={{ marginBottom: 16 }}
                >
                  <Radio value="all">所有有库存的物资</Radio>
                  <Radio value="custom">手动选择物资</Radio>
                </Radio.Group>
              </Form.Item>

              {selectedMaterials === 'custom' && (
                <Form.Item label="选择物资" required>
                  <Select
                    mode="multiple"
                    placeholder="请选择要盘点的物资"
                    style={{ width: '100%' }}
                    value={customMaterials}
                    onChange={setCustomMaterials}
                    showSearch
                    optionFilterProp="children"
                  >
                    {materials.map((m: any) => (
                      <Option key={m.id} value={m.id}>
                        {m.name} ({m.code}) - 库存: {inventories.get(m.id) || 0}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
            </Form>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setDetailModalOpen(false)} style={{ marginRight: 8 }}>
                取消
              </Button>
              <Button 
                type="primary"
                onClick={() => {
                  // 在进入第二步前，初始化盘点物品列表
                  const items: StocktakingItem[] = [];
                  const sourceMaterials = selectedMaterials === 'all'
                    ? materials.filter((m: any) => (inventories.get(m.id) || 0) > 0)
                    : materials.filter((m: any) => customMaterials.includes(m.id));
                  
                  if (sourceMaterials.length === 0) {
                    message.warning('没有可盘点的物资，请选择有库存的物资');
                    return;
                  }
                  
                  sourceMaterials.forEach((mat: any) => {
                    items.push({
                      material_id: mat.id,
                      system_quantity: inventories.get(mat.id) || 0,
                      actual_quantity: 0,
                      difference: 0,
                      remark: '',
                    });
                  });
                  
                  setStocktakingItems(items);
                  setCurrentStep(1);
                }} 
              >
                下一步
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Alert
              message="提示"
              description="请根据实际情况填写每个物资的实际盘点数量。系统库存为当前账面数量。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            {stocktakingItems.length === 0 && (
              <Alert
                message="请先在第一步选择物资"
                description="请先返回第一步选择要盘点的物资范围，然后再填写实际盘点数量。"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <Table
                rowKey="material_id"
                columns={[
                  { title: '物资名称', dataIndex: ['name'], width: 200 },
                  { title: '系统库存', dataIndex: ['inventory', 'quantity'], width: 100, render: (qty: number, record: any) => inventories.get(record.id) || 0 },
                  { 
                    title: '实际盘点', 
                    key: 'actual',
                    width: 150,
                    render: (_: any, record: any) => (
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        placeholder="请输入实际数量"
                        addonAfter="个"
                        defaultValue={actualQuantities.get(record.id) || 0}
                        onChange={(value) => {
                          const newMap = new Map(actualQuantities);
                          newMap.set(record.id, value || 0);
                          setActualQuantities(newMap);
                        }}
                      />
                    ),
                  },
                  { 
                    title: '备注', 
                    dataIndex: ['remark'], 
                    width: 200, 
                    render: (_: any, record: any) => (
                      <Input
                        placeholder="可选"
                        defaultValue={itemRemarks.get(record.id) || ''}
                        onChange={(e) => {
                          const newMap = new Map(itemRemarks);
                          newMap.set(record.id, e.target.value);
                          setItemRemarks(newMap);
                        }}
                      />
                    ),
                  },
                ]}
                dataSource={
                  selectedMaterials === 'all'
                    ? materials.filter((m: any) => (inventories.get(m.id) || 0) > 0).map((m: any) => ({ ...m, inventory: { quantity: inventories.get(m.id) || 0 } }))
                    : materials.filter((m: any) => customMaterials.includes(m.id)).map((m: any) => ({ ...m, inventory: { quantity: inventories.get(m.id) || 0 } }))
                }
                pagination={false}
                size="small"
              />
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>
                上一步
              </Button>
              <Button type="primary" onClick={() => setCurrentStep(2)}>
                下一步
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <Alert
              message="确认创建"
              description={'请确认以下信息无误后点击"创建"按钮。'}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>操作人：</strong>{stocktakingForm.getFieldValue('operator') || currentUser?.full_name}</p>
              <p><strong>物资范围：</strong>{selectedMaterials === 'all' ? '所有有库存的物资' : `手动选择 ${customMaterials.length} 项物资`}</p>
              <p><strong>物资数量：</strong>{
                selectedMaterials === 'all'
                  ? materials.filter((m: any) => (inventories.get(m.id) || 0) > 0).length
                  : customMaterials.length
              } 项</p>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCurrentStep(1)} style={{ marginRight: 8 }}>
                上一步
              </Button>
              <Button type="primary" onClick={handleCreateStocktaking}>
                创建盘点单
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 盘点明细模态框 */}
      <Modal
        title={`盘点单明细 - ${currentStocktaking?.order_no}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={1000}
        footer={null}
      >
        {currentStocktaking && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">单号：{currentStocktaking.order_no}</Tag>
              <Tag>操作人：{currentStocktaking.operator}</Tag>
              <Tag color={statusMap[currentStocktaking.status]?.color || 'default'}>
                {statusMap[currentStocktaking.status]?.text || currentStocktaking.status}
              </Tag>
              <Tag>创建时间：{new Date(currentStocktaking.created_at).toLocaleString()}</Tag>
            </div>

            <Divider />

            <Table
              rowKey="id"
              columns={[
                { title: '物资名称', dataIndex: ['materials', 'name'], width: 150 },
                { title: '系统库存', dataIndex: ['system_quantity'], width: 100 },
                { title: '实际盘点', dataIndex: ['actual_quantity'], width: 100 },
                { 
                  title: '差异', 
                  dataIndex: ['difference'],
                  width: 80,
                  render: (diff: number) => {
                    if (diff > 0) return <span style={{ color: '#ff4d4f' }}>+{diff}</span>;
                    if (diff < 0) return <span style={{ color: '#52c41a' }}>{diff}</span>;
                    return '-';
                  },
                },
                { title: '备注', dataIndex: ['remark'], width: 200 },
              ]}
              dataSource={currentStocktaking.stocktaking_items || []}
              pagination={false}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StocktakingPage;
