import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Tag, Typography, Popconfirm, Upload, Alert, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, supabase } from '@/lib/supabase';
import { downloadCSV, downloadTemplate, csvToObjects } from '@/lib/importExport';

const { Title } = Typography;

// 导出/导入列定义常量（消除重复定义）
const SUPPLIER_COLUMNS = [
  { key: 'name', label: '供应商名称' },
  { key: 'contact_person', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'email', label: '邮箱' },
  { key: 'address', label: '地址' },
];

// 允许导入的字段白名单（防止 CSV 注入额外字段）
const IMPORT_ALLOWED_KEYS = SUPPLIER_COLUMNS.map(col => col.key);

// 安全日期格式化
const formatSafeDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const SuppliersPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      const result = await getSuppliers(params);
      setData(result?.data || []);
      setPagination({
        current: page,
        pageSize,
        total: result?.total || 0,
      });
    } catch (error: any) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 日期范围变化
  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      fetchData(1);
    }
  };

  const handleAdd = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };
  const handleEdit = (record: any) => { setEditingId(record.id); form.setFieldsValue(record); setModalOpen(true); };

  const handleDelete = async (id: number) => {
    try {
      await deleteSupplier(id);
      message.success('删除成功');
      fetchData();
    }
    catch (error: any) {
      const errorMessage = error?.message || error?.hint || '删除失败';

      if (errorMessage.includes('foreign key constraint') || errorMessage.includes('delete on table')) {
        message.warning('该供应商已被其他记录引用，无法删除。请先删除相关的入库记录。');
      } else {
        message.error(`删除失败：${errorMessage}`);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) { await updateSupplier(editingId, values); message.success('更新成功'); }
      else { await createSupplier(values); message.success('创建成功'); }
      setModalOpen(false); fetchData();
    } catch {}
  };

  // 导出供应商数据
  const handleExport = () => {
    downloadCSV(data, SUPPLIER_COLUMNS, '供应商数据');
    message.success('导出成功');
  };

  // 下载导入模板
  const handleDownloadTemplate = () => {
    downloadTemplate(SUPPLIER_COLUMNS, '供应商导入模板');
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

  // 过滤导入数据，仅保留白名单字段，防止 CSV 注入额外字段
  const sanitizeImportItems = (items: any[]): any[] => {
    return items.map(item => {
      const sanitized: any = {};
      for (const key of IMPORT_ALLOWED_KEYS) {
        if (item.hasOwnProperty(key)) {
          sanitized[key] = item[key];
        }
      }
      return sanitized;
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
      const items = csvToObjects(text, SUPPLIER_COLUMNS);

      if (items.length === 0) {
        message.error('文件中没有有效数据');
        return;
      }

      // 字段白名单过滤，防止注入额外字段
      const sanitizedItems = sanitizeImportItems(items);

      const { error } = await supabase.from('suppliers').insert(sanitizedItems);
      if (error) throw error;

      message.success(`成功导入 ${items.length} 条供应商数据`);
      setImportModalOpen(false);
      fetchData(1, pagination.pageSize);
    } catch (error: any) {
      message.error(error.message || '导入失败');
    }
  };

  const columns = useMemo(() => [
    { title: '供应商名称', dataIndex: 'name', key: 'name' },
    { title: '联系人', dataIndex: 'contact_person', key: 'contact_person' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (date: string) => formatSafeDate(date) },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>供应商管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
          <Button icon={<UploadOutlined />} type="primary" onClick={() => setImportModalOpen(true)}>导入数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增供应商</Button>
        </Space>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <DatePicker.RangePicker
          placeholder={['开始日期', '结束日期']}
          style={{ width: 250 }}
          onChange={handleDateRangeChange}
        />
        <Button onClick={() => { setDateRange(null); fetchData(1); }}>重置</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
          showPrevNextButtons: true, showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize) }} />
      <Modal title={editingId ? '编辑供应商' : '新增供应商'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="供应商名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_person" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入供应商数据"
        open={importModalOpen}
        onOk={handleImport}
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

export default SuppliersPage;
