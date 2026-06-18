-- 两江校区后勤物资管理系统 - Supabase 数据库 schema
-- 执行方式：在 Supabase Dashboard → SQL Editor 中运行此脚本

-- ============================================
-- 1. 物资分类表
-- ============================================
create table if not exists categories (
  id bigint primary key generated always as identity,
  name text not null unique,
  description text,
  created_at timestamp with time zone default now()
);

comment on table categories is '物资分类';
comment on column categories.name is '分类名称，如：办公用品、清洁用品、维修工具等';

-- ============================================
-- 2. 供应商表
-- ============================================
create table if not exists suppliers (
  id bigint primary key generated always as identity,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamp with time zone default now()
);

comment on table suppliers is '供应商信息';

-- ============================================
-- 3. 物资信息表
-- ============================================
create table if not exists materials (
  id bigint primary key generated always as identity,
  name text not null,
  code text not null unique,
  category_id bigint references categories(id),
  specification text,
  unit text not null,
  price decimal(10,2),
  min_stock integer default 10,
  location text,
  supplier_id bigint references suppliers(id),
  status integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

comment on table materials is '物资基本信息';

-- ============================================
-- 4. 入库记录表
-- ============================================
create table if not exists inbound (
  id bigint primary key generated always as identity,
  order_no text not null unique,
  supplier_id bigint references suppliers(id),
  operator text not null,
  status text default 'pending',
  remark text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

comment on table inbound is '物资入库记录';

create table if not exists inbound_items (
  id bigint primary key generated always as identity,
  inbound_id bigint references inbound(id) on delete cascade,
  material_id bigint references materials(id),
  quantity integer not null,
  unit_price decimal(10,2),
  total_amount decimal(10,2),
  remark text
);

comment on table inbound_items is '入库明细';

-- ============================================
-- 5. 出库记录表
-- ============================================
create table if not exists outbound (
  id bigint primary key generated always as identity,
  order_no text not null unique,
  recipient text not null,
  operator text not null,
  status text default 'pending',
  purpose text,
  remark text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

comment on table outbound is '物资出库记录';

create table if not exists outbound_items (
  id bigint primary key generated always as identity,
  outbound_id bigint references outbound(id) on delete cascade,
  material_id bigint references materials(id),
  quantity integer not null,
  remark text
);

comment on table outbound_items is '出库明细';

-- ============================================
-- 6. 库存表
-- ============================================
create table if not exists inventory (
  id bigint primary key generated always as identity,
  material_id bigint references materials(id) unique,
  quantity integer default 0,
  location text,
  updated_at timestamp with time zone default now()
);

comment on table inventory is '物资库存';

-- ============================================
-- 7. 盘点记录表
-- ============================================
create table if not exists stocktaking (
  id bigint primary key generated always as identity,
  order_no text not null unique,
  operator text not null,
  status text default 'draft',
  remark text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

comment on table stocktaking is '物资盘点记录';

create table if not exists stocktaking_items (
  id bigint primary key generated always as identity,
  stocktaking_id bigint references stocktaking(id) on delete cascade,
  material_id bigint references materials(id),
  system_quantity integer default 0,
  actual_quantity integer,
  difference integer,
  remark text
);

comment on table stocktaking_items is '盘点明细';

-- ============================================
-- 8. 用户表（用于认证）
-- ============================================
create table if not exists user_profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  role text default 'staff',
  department text,
  created_at timestamp with time zone default now()
);

comment on table user_profiles is '用户扩展信息';

-- ============================================
-- 插入测试数据
-- ============================================
insert into categories (name, description) values
  ('办公用品', '笔、纸、文件夹等办公消耗品'),
  ('清洁用品', '扫把、拖把、清洁剂等'),
  ('维修工具', '螺丝刀、扳手、电钻等维修工具'),
  ('电器设备', '电脑、打印机、空调等电器'),
  ('家具', '桌椅、柜子、床等家具')
on conflict (name) do nothing;

insert into suppliers (name, contact_person, phone, email) values
  ('办公用品有限公司', '张三', '13800138000', 'office@example.com'),
  ('清洁用品批发', '李四', '13900139000', 'cleaning@example.com'),
  ('五金工具行', '王五', '13700137000', 'tools@example.com')
on conflict do nothing;

insert into materials (name, code, category_id, specification, unit, price, min_stock, location) values
  ('A4打印纸', 'WZ001', 1, '80g/包', '包', 25.00, 20, '仓库A区'),
  ('签字笔', 'WZ002', 1, '黑色0.5mm', '支', 2.50, 50, '仓库A区'),
  ('扫把', 'WZ003', 2, '塑料扫把', '把', 15.00, 10, '仓库B区'),
  ('拖把', 'WZ004', 2, '棉纱拖把', '把', 20.00, 10, '仓库B区'),
  ('螺丝刀套装', 'WZ005', 3, '十字/一字各5把', '套', 35.00, 5, '仓库C区')
on conflict do nothing;

-- ============================================
-- 启用行级安全（RLS）
-- ============================================
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table materials enable row level security;
alter table inbound enable row level security;
alter table inbound_items enable row level security;
alter table outbound enable row level security;
alter table outbound_items enable row level security;
alter table inventory enable row level security;
alter table stocktaking enable row level security;
alter table stocktaking_items enable row level security;
alter table user_profiles enable row level security;

-- ============================================
-- RLS 辅助函数
-- ============================================
create or replace function is_admin()
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

create or replace function is_admin_or_manager()
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
end;
$$;

-- ============================================
-- 创建 RLS 策略
-- ============================================

-- 分类策略
drop policy if exists "所有人可以查看分类" on public.categories;
create policy "所有人可以查看分类"
  on public.categories for select to anon, authenticated
  using (true);

drop policy if exists "管理员可以管理分类" on public.categories;
create policy "管理员可以管理分类"
  on public.categories for all to authenticated
  using (is_admin());

-- 供应商策略
drop policy if exists "所有人可以查看供应商" on public.suppliers;
create policy "所有人可以查看供应商"
  on public.suppliers for select to anon, authenticated
  using (true);

drop policy if exists "管理员和经理可以管理供应商" on public.suppliers;
create policy "管理员和经理可以管理供应商"
  on public.suppliers for all to authenticated
  using (is_admin_or_manager());

-- 物资策略
drop policy if exists "所有人可以查看物资" on public.materials;
create policy "所有人可以查看物资"
  on public.materials for select to anon, authenticated
  using (true);

drop policy if exists "管理员和经理可以管理物资" on public.materials;
create policy "管理员和经理可以管理物资"
  on public.materials for all to authenticated
  using (is_admin_or_manager());

-- 入库策略
drop policy if exists "所有人可以查看入库记录" on public.inbound;
create policy "所有人可以查看入库记录"
  on public.inbound for select to anon, authenticated
  using (true);

drop policy if exists "管理员和经理可以创建入库记录" on public.inbound;
create policy "管理员和经理可以创建入库记录"
  on public.inbound for insert to authenticated
  with check (is_admin_or_manager());

-- 出库策略
drop policy if exists "所有人可以查看出库记录" on public.outbound;
create policy "所有人可以查看出库记录"
  on public.outbound for select to anon, authenticated
  using (true);

drop policy if exists "认证用户可以创建出库记录" on public.outbound;
create policy "认证用户可以创建出库记录"
  on public.outbound for insert to authenticated
  with check (auth.uid() is not null);

-- 用户资料策略
drop policy if exists "用户可以查看自己的资料" on public.user_profiles;
create policy "用户可以查看自己的资料"
  on public.user_profiles for select to authenticated
  using (is_admin() or id = auth.uid());

-- ============================================
-- 创建索引
-- ============================================
create index if not exists idx_materials_category on materials(category_id);
create index if not exists idx_materials_name on materials(name);
create index if not exists idx_inbound_created on inbound(created_at desc);
create index if not exists idx_outbound_created on outbound(created_at desc);

-- ============================================
-- 创建更新时间戳的触发器
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_materials_updated_at on materials;
create trigger update_materials_updated_at
  before update on materials
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_inbound_updated_at on inbound;
create trigger update_inbound_updated_at
  before update on inbound
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_outbound_updated_at on outbound;
create trigger update_outbound_updated_at
  before update on outbound
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_stocktaking_updated_at on stocktaking;
create trigger update_stocktaking_updated_at
  before update on stocktaking
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 完成提示
-- ============================================
do $$
begin
  raise notice '✅ 两江校区后勤物资管理系统数据库创建完成！';
  raise notice '📊 已创建表：categories, suppliers, materials, inbound, outbound, inventory, stocktaking, user_profiles';
  raise notice '🔒 已启用 RLS 并创建访问策略';
  raise notice '⚡ 已创建触发器和索引';
  raise notice '📝 已插入测试数据，可以开始使用了！';
end;
$$;
