import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Card, Alert, Tabs, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, InputNumber } from 'antd';
import { SettingOutlined, SafetyOutlined, UserOutlined, TeamOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CheckOutlined, KeyOutlined } from '@ant-design/icons';
import {
  supabase,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getRoles, createRole, updateRole, deleteRole,
  getPermissions, getRolePermissions, updateRolePermissions,
  getAllUsers, updateUserRole, deleteUser,
  signUp,
  adminResetUserPassword,
} from '@/lib/supabase';

const { Title } = Typography;

/** 创建用户后等待时间（ms），避免触发 Supabase 速率限制 */
const SIGNUP_COOLDOWN_MS = 500;

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>后台管理</Title>

      <Alert
        message="提示"
        description="请先在 Supabase Dashboard 中运行 admin_schema.sql 脚本初始化数据库表。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'users',
            label: <Space><UserOutlined />用户管理</Space>,
            children: <UserManagementTab />,
          },
          {
            key: 'roles',
            label: <Space><SafetyOutlined />角色管理</Space>,
            children: <RoleManagementTab />,
          },
          {
            key: 'departments',
            label: <Space><TeamOutlined />部门管理</Space>,
            children: <DepartmentManagementTab />,
          },
        ]}
      />
    </div>
  );
};

// ============================================
// 用户管理标签页
// ============================================
const UserManagementTab: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resettingUserName, setResettingUserName] = useState('');
  const [passwordForm] = Form.useForm();
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await getAllUsers();
      setUsers(result || []);
    } catch (error: any) {
      console.error('获取用户列表失败:', error?.message || error);
      message.error(error?.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const result = await getRoles();
      setRoles(result || []);
    } catch (error: any) {
      console.error('获取角色列表失败:', error?.message || error);
      message.error(error?.message || '获取角色列表失败');
    }
  };

  const fetchDepartments = async () => {
    try {
      const result = await getDepartments();
      setDepartments(result || []);
    } catch (error: any) {
      console.error('获取部门列表失败:', error?.message || error);
      message.error(error?.message || '获取部门列表失败');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchDepartments();
  }, []);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingUserId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (user: any) => {
    setEditingUserId(user.id);
    setIsCreating(false);
    form.setFieldsValue({
      full_name: user.full_name,
      role: user.role,
      department: user.department,
      email: undefined,
      password: undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (isCreating) {
        // 创建新用户：调用 Supabase Auth 注册
        const signUpResult = await signUp(values.email, values.password);

        if (!signUpResult?.user?.id) {
          throw new Error('创建用户失败，请检查 Supabase 邮箱确认设置');
        }

        // 等待指定时间，避免触发 Supabase 速率限制
        await new Promise(resolve => setTimeout(resolve, SIGNUP_COOLDOWN_MS));

        // 创建用户档案（若失败需提示管理员手动处理 Auth 用户）
        const { error } = await supabase
          .from('user_profiles')
          .insert([{
            id: signUpResult.user.id,
            full_name: values.full_name,
            role: values.role,
            department: values.department,
          }]);

        if (error) {
          console.error(
            '用户档案创建失败，Supabase Auth 中已创建用户（邮箱：' + values.email + '），请手动清理或重试。',
            error
          );
          throw new Error('用户档案创建失败，但 Auth 用户已创建，请联系开发者处理');
        }
        message.success('创建成功');
      } else if (editingUserId) {
        // 编辑用户 - 更新 full_name, role, department
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: values.full_name,
            role: values.role,
            department: values.department,
          })
          .eq('id', editingUserId);

        if (error) throw error;
        message.success('更新成功');
      }

      setModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('用户操作失败:', error?.message || error);
      message.error(error?.message || '操作失败');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
      message.success('删除成功');
      fetchUsers();
    } catch (error: any) {
      console.error('删除用户失败:', error?.message || error);
      message.error(error?.message || '删除失败');
    }
  };

  const handleResetPassword = (user: any) => {
    setResettingUserId(user.id);
    setResettingUserName(user.full_name || user.email);
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();

      if (!resettingUserId) {
        message.error('重置失败：用户 ID 为空');
        return;
      }

      await adminResetUserPassword(resettingUserId, values.password);
      message.success(`用户 ${resettingUserName} 的密码已重置`);
      setPasswordModalOpen(false);
      setResettingUserId(null);
      setResettingUserName('');
    } catch (error: any) {
      console.error('重置密码失败:', error?.message || error);
      message.error(error?.message || '重置密码失败');
    }
  };

  const renderDate = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return '-';
    }
  };

  const columns = [
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '姓名', dataIndex: 'full_name', key: 'full_name' },
    { title: '角色', dataIndex: 'role', key: 'role', render: (role: string) => <Tag color="blue">{role}</Tag> },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: renderDate },
    {
      title: '操作', key: 'action', width: 280,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => handleResetPassword(record)}>重置密码</Button>
          <Popconfirm title="确认删除该用户?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增用户</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={users} loading={loading} />

      <Modal
        title={isCreating ? '新增用户' : '编辑用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          {isCreating && (
            <>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效的邮箱地址' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '密码长度不能少于6位' }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="full_name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select>
              {roles.map((role: any) => (
                <Select.Option key={role.id} value={role.code}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Select allowClear placeholder="请选择部门">
              {departments.map((dept: any) => (
                <Select.Option key={dept.id} value={dept.name}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码模态框 */}
      <Modal
        title="重置用户密码"
        open={passwordModalOpen}
        onOk={handlePasswordSubmit}
        onCancel={() => { setPasswordModalOpen(false); setResettingUserId(null); }}
      >
        <Form form={passwordForm} layout="vertical">
          <Alert
            message={`正在重置用户: ${resettingUserName}`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码长度不能少于6位' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================
// 角色管理标签页
// ============================================
const RoleManagementTab: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(rolesRes || []);
      setPermissions(permsRes || []);
    } catch (error: any) {
      console.error('获取角色/权限数据失败:', error?.message || error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleEdit = async (role: any) => {
    setEditingRole(role.id);
    form.setFieldsValue({ name: role.name, code: role.code, description: role.description });

    const rolePerms = await getRolePermissions(role.id);
    setSelectedPermissions(rolePerms.map((rp: any) => rp.permission_id));
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingRole) {
        await updateRole(editingRole, values);
        await updateRolePermissions(editingRole, selectedPermissions);
        message.success('更新成功');
      } else {
        await createRole(values);
        message.success('创建成功');
      }

      setModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('角色操作失败:', error?.message || error);
      message.error(error?.message || '操作失败');
    }
  };

  const handleDelete = async (roleId: number) => {
    try {
      await deleteRole(roleId);
      message.success('删除成功');
      fetchData();
    } catch (error: any) {
      console.error('删除角色失败:', error?.message || error);
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '角色编码', dataIndex: 'code', key: 'code', render: (code: string) => <Tag>{code}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除该角色?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRole(null); form.resetFields(); setSelectedPermissions([]); setModalOpen(true); }}>新增角色</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={roles} loading={loading} />

      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
            <Input placeholder="如: admin, manager, staff" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="权限配置">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择权限"
              value={selectedPermissions}
              onChange={setSelectedPermissions}
            >
              {permissions.map((perm: any) => (
                <Select.Option key={perm.id} value={perm.id}>
                  {perm.name} ({perm.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================
// 部门管理标签页
// ============================================
const DepartmentManagementTab: React.FC = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<number | null>(null);
  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const result = await getDepartments();
      setDepartments(result || []);
    } catch (error: any) {
      console.error('获取部门列表失败:', error?.message || error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const handleEdit = (dept: any) => {
    setEditingDept(dept.id);
    form.setFieldsValue({ name: dept.name, description: dept.description });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingDept) {
        await updateDepartment(editingDept, values);
        message.success('更新成功');
      } else {
        await createDepartment(values);
        message.success('创建成功');
      }

      setModalOpen(false);
      fetchDepartments();
    } catch (error: any) {
      console.error('部门操作失败:', error?.message || error);
      message.error(error?.message || '操作失败');
    }
  };

  const handleDelete = async (deptId: number) => {
    try {
      await deleteDepartment(deptId);
      message.success('删除成功');
      fetchDepartments();
    } catch (error: any) {
      console.error('删除部门失败:', error?.message || error);
      message.error('删除失败');
    }
  };

  const renderDate = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return '-';
    }
  };

  const columns = [
    { title: '部门名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: renderDate },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除该部门?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchDepartments}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingDept(null); form.resetFields(); setModalOpen(true); }}>新增部门</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={departments} loading={loading} />

      <Modal
        title={editingDept ? '编辑部门' : '新增部门'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminPage;
