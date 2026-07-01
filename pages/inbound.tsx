import React, { useEffect, useState, useRef } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, Popconfirm, Row, Col, Divider, DatePicker, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, CheckOutlined, SendOutlined, DownloadOutlined, UploadOutlined, MinusCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import { getInboundOrders, createInboundOrder, updateInboundOrderStatus, deleteInboundOrder, approveInboundOrder, getSuppliers, getMaterials, getInventories, getCurrentUser, supabase } from '@/lib/supabase';
import { downloadCSV, downloadTemplate, csvToObjects, printMaterials, exportTableAsHTML } from '@/lib/importExport';

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
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (dateRange?.[0]) params.startDate = dateRange[0].format?.('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format?.('YYYY-MM-DD');
      const result = await getInboundOrders(params);
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
      const supRes = await getSuppliers({ pageSize: 1000 });
      setSuppliers(supRes?.data || []);

      const matRes = await getMaterials({ pageSize: 1000 });
      const materialsList = matRes?.data || [];

      const invRes = await getInventories();
      const inventoryMap = new Map();
      if (invRes) {
        invRes.forEach((inv: any) => {
          inventoryMap.set(inv.material_id, inv.quantity);
        });
      }

      const materialsWithInventory = materialsList.map((mat: any) => ({
        ...mat,
        inventory: { quantity: inventoryMap.get(mat.id) || 0 },
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

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) fetchData(1);
  };

  const handleAdd = () => {
    form.resetFields();
    setItems([{ material_id: '', quantity: 1 }]);
    if (currentUser?.full_name) {
      form.setFieldsValue({ operator: currentUser.full_name });
    }
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

  const handleApprove = async (id: number) => {
    try {
      await approveInboundOrder(id);
      message.success('审批通过，库存已更新');
      fetchData();
    } catch (error: any) {
      message.error(error.message || '审批失败');
    }
  };

  const handleSubmitApproval = async (id: number) => {
    try {
      await updateInboundOrderStatus(id, 'pending');
      message.success('已提交审批');
      fetchData();
    } catch (error: any) {
      message.error('提交失败: ' + (error.message || '请稍后重试'));
    }
  };

  const handleDelete = async (id: number) => {
    try { await deleteInboundOrder(id); message.success('删除成功'); fetchData(); }
    catch { message.error('删除失败'); }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) { message.warning('请选择要删除的记录'); return; }
    try {
      await Promise.all(selectedRows.map(row => deleteInboundOrder(row.id)));
      message.success(`成功删除 ${selectedRows.length} 条记录`);
      setSelectedRows([]);
      fetchData();
    } catch { message.error('批量删除失败'); }
  };

  const handleBatchSubmit = async () => {
    if (selectedRows.length === 0) { message.warning('请选择要提交的记录'); return; }
    const draftRows = selectedRows.filter(row => row.status === 'draft');
    if (draftRows.length === 0) { message.warning('请选择草稿状态的记录'); return; }
    message.loading({ content: `正在提交 ${draftRows.length} 条记录...`, key: 'batch-submit', duration: 0 });
    let successCount = 0, failCount = 0;
    for (const row of draftRows) {
      try { await updateInboundOrderStatus(row.id, 'pending'); successCount++; }
      catch { failCount++; }
    }
    message.success({ content: `成功提交 ${successCount} 条${failCount > 0 ? `，${failCount} 条失败` : ''}`, key: 'batch-submit', duration: 2 });
    setSelectedRows([]);
    fetchData();
  };

  const handleQuickSubmitAll = async () => {
    const draftOrders = data.filter(row => row.status === 'draft');
    if (draftOrders.length === 0) { message.warning('没有待提交的单据'); return; }
    message.loading({ content: `正在提交 ${draftOrders.length} 条记录...`, key: 'quick-submit', duration: 0 });
    let successCount = 0, failCount = 0;
    for (const row of draftOrders) {
      try { await updateInboundOrderStatus(row.id, 'pending'); successCount++; }
      catch { failCount++; }
    }
    message.success({ content: `一键提交完成，成功 ${successCount} 条${failCount > 0 ? `，${failCount} 条失败` : ''}`, key: 'quick-submit', duration: 2 });
    fetchData();
  };

  const handleBatchApprove = async () => {
    if (selectedRows.length === 0) { message.warning('请选择要审批的记录'); return; }
    const pendingRows = selectedRows.filter(row => row.status === 'pending');
    if (pendingRows.length === 0) { message.warning('请选择待审批状态的记录'); return; }
    message.loading({ content: `正在审批 ${pendingRows.length} 条记录...`, key: 'batch-approve', duration: 0 });
    let successCount = 0, failCount = 0;
    for (const row of pendingRows) {
      try { await approveInboundOrder(row.id); successCount++; }
      catch { failCount++; }
    }
    message.success({ content: `成功审批 ${successCount} 条${failCount > 0 ? `，${failCount} 条失败` : ''}`, key: 'batch-approve', duration: 2 });
    setSelectedRows([]);
    fetchData();
  };

  const handleQuickApproveAll = async () => {
    const pendingOrders = data.filter(row => row.status === 'pending');
    if (pendingOrders.length === 0) { message.warning('没有待审批的单据'); return; }
    message.loading({ content: `正在审批 ${pendingOrders.length} 条记录...`, key: 'quick-approve', duration: 0 });
    let successCount = 0, failCount = 0;
    for (const row of pendingOrders) {
      try { await approveInboundOrder(row.id); successCount++; }
      catch { failCount++; }
    }
    message.success({ content: `一键审批完成，成功 ${successCount} 条${failCount > 0 ? `，${failCount} 条失败` : ''}`, key: 'quick-approve', duration: 2 });
    fetchData();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) { message.warning('请至少添加一项物资'); return; }
      const validItems = items.filter(item => item.material_id && item.quantity > 0);
      if (validItems.length === 0) { message.warning('请至少填写一项有效的物资明细'); return; }

      await createInboundOrder({
        supplier_id: values.supplier_id,
        operator: values.operator,
        remark: values.remark,
        order_date: values.order_date?.format?.('YYYY-MM-DD'),
        items: validItems.map(item => ({
          material_id: item.material_id,
          quantity: item.quantity,
        })),
      });
      message.success('创建成功');
      setModalOpen(false);
      setItems([]);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '创建失败');
    }
  };

  // 导出为可编辑 Excel（HTML 格式）
  const handleExport = () => {
    if (data.length === 0) { message.warning('暂无数据可导出'); return; }
    const exportData: any[] = [];
    for (const order of data) {
      const orderItems = order.inbound_items || [];
      if (orderItems.length === 0) {
        exportData.push({
          order_no: order.order_no,
          supplier_name: order.suppliers?.name || '',
          operator: order.operator,
          status: statusMap[order.status]?.text || order.status,
          material_name: '',
          material_code: '',
          unit: '',
          quantity: '',
          remark: order.remark || '',
          created_at: new Date(order.created_at).toLocaleString(),
        });
      } else {
        for (const item of orderItems) {
          exportData.push({
            order_no: order.order_no,
            supplier_name: order.suppliers?.name || '',
            operator: order.operator,
            status: statusMap[order.status]?.text || order.status,
            material_name: item.materials?.name || '',
            material_code: item.materials?.code || '',
            unit: item.materials?.unit || '',
            quantity: item.quantity,
            remark: order.remark || '',
            created_at: new Date(order.created_at).toLocaleString(),
          });
        }
      }
    }
    const columns = [
      { key: 'order_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'operator', label: '操作人' },
      { key: 'status', label: '状态' },
      { key: 'material_name', label: '物资名称' },
      { key: 'material_code', label: '物资编码' },
      { key: 'unit', label: '单位' },
      { key: 'quantity', label: '数量' },
      { key: 'remark', label: '备注' },
      { key: 'created_at', label: '创建时间' },
    ];
    exportTableAsHTML(exportData, columns, '入库记录');
    message.success('导出成功');
  };

  // 打印
  const handlePrint = () => {
    if (data.length === 0) { message.warning('暂无数据可打印'); return; }
    const printData: any[] = [];
    for (const order of data) {
      const orderItems = order.inbound_items || [];
      if (orderItems.length === 0) {
        printData.push({
          order_no: order.order_no,
          supplier_name: order.suppliers?.name || '',
          operator: order.operator,
          status: statusMap[order.status]?.text || order.status,
          material_name: '',
          material_code: '',
          unit: '',
          quantity: '',
          remark: order.remark || '',
          created_at: new Date(order.created_at).toLocaleString(),
        });
      } else {
        for (const item of orderItems) {
          printData.push({
            order_no: order.order_no,
            supplier_name: order.suppliers?.name || '',
            operator: order.operator,
            status: statusMap[order.status]?.text || order.status,
            material_name: item.materials?.name || '',
            material_code: item.materials?.code || '',
            unit: item.materials?.unit || '',
            quantity: item.quantity,
            remark: order.remark || '',
            created_at: new Date(order.created_at).toLocaleString(),
          });
        }
      }
    }
    const columns = [
      { key: 'order_no', label: '入库单号' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'operator', label: '操作人' },
      { key: 'status', label: '状态' },
      { key: 'material_name', label: '物资名称' },
      { key: 'material_code', label: '物资编码' },
      { key: 'unit', label: '单位' },
      { key: 'quantity', label: '数量' },
      { key: 'remark', label: '备注' },
      { key: 'created_at', label: '创建时间' },
    ];
    printMaterials(printData, columns);
  };

  const handleDownloadTemplate = () => {
    downloadTemplate([
      { key: 'material_code', label: '物资编码' },
      { key: 'material_name', label: '物资名称' },
      { key: 'quantity', label: '数量' },
      { key: 'unit', label: '单位' },
      { key: 'supplier_name', label: '供应商' },
      { key: 'remark', label: '备注' },
    ], '入库记录导入模板');
    message.success('模板下载成功，入库单号由系统自动生成');
  };

  const readFileText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!selectedFile) { message.warning('请选择文件'); return; }
    try {
      const text = await readFileText(selectedFile);
      const rows = csvToObjects(text, [
        { key: 'material_code', label: '物资编码' },
        { key: 'material_name', label: '物资名称' },
        { key: 'quantity', label: '数量' },
        { key: 'unit', label: '单位' },
        { key: 'supplier_name', label: '供应商' },
        { key: 'remark', label: '备注' },
      ]);
      if (rows.length === 0) { message.error('文件中没有有效数据'); return; }

      // 按供应商名称分组
      const supplierGroups = new Map<string, any[]>();
      for (const row of rows) {
        const supplierName = String(row.supplier_name || '').trim();
        if (!supplierName) continue;
        if (!supplierGroups.has(supplierName)) {
          supplierGroups.set(supplierName, []);
        }
        supplierGroups.get(supplierName)!.push(row);
      }

      if (supplierGroups.size === 0) {
        message.error('文件中缺少供应商信息');
        return;
      }

      message.loading({ content: `正在导入 ${supplierGroups.size} 个供应商的入库单...`, key: 'import-inbound', duration: 0 });
      let successCount = 0;
      let failCount = 0;

      for (const [supplierName, items] of supplierGroups) {
        try {
          // 查找供应商ID
          const supplier = suppliers.find(s => s.name === supplierName);
          if (!supplier) {
            throw new Error(`供应商"${supplierName}"未找到，请先在供应商管理中创建`);
          }

          // 解析物资明细
          const orderItems: any[] = [];
          for (const item of items) {
            const materialCode = String(item.material_code || '').trim();
            const materialName = String(item.material_name || '').trim();
            const material = materials.find(m =>
              (materialCode && m.code === materialCode) ||
              (materialName && m.name === materialName)
            );
            if (!material) {
              throw new Error(`物资"${materialName}"(${materialCode})未找到，请先在物资档案中创建`);
            }
            const qty = Number(item.quantity) || 0;
            if (qty <= 0) {
              throw new Error(`物资"${material.name}"的数量必须大于0`);
            }
            orderItems.push({
              material_id: material.id,
              quantity: qty,
            });
          }

          // 创建入库单（入库单号由系统自动生成）
          await createInboundOrder({
            supplier_id: supplier.id,
            operator: currentUser?.full_name || '系统导入',
            remark: items[0]?.remark || '',
            items: orderItems,
          });
          successCount++;
        } catch (e: any) {
          failCount++;
          console.error(`导入供应商"${supplierName}"失败:`, e.message);
          message.error(`供应商"${supplierName}"导入失败: ${e.message}`);
        }
      }

      message.success({
        content: `导入完成：成功 ${successCount} 单${failCount > 0 ? `，失败 ${failCount} 单` : ''}`,
        key: 'import-inbound',
        duration: 3,
      });
      setImportModalOpen(false);
      setSelectedFile(null);
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

  // 主表格列（每行是一张入库单）
  const columns = [
    { title: '入库单号', dataIndex: 'order_no', key: 'order_no', width: 150 },
    { title: '供应商', dataIndex: ['suppliers', 'name'], key: 'supplier', width: 120, render: (v: any) => v || '-' },
    {
      title: '物资名称',
      key: 'material_names',
      width: 160,
      render: (_: any, record: any) => {
        const items = record.inbound_items || [];
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
        const items = record.inbound_items || [];
        if (items.length === 0) return '-';
        const totalQty = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
        return <span>{totalQty}</span>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => {
        const st = statusMap[s] || { color: 'default', text: s };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 80 },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 140,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作', key: 'action', width: 240, fixed: 'right' as const,
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

  // 子表格列（展开后显示物资明细）
  const expandedRowRender = (record: any) => {
    const items = record.inbound_items || [];
    if (items.length === 0) {
      return <div style={{ padding: '8px 0', color: '#999', textAlign: 'center' }}>暂无物资明细</div>;
    }
    const subColumns = [
      { title: '物资名称', dataIndex: ['materials', 'name'], key: 'name', width: 160,
        render: (v: any) => v || '-' },
      { title: '物资编码', dataIndex: ['materials', 'code'], key: 'code', width: 120,
        render: (v: any) => v || '-' },
      { title: '规格', dataIndex: ['materials', 'specification'], key: 'spec', width: 120,
        render: (v: any) => v || '-' },
      {
        title: '数量', key: 'quantity', width: 100,
        render: (_: any, item: any) => {
          const unit = item.materials?.unit || '个';
          return `${item.quantity} ${unit}`;
        },
      },
      {
        title: '备注', dataIndex: 'remark', key: 'remark', render: (v: any) => v || '-' },
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

  const rowSelection = {
    selectedRowKeys: selectedRows.map(row => row.id),
    onChange: (_keys: React.Key[], rows: any[]) => setSelectedRows(rows),
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>入库管理</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>导入数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增入库单</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={handleQuickSubmitAll}>一键提交</Button>
          <Button type="primary" danger icon={<CheckOutlined />} onClick={handleQuickApproveAll}>一键审批</Button>
          {selectedRows.length > 0 && (
            <Space.Compact>
              <Button icon={<DeleteOutlined />} onClick={handleBatchDelete}>批量删除 ({selectedRows.length})</Button>
              <Button icon={<SendOutlined />} onClick={handleBatchSubmit}>批量提交</Button>
              <Button icon={<CheckOutlined />} onClick={handleBatchApprove}>批量审批</Button>
            </Space.Compact>
          )}
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select placeholder="选择状态" allowClear style={{ width: 140 }} value={selectedStatus} onChange={handleStatusChange}>
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="pending">待审批</Select.Option>
          <Select.Option value="approved">已审批</Select.Option>
          <Select.Option value="completed">已完成</Select.Option>
        </Select>
        <DatePicker.RangePicker placeholder={['开始日期', '结束日期']} style={{ width: 250 }} onChange={handleDateRangeChange} />
        <Button onClick={() => { setSelectedStatus(''); setDateRange(null); fetchData(1); }}>重置</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection={rowSelection}
        expandable={{
          expandedRowRender,
          rowExpandable: (record) => (record.inbound_items?.length || 0) > 0,
        }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
        scroll={{ x: 1000 }}
      />

      {/* 新增入库单弹窗 */}
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
          <Col span={8}>
            <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
              <Select placeholder="请选择供应商" showSearch optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }>
                {suppliers.map((s: any) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请输入操作人' }]}>
              <Input placeholder="自动填入" readOnly />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="order_date" label="入库日期" rules={[{ required: true, message: '请选择入库日期' }]}>
              <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
            </Form.Item>
          </Col>
        </Row>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>
              入库物资明细 <span style={{ color: '#ff4d4f' }}>*</span>
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddItem}>添加物资</Button>
          </div>

          {/* 物资明细表头 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, padding: '0 38px 0 30px', color: '#666', fontSize: 12 }}>
            <span style={{ flex: 2 }}>物资名称（编码/库存）</span>
            <span style={{ width: 110 }}>数量</span>
            <span style={{ width: 32 }}></span>
          </div>

          <div style={{ marginBottom: 16 }}>
            {items.map((item, index) => {
              const selectedMat = materials.find(m => m.id === item.material_id);
              const unit = selectedMat?.unit || '个';
              return (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ width: 28, textAlign: 'center', color: '#999', flexShrink: 0 }}>{index + 1}.</span>
                  <div style={{ flex: 2 }}>
                    <Select
                      placeholder="选择物资"
                      value={item.material_id || undefined}
                      onChange={(value) => handleItemChange(index, 'material_id', value)}
                      showSearch
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                    >
                      {materials.map((m: any) => (
                        <Option key={m.id} value={m.id}>
                          {m.name}（{m.code}）库存: {m.inventory?.quantity || 0}{m.unit || '个'}
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

      {/* 导入弹窗 */}
      <Modal
        title="导入入库记录"
        open={importModalOpen}
        onOk={handleImport}
        onCancel={() => setImportModalOpen(false)}
        okText="导入"
        cancelText="取消"
      >
        <Alert
          message="导入说明"
          description={
            <>
              1. 请先下载导入模板，按照模板格式填写数据<br />
              2. CSV 文件请使用 UTF-8 编码，物资编码和物资名称至少填一项<br />
              3. 同一供应商的多行物资将自动合并为一个入库单<br />
              4. 入库单号由系统自动生成，无需填写
            </>
          }
          type="info" showIcon style={{ marginBottom: 16 }}
        />
        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ marginBottom: 16 }}>下载导入模板</Button>
        <div
          style={{ border: '2px dashed #d9d9d9', borderRadius: 6, padding: 24, textAlign: 'center', cursor: 'pointer', backgroundColor: '#fafafa' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ fontSize: 48, margin: 0 }}><UploadOutlined /></p>
          <p style={{ margin: '8px 0 0 0' }}>
            {selectedFile ? `已选择：${selectedFile.name}` : '点击选择 CSV 文件'}
          </p>
        </div>
        <input
          ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { setSelectedFile(file); message.success('文件已选择，点击导入按钮'); }
            e.target.value = '';
          }}
        />
      </Modal>
    </div>
  );
};

export default InboundPage;
