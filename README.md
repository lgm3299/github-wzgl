# 两江校区后勤物资管理系统

## 快速启动

### 第一步：配置 Supabase

1. 在 https://supabase.com/dashboard 创建项目
2. 复制 Project URL 和 anon/public key
3. 编辑 `frontend/.env.local` 文件,填入配置:
```env
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的anon/public key
```

### 第二步：初始化数据库

1. 在 Supabase Dashboard → SQL Editor 中运行 `supabase_schema.sql` 脚本
2. 创建用户并设置角色(admin/manager/staff)

详细步骤请查看 [SETUP_GUIDE.md](SETUP_GUIDE.md)

### 第三步：安装依赖

```bash
cd frontend
npm install
```

### 第四步：启动项目

```bash
npm run dev
```

前端运行在 http://localhost:8000

## 技术栈

- **前端**: React 18 + Ant Design 5 + Vite + React Router
- **后端**: Supabase (PostgreSQL + Auth + RLS)
- **认证**: Supabase Auth
- **权限**: RBAC (基于行级安全)

## 项目结构

```
material-management/
├── frontend/          # 前端应用 (React + Vite)
│   └── src/
│       ├── pages/          # 页面组件 (10个)
│       ├── lib/            # Supabase 客户端和 API
│       ├── layouts/        # 布局组件
│       └── main.tsx        # 应用入口
├── supabase_schema.sql   # 数据库初始化脚本
├── SETUP_GUIDE.md        # 详细设置指南
├── package.json          # 前端依赖配置
└── vite.config.ts        # Vite 配置
```

## 功能模块

| 模块 | 说明 |
|------|------|
| 仪表盘 | 统计概览、最近出入库 |
| 物资档案 | 物资的增删改查 |
| 供应商管理 | 供应商的增删改查 |
| 入库管理 | 入库单创建、审批 |
| 出库管理 | 出库单创建、审批、完成 |
| 库存管理 | 库存列表、预警管理 |
| 盘点管理 | 盘点单创建、完成、查看 |
| 报表统计 | 出入库报表、库存报表 |
| 后台管理 | 用户、部门、角色管理 |

## 角色权限

| 角色 | 权限 |
|------|------|
| admin (管理员) | 全部权限 |
| director (后勤主管) | 审批、基础数据管理、报表 |
| manager (库管员) | 出入库、库存、盘点 |
| staff (普通职工) | 查询物资、发起出库 |

## 环境要求

- Node.js >= 18
