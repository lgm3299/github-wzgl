import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Typography, Popconfirm, DatePicker, Upload, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { getMaterials, getCategories, createMaterial, updateMaterial, deleteMaterial, supabase } from '@/lib/supabase';
import { downloadCSV, downloadTemplate, parseCSV, csvToObjects } from '@/lib/importExport';

const { Title } = Typography;

// 导出列定义常量
const EXPORT_COLUMNS = [
  { key: 'code', label: '物资编码' },
  { key: 'name', label: '物资名称' },
  { key: 'specification', label: '规格型号' },
  { key: 'unit', label: '单位' },
  { key: 'price', label: '参考单价' },
  { key: 'location', label: '存放位置' },
];

// 导入列定义常量
const IMPORT_COLUMNS = [
  { key: 'code', label: '物资编码' },
  { key: 'name', label: '物资名称' },
  { key: 'specification', label: '规格型号' },
  { key: 'unit', label: '单位' },
  { key: 'price', label: '参考单价' },
  { key: 'location', label: '存放位置' },
];

const MaterialsPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (selectedCategory) params.category_id = selectedCategory;
      if (keyword) params.keyword = keyword;
      if (dateRange?.[0]) params.startDate = dateRange[0].format?.('YYYY-MM-DD');
      if (dateRange?.[1]) params.endDate = dateRange[1].format?.('YYYY-MM-DD');
      const result = await getMaterials(params);
      setData(result?.data || []);
      setPagination({
        current: page,
        pageSize,
        total: result?.total || 0,
      });
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

  const fetchSuppliers = async () => {
    try {
      const result = await getSuppliers({ pageSize: 1000 });
      setSuppliers(result || []);
    } catch {}
  };

  useEffect(() => { fetchData(); fetchCategories(); fetchSuppliers(); }, []);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData(1);
  };

  const handleKeywordSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData(1);
  };

  const handleDateChange = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData(1);
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    // 自动生成物资编码
    generateCode();
    setModalOpen(true);
  };

  // 生成物资编码 - 简化版本
  const generateCode = async () => {
    try {
      const result = await getMaterials({ pageSize: 1000 });
      const materials = Array.isArray(result) ? result : (result?.data || []);
      
      let maxNum = 0;
      materials.forEach((item: any) => {
        if (item.code && item.code.startsWith('WZ')) {
          const num = parseInt(item.code.replace('WZ', ''));
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      
      const newCode = `WZ${String(maxNum + 1).padStart(3, '0')}`;
      form.setFieldsValue({ code: newCode });
    } catch (error) {
      console.error('生成编码失败:', error);
      form.setFieldsValue({ code: 'WZ001' });
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMaterial(id);
      message.success('删除成功');
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      console.error('删除物资失败:', error);
      const errorMessage = error?.message || error?.hint || '删除失败';
      
      // 如果是外键约束错误，给出友好提示
      if (errorMessage.includes('foreign key constraint') || errorMessage.includes('delete on table')) {
        message.warning('该物资已被其他记录引用，无法删除。请先删除相关的入库/出库记录。');
      } else {
        message.error(`删除失败：${errorMessage}`);
      }
    }
  };

  // 批量删除 - 添加错误隔离
  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const row of selectedRows) {
        try {
          await deleteMaterial(row.id);
          successCount++;
        } catch {
          failCount++;
          console.error(`删除物资 ${row.id} 失败`);
        }
      }
      
      message.success(`成功删除 ${successCount} 条记录${failCount > 0 ? `，${failCount} 条失败` : ''}`);
      setSelectedRows([]);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      console.error('批量删除失败:', error);
      message.error('批量删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await updateMaterial(editingId, values);
        message.success('更新成功');
      } else {
        await createMaterial(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData(pagination.current, pagination.pageSize);
    } catch {}
  };

  // 导出物资数据
  const handleExport = () => {
    downloadCSV(data, EXPORT_COLUMNS, '物资档案');
    message.success('导出成功');
  };

  // 下载导入模板
  const handleDownloadTemplate = () => {
    downloadTemplate(IMPORT_COLUMNS, '物资档案导入模板');
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
      // 不指定编码，让浏览器使用默认编码（通常会正确识别 GBK/UTF-8）
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
      const items = csvToObjects(text, IMPORT_COLUMNS);
      
      if (items.length === 0) {
        message.error('文件中没有有效数据');
        return;
      }

      // 批量插入
      const { error } = await supabase
        .from('materials')
        .insert(items.map((item: any) => ({
          ...item,
          price: item.price || null,
        })));

      if (error) throw error;
      
      message.success(`成功导入 ${items.length} 条物资数据`);
      setImportModalOpen(false);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '导入失败');
    }
  };

  const columns = [
    { title: '物资编码', dataIndex: 'code', key: 'code', width: 120 },
    { title: '物资名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '规格型号', dataIndex: 'specification', key: 'specification', width: 120 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    { title: '参考单价', dataIndex: 'price', key: 'price', width: 100, render: (v: number) => v ? `¥${Number(v).toFixed(2)}` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s: number) => <Tag color={s === 1 ? 'green' : 'red'}>{s === 1 ? '启用' : '禁用'}</Tag> },
    { title: '操作', key: 'action', width: 160, fixed: 'right' as const, render: (_: any, record: any) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>物资档案管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出数据</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
          <Button icon={<UploadOutlined />} type="primary" onClick={() => setImportModalOpen(true)}>导入数据</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增物资</Button>
          {selectedRows.length > 0 && (
            <Button type="default" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              批量删除 ({selectedRows.length})
            </Button>
          )}
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索物资名称、编码"
          style={{ width: 250 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleKeywordSearch}
          prefix={<SearchOutlined />}
        />
        <Button icon={<SearchOutlined />} onClick={handleKeywordSearch}>搜索</Button>
        <DatePicker.RangePicker
          placeholder={['开始日期', '结束日期']}
          style={{ width: 250 }}
          onChange={(dates) => setDateRange(dates)}
        />
        <Button icon={<SearchOutlined />} onClick={handleDateChange}>按时间筛选</Button>
        <Button onClick={() => { setKeyword(''); setDateRange(null); fetchData(1); }}>重置</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          showPrevNextButtons: true,
          showQuickJumper: true,
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
        rowSelection={{
          selectedRowKeys: selectedRows.map(row => row.id),
          onChange: (selectedRowKeys: React.Key[], selectedRows: any[]) => {
            setSelectedRows(selectedRows);
          },
        }}
      />

      <Modal
        title={editingId ? '编辑物资' : '新增物资'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="物资名称" rules={[{ required: true }]}>
            <Input placeholder="请输入物资名称" />
          </Form.Item>
          <Form.Item name="code" label="物资编码" rules={[{ required: true }]}>
            <Input placeholder="自动生成" readOnly />
          </Form.Item>
          <Form.Item name="specification" label="规格型号">
            <Input placeholder="请输入规格型号" />
          </Form.Item>
          <Form.Item name="unit" label="计量单位" initialValue="个">
            <Input placeholder="如: 个、箱、件" />
          </Form.Item>
          <Form.Item name="supplier_id" label="供应商">
            <Select placeholder="请选择供应商" allowClear>
              {suppliers.map((s: any) => (
                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select>
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price" label="参考单价">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <Input placeholder="请输入存放位置" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入物资数据"
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

export default MaterialsPage;
