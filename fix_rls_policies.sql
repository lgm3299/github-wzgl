-- ============================================
-- 修复 RLS 策略缺失问题
-- 问题：outbound_items、inbound_items、stocktaking_items
--        启用了 RLS 但没有创建 SELECT 策略，
--        导致所有查询被阻止，返回空数据。
-- 执行方式：在 Supabase Dashboard → SQL Editor 中执行
-- ============================================

-- 先删再建，避免重复报错
drop policy if exists "所有人可以查看入库明细" on public.inbound_items;
drop policy if exists "所有人可以查看出库明细" on public.outbound_items;
drop policy if exists "所有人可以查看盘点明细" on public.stocktaking_items;

-- inbound_items：所有人可查看（只要能看到入库单就能看明细）
create policy "所有人可以查看入库明细"
  on public.inbound_items for select to anon, authenticated
  using (true);

-- outbound_items：所有人可查看（只要能看到出库单就能看明细）
create policy "所有人可以查看出库明细"
  on public.outbound_items for select to anon, authenticated
  using (true);

-- stocktaking_items：所有人可查看（只要能看到盘点单就能看明细）
create policy "所有人可以查看盘点明细"
  on public.stocktaking_items for select to anon, authenticated
  using (true);

-- 确认 policy 已创建
do $$
declare
  pol record;
begin
  raise notice '✅ 已修复 RLS 策略：';
  for pol in
    select tablename, policyname
    from pg_policies
    where tablename in ('inbound_items','outbound_items','stocktaking_items')
    and policyname like '%查看%'
  loop
    raise notice '  - %.%', pol.tablename, pol.policyname;
  end loop;
end;
$$;
