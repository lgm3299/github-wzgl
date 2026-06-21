# 项目长期记忆

## 物资管理系统 (wzgl)
- **项目类型**: React + TypeScript + Vite 前端，Supabase 后端
- **部署平台**: Cloudflare Pages（GitHub 自动部署，从 Vercel 迁移）
- **访问地址**: https://wzgl.pages.dev/
- **数据库**: Supabase (vrwfygsvsisxpjesxrfp.supabase.co)
- **构建命令**: `npm install && npm run build`
- **构建输出**: `dist/`（已验证本地构建成功）
- **dist 必需文件**: index.html, _redirects, _headers, assets/
- **SPA 路由**: `_redirects` 文件处理客户端路由（解决刷新 404）
- **环境变量**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`（在 CF Pages 设置）
- **GitHub 仓库**: lgm3299/wzgl

## 新增/修改文件（2026-06-21）
- `_redirects`：Cloudflare SPA 路由重定向（新增）
- `_headers`：CDN 缓存策略（新增）
- `.env.example`：环境变量示例（新增）
- `.gitignore`：防止敏感文件提交（新增）
- `CLOUDFLARE_DEPLOY_GUIDE.md`：完整部署指南（已更新，420行）
- **删除文件**：`vercel.json`、`.vercelignore`、`.vercel/` 目录、`SETUP_GUIDE.md`、`.github/workflows/deploy.yml`、`dist/` 目录（与 Cloudflare Pages 模式无关）
- **`pages/inbound.tsx`**：导入模板改为包含物资编码/名称/数量/单价/供应商/备注，入库单号由系统自动生成（调用 `createInboundOrder` API）

## 用户偏好
- 文档交付偏好: Excel/WPS/Word/真实PPTX，拒绝 HTML 演示文稿
- 验证习惯严谨: 先确认再收件，发现错误会要求修正
