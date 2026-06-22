import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, Popconfirm, Row, Col, Upload, Divider, DatePicker, Alert, Checkbox } from 'antd';
import { ReloadOutlined, DownloadOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { getMaterials, getInventories, getCurrentUser, getOutboundOrders, supabase } from '@/lib/supabase';
import { downloadCSV, downloadTemplate } from '@/lib/importExport';

const { Title } = Typography;

// 出库状态映射常量
const OUTBOUND_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending: { color: 'processing', text: '待审批' },
  approved: { color: 'success', text: '已审批' },
  completed: { color: 'blue', text: '已完成' },
};

// 生成出库单号函数（使用时间戳+随机数，降低重复概率）
const generateOrderNo = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `CK${dateStr}${timeStr}${randomNum}`;
};

const OutboundPage: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchOutboundModalOpen, setBatchOutboundModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [batchForm] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  // 加载库存数据
  const loadInventory = async () => {
    setLoading(true);
    try {
      const [matRes, invRes] = await Promise.all([
        getMaterials({ pageSize: 1000 }),
        getInventories(),
      ]);

      const materialsList = matRes?.data || [];

      const inventoryMap = new Map();
      if (invRes) {
        invRes.forEach((inv: any) => {
          inventoryMap.set(inv.material_id, inv.quantity);
        });
      }

      const inventoryWithDetails = materialsList.map((mat: any) => ({
        ...mat,
        current_quantity: inventoryMap.get(mat.id) || 0,
      }));

      setInventory(inventoryWithDetails);
    } catch (error: any) {
      message.error(`加载库存失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 加载出库历史
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const orders = await getOutboundOrders({ pageSize: 1000 });

      const flatData: any[] = [];

      for (const order of orders) {
        const items = order.outbound_items || [];
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
              material_quantity: `${item.quantity}`,
              _item: item,
            });
          }
        }
      }

      setHistoryData(flatData);
      setHistoryModalOpen(true);
    } catch (error: any) {
      message.error('加载历史记录失败: ' + (error.message || '未知错误'));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      // 获取用户信息失败，使用默认值
    }
  };

  // 校验日期是否有效
  const formatSafeDate = (date: string | null | undefined): string => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  // 顺序处理出库明细（避免并发更新库存导致数据竞争）
  const processOutboundItems = async (
    orderId: string,
    rows: any[],
    operator: string,
  ): Promise<{ successCount: number; failCount: number; messages: string[] }> => {
    let successCount = 0;
    let failCount = 0;
    const messages: string[] = [];

    for (const row of rows) {
      const quantity = row.outbound_quantity;

      if (!quantity || quantity <= 0) {
        failCount++;
        continue;
      }

      if (quantity > row.current_quantity) {
        messages.push(`${row.name} 库存不足！当前库存：${row.current_quantity}`);
        failCount++;
        continue;
      }

      try {
        // 创建出库明细
        const { error: itemError } = await supabase
          .from('outbound_items')
          .insert([{
            outbound_id: orderId,
            material_id: row.id,
            quantity,
            unit_price: row.price || 0,
            total_amount: quantity * (row.price || 0),
          }]);

        if (itemError) throw itemError;

        // 更新库存（串行执行，避免并发竞争）
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            quantity: Math.max(0, (row.current_quantity || 0) - quantity),
            updated_at: new Date().toISOString(),
          })
          .eq('material_id', row.id);

        if (updateError) throw updateError;

        successCount++;
      } catch (error: any) {
        messages.push(`处理物资 ${row.name} 失败: ${error.message || '未知错误'}`);
        failCount++;
      }
    }

    return { successCount, failCount, messages };
  };

  // 批量出库处理
  const handleBatchOutbound = async (values: any) => {
    if (selectedRows.length === 0) {
      message.warning('请选择要出库的物资');
      return;
    }

    const { recipient, purpose, remark } = values;
    const operator = currentUser?.full_name || currentUser?.email || '系统';
    const orderNo = generateOrderNo();

    try {
      // 创建出库单
      const { data: orderData, error: orderError } = await supabase
        .from('outbound')
        .insert([{
          order_no: orderNo,
          operator,
          recipient,
          status: 'approved',
          purpose: purpose || '批量出库',
          remark,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const { successCount, failCount, messages } = await processOutboundItems(
        orderData.id,
        selectedRows,
        operator,
      );

      // 显示处理消息
      messages.forEach(msg => message.warning(msg));

      if (successCount > 0) {
        message.success(`批量出库成功！成功 ${successCount} 项，失败 ${failCount} 项。出库单号：${orderNo}`);
      } else {
        message.warning('所有物资出库失败');
      }

      setBatchOutboundModalOpen(false);
      batchForm.resetFields();
      setSelectedRows([]);
      loadInventory();
    } catch (error: any) {
      message.error(error.message || '批量出库失败');
    }
  };

  // 切换选中状态的处理函数
  const handleToggleSelect = (record: any) => {
    const isSelected = selectedRows.some(row => row.id === record.id);
    if (isSelected) {
      setSelectedRows(selectedRows.filter(row => row.id !== record.id));
    } else {
      setSelectedRows([...selectedRows, { ...record, outbound_quantity: 1 }]);
    }
  };

  // 更新出库数量
  const handleUpdateQuantity = (recordId: number, quantity: number | null) => {
    setSelectedRows(selectedRows.map(row =>
      row.id === recordId ? { ...row, outbound_quantity: quantity || 0 } : row
    ));
  };

  const columns = useMemo(() => [
    {
      title: '选择',
      key: 'selection',
      width: 80,
      render: (_: any, record: any) => (
        <Checkbox
          checked={selectedRows.some(row => row.id === record.id)}
          onChange={() => handleToggleSelect(record)}
        />
      ),
    },
    { title: '物资编码', dataIndex: 'code', key: 'code', width: 120 },
    { title: '物资名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '规格型号', dataIndex: 'specification', key: 'specification', width: 120 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: '当前库存',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      width: 100,
      render: (v: number) => <Tag color={v > 0 ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '出库数量',
      key: 'outbound_quantity',
      width: 120,
      render: (_: any, record: any) => (
        <InputNumber
          min={1}
          max={record.current_quantity}
          defaultValue={1}
          onChange={(value) => handleUpdateQuantity(record.id, value)}
          style={{ width: '100%' }}
          placeholder="数量"
        />
      ),
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s: number) => <Tag color={s === 1 ? 'green' : 'red'}>{s === 1 ? '启用' : '禁用'}</Tag> },
  ], [selectedRows]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>出库管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadInventory()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={loadHistory}>查看出库历史</Button>
          {selectedRows.length > 0 && (
            <Button type="primary" icon={<InboxOutlined />} onClick={() => setBatchOutboundModalOpen(true)}>
              批量出库 ({selectedRows.length})
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={inventory}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />

      {/* 批量出库表单弹窗 */}
      <Modal
        title="批量出库"
        open={batchOutboundModalOpen}
        onOk={() => batchForm.submit()}
        onCancel={() => { setBatchOutboundModalOpen(false); batchForm.resetFields(); setSelectedRows([]); }}
        width={800}
      >
        <Alert
          message="批量出库说明"
          description={`已选择 ${selectedRows.length} 项物资，请在下方表格中填写出库数量，然后点击"确认出库"按钮`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={batchForm} layout="vertical" onFinish={handleBatchOutbound}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="recipient" label="领用人" rules={[{ required: true, message: '请输入领用人' }]}>
                <Input placeholder="请输入领用人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purpose" label="用途说明">
                <Input placeholder="请输入用途说明（可选）" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注信息（可选）" />
          </Form.Item>

          <div style={{ marginTop: 16 }}>
            <Table
              rowKey="id"
              columns={[
                { title: '物资编码', dataIndex: 'code', key: 'code', width: 120 },
                { title: '物资名称', dataIndex: 'name', key: 'name', width: 150 },
                { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
                { title: '当前库存', dataIndex: 'current_quantity', key: 'current_quantity', width: 100 },
                {
                  title: '出库数量',
                  dataIndex: 'outbound_quantity',
                  key: 'outbound_quantity',
                  width: 150,
                  render: (_: any, record: any) => (
                    <InputNumber
                      min={1}
                      max={record.current_quantity}
                      value={record.outbound_quantity}
                      onChange={(value) => {
                        setSelectedRows(selectedRows.map(row =>
                          row.id === record.id ? { ...row, outbound_quantity: value || 0 } : row
                        ));
                      }}
                      style={{ width: '100%' }}
                    />
                  ),
                },
              ]}
              dataSource={selectedRows}
              pagination={false}
              size="small"
            />
          </div>
        </Form>
      </Modal>

      {/* 出库历史弹窗 */}
      <Modal
        title="出库历史记录"
        open={historyModalOpen}
        onCancel={() => setHistoryModalOpen(false)}
        footer={null}
        width={1200}
      >
        <Table
          rowKey="id"
          columns={[
            { title: '出库单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
            { title: '物资名称', dataIndex: 'material_name', key: 'material_name', width: 150 },
            { title: '出库数量', dataIndex: 'material_quantity', key: 'material_quantity', width: 100 },
            { title: '领用人', dataIndex: 'recipient', key: 'recipient', width: 120 },
            { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: (s: string) => {
                const st = OUTBOUND_STATUS_MAP[s] || { color: 'default', text: s };
                return <Tag color={st.color}>{st.text}</Tag>;
              },
            },
            { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (date: string) => formatSafeDate(date) },
          ]}
          dataSource={historyData}
          loading={historyLoading}
          pagination={{ showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Modal>
    </div>
  );
};

export default OutboundPage;
