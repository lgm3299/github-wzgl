# Cloudflare Pages 部署指南

## 一、准备工作（一次性）

### 1. 注册/登录 Cloudflare
- 访问 https://dash.cloudflare.com
- 用邮箱或 Google 账号注册

### 2. 获取 API Token
1. 点击右上角头像 → My Profile
2. 左侧菜单 → API Tokens → Get started
3. 选择 **Edit Cloudflare Pages** 模板
4. 权限设置：
   - Zones → Zone → Read
   - Cloudflare Pages → Workers and Pages → Edit
5. 区域资源 → 选择你的域名（或 All zones）
6. 创建令牌
7. **复制保存好这个 Token**（只显示一次）

### 3. 获取 Account ID
1. 访问 https://dash.cloudflare.com
2. 点击右上角任意域名（或 "Workers & Pages"）
3. 在右侧面板中找到 **Account ID**（一串 32 位字符）
4. **复制保存**

## 二、创建 Cloudflare Pages 项目

1. 访问 https://dash.cloudflare.com → 左侧 "Workers & Pages" → "Create application" → "Pages"
2. 选择 **Connect to Git**
3. 授权连接你的 GitHub 账号
4. 选择仓库 `lgm3299/wzgl`
5. 配置构建设置：
   - **Project name**: `wzgl`（或你想要的名字）
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - 其他保持默认
6. 点击 "Save and Deploy"
7. 跳过环境变量（我们稍后在 Secrets 中配置）

## 三、配置 Secrets（环境变量）

1. 进入你刚创建的 Pages 项目
2. 点击 **Settings** → **Functions** → **Secrets**
3. 添加以下变量：

| 名称 | 值 |
|------|-----|
| VITE_SUPABASE_URL | 你的 Supabase 项目 URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | 你的 Supabase anon key |
| VITE_SUPABASE_SERVICE_KEY | （可选）你的 Supabase service key |
| CLOUDFLARE_API_TOKEN | 上面生成的 API Token |
| CLOUDFLARE_ACCOUNT_ID | 上面获取的 Account ID |

4. 点击 **Add** 保存

## 四、触发部署

有两种方式触发部署：

### 方式 1：手动触发（推荐第一次用）
1. 进入 Pages 项目 → **Deployments** 标签
2. 点击 **Trigger deploy** → **Deploy latest commit**

### 方式 2：自动触发
1. 每次 push 到 `main` 分支会自动触发
2. 或者在 GitHub 上运行 Workflow：
   - 进入仓库 → Actions 标签
   - 选择 "Deploy to Cloudflare Pages" workflow
   - 点击 "Run workflow"

## 五、访问地址

部署成功后，你会得到一个类似这样的地址：
```
https://wzgl.pages.dev
```

这个地址在中国大陆访问速度比 Vercel 快很多。

如果需要自定义域名：
1. Pages 项目 → **Custom domains**
2. 添加你自己的域名（需要 DNS 解析到 Cloudflare）

## 六、注意事项

- Supabase 的环境变量（VITE_SUPABASE_*）必须在 Cloudflare Pages 的 Secrets 中配置，否则登录后会报错
- 如果页面白屏，检查浏览器控制台（F12）是否有错误
- API Token 和 Account ID 不要提交到代码中，它们存储在 Cloudflare Secrets 里是安全的