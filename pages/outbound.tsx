import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, Popconfirm, Row, Col, Upload, Divider, DatePicker, Alert, Checkbox } from 'antd';
import { ReloadOutlined, DownloadOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { getMaterials, getInventories, getCurrentUser, supabase } from '@/lib/supabase';
import { downloadCSV, downloadTemplate, csvToObjects } from '@/lib/importExport';

const { Title } = Typography;
const { Option } = Select;

// 出库状态映射常量
const OUTBOUND_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending: { color: 'processing', text: '待审批' },
  approved: { color: 'success', text: '已审批' },
  completed: { color: 'blue', text: '已完成' },
};

// 生成出库单号函数
const generateOrderNo = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `CK${dateStr}${randomNum}`;
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
      console.log('开始加载库存数据...');
      const [matRes, invRes] = await Promise.all([
        getMaterials({ pageSize: 1000 }),
        getInventories(),
      ]);
      console.log('获取到物资数据:', matRes);
      console.log('获取到库存数据:', invRes);

      const materialsList = matRes?.data || [];
      console.log('物资列表:', materialsList);
      
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

      console.log('库存详情:', inventoryWithDetails);
      setInventory(inventoryWithDetails);
    } catch (error: any) {
      console.error('加载库存失败:', error);
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
      message.error(`加载库存失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 加载出库历史
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await supabase
        .from('outbound')
        .select('*, outbound_items(*, materials(name, code))')
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;

      const orders = result.data || [];
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
      console.error('加载历史记录失败:', error);
      message.error('加载历史记录失败');
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
      console.error('获取用户信息失败:', error);
    }
  };

  // 批量出库处理
  const handleBatchOutbound = async (values: any) => {
    if (selectedRows.length === 0) {
      message.warning('请选择要出库的物资');
      return;
    }

    const { recipient, purpose, remark } = values;
    const operator = currentUser?.full_name || currentUser?.email || '系统';
    let successCount = 0;
    let failCount = 0;
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

      // 批量处理每个物资 - 使用并行处理提升性能
      const processingResults: Promise<void>[] = [];

      for (const row of selectedRows) {
        const quantity = row.outbound_quantity;
        
        if (!quantity || quantity <= 0) {
          failCount++;
          continue;
        }

        // 检查库存
        if (quantity > row.current_quantity) {
          message.warning(`${row.name} 库存不足！当前库存：${row.current_quantity}`);
          failCount++;
          continue;
        }

        processingResults.push(
          (async () => {
            try {
              // 创建出库明细
              const { error: itemError } = await supabase
                .from('outbound_items')
                .insert([{
                  outbound_id: orderData.id,
                  material_id: row.id,
                  quantity,
                  unit_price: row.price || 0,
                  total_amount: quantity * (row.price || 0),
                }]);

              if (itemError) throw itemError;

              // 更新库存
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
              console.error(`处理物资 ${row.name} 失败:`, error.message);
              failCount++;
            }
          })()
        );
      }

      await Promise.all(processingResults);

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
      console.error('批量出库失败:', error.message);
      message.error(error.message || '批量出库失败');
    }
  };

  // 出库处理 - 已移除，统一使用批量出库

  // 使用useMemo优化列定义，避免不必要的重新渲染
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
      render: (v: number) => <Tag color={v > 0 ? 'green' : 'red'}>{v}</Tag>
    },
    { 
      title: '出库数量', 
      key: 'outbound_quantity', 
      width: 120,
      render: (_: any, record: any) => (
        <InputNumber
          min={0}
          max={record.current_quantity}
          defaultValue={1}
          onChange={(value) => handleUpdateQuantity(record.id, value)}
          style={{ width: '100%' }}
          placeholder="数量"
        />
      ),
    },
    { title: '参考单价', dataIndex: 'price', key: 'price', width: 100, render: (v: number) => v ? `¥${Number(v).toFixed(2)}` : '-' },
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
                      min={0}
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
            { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (date: string) => new Date(date).toLocaleString() },
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
