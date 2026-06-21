# 两江校区后勤物资管理系统

> 基于 React + Vite + Supabase 的高校后勤物资全生命周期管理 Web 应用。支持物资档案、入库、出库、库存、盘点、报表统计及 RBAC 权限控制。
> 
> 部署平台：Cloudflare Pages（GitHub 自动构建）

---

## 一、技术架构

```
┌────────────────────────────────────────────────────────────┐
│                    浏览器（用户访问）                       │
│              https://wzgl.pages.dev（示例）               │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│           Cloudflare Pages（静态托管 + CDN）                │
│  • 构建命令：npm install && npm run build                  │
│  • 构建输出：dist/                                          │
│  • _redirects：SPA 路由重定向（刷新不 404）               │
│  • _headers：静态资源长期缓存、HTML 不缓存                 │
│  • 注入环境变量：VITE_SUPABASE_URL、VITE_SUPABASE_KEY     │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌────────────────────────────────────────────────────────────┐
│              Supabase（后端即服务）                          │
│  • PostgreSQL 数据库（10 张表）                            │
│  • Auth 用户认证（邮箱/密码）                              │
│  • RLS 行级安全（基于角色权限控制）                        │
│  • 项目地址：vrwfygsvsisxpjesxrfp.supabase.co              │
└────────────────────────────────────────────────────────────┘
```

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | React | 18.3 | SPA 单页应用，懒加载路由 |
| 构建工具 | Vite | 5.3 | 构建输出到 `dist/`，支持代码分割 |
| 语言 | TypeScript | 5.4 | 全项目类型安全 |
| UI 组件库 | Ant Design | 5.18 | 后台管理系统风格 |
| 路由 | React Router | 6.23 | 客户端路由 + AuthGuard 认证保护 |
| 后端服务 | Supabase | 2.39 | PostgreSQL + Auth + RLS |
| 部署平台 | Cloudflare Pages | — | 全球 CDN，GitHub 自动构建 |
| 代码托管 | GitHub | — | `lgm3299/github-wzgl` |

---

## 二、快速开始

### 2.1 克隆项目

```bash
git clone https://github.com/lgm3299/github-wzgl.git
cd github-wzgl
```

### 2.2 配置环境变量

复制环境变量示例文件并填入真实值：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> 注意：`.env.local` 已被 `.gitignore` 忽略，**不会提交到 GitHub**。

### 2.3 初始化数据库

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 在 SQL Editor 中运行 `supabase_schema.sql` 脚本
3. 脚本会自动创建表、索引、触发器、RLS 策略和测试数据

### 2.4 安装依赖并启动

```bash
npm install
npm run dev
```

前端运行在 http://localhost:8000

---

## 三、项目结构

```
github-wzgl/
├── index.html                    # 入口 HTML
├── main.tsx                      # React 入口 + 路由 + AuthGuard
├── vite.config.ts                # Vite 构建配置（代码分割、别名）
├── package.json                  # 依赖与脚本
├── tsconfig.json                 # TypeScript 配置
├── supabase_schema.sql           # 数据库初始化脚本（表 + RLS + 测试数据）
│
├── _redirects                    # Cloudflare Pages SPA 路由重定向
├── _headers                      # Cloudflare Pages 缓存策略
├── .env.example                  # 环境变量示例
├── .gitignore                    # 忽略规则（.env / dist / node_modules）
│
├── CLOUDFLARE_DEPLOY_GUIDE.md    # 完整部署指南（必读）
│
├── pages/                        # 页面组件（12 个页面）
│   ├── login.tsx                 # 登录页
│   ├── dashboard.tsx             # 仪表盘（统计概览）
│   ├── materials.tsx             # 物资档案（增删改查、分页、搜索）
│   ├── suppliers.tsx             # 供应商管理（增删改查）
│   ├── inbound.tsx               # 入库管理（入库单创建、审批、导入导出）
│   ├── outbound.tsx              # 出库管理（出库单创建、审批、库存扣减）
│   ├── inventory.tsx             # 库存管理（库存列表、预警）
│   ├── stocktaking.tsx           # 盘点管理（盘点单创建、完成）
│   ├── reports.tsx               # 报表统计（出入库统计）
│   ├── admin.tsx                 # 后台管理（用户/部门/角色/权限）
│   ├── guide.tsx                 # 使用指南
│   └── index.tsx                 # 页面导出索引
│
├── lib/                          # 核心库
│   ├── supabase.ts               # Supabase 客户端 + 所有 API 函数
│   └── importExport.ts           # CSV 导入/导出工具（模板下载、数据解析）
│
└── layouts/
    └── index.tsx                 # 主布局（侧边栏导航 + 顶栏用户信息）
```

---

## 四、功能模块

| 模块 | 功能说明 |
|------|----------|
| **仪表盘** | 统计概览：物资总数、供应商数、出入库数量、本月出入库、库存预警 |
| **物资档案** | 物资增删改查，支持分类筛选、关键词搜索、分页、时间范围筛选 |
| **供应商管理** | 供应商增删改查，支持关键词搜索 |
| **入库管理** | 入库单创建（自动生成单号 RK+日期+随机数）、审批、完成（自动更新库存）；支持 CSV 批量导入（按供应商分组，物资编码/名称匹配） |
| **出库管理** | 出库单创建（自动生成单号 CK+日期+随机数）、审批、完成（自动扣减库存）；支持库存充足检查 |
| **库存管理** | 实时库存列表，关联物资信息，库存预警（低于最低库存量） |
| **盘点管理** | 盘点单创建、完成，系统库存 vs 实际库存对比 |
| **报表统计** | 出入库统计报表 |
| **后台管理** | 用户管理、部门管理、角色管理、权限分配、密码重置 |
| **使用指南** | 系统操作说明 |

### 入库导入说明

入库管理支持 CSV 批量导入，模板字段包括：

| 字段 | 必填 | 说明 |
|------|------|------|
| 物资编码 | 二选一 | 物资编码，用于匹配物资 |
| 物资名称 | 二选一 | 物资名称，编码为空时按名称匹配 |
| 数量 | 是 | 入库数量 |
| 单位 | 否 | 物资单位 |
| 单价(元) | 否 | 入库单价 |
| 供应商 | 是 | 供应商名称（按名称自动匹配 supplier_id） |
| 备注 | 否 | 备注信息 |

> 入库单号由系统自动生成（`RK20260621001` 格式），无需手动填写。

---

## 五、数据库设计

### 5.1 数据表（10 张）

| 表名 | 说明 | 关联 |
|------|------|------|
| `categories` | 物资分类 | — |
| `suppliers` | 供应商信息 | — |
| `materials` | 物资基本信息 | → categories, suppliers |
| `inbound` | 入库记录（主表） | → suppliers |
| `inbound_items` | 入库明细 | → inbound, materials |
| `outbound` | 出库记录（主表） | — |
| `outbound_items` | 出库明细 | → outbound, materials |
| `inventory` | 库存表 | → materials |
| `stocktaking` | 盘点记录（主表） | — |
| `stocktaking_items` | 盘点明细 | → stocktaking, materials |
| `user_profiles` | 用户扩展信息 | → auth.users |

### 5.2 安全策略（RLS）

所有数据表已启用行级安全（RLS），核心策略：

- **所有人可查看**：categories、suppliers、materials、inbound、outbound
- **管理员/经理可管理**：categories、suppliers、materials
- **管理员/经理可创建入库**：inbound
- **认证用户可创建出库**：outbound
- **用户只能查看自己的资料**：user_profiles

### 5.3 辅助功能

- 触发器：自动更新 `updated_at` 时间戳（materials、inbound、outbound、stocktaking）
- 索引：materials(name, category_id)、inbound(created_at)、outbound(created_at)
- 单号生成：入库 `RK` + 日期 + 3位随机数；出库 `CK` + 日期 + 3位随机数

---

## 六、角色权限

| 角色 | 代码 | 权限说明 |
|------|------|----------|
| 管理员 | `admin` | 全部权限（用户管理、角色分配、系统配置） |
| 后勤主管 | `director` | 审批、基础数据管理、报表查看 |
| 库管员 | `manager` | 出入库操作、库存管理、盘点管理 |
| 普通职工 | `staff` | 查询物资、发起出库申请 |

> 角色通过 `user_profiles.role` 字段控制，RLS 策略据此判断操作权限。

---

## 七、部署指南

本项目部署在 **Cloudflare Pages**，通过 **GitHub 集成**实现自动构建和部署。

详细步骤请参考：

### [CLOUDFLARE_DEPLOY_GUIDE.md](CLOUDFLARE_DEPLOY_GUIDE.md)

简要流程：

```
git push origin main
        │
        ▼
Cloudflare 自动检测推送
        │
        ▼
自动构建：npm install && npm run build
        │
        ▼
构建成功后发布到 wzgl.pages.dev
```

### 部署前检查清单

- [ ] 代码已推送到 GitHub `main` 分支
- [ ] Cloudflare Pages 已连接 GitHub 仓库
- [ ] 环境变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY` 已配置
- [ ] `Build command` = `npm install && npm run build`
- [ ] `Build output directory` = `dist`
- [ ] `Root directory` = `/`
- [ ] Supabase 中已配置 Redirect URLs（包含 `https://your-domain.pages.dev/**`）

---

## 八、环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `VITE_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 是 | Supabase anon/public key（前端使用） |
| `VITE_SUPABASE_SERVICE_KEY` | 否 | Supabase service role key（管理员功能，可选） |

> Vite 只会将 `VITE_` 前缀的环境变量暴露给前端代码。`VITE_SUPABASE_SERVICE_KEY` 有完全数据库权限，谨慎使用。

---

## 九、常见问题

### 1. 刷新页面显示 404

确认项目根目录有 `_redirects` 文件，内容：

```
/*  /index.html  200
```

### 2. 页面白屏，Console 显示 "Supabase 配置缺失"

检查 Cloudflare Pages 环境变量是否正确配置了 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`，然后重新部署。

### 3. 构建失败

- 检查 `package.json` 中的 `build` 脚本是否为 `vite build`
- 检查 `vite.config.ts` 中 `outDir` 是否为 `dist`
- 在 Cloudflare 环境变量中添加 `NODE_VERSION=18`

---

## 十、更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-06-21 | 迁移部署到 Cloudflare Pages，添加 `_redirects`/`_headers`/` .env.example`/` .gitignore`；删除 Vercel/EdgeOne 相关文件；入库管理导入模板支持物资明细，入库单号自动生成 |

---

## 许可

本项目为高校后勤内部使用，仅供学习交流。
