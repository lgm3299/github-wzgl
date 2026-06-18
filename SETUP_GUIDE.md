# 两江校区后勤物资管理系统 - Supabase 设置指南

## 一、Supabase 项目配置

### 1.1 创建 Supabase 项目
1. 访问 https://supabase.com/dashboard
2. 点击 "New Project" 创建新项目
3. 填写项目名称、数据库密码等信息
4. 等待项目创建完成(约2-3分钟)

### 1.2 获取项目信息
1. 进入项目设置页面
2. 点击 "API" 菜单
3. 复制以下信息:
   - **Project URL**: 格式为 `https://xxxxx.supabase.co`
   - **anon/public key**: 格式为 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 1.3 配置环境变量
1. 打开 `material-management/frontend/.env.local` 文件
2. 替换以下内容:
   ```env
   VITE_SUPABASE_URL=https://你的项目ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=你的anon/public key
   ```

## 二、数据库初始化

### 2.1 运行数据库脚本
1. 在 Supabase Dashboard 中,点击左侧菜单 "SQL Editor"
2. 打开 `material-management/supabase_schema.sql` 文件
3. 复制全部内容
4. 粘贴到 SQL Editor 中
5. 点击 "Run" 按钮执行

### 2.2 验证数据库
执行成功后,会在左侧看到以下表:
- `categories` - 物资分类表
- `suppliers` - 供应商表
- `materials` - 物资档案表
- `inbound` - 入库记录表
- `inbound_items` - 入库明细表
- `outbound` - 出库记录表
- `outbound_items` - 出库明细表
- `inventory` - 库存表
- `stocktaking` - 盘点记录表
- `stocktaking_items` - 盘点明细表
- `user_profiles` - 用户信息表

## 三、用户注册与角色配置

### 3.1 注册用户
1. 启动前端应用: `cd frontend && npm run dev`
2. 打开浏览器访问 http://localhost:8000
3. 目前登录页面只有登录功能,需要先通过 Supabase 注册

### 3.2 手动创建用户资料
1. 在 Supabase Dashboard 中,点击 "Authentication" → "Users"
2. 点击 "Add user" 手动创建用户
3. 记录用户的 UUID

### 3.3 设置用户角色
1. 打开 "Table Editor"
2. 找到 `user_profiles` 表
3. 插入一条记录:
   - `id`: 用户的 UUID (从步骤3.2获取)
   - `full_name`: 用户姓名
   - `role`: 角色 (admin/manager/staff)
   - `department`: 部门名称

## 四、启动应用

### 4.1 安装依赖
```bash
cd material-management/frontend
npm install
```

### 4.2 启动开发服务器
```bash
npm run dev
```

### 4.3 访问应用
打开浏览器访问: http://localhost:8000

## 五、常见问题

### 5.1 数据库表不存在
- 确认已正确执行 `supabase_schema.sql` 脚本
- 检查 SQL Editor 是否有错误信息

### 5.2 认证失败
- 确认 `.env.local` 中的配置正确
- 确认 Supabase 项目已启动

### 5.3 权限不足
- 检查 `user_profiles` 表中的角色设置
- 确认用户已正确添加到 `auth.users` 表

## 六、部署

### 6.1 构建生产版本
```bash
npm run build
```

### 6.2 部署到 Vercel
1. 安装 Vercel CLI: `npm i -g vercel`
2. 运行: `vercel`
3. 按照提示完成部署

### 6.3 部署到 EdgeOne Pages
1. 登录 EdgeOne 控制台
2. 创建新项目
3. 选择构建产物目录 `dist`
4. 配置环境变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`
