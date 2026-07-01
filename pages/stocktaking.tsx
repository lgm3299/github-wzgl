import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, DatePicker, Row, Col, Divider, Alert, Steps, Radio, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, DownloadOutlined, FileTextOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import { getStocktakingOrders, createStocktakingOrder, updateStocktakingOrder, approveStocktakingOrder, deleteStocktakingOrder, getMaterials, getInventories, getCurrentUser } from '@/lib/supabase';
import { printMaterials, exportTableAsHTML, downloadCSV } from '@/lib/importExport';

const { Title } = Typography;

// 盘点状态映射常量
const STOCKTAKING_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  in_progress: { color: 'processing', text: '盘点中' },
  completed: { color: 'success', text: '已完成' },
};

// 导出列定义常量
const EXPORT_COLUMNS = [
  { key: 'order_no', label: '盘点单号' },
  { key: 'material_name', label: '物资名称' },
  { key: 'system_quantity', label: '系统库存' },
  { key: 'actual_quantity', label: '实际盘点' },
  { key: 'difference', label: '差异' },
  { key: 'status', label: '状态' },
  { key: 'created_at', label: '创建时间' },
];

interface StocktakingItem {
  material_id: string;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  remark: string;
}

// 差异显示组件
const DifferenceTag: React.FC<{ diff: number }> = ({ diff }) => {
  if (diff > 0) return <span style={{ color: '#ff4d4f' }}>+{diff}</span>;
  if (diff < 0) return <span style={{ color: '#52c41a' }}>{diff}</span>;
  return <span>-</span>;
};

// 状态标签组件
const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const st = STOCKTAKING_STATUS_MAP[status] || { color: 'default', text: status };
  return <Tag color={st.color}>{st.text}</Tag>;
};

const StocktakingPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [inventories, setInventories] = useState<Map<number, number>>(new Map());
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 盘点创建步骤
  const [currentStep, setCurrentStep] = useState(0);
  const [stocktakingForm] = Form.useForm();
  const [selectedMaterials, setSelectedMaterials] = useState<string>('all');
  const [customMaterials, setCustomMaterials] = useState<number[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentStocktaking, setCurrentStocktaking] = useState<any>(null);

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
      message.error('获取用户信息失败');
    }
  };

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (selectedStatus) params.status = selectedStatus;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0]?.format?.('YYYY-MM-DD') || '';
        params.endDate = dateRange[1]?.format?.('YYYY-MM-DD') || '';
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
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, dateRange]);

  const fetchOptions = async () => {
    try {
      const matRes = await getMaterials({ pageSize: 1000 });
      setMaterials(matRes?.data || []);

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
      message.error('获取物资和库存数据失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchOptions();
  }, [fetchData]);

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

  const handleReset = () => {
    setSelectedStatus('');
    setDateRange(null);
    fetchData(1);
  };

  // 创建盘点单
  const handleCreateStocktaking = async (items: any[]) => {
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
      // 直接通过record获取完整数据，避免重复请求
      if (record.stocktaking_items) {
        setCurrentStocktaking(record);
        setDetailModalOpen(true);
        return;
      }

      const result = await getStocktakingOrders({ page: 1, pageSize: 1000 });
      const orders = Array.isArray(result) ? result : [];
      const stocktaking = orders.find((s: any) => s.id === record.id);

      if (!stocktaking) {
        message.warning('盘点单不存在');
        return;
      }

      setCurrentStocktaking(stocktaking);
      setDetailModalOpen(true);
    } catch (error: any) {
      console.error('获取盘点明细失败:', error);
      message.error('获取盘点明细失败');
    }
  };

  // 完成盘点 - 调用后端审批函数，自动调整库存
  const handleComplete = async (id: number) => {
    try {
      await approveStocktakingOrder(id);
      message.success('盘点完成，库存已调整');
      fetchData();
    } catch (error: any) {
      console.error('完成盘点失败:', error);
      message.error(error.message || '操作失败');
    }
  };

  // 删除盘点单
  const handleDelete = async (id: number) => {
    try {
      await deleteStocktakingOrder(id);
      message.success('盘点单删除成功，库存已回滚');
      fetchData();
    } catch (error: any) {
      console.error('删除盘点单失败:', error);
      message.error(error.message || '删除失败');
    }
  };

  // 导出盘点数据（HTML 格式 Excel）
  const handleExport = () => {
    if (data.length === 0) { message.warning('暂无数据可导出'); return; }
    const exportData = data.map((item, idx) => ({
      ...item,
      _idx: idx + 1,
      status_text: STOCKTAKING_STATUS_MAP[item.status]?.text || item.status,
    }));
    const columns = [
      { key: '_idx', label: '序号' },
      { key: 'order_no', label: '盘点单号' },
      { key: 'operator', label: '操作人' },
      { key: 'material_name', label: '物资名称' },
      { key: 'system_quantity', label: '系统库存' },
      { key: 'material_quantity', label: '实际盘点' },
      { key: 'difference', label: '差异' },
      { key: 'status_text', label: '状态' },
      { key: 'created_at', label: '创建时间' },
    ];
    exportTableAsHTML(exportData, columns, '盘点记录');
    message.success('导出成功');
  };

  // 打印
  const handlePrint = () => {
    if (data.length === 0) { message.warning('暂无数据可打印'); return; }
    const printData = data.map((item, idx) => ({
      ...item,
      _idx: idx + 1,
      status_text: STOCKTAKING_STATUS_MAP[item.status]?.text || item.status,
    }));
    const columns = [
      { key: '_idx', label: '序号' },
      { key: 'order_no', label: '盘点单号' },
      { key: 'operator', label: '操作人' },
      { key: 'material_name', label: '物资名称' },
      { key: 'system_quantity', label: '系统库存' },
      { key: 'material_quantity', label: '实际盘点' },
      { key: 'difference', label: '差异' },
      { key: 'status_text', label: '状态' },
      { key: 'created_at', label: '创建时间' },
    ];
    printMaterials(printData, columns);
  };

  // 表格列定义
  const columns = [
    { title: '盘点单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusTag status={status} />,
    },
    { title: '物资名称', dataIndex: 'material_name', key: 'material_name', width: 150 },
    { title: '实际数量', dataIndex: 'material_quantity', key: 'material_quantity', width: 100 },
    {
      title: '差异',
      dataIndex: 'difference',
      key: 'difference',
      width: 80,
      render: (diff: number) => <DifferenceTag diff={diff} />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleViewDetails(record)}>查看明细</Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record.id)}>完成</Button>
          )}
          <Popconfirm
            title="确认删除"
            description="删除盘点单将回滚库存调整，是否继续？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>盘点管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()} loading={loading}>刷新</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCurrentStep(0); setCreateModalOpen(true); }}>
            创建盘点单
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Select
          placeholder="选择状态"
          allowClear
          style={{ width: 140 }}
          value={selectedStatus || undefined}
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
        <Button onClick={handleReset}>重置</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
      />

      {/* 创建盘点单模态框 */}
      <CreateStocktakingModal
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); setCurrentStep(0); }}
        materials={materials}
        inventories={inventories}
        currentUser={currentUser}
        stocktakingForm={stocktakingForm}
        selectedMaterials={selectedMaterials}
        setSelectedMaterials={setSelectedMaterials}
        customMaterials={customMaterials}
        setCustomMaterials={setCustomMaterials}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onCreate={handleCreateStocktaking}
      />

      {/* 盘点明细模态框 */}
      <DetailModal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        stocktaking={currentStocktaking}
      />
    </div>
  );
};

// 创建盘点单模态框组件
interface CreateModalProps {
  open: boolean;
  onCancel: () => void;
  materials: any[];
  inventories: Map<number, number>;
  currentUser: any;
  stocktakingForm: any;
  selectedMaterials: string;
  setSelectedMaterials: (value: string) => void;
  customMaterials: number[];
  setCustomMaterials: (value: number[]) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  onCreate: (items: any[]) => void;
}

const CreateStocktakingModal: React.FC<CreateModalProps> = ({
  open, onCancel, materials, inventories, currentUser, stocktakingForm,
  selectedMaterials, setSelectedMaterials, customMaterials, setCustomMaterials,
  currentStep, setCurrentStep, onCreate,
}) => {
  const [actualQuantities, setActualQuantities] = useState<Map<number, number>>(new Map());
  const [itemRemarks, setItemRemarks] = useState<Map<number, string>>(new Map());

  // 根据选择获取目标物资
  const targetMaterials = useMemo(() => {
    if (selectedMaterials === 'all') {
      return materials.filter((m: any) => (inventories.get(m.id) || 0) > 0);
    }
    return materials.filter((m: any) => customMaterials.includes(m.id));
  }, [selectedMaterials, materials, inventories, customMaterials]);

  const handleNextStep1 = () => {
    if (targetMaterials.length === 0) {
      message.warning('没有可盘点的物资，请选择有库存的物资');
      return;
    }
    setCurrentStep(1);
  };

  const handleCreate = () => {
    // 在实际创建前，将实际数量合并到表单中
    const items = targetMaterials.map((mat: any) => ({
      material_id: mat.id,
      system_quantity: inventories.get(mat.id) || 0,
      actual_quantity: actualQuantities.get(mat.id) ?? 0,
      difference: 0,
      remark: itemRemarks.get(mat.id) || '',
    }));

    // 传递 items 到父组件
    onCreate(items);
  };

  return (
    <Modal
      title="创建盘点单"
      open={open}
      onCancel={() => {
        onCancel();
        setActualQuantities(new Map());
        setItemRemarks(new Map());
      }}
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
        <Step0Content
          stocktakingForm={stocktakingForm}
          currentUser={currentUser}
          selectedMaterials={selectedMaterials}
          setSelectedMaterials={setSelectedMaterials}
          materials={materials}
          inventories={inventories}
          customMaterials={customMaterials}
          setCustomMaterials={setCustomMaterials}
          onNext={handleNextStep1}
          onCancel={onCancel}
        />
      )}

      {currentStep === 1 && (
        <Step1Content
          targetMaterials={targetMaterials}
          inventories={inventories}
          actualQuantities={actualQuantities}
          setActualQuantities={setActualQuantities}
          itemRemarks={itemRemarks}
          setItemRemarks={setItemRemarks}
          onPrev={() => setCurrentStep(0)}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && (
        <Step2Content
          stocktakingForm={stocktakingForm}
          currentUser={currentUser}
          selectedMaterials={selectedMaterials}
          customMaterials={customMaterials}
          materials={materials}
          inventories={inventories}
          onPrev={() => setCurrentStep(1)}
          onCreate={handleCreate}
        />
      )}
    </Modal>
  );
};

// 步骤0内容组件
const Step0Content: React.FC<any> = ({
  stocktakingForm, currentUser, selectedMaterials, setSelectedMaterials,
  materials, inventories, customMaterials, setCustomMaterials, onNext, onCancel,
}) => (
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
              <Select.Option key={m.id} value={m.id}>
                {m.name} ({m.code}) - 库存: {inventories.get(m.id) || 0}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}
    </Form>

    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
      <Button onClick={onCancel} style={{ marginRight: 8 }}>
        取消
      </Button>
      <Button type="primary" onClick={onNext}>
        下一步
      </Button>
    </div>
  </div>
);

// 步骤1内容组件
const Step1Content: React.FC<any> = ({
  targetMaterials, inventories, actualQuantities, setActualQuantities,
  itemRemarks, setItemRemarks, onPrev, onNext,
}) => (
  <div>
    <Alert
      message="提示"
      description="请根据实际情况填写每个物资的实际盘点数量。系统库存为当前账面数量。"
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
    />

    {targetMaterials.length === 0 && (
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
        rowKey="id"
        columns={[
          { title: '物资名称', dataIndex: 'name', width: 200 },
          {
            title: '系统库存',
            key: 'system_quantity',
            width: 100,
            render: (_: any, record: any) => inventories.get(record.id) || 0,
          },
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
            key: 'remark',
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
        dataSource={targetMaterials.map((m: any) => ({ ...m }))}
        pagination={false}
        size="small"
      />
    </div>

    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
      <Button onClick={onPrev} style={{ marginRight: 8 }}>
        上一步
      </Button>
      <Button type="primary" onClick={onNext}>
        下一步
      </Button>
    </div>
  </div>
);

// 步骤2内容组件
const Step2Content: React.FC<any> = ({
  stocktakingForm, currentUser, selectedMaterials, customMaterials,
  materials, inventories, onPrev, onCreate,
}) => {
  const materialCount = useMemo(() => {
    if (selectedMaterials === 'all') {
      return materials.filter((m: any) => (inventories.get(m.id) || 0) > 0).length;
    }
    return customMaterials.length;
  }, [selectedMaterials, materials, inventories, customMaterials]);

  return (
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
        <p><strong>物资数量：</strong>{materialCount} 项</p>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>
          上一步
        </Button>
        <Button type="primary" onClick={onCreate}>
          创建盘点单
        </Button>
      </div>
    </div>
  );
};

// 明细模态框组件
interface DetailModalProps {
  open: boolean;
  onCancel: () => void;
  stocktaking: any;
}

const DetailModal: React.FC<DetailModalProps> = ({ open, onCancel, stocktaking }) => {
  if (!stocktaking) return null;

  return (
    <Modal
      title={`盘点单明细 - ${stocktaking?.order_no}`}
      open={open}
      onCancel={onCancel}
      width={1000}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        <Tag color="blue">单号：{stocktaking.order_no}</Tag>
        <Tag>操作人：{stocktaking.operator}</Tag>
        <Tag color={STOCKTAKING_STATUS_MAP[stocktaking.status]?.color || 'default'}>
          {STOCKTAKING_STATUS_MAP[stocktaking.status]?.text || stocktaking.status}
        </Tag>
        <Tag>创建时间：{stocktaking.created_at ? new Date(stocktaking.created_at).toLocaleString() : '-'}</Tag>
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
            render: (diff: number) => <DifferenceTag diff={diff} />,
          },
          { title: '备注', dataIndex: ['remark'], width: 200 },
        ]}
        dataSource={stocktaking.stocktaking_items || []}
        pagination={false}
      />
    </Modal>
  );
};

export default StocktakingPage;
