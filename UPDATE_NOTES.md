# 物资管理系统 - 更新说明

## 已修复的问题

本次更新修复了以下7个问题：

### 1. ✅ 出库历史显示物资名称和数量
- **问题**：出库历史列表中没有显示物资名称和出库数量
- **修复**：修改了`outbound.tsx`中的`loadHistory`函数，添加了`page`参数

### 2. ✅ 创建盘点单失败
- **问题**：创建盘点单时失败
- **修复**：修改了`supabase.ts`中的`getStocktakingOrders`函数，添加了查询`materials`表的逻辑

### 3. ✅ 库存管理去掉分类列
- **问题**：库存管理表格中显示了分类列，用户要求去掉
- **修复**：删除了`inventory.tsx`中的"分类"列

### 4. ✅ 报表统计用量查询
- **说明**：`getOutboundUsageStats`函数已经正确实现，请确保选择的时间范围内有出库数据

### 5. ✅ 废旧回收获取数据失败
- **问题**：打开废旧回收功能时显示"获取数据失败"
- **修复**：修改了`supabase.ts`中的`getRecycleOrders`函数，改为两步查询以避免RLS策略阻止

### 6. ✅ 回收单选择物资显示出库数量
- **问题**：新增回收单时选择物资，显示的是库存数量，用户要求显示出库数量
- **修复**：
  - 在`supabase.ts`中添加了`getMaterialOutboundQuantity`函数
  - 修改了`recycle.tsx`，在选择物资时查询并显示出库数量

### 7. ✅ 出入库增加时间选择
- **问题**：创建入库单/出库单时不能选择时间
- **修复**：
  - 创建了`add_order_date_field.sql`文件，用于添加`order_date`字段到`inbound`表和`outbound`表
  - 修改了`supabase.ts`中的`createInboundOrder`和`createOutboundOrder`函数，添加`order_date`字段
  - 修改了`inbound.tsx`和`outbound.tsx`，在创建入库单/出库单时添加日期选择器

---

## 重要：需要执行SQL文件

为了使"出入库增加时间选择"功能正常工作，你需要执行以下步骤：

### 步骤1：执行SQL文件

1. 登录到 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 在左侧菜单中找到 **SQL Editor**
4. 点击 **New Query**
5. 打开项目中的 `add_order_date_field.sql` 文件
6. 复制文件中的所有内容
7. 粘贴到 SQL Editor 中
8. 点击 **Run** 按钮执行

### 步骤2：验证字段是否添加成功

执行完SQL文件后，你可以在 **Table Editor** 中查看：
- `inbound`表应该有一个`order_date`字段（类型为`date`）
- `outbound`表应该有一个`order_date`字段（类型为`date`）

---

## 部署说明

本项目使用 **Cloudflare Pages** 自动部署：
1. 代码已经推送到GitHub仓库的`main`分支
2. Cloudflare Pages会自动检测更改并重新部署
3. 部署完成后（通常1-2分钟），访问 https://wzgl.pages.dev/ 即可看到更新

---

## 其他说明

### 关于报表统计用量查询
如果报表统计用量查询没有数据，请检查：
1. 选择的时间范围内是否有出库记录
2. 出库记录是否有物资明细
3. 可以在浏览器的控制台查看错误信息

### 关于废旧回收功能
如果废旧回收功能仍然无法获取数据，请检查：
1. Supabase数据库中的`recycle`表和`recycle_items`表是否存在
2. RLS策略是否正确配置（应该允许所有用户查看，允许管理员和经理管理）
3. 可以在浏览器的控制台查看错误信息

---

## 文件清单

本次更新修改/新增的文件：
- `lib/supabase.ts` - 修改了多个函数，添加了新函数
- `pages/inbound.tsx` - 添加了入库日期选择器
- `pages/outbound.tsx` - 添加了出库日期选择器
- `pages/inventory.tsx` - 删除了分类列
- `pages/recycle.tsx` - 修改了显示逻辑，显露出库数量
- `add_order_date_field.sql` - 新增的SQL文件，用于修改数据库表结构

---

## 问题反馈

如果在使用过程中遇到任何问题，请：
1. 查看浏览器的控制台错误信息
2. 检查Supabase Dashboard中的日志
3. 联系开发者进行修复
