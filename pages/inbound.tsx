import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, Popconfirm, Row, Col, Upload, Divider, DatePicker, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, CheckOutlined, SendOutlined, DownloadOutlined, UploadOutlined, MinusCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { getInboundOrders, createInboundOrder, updateInboundOrder, updateInboundOrderStatus, deleteInboundOrder, approveInboundOrder, getSuppliers, getMaterials, getInventories, getCurrentUser, supabase } from '@/lib/supabase';
import { downloadCSV, downloadTemplate, csvToObjects } from '@/lib/importExport';

const { Title } = Typography;
const { Option } = Select;

const InboundPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // 批量操作选中的行
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (dateRange?.[0]) params.startDate = dateRange[0].format?.('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format?.('YYYY-MM-DD');
      const result = await getInboundOrders(params);
      
      // 将入库单和物资明细展开为扁平结构
      const flatData: any[] = [];
      const orders = result || [];
      
      for (const order of orders) {
        const items = order.inbound_items || [];
        if (items.length === 0) {
          flatData.push({
            ...order,
            material_name: '-',
            material_quantity: '-',
          });
        } else {
          for (const item of items) {
            flatData.push({
              ...order,
              material_name: item.materials?.name || '未知物资',
              material_quantity: `${item.quantity}个`,
              _item: item,
            });
          }
        }
      }
      
      setData(flatData);
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
      // 获取供应商列表
      const supRes = await getSuppliers({ pageSize: 1000 });
      setSuppliers(supRes?.data || []);
      
      // 获取物资列表
      const matRes = await getMaterials({ pageSize: 1000 });
      const materialsList = matRes?.data || [];
      
      // 获取库存数据
      const invRes = await getInventories();
      const inventoryMap = new Map();
      if (invRes) {
        invRes.forEach((inv: any) => {
          inventoryMap.set(inv.material_id, inv.quantity);
        });
      }
      
      // 将库存信息合并到物资列表中
      const materialsWithInventory = materialsList.map((mat: any) => ({
        ...mat,
        inventory: {
          quantity: inventoryMap.get(mat.id) || 0,
        },
      }));
      
      setMaterials(materialsWithInventory);
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  useEffect(() => { 
    fetchData(); 
    fetchOptions(); 
    loadCurrentUser();
  }, []);

  // 加载当前登录用户
  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    fetchData(1);
  };

  // 日期范围变化
  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      fetchData(1);
    }
  };

  const handleAdd = () => { 
    form.resetFields(); 
    setItems([{ material_id: '', quantity: 0, unit_price: 0, total_amount: 0 }]);
    // 自动填人操作人
    if (currentUser?.full_name) {
      form.setFieldsValue({ operator: currentUser.full_name });
    }
    setModalOpen(true); 
  };

  // 添加物资明细行
  const handleAddItem = () => {
    setItems([...items, { material_id: '', quantity: 0, unit_price: 0, total_amount: 0 }]);
  };

  // 删除物资明细行
  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // 更新物资明细
  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // 自动计算总价
    if (field === 'quantity' || field === 'unit_price') {
      const qty = Number(newItems[index].quantity) || 0;
      const price = Number(newItems[index].unit_price) || 0;
      newItems[index].total_amount = qty * price;
    }
    
    setItems(newItems);
  };

  // 计算总金额
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

  const handleApprove = async (id: number) => {
    try {
      await approveInboundOrder(id);
      message.success('审批通过，库存已更新');
      fetchData();
    } catch (error: any) {
      message.error(error.message || '审批失败');
    }
  };

  // 提交审批（将草稿状态改为待审批）
  const handleSubmitApproval = async (id: number) => {
    console.log('🔵 前端：开始提交审批，ID:', id);
    try {
      const result = await updateInboundOrderStatus(id, 'pending');
      console.log('✅ 前端：提交审批成功，返回数据:', result);
      message.success('已提交审批');
      fetchData();
    } catch (error: any) {
      console.error('❌ 前端：提交审批失败:', error);
      message.error('提交失败: ' + (error.message || '请稍后重试'));
    }
  };

  const handleDelete = async (id: number) => {
    try { await deleteInboundOrder(id); message.success('删除成功'); fetchData(); }
    catch { message.error('删除失败'); }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }
    try {
      const promises = selectedRows.map(row => deleteInboundOrder(row.id));
      await Promise.all(promises);
      message.success(`成功删除 ${selectedRows.length} 条记录`);
      setSelectedRows([]);
      fetchData();
    } catch {
      message.error('批量删除失败');
    }
  };

  // 批量提交审批 - 添加错误隔离
  const handleBatchSubmit = async () => {
    if (selectedRows.length === 0) {
      message.warning('请选择要提交的记录');
      return;
    }
    const draftRows = selectedRows.filter(row => row.status === 'draft');
    if (draftRows.length === 0) {
      message.warning('请选择草稿状态的记录');
      return;
    }
    
    message.loading({ content: `正在提交 ${draftRows.length} 条记录...`, key: 'batch-submit', duration: 0 });
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const row of draftRows) {
        try {
          await updateInboundOrderStatus(row.id, 'pending');
          successCount++;
        } catch (error: any) {
          console.error(`提交记录 ${row.id} 失败:`, error.message);
          failCount++;
        }
      }
      
      message.success({ 
        content: `成功提交 ${successCount} 条记录审批${failCount > 0 ? `，${failCount} 条失败` : ''}`, 
        key: 'batch-submit', 
        duration: 2 
      });
      setSelectedRows([]);
      fetchData();
    } catch (error: any) {
      console.error('批量提交失败:', error.message);
      message.error({ content: `批量提交失败`, key: 'batch-submit', duration: 3 });
    }
  };

  // 一键提交审批所有草稿单据 - 添加错误隔离
  const handleQuickSubmitAll = async () => {
    const draftOrders = data.filter(row => row.status === 'draft');
    if (draftOrders.length === 0) {
      message.warning('没有待提交的单据');
      return;
    }
    
    message.loading({ content: `正在提交 ${draftOrders.length} 条记录...`, key: 'quick-submit', duration: 0 });
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const row of draftOrders) {
        try {
          await updateInboundOrderStatus(row.id, 'pending');
          successCount++;
        } catch (error: any) {
          console.error(`提交记录 ${row.id} 失败:`, error.message);
          failCount++;
        }
      }
      
      message.success({ 
        content: `一键提交完成，成功 ${successCount} 条记录${failCount > 0 ? `，${failCount} 条失败` : ''}`, 
        key: 'quick-submit', 
        duration: 2 
      });
      fetchData();
    } catch (error: any) {
      console.error('一键提交失败:', error.message);
      message.error({ content: `一键提交失败`, key: 'quick-submit', duration: 3 });
    }
  };

  // 批量审批 - 添加错误隔离
  const handleBatchApprove = async () => {
    if (selectedRows.length === 0) {
      message.warning('请选择要审批的记录');
      return;
    }
    const pendingRows = selectedRows.filter(row => row.status === 'pending');
    if (pendingRows.length === 0) {
      message.warning('请选择待审批状态的记录');
      return;
    }
    
    message.loading({ content: `正在审批 ${pendingRows.length} 条记录...`, key: 'batch-approve', duration: 0 });
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const row of pendingRows) {
        try {
          await approveInboundOrder(row.id);
          successCount++;
        } catch (error: any) {
          console.error(`审批记录 ${row.id} 失败:`, error.message);
          failCount++;
        }
      }
      
      message.success({ 
        content: `成功审批 ${successCount} 条记录${failCount > 0 ? `，${failCount} 条失败` : ''}`, 
        key: 'batch-approve', 
        duration: 2 
      });
      setSelectedRows([]);
      fetchData();
    } catch (error: any) {
      console.error('批量审批失败:', error.message);
      message.error({ content: `批量审批失败`, key: 'batch-approve', duration: 3 });
    }
  };

  // 一键审批所有待审批单据 - 添加错误隔离
  const handleQuickApproveAll = async () => {
    const pendingOrders = data.filter(row => row.status === 'pending');
    if (pendingOrders.length === 0) {
      message.warning('没有待审批的单据');
      return;
    }
    
    message.loading({ content: `正在审批 ${pendingOrders.length} 条记录...`, key: 'quick-approve', duration: 0 });
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const row of pendingOrders) {
        try {
          await approveInboundOrder(row.id);
          successCount++;
        } catch (error: any) {
          console.error(`审批记录 ${row.id} 失败:`, error.message);
          failCount++;
        }
      }
      
      message.success({ 
        content: `一键审批完成，成功 ${successCount} 条记录${failCount > 0 ? `，${failCount} 条失败` : ''}`, 
        key: 'quick-approve', 
        duration: 2 
      });
      fetchData();
    } catch (error: any) {
      console.error('一键审批失败:', error.message);
      message.error({ content: `一键审批失败`, key: 'quick-approve', duration: 3 });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 验证物资明细
      if (items.length === 0) {
        message.warning('请至少添加一项物资');
        return;
      }
      
      const validItems = items.filter(item => item.material_id && item.quantity > 0);
      if (validItems.length === 0) {
        message.warning('请至少填写一项有效的物资明细');
        return;
      }
      
      // 创建入库单
      const orderData = {
        supplier_id: values.supplier_id,
        operator: values.operator,
        remark: values.remark,
        items: validItems.map(item => ({
          material_id: item.material_id,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          total_amount: item.total_amount || 0,
        })),
      };
      
      await createInboundOrder(orderData);
      message.success('创建成功');
      setModalOpen(false);
      setItems([]);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '创建失败');
    }
  };

  // 导出数据
  const handleExport = () => {
    const columns = [
      { key: 'order_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'operator', label: '操作人' },
      { key: 'status', label: '状态' },
      { key: 'remark', label: '备注' },
      { key: 'created_at', label: '创建时间' },
    ];
    const exportData = data.map(item => ({
      order_no: item.order_no,
      supplier_name: item.suppliers?.name || '',
      operator: item.operator,
      status: item.status,
      remark: item.remark || '',
      created_at: new Date(item.created_at).toLocaleString(),
    }));
    downloadCSV(exportData, columns, '入库记录');
    message.success('导出成功');
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const columns = [
      { key: 'order_no', label: '入库单号' },
      { key: 'supplier_id', label: '供应商ID' },
      { key: 'operator', label: '操作人' },
      { key: 'status', label: '状态' },
      { key: 'remark', label: '备注' },
    ];
    downloadTemplate(columns, '入库记录导入模板');
    message.success('模板下载成功');
  };


  // 读取文件内容为文本
  const readFileText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // 处理文件导入
  const handleImport = async () => {
    if (!selectedFile) {
      message.warning('请选择文件');
      return;
    }

    try {
      const text = await readFileText(selectedFile);
      const items = csvToObjects(text, [
        { key: 'order_no', label: '入库单号' },
        { key: 'supplier_id', label: '供应商ID' },
        { key: 'operator', label: '操作人' },
        { key: 'status', label: '状态' },
        { key: 'remark', label: '备注' },
      ]);

      if (items.length === 0) {
        message.error('文件中没有有效数据');
        return;
      }

      // 批量插入
      const { error } = await supabase
        .from('inbound_orders')
        .insert(items.map((item: any) => ({
          ...item,
          status: item.status || 'draft',
        })));

      if (error) throw error;

      message.success(`成功导入 ${items.length} 条入库记录`);
      setImportModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '导入失败');
    }
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    pending: { color: 'processing', text: '待审批' },
    approved: { color: 'success', text: '已审批' },
    completed: { color: 'blue', text: '已完成' },
  };

  const columns = [
    { title: '入库单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
    { title: '供应商', dataIndex: ['suppliers', 'name'], key: 'supplier', width: 150 },
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
      title: '数量',
      dataIndex: 'material_quantity',
      key: 'material_quantity',
      width: 100,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (date: string) => new Date(date).toLocaleString() },
    {
      title: '操作', key: 'action', width: 280, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'draft' && (
            <Popconfirm title="确认提交审批?" onConfirm={() => handleSubmitApproval(record.id)}>
              <Button type="link" size="small" icon={<SendOutlined />}>提交审批</Button>
            </Popconfirm>
          )}
          {record.status === 'pending' && (
            <Popconfirm title="确认审批通过?" onConfirm={() => handleApprove(record.id)}>
              <Button type="link" size="small" icon={<CheckOutlined />}>审批</Button>
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

  const rowSelection = {
    selectedRowKeys: selectedRows.map(row => row.id),
    onChange: (selectedRowKeys: React.Key[], selectedRows: any[]) => {
      setSelectedRows(selectedRows);
    },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>入库管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
          <Button icon={<UploadOutlined />} type="primary" onClick={() => setImportModalOpen(true)}>导入数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增入库单</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={handleQuickSubmitAll}>
            一键提交
          </Button>
          <Button type="primary" danger icon={<CheckOutlined />} onClick={handleQuickApproveAll}>
            一键审批
          </Button>
          {selectedRows.length > 0 && (
            <Space.Compact>
              <Button type="default" icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                批量删除 ({selectedRows.length})
              </Button>
              <Button type="default" icon={<SendOutlined />} onClick={handleBatchSubmit}>
                批量提交
              </Button>
              <Button type="default" icon={<CheckOutlined />} onClick={handleBatchApprove}>
                批量审批
              </Button>
            </Space.Compact>
          )}
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
          <Select.Option value="pending">待审批</Select.Option>
          <Select.Option value="approved">已审批</Select.Option>
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
        rowSelection={rowSelection}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          showPrevNextButtons: true, showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize) }} />

      <Modal 
        title="新增入库单" 
        open={modalOpen} 
        onOk={handleSubmit} 
        onCancel={() => { setModalOpen(false); setItems([]); }} 
        width={1000}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
                <Select 
                  placeholder="请选择供应商" 
                  showSearch 
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {suppliers.map((s: any) => (
                    <Option key={s.id} value={s.id}>{s.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请输入操作人' }]}>
                <Input placeholder="自动填入" readOnly />
              </Form.Item>
            </Col>
          </Row>
          
          {/* 物资明细表头 */}
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>
              入库物资明细 <span style={{ color: '#ff4d4f' }}>*</span>
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddItem}>
              添加物资
            </Button>
          </div>
          
          {/* 物资明细表格 */}
          <div style={{ marginBottom: 16 }}>
            {items.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ width: 30, textAlign: 'center', color: '#999' }}>{index + 1}.</span>
                <div style={{ flex: 2 }}>
                  <Select
                    placeholder="选择物资"
                    value={item.material_id}
                    onChange={(value) => handleItemChange(index, 'material_id', value)}
                    showSearch
                    optionFilterProp="children"
                    style={{ width: '100%' }}
                  >
                    {materials.map((m: any) => (
                      <Option key={m.id} value={m.id}>
                        {m.name} ({m.code}) - 库存: {m.inventory?.quantity || 0}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div style={{ width: 100 }}>
                  <InputNumber
                    placeholder="数量"
                    value={item.quantity}
                    onChange={(value) => handleItemChange(index, 'quantity', value)}
                    min={1}
                    style={{ width: '100%' }}
                    addonAfter="个"
                  />
                </div>
                <div style={{ width: 120 }}>
                  <InputNumber
                    placeholder="单价"
                    value={item.unit_price}
                    onChange={(value) => handleItemChange(index, 'unit_price', value)}
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    addonAfter="元"
                  />
                </div>
                <div style={{ width: 120 }}>
                  <InputNumber
                    placeholder="总价"
                    value={item.total_amount}
                    disabled
                    precision={2}
                    style={{ width: '100%' }}
                    addonAfter="元"
                  />
                </div>
                <Button 
                  type="link" 
                  danger 
                  icon={<MinusCircleOutlined />} 
                  onClick={() => handleRemoveItem(index)}
                  disabled={items.length === 1}
                />
              </div>
            ))}
            
            {items.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#999', border: '1px dashed #d9d9d9', borderRadius: 6 }}>
                暂无物资明细，请点击"添加物资"按钮
              </div>
            )}
            
            {/* 合计行 */}
            {items.some(item => item.quantity > 0) && (
              <div style={{ marginTop: 8, textAlign: 'right', padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                <span style={{ fontWeight: 500 }}>合计：{items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0).toFixed(2)} 元</span>
              </div>
            )}
          </div>
          
          <Divider />
          
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入入库记录"
        open={importModalOpen}
        onOk={() => handleImport()}
        onCancel={() => setImportModalOpen(false)}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="导入说明"
            description="1. 请先下载导入模板 2. 按照模板格式填写数据 3. CSV 文件请使用 UTF-8 编码保存（记事本另存为时选择 UTF-8）"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ marginBottom: 16 }}>下载导入模板</Button>
        </div>
        <div style={{ border: '2px dashed #d9d9d9', borderRadius: 6, padding: 24, textAlign: 'center', cursor: 'pointer', backgroundColor: '#fafafa' }}
             onClick={() => fileInputRef.current?.click()}>
          <p style={{ fontSize: 48, margin: 0 }}><UploadOutlined /></p>
          <p style={{ margin: '8px 0 0 0' }}>点击选择 CSV 文件</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file instanceof File) {
              setSelectedFile(file);
              message.success('文件已选择，请点击"导入"按钮');
            }
            e.target.value = '';
          }}
        />
      </Modal>
    </div>
  );
};

export default InboundPage;
