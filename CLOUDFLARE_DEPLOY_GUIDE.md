# 物资管理系统 — GitHub + Cloudflare Pages 完整部署指南

> 本文档适用于：**两江校区后勤物资管理系统**（React + Vite + Supabase）
> 更新时间：2026-06-21

---

## 一、系统架构总览

```
┌─────────────────────────────────────────────────────────┐
│                 浏览器（用户访问）                      │
│          https://your-domain.pages.dev                 │
└─────────────────────┬─────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          Cloudflare Pages（静态托管）                  │
│  • 托管 React 构建产物（dist/）                      │
│  • _redirects 处理 SPA 路由                          │
│  • _headers 配置缓存策略                              │
│  • 注入环境变量（VITE_SUPABASE_*）                    │
└─────────────────────┬─────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase（后端服务）                      │
│  • PostgreSQL 数据库（物资/供应商/出入库等数据）       │
│  • Auth 用户认证                                      │
│  • RLS 行级权限控制                                   │
│  • Realtime（可选）                                   │
│  • 项目地址：https://xxxxx.supabase.co               │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | SPA 单页应用 |
| 构建工具 | Vite 5 | 构建输出到 `dist/` |
| UI 组件库 | Ant Design 5 | 后台管理系统风格 |
| 路由 | React Router v6 | 客户端路由 |
| 后端服务 | Supabase | PostgreSQL + Auth + RLS |
| 部署平台 | Cloudflare Pages | 全球 CDN 加速 |
| 代码托管 | GitHub | 自动触发部署 |

### 项目结构

```
wzgl/
├── index.html                # 入口 HTML
├── main.tsx                 # React 入口，路由配置
├── vite.config.ts           # Vite 构建配置
├── package.json             # 依赖与脚本
├── tsconfig.json           # TypeScript 配置
├── _redirects              # ⭐ Cloudflare SPA 路由（已创建）
├── _headers                # ⭐ 缓存策略配置（已创建）
├── .env.example            # ⭐ 环境变量示例（已创建）
├── supabase_schema.sql     # 数据库初始化脚本
├── dist/                   # 构建产物（.gitignore）
├── pages/                  # 页面组件（10个页面）
│   ├── login.tsx           # 登录页
│   ├── dashboard.tsx       # 仪表盘
│   ├── materials.tsx        # 物资档案
│   ├── suppliers.tsx        # 供应商管理
│   ├── inbound.tsx          # 入库管理
│   ├── outbound.tsx         # 出库管理
│   ├── inventory.tsx        # 库存管理
│   ├── stocktaking.tsx      # 盘点管理
│   ├── reports.tsx          # 报表统计
│   ├── admin.tsx            # 后台管理
│   └── guide.tsx            # 使用指南
├── lib/
│   └── supabase.ts         # Supabase 客户端 + 所有 API 函数
└── layouts/
    └── index.tsx            # 主布局（侧边栏 + 顶栏）
```

---

## 二、前置准备

部署前需要确保以下事项已完成：

### 2.1 Supabase 后端（必须）

> 前端是纯静态应用，所有数据都存在 Supabase 中。
> **Supabase 不随 Cloudflare 部署，需要独立配置。**

1. 访问 https://supabase.com/dashboard 创建项目
2. 获取项目 URL 和 anon/public key
3. 在 SQL Editor 中运行 `supabase_schema.sql` 初始化数据库
4. 在 Auth → Users 中创建用户，并在 `user_profiles` 表中设置角色

**记录以下信息（部署时必须）：**

```
Supabase URL:      https://____________________.supabase.co
Supabase anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Supabase service key（可选）: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.2 GitHub 仓库

确保代码已在 GitHub 上：

```bash
# 检查当前状态
git status

# 如需首次推送
git init
git add .
git commit -m "Initial commit: 物资管理系统"
git remote add origin https://github.com/你的用户名/wzgl.git
git push -u origin main
```

> ⚠️ 注意：`.env.local` 必须在 `.gitignore` 中，不要提交到 GitHub！

### 2.3 Cloudflare 账号

- 访问 https://dash.cloudflare.com 注册/登录
- 免费计划已足够（每月 500 次构建，无限带宽）

---

## 三、将项目推送到 GitHub

### 3.1 检查 .gitignore

确保以下内容在 `.gitignore` 中：

```gitignore
# 环境变量（包含 Supabase key，禁止提交！）
.env
.env.local
.env.production

# 构建产物
dist/
node_modules/
```

### 3.2 提交并推送代码

```bash
# 添加所有文件（确认 .env.local 不会被提交）
git add .

# 检查暂存文件
git status

# 提交
git commit -m "feat: 准备部署到 Cloudflare Pages"

# 推送到 main 分支
git push origin main
```

---

## 四、Cloudflare Pages 部署（核心步骤）

### 步骤 1：创建 Pages 项目

1. 登录 https://dash.cloudflare.com
2. 左侧菜单 → **Workers & Pages**
3. 点击 **Create Application**
4. 选择 **Pages** 标签
5. 点击 **Connect to Git**
6. 授权 Cloudflare 访问你的 GitHub 账号
7. 选择仓库：`你的用户名/wzgl`
8. 点击 **Begin Setup**

### 步骤 2：配置构建设置

在设置页面填入以下信息：

| 字段 | 值 | 说明 |
|------|-----|------|
| **Project name** | `wzgl` | 会决定你的子域名：`wzgl.pages.dev` |
| **Production branch** | `main` | 推送到 main 时自动部署 |
| **Build command** | `npm install && npm run build` | 安装依赖 + 构建 |
| **Build output directory** | `dist` | Vite 构建输出目录 |
| **Root directory** | `/` | 保持默认（index.html 在根目录） |
| **Environment variables** | 见下方 | 先跳过，稍后在设置中配置 |

> ⚠️ **重要**：先不要点击"Save and Deploy"，需要先配置环境变量，否则构建成功但应用无法连接 Supabase。

### 步骤 3：配置环境变量（关键！）

在构建设置页面，展开 **Environment variables** 部分，添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | 你的 Supabase 项目 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` | Supabase anon/public key |
| `NODE_VERSION` | `18` | 指定 Node.js 版本（可选但推荐） |

> 📝 **说明**：Vite 只会将 `VITE_` 开头的环境变量暴露给前端代码（`import.meta.env.VITE_SUPABASE_URL`）。

**可选变量**（如需使用管理员功能）：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_SUPABASE_SERVICE_KEY` | `eyJhbGci...` | Supabase service role key（有完全数据库权限，慎用于前端） |

> ⚠️ **安全提示**：`VITE_` 开头的变量会被打包进前端代码，任何人都可以查看。Supabase 的 anon key 本身是设计给前端的，配合 RLS 策略是安全的。但 service key **不应**以 `VITE_` 前缀暴露！

### 步骤 4：开始部署

1. 确认构建设置和环境变量无误
2. 点击 **Save and Deploy**
3. Cloudflare 会开始构建，通常需要 **1-3 分钟**
4. 可以在 **Deployments** 标签中查看实时构建日志

### 步骤 5：验证部署结果

部署成功后：

1. 点击生成的预览链接（格式：`https://wzgl.pages.dev`）
2. 页面应正常加载登录界面
3. 打开浏览器开发者工具（F12）→ Console，确认没有 `Supabase 配置缺失` 错误
4. 尝试登录，验证是否能正常连接 Supabase

---

## 五、自动化部署工作流

Cloudflare Pages + GitHub 集成了自动化部署，**无需额外配置**：

```
你推送代码到 GitHub main 分支
        │
        ▼
Cloudflare 自动检测到推送
        │
        ▼
自动触发构建（npm install && npm run build）
        │
        ▼
构建成功后自动发布到 wzgl.pages.dev
        │
        ▼
用户访问时看到最新版本
```

### 手动触发部署（如需）

1. 进入 Pages 项目 → **Deployments** 标签
2. 点击 **Trigger Deploy** → **Deploy Latest Commit**

---

## 六、自定义域名（可选）

如果不想使用 `xxx.pages.dev` 子域名，可以绑定自己的域名：

### 前提条件

- 域名已注册（阿里云/腾讯云/GoDaddy 等均可）
- 域名的 DNS 解析权（能修改 NS 或添加 CNAME 记录）

### 操作步骤

1. Pages 项目 → **Custom Domains** 标签
2. 点击 **Set up a domain**
3. 输入你的域名（如 `wzgl.yourdomain.com`）
4. Cloudflare 会提示你添加 DNS 记录：

**如果域名已使用 Cloudflare DNS：**
- 自动配置，无需手动操作

**如果域名使用其他 DNS：**
- 添加 CNAME 记录：
  ```
  类型：CNAME
  名称：wzgl（或你要的子域名）
  值：wzgl.pages.dev
  ```

5. 等待 DNS 生效（几分钟到 24 小时不等）
6. Cloudflare 自动签发 SSL 证书（免费）

---

## 七、环境变量管理

### 查看/修改环境变量

1. Pages 项目 → **Settings** → **Environment variables**
2. 可以编辑、删除或添加新变量
3. **修改后需要重新部署**才能生效

### 为不同分支配置不同环境

Cloudflare Pages 支持为 `Production`（main 分支）和 `Preview`（PR 分支）配置不同的环境变量：

- 在 **Environment variables** 设置页面
- 选择 **Production** 或 **Preview** 环境
- 分别配置对应的 Supabase 项目（如生产库 vs 测试库）

---

## 八、常见问题排查

### 问题 1：页面白屏，Console 显示 "Supabase 配置缺失"

**原因**：环境变量未正确配置

**解决**：
1. 检查 Pages 项目 → Settings → Environment variables
2. 确认 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY` 已设置
3. 确认变量名拼写正确（必须 `VITE_` 前缀）
4. 重新部署

### 问题 2：刷新页面显示 404

**原因**：SPA 路由问题，Cloudflare 没有正确返回 `index.html`

**解决**：
1. 确认项目根目录有 `_redirects` 文件（本项目已创建）
2. 确认 `_redirects` 内容正确：
   ```
   /*  /index.html  200
   ```
3. 重新部署

### 问题 3：构建失败，提示 "npm: command not found"

**原因**：Node.js 版本问题

**解决**：
1. 在 Environment variables 中添加 `NODE_VERSION=18`
2. 重新部署

### 问题 4：构建成功但页面样式错乱

**原因**：可能是资源路径问题

**解决**：
1. 检查 `vite.config.ts` 中的 `base` 配置
2. 对于 Cloudflare Pages，应使用 `base: '/'` （本项目已正确配置）
3. 检查 `dist/` 目录下是否有 `assets/` 文件夹

### 问题 5：登录后跳转异常

**原因**：Supabase Auth 回调 URL 配置问题

**解决**：
1. 进入 Supabase Dashboard → Authentication → URL Configuration
2. 在 **Redirect URLs** 中添加：
   ```
   https://wzgl.pages.dev/**
   ```
3. 如果使用自定义域名，也一并添加：
   ```
   https://yourdomain.com/**
   ```

---

## 九、部署检查清单

部署完成后，按此清单逐一验证：

- [ ] 访问 `https://your-project.pages.dev` 能正常加载登录页
- [ ] 浏览器 Console 没有 `Supabase 配置缺失` 错误
- [ ] 能正常登录（Supabase Auth 工作正常）
- [ ] 登录后能看到仪表盘数据
- [ ] 各页面切换正常（React Router 工作正常）
- [ ] 刷新任意子页面（如 `/inbound`）不会 404
- [ ] 静态资源（JS/CSS）已正确加载（Network 标签查看）
- [ ] （可选）自定义域名已生效且 HTTPS 正常

---

## 十、文件变更说明

本次为支持 Cloudflare Pages 部署，新增/修改了以下文件：

| 文件 | 状态 | 说明 |
|------|------|------|
| `_redirects` | **新增** | SPA 路由重定向，解决刷新 404 问题 |
| `_headers` | **新增** | 配置 CDN 缓存策略 |
| `.env.example` | **新增** | 环境变量示例，方便团队成员配置 |
| `CLOUDFLARE_DEPLOY_GUIDE.md` | 更新 | 本文档（原文档内容已整合升级） |

**不需要修改的文件**：
- `vite.config.ts` — `base: '/'` 已正确配置
- `package.json` — `build` 脚本已正确配置
- `main.tsx` — 路由和 AuthGuard 无需变动

---

## 附：完整环境变量参考

### Supabase 相关（必须）

```env
# 从 Supabase Dashboard → Settings → API 获取
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 构建相关（可选）

```env
# 指定 Node.js 版本（Cloudflare Pages 默认可能较旧）
NODE_VERSION=18

# Vite 构建模式
VITE_MODE=production
```

---

*如有问题，检查 Cloudflare Pages 构建日志（项目 → Deployments → 点击某次部署 → View Build Logs）*
