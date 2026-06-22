-- ============================================
-- 物资管理系统 - 数据库修复脚本（使用 RPC 绕过 RLS）
-- 问题：outbound_items 等明细表启用 RLS 但缺少策略，
--        导致前端查询被阻止。
-- 解决：创建 SECURITY DEFINER RPC 函数绕过 RLS。
-- 执行方式：Supabase Dashboard → SQL Editor → 复制全部内容 → Run
-- ============================================

-- ============================================
-- 1. 补充缺失的 RLS 策略（直接修复，推荐）
-- ============================================
drop policy if exists "所有人可以查看入库明细" on public.inbound_items;
create policy "所有人可以查看入库明细"
  on public.inbound_items for select to anon, authenticated
  using (true);

drop policy if exists "所有人可以查看出库明细" on public.outbound_items;
create policy "所有人可以查看出库明细"
  on public.outbound_items for select to anon, authenticated
  using (true);

drop policy if exists "所有人可以查看盘点明细" on public.stocktaking_items;
create policy "所有人可以查看盘点明细"
  on public.stocktaking_items for select to anon, authenticated
  using (true);

-- ============================================
-- 2. RPC 函数：获取单个物资的出库总量（只统计已审批的）
-- ============================================
create or replace function get_material_outbound_qty(material_id_param bigint)
returns bigint
language plpgsql
security definer
set search_path = 'public'
as $$
declare
    total_qty bigint;
begin
    select coalesce(sum(oi.quantity), 0)
    into total_qty
    from outbound_items oi
    join outbound o on oi.outbound_id = o.id
    where oi.material_id = material_id_param
    and o.status in ('approved', 'completed');

    return total_qty;
end;
$$;

-- ============================================
-- 3. RPC 函数：获取所有已出库物资及其出库总量
-- ============================================
create or replace function get_all_outbound_quantities()
returns table(material_id bigint, total_quantity bigint)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
    return query
    select oi.material_id, coalesce(sum(oi.quantity), 0)::bigint
    from outbound_items oi
    join outbound o on oi.outbound_id = o.id
    where o.status in ('approved', 'completed')
    group by oi.material_id;
end;
$$;

-- ============================================
-- 验证
-- ============================================
do $$
begin
    raise notice '✅ 修复完成！';
    raise notice '  - inbound_items SELECT 策略已创建';
    raise notice '  - outbound_items SELECT 策略已创建';
    raise notice '  - stocktaking_items SELECT 策略已创建';
    raise notice '  - get_material_outbound_qty RPC 函数已创建';
    raise notice '  - get_all_outbound_quantities RPC 函数已创建';
end;
$$;
