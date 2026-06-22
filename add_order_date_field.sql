-- 为入库表和出库表添加order_date字段
-- 执行方式：在 Supabase Dashboard → SQL Editor 中运行此脚本

-- ============================================
-- 1. 为入库表添加order_date字段
-- ============================================
alter table if exists inbound 
add column if not exists order_date date default current_date;

comment on column inbound.order_date is '入库日期，默认为当前日期';

-- ============================================
-- 2. 为出库表添加order_date字段
-- ============================================
alter table if exists outbound 
add column if not exists order_date date default current_date;

comment on column outbound.order_date is '出库日期，默认为当前日期';

-- ============================================
-- 3. 创建索引以提高查询性能
-- ============================================
create index if not exists idx_inbound_order_date on inbound(order_date);
create index if not exists idx_outbound_order_date on outbound(order_date);

-- ============================================
-- 完成提示
-- ============================================
do $$
begin
  raise notice '✅ 已为入库表和出库表添加order_date字段！';
  raise notice '📅 现在创建入库单/出库单时可以选择日期';
end;
$$;
