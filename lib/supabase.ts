import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// ============================================
// 常量配置（便于统一修改）
// ============================================
const ORDER_NO_PREFIX = {
  INBOUND: 'RK',
  OUTBOUND: 'CK',
  STOCKTAKING: 'PD',
} as const;

const ORDER_NO_RANDOM_LENGTH = 3;
const ORDER_NO_DATE_FORMAT = 'YYYYMMDD'; // 用于注释说明日期格式
const DATE_TIME_START = ' 00:00:00';
const DATE_TIME_END = ' 23:59:59';
const DEFAULT_PAGE_SIZE = 20;

// ============================================
// Supabase 客户端初始化
// ============================================

// 验证配置
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 配置缺失！请检查 .env.local 文件');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING');
}

// 创建普通客户端（用于普通操作）
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 创建管理员客户端（用于管理操作）
let adminSupabase: SupabaseClient | null = null;
if (supabaseServiceKey && supabaseUrl) {
  adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================
// 安全包装器：获取 supabase 客户端，未配置时抛出明确错误
// ============================================
function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase 未配置，请在 Vercel 添加环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY'
    );
  }
  return supabase;
}

function getAdminSupabase(): SupabaseClient {
  if (!adminSupabase) {
    throw new Error('Supabase 管理员客户端未配置，请设置 VITE_SUPABASE_SERVICE_KEY');
  }
  return adminSupabase;
}

// ============================================
// 通用工具函数
// ============================================

/**
 * 生成唯一订单号
 * 格式：前缀 + YYYYMMDD + 3位随机数
 * 注意：高并发场景下建议使用数据库序列或 UUID
 */
function generateOrderNo(prefix: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = String(Math.floor(Math.random() * 1000)).padStart(ORDER_NO_RANDOM_LENGTH, '0');
  return `${prefix}${dateStr}${random}`;
}

/**
 * 输入验证：必填字段
 */
function requireValue<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined || value === '') {
    throw new Error(`参数错误：${fieldName} 不能为空`);
  }
  return value;
}

/**
 * 安全地获取分页参数
 */
function getPaginationParams(params?: any): { start: number; end: number } | null {
  if (!params?.page || !params?.pageSize) return null;
  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;
  return { start, end };
}

/**
 * 安全地构建日期范围查询
 */
function applyDateRange(query: any, field: string, startDate?: string, endDate?: string) {
  let q = query;
  if (startDate && endDate) {
    q = q.gte(field, startDate + DATE_TIME_START).lte(field, endDate + DATE_TIME_END);
  } else if (startDate) {
    q = q.gte(field, startDate + DATE_TIME_START);
  } else if (endDate) {
    q = q.lte(field, endDate + DATE_TIME_END);
  }
  return q;
}

// ============================================
// 认证相关函数
// ============================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  department?: string;
}

export async function signUp(email: string, password: string) {
  requireValue(email, 'email');
  requireValue(password, 'password');
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) {
    console.error('[signUp] 注册失败:', error.message);
    throw error;
  }
  return data;
}

export async function signIn(email: string, password: string) {
  requireValue(email, 'email');
  requireValue(password, 'password');
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[signIn] 登录失败:', error.message);
    throw error;
  }
  return data;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) {
    console.error('[signOut] 登出失败:', error.message);
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { session }, error } = await getSupabase().auth.getSession();
    if (error || !session) return null;

    const { data: profile, error: profileError } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.warn('[getCurrentUser] 获取用户资料失败:', profileError.message);
    }

    // 关键修复：即使 profile 查询失败或不存在，只要有 session 就返回用户
    // 避免因为 user_profiles 表缺失/RLS 策略问题导致已登录用户被踢出
    return { ...session.user, ...profile } as User;
  } catch (error) {
    console.error('[getCurrentUser] 异常:', error);
    return null;
  }
}

// ============================================
// 物资分类相关函数
// ============================================

export interface Category {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export async function getCategories() {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .order('name');
  if (error) {
    console.error('[getCategories] 查询失败:', error.message);
    throw error;
  }
  return data || [];
}

// ============================================
// 供应商相关函数
// ============================================

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
}

export async function getSuppliers(params?: any) {
  const pg = getPaginationParams(params);
  let query = getSupabase().from('suppliers').select('*');

  if (params?.keyword) {
    query = query.ilike('name', `%${params.keyword}%`);
  }

  if (pg) {
    query = query.range(pg.start, pg.end);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[getSuppliers] 查询失败:', error.message);
    throw error;
  }

  // 单独查询总数（不使用 head: true）
  let total = 0;
  if (pg) {
    const { count, error: countError } = await getSupabase()
      .from('suppliers')
      .select('*', { count: 'exact', head: false });
    if (countError) {
      console.error('[getSuppliers] 查询总数失败:', countError.message);
    }
    total = count || 0;
  } else {
    total = (data || []).length;
  }

  return {
    data: data || [],
    total,
  };
}

export async function createSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>) {
  requireValue(supplier.name, 'name');
  const { data, error } = await getSupabase()
    .from('suppliers')
    .insert([supplier])
    .select()
    .single();
  if (error) {
    console.error('[createSupplier] 创建失败:', error.message);
    throw error;
  }
  return data;
}

export async function updateSupplier(id: number, supplier: Partial<Supplier>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('suppliers')
    .update(supplier)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[updateSupplier] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

export async function deleteSupplier(id: number) {
  requireValue(id, 'id');
  const { error } = await getSupabase()
    .from('suppliers')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteSupplier] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 物资档案相关函数
// ============================================

export interface Material {
  id: number;
  name: string;
  code: string;
  category_id: number;
  specification?: string;
  unit: string;
  price?: number;
  min_stock: number;
  location?: string;
  supplier_id?: number;
  status: number;
  created_at: string;
  updated_at: string;
}

export async function getMaterials(params?: any) {
  const pg = getPaginationParams(params);
  let query = getSupabase()
    .from('materials')
    .select('*, categories(name)');

  if (params?.keyword) {
    query = query.or(`name.ilike.%${params.keyword}%,code.ilike.%${params.keyword}%`);
  }

  if (params?.category_id) {
    query = query.eq('category_id', params.category_id);
  }

  if (params?.status !== undefined) {
    query = query.eq('status', params.status);
  }

  query = applyDateRange(query, 'created_at', params?.startDate, params?.endDate);

  if (pg) {
    query = query.range(pg.start, pg.end);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[getMaterials] 查询失败:', error.message);
    throw error;
  }

  // 单独查询总数（不使用 head: true，避免 HEAD 请求被 RLS 阻止）
  let total = 0;
  if (pg) {
    const { count, error: countError } = await getSupabase()
      .from('materials')
      .select('*', { count: 'exact', head: false });
    if (countError) {
      console.error('[getMaterials] 查询总数失败:', countError.message);
    }
    total = count || 0;
  } else {
    total = (data || []).length;
  }

  return {
    data: data || [],
    total,
  };
}

export async function createMaterial(material: Omit<Material, 'id' | 'created_at' | 'updated_at'>) {
  requireValue(material.name, 'name');
  requireValue(material.code, 'code');
  requireValue(material.unit, 'unit');
  const { data, error } = await getSupabase()
    .from('materials')
    .insert([material])
    .select('*, categories(name)')
    .single();
  if (error) {
    console.error('[createMaterial] 创建失败:', error.message);
    throw error;
  }
  return data;
}

export async function updateMaterial(id: number, material: Partial<Material>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('materials')
    .update(material)
    .eq('id', id)
    .select('*, categories(name)')
    .single();
  if (error) {
    console.error('[updateMaterial] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

export async function deleteMaterial(id: number) {
  requireValue(id, 'id');
  const { error } = await getSupabase()
    .from('materials')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteMaterial] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 入库相关函数
// ============================================

export interface InboundOrder {
  id: number;
  order_no: string;
  supplier_id: number;
  operator: string;
  status: string;
  remark?: string;
  order_date?: string;
  created_at: string;
  updated_at: string;
  items?: InboundItem[];
}

export interface InboundItem {
  id: number;
  inbound_id: number;
  material_id: number;
  quantity: number;
  unit_price?: number;
  total_amount?: number;
  remark?: string;
}

export async function getInboundOrders(params?: any) {
  const pg = getPaginationParams(params);
  let query = getSupabase()
    .from('inbound')
    .select('*');

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  query = applyDateRange(query, 'created_at', params?.startDate, params?.endDate);

  if (pg) {
    query = query.range(pg.start, pg.end);
  }

  const { data: orders, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[getInboundOrders] 查询失败:', error.message);
    throw error;
  }

  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: any) => o.id);

  // 单独查询入库明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('inbound_items')
    .select('*')
    .in('inbound_id', orderIds);

  // 获取所有不重复的 material_id
  const materialIds = [...new Set((items || []).map((item: any) => item.material_id).filter(Boolean))];

  // 单独查询物资信息
  const { data: materialsData, error: matError } = await getSupabase()
    .from('materials')
    .select('id, name, code')
    .in('id', materialIds);

  if (matError) {
    console.error('[getInboundOrders] 查询物资失败:', matError.message);
  }

  // 建立物资信息映射
  const materialMap: Record<number, any> = {};
  (materialsData || []).forEach((mat: any) => {
    materialMap[mat.id] = {
      name: mat.name || '未知物资',
      code: mat.code || '-',
    };
  });

  // 单独查询供应商
  const supplierIds = [...new Set(orders.map((o: any) => o.supplier_id).filter(Boolean))];
  const { data: suppliersData, error: supError } = await getSupabase()
    .from('suppliers')
    .select('id, name')
    .in('id', supplierIds);

  if (supError) {
    console.error('[getInboundOrders] 查询供应商失败:', supError.message);
  }

  const supplierMap: Record<number, any> = {};
  (suppliersData || []).forEach((s: any) => {
    supplierMap[s.id] = { name: s.name || '-' };
  });

  const itemsByOrderId: Record<number, any[]> = {};
  (items || []).forEach((item: any) => {
    const oid = item.inbound_id;
    if (!itemsByOrderId[oid]) itemsByOrderId[oid] = [];
    itemsByOrderId[oid].push({
      ...item,
      materials: item.material_id ? materialMap[item.material_id] || null : null,
    });
  });

  return orders.map((order: any) => ({
    ...order,
    suppliers: supplierMap[order.supplier_id] || { name: '-' },
    inbound_items: itemsByOrderId[order.id] || [],
  }));
}

/**
 * 创建入库单
 * 注意：创建入库单和插入明细非原子操作。
 * 若明细插入失败，已创建的入库单需要通过补偿逻辑清理。
 * 生产环境建议使用数据库 RPC 事务。
 */
export async function createInboundOrder(order: Omit<InboundOrder, 'id' | 'order_no' | 'created_at' | 'updated_at'>) {
  requireValue(order.supplier_id, 'supplier_id');
  requireValue(order.operator, 'operator');

  const orderNo = generateOrderNo(ORDER_NO_PREFIX.INBOUND);

  // 创建入库单
  const { data: orderData, error: orderError } = await getSupabase()
    .from('inbound')
    .insert([{
      order_no: orderNo,
      supplier_id: order.supplier_id,
      operator: order.operator,
      status: order.status || 'draft',
      remark: order.remark,
      order_date: order.order_date || new Date().toISOString().split('T')[0],
    }])
    .select()
    .single();

  if (orderError) {
    console.error('[createInboundOrder] 创建入库单失败:', orderError.message);
    throw orderError;
  }

  // 如果有物资明细，插入明细
  if (order.items && order.items.length > 0) {
    const items = order.items.map((item: any) => ({
      inbound_id: orderData.id,
      material_id: requireValue(item.material_id, 'items[].material_id'),
      quantity: requireValue(item.quantity, 'items[].quantity'),
      unit_price: item.unit_price || 0,
      total_amount: item.total_amount || 0,
      remark: item.remark || '',
    }));

    const { error: itemsError } = await getSupabase()
      .from('inbound_items')
      .insert(items);

    if (itemsError) {
      // 补偿：删除已创建的入库单
      console.error('[createInboundOrder] 插入明细失败，补偿删除入库单:', itemsError.message, { orderId: orderData.id });
      await getSupabase().from('inbound').delete().eq('id', orderData.id);
      throw itemsError;
    }
  }

  return orderData;
}

export async function updateInboundOrder(id: number, order: Partial<InboundOrder>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('inbound')
    .update(order)
    .eq('id', id)
    .select('*, inbound_items(*)')
    .single();
  if (error) {
    console.error('[updateInboundOrder] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

export async function updateInboundOrderStatus(id: number, status: string) {
  requireValue(id, 'id');
  requireValue(status, 'status');
  const { data, error } = await getSupabase()
    .from('inbound')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateInboundOrderStatus] 更新失败:', error.message, { id, status });
    throw error;
  }

  return data;
}

/**
 * 审批入库单并更新库存
 * 注意：更新状态和更新库存非原子操作，存在竞态风险。
 * 生产环境建议使用数据库 RPC 事务 + 行级锁。
 */
export async function approveInboundOrder(id: number) {
  requireValue(id, 'id');

  // 1. 获取入库单（不含明细，避免关联查询被RLS阻止）
  const { data: order, error: orderError } = await getSupabase()
    .from('inbound')
    .select('*')
    .eq('id', id)
    .single();

  if (orderError) {
    console.error('[approveInboundOrder] 查询入库单失败:', orderError.message, { id });
    throw orderError;
  }
  if (!order) {
    throw new Error('入库单不存在');
  }

  // 1.5 单独查询入库明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('inbound_items')
    .select('*')
    .eq('inbound_id', id);

  if (itemsError) {
    console.error('[approveInboundOrder] 查询明细失败:', itemsError.message, { id });
    throw itemsError;
  }

  // 2. 更新状态为已完成
  const { error: updateError } = await getSupabase()
    .from('inbound')
    .update({ status: 'completed' })
    .eq('id', id);

  if (updateError) {
    console.error('[approveInboundOrder] 更新状态失败:', updateError.message, { id });
    throw updateError;
  }

  // 3. 串行更新库存（避免并行竞态导致数据不一致）
  const inboundItems = (items || []) as any[];

  if (inboundItems.length === 0) {
    return { ...order, inbound_items: [] };
  }

  for (const item of inboundItems) {
    if (!item.material_id || !item.quantity) {
      console.warn('[approveInboundOrder] 跳过无效明细:', item);
      continue;
    }

    // 先查询当前库存
    const { data: existingInv, error: invError } = await getSupabase()
      .from('inventory')
      .select('quantity')
      .eq('material_id', item.material_id)
      .single();

    if (invError && invError.code !== 'PGRST116') {
      // PGRST116 = no rows returned，允许库存记录不存在
      console.error('[approveInboundOrder] 查询库存失败:', invError.message, { materialId: item.material_id });
      throw invError;
    }

    const currentQuantity = existingInv?.quantity || 0;
    const newQuantity = currentQuantity + item.quantity;

    // 使用 upsert 更新库存
    const { error: upsertError } = await getSupabase()
      .from('inventory')
      .upsert({
        material_id: item.material_id,
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'material_id' });

    if (upsertError) {
      console.error('[approveInboundOrder] 更新库存失败:', upsertError.message, { materialId: item.material_id });
      throw upsertError;
    }
  }

  return order;
}

export async function completeInboundOrder(id: number) {
  return await updateInboundOrderStatus(id, 'completed');
}

export async function deleteInboundOrder(id: number) {
  requireValue(id, 'id');

  // 先查询入库单状态，已审批的单据不能删除
  const { data: order, error: orderError } = await getSupabase()
    .from('inbound')
    .select('status')
    .eq('id', id)
    .single();

  if (orderError) {
    console.error('[deleteInboundOrder] 查询入库单失败:', orderError.message, { id });
    throw new Error('查询入库单失败: ' + orderError.message);
  }
  if (!order) {
    throw new Error('入库单不存在');
  }
  if (order.status === 'approved' || order.status === 'completed') {
    throw new Error('已审批的入库单不能删除，请先反审核');
  }

  const { error } = await getSupabase()
    .from('inbound')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteInboundOrder] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 出库相关函数
// ============================================

export interface OutboundOrder {
  id: number;
  order_no: string;
  recipient: string;
  operator: string;
  status: string;
  purpose?: string;
  remark?: string;
  order_date?: string;
  created_at: string;
  updated_at: string;
  items?: OutboundItem[];
}

export interface OutboundItem {
  id: number;
  outbound_id: number;
  material_id: number;
  quantity: number;
  remark?: string;
}

export async function getOutboundOrders(params?: any) {
  const pg = getPaginationParams(params);
  let query = getSupabase()
    .from('outbound')
    .select('*');

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  query = applyDateRange(query, 'created_at', params?.startDate, params?.endDate);

  if (pg) {
    query = query.range(pg.start, pg.end);
  }

  const { data: orders, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[getOutboundOrders] 查询失败:', error.message);
    throw error;
  }

  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: any) => o.id);

  // 单独查询出库明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('outbound_items')
    .select('*')
    .in('outbound_id', orderIds);

  // 获取所有不重复的material_id
  const materialIds = [...new Set((items || []).map((item: any) => item.material_id).filter(Boolean))];
  
  // 单独查询物资信息
  const { data: materialsData, error: matError } = await getSupabase()
    .from('materials')
    .select('id, name, code')
    .in('id', materialIds);
  
  if (matError) {
    console.error('[getOutboundOrders] 查询物资失败:', matError.message);
  }

  // 建立物资信息映射
  const materialMap: Record<number, any> = {};
  (materialsData || []).forEach((mat: any) => {
    materialMap[mat.id] = {
      name: mat.name || '未知物资',
      code: mat.code || '-',
    };
  });

  if (itemsError) {
    console.error('[getOutboundOrders] 查询明细失败:', itemsError.message);
  }

  const itemsByOrderId: Record<number, any[]> = {};
  (items || []).forEach((item: any) => {
    const oid = item.outbound_id;
    if (!itemsByOrderId[oid]) itemsByOrderId[oid] = [];
    itemsByOrderId[oid].push({
      ...item,
      materials: item.material_id ? materialMap[item.material_id] || null : null,
    });
  });

  return orders.map((order: any) => ({
    ...order,
    outbound_items: itemsByOrderId[order.id] || [],
  }));
}

/**
 * 创建出库单
 * 注意：创建出库单和插入明细非原子操作，若明细插入失败会补偿删除入库单。
 * 生产环境建议使用数据库 RPC 事务。
 */
export async function createOutboundOrder(order: Omit<OutboundOrder, 'id' | 'order_no' | 'created_at' | 'updated_at'>) {
  requireValue(order.recipient, 'recipient');
  requireValue(order.operator, 'operator');

  const orderNo = generateOrderNo(ORDER_NO_PREFIX.OUTBOUND);

  // 创建出库单
  const { data: orderData, error: orderError } = await getSupabase()
    .from('outbound')
    .insert([{
      order_no: orderNo,
      recipient: order.recipient,
      operator: order.operator,
      status: order.status || 'draft',
      purpose: order.purpose,
      remark: order.remark,
      order_date: order.order_date || new Date().toISOString().split('T')[0],
    }])
    .select()
    .single();

  if (orderError) {
    console.error('[createOutboundOrder] 创建出库单失败:', orderError.message);
    throw orderError;
  }

  // 如果有物资明细，插入明细
  if (order.items && order.items.length > 0) {
    const items = order.items.map((item: any) => ({
      outbound_id: orderData.id,
      material_id: requireValue(item.material_id, 'items[].material_id'),
      quantity: requireValue(item.quantity, 'items[].quantity'),
      remark: item.remark || '',
    }));

    const { error: itemsError } = await getSupabase()
      .from('outbound_items')
      .insert(items);

    if (itemsError) {
      // 补偿：删除已创建的出库单
      console.error('[createOutboundOrder] 插入明细失败，补偿删除出库单:', itemsError.message, { orderId: orderData.id });
      await getSupabase().from('outbound').delete().eq('id', orderData.id);
      throw itemsError;
    }
  }

  return orderData;
}

export async function updateOutboundOrder(id: number, order: Partial<OutboundOrder>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('outbound')
    .update(order)
    .eq('id', id)
    .select('*, outbound_items(*)')
    .single();
  if (error) {
    console.error('[updateOutboundOrder] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

export async function updateOutboundOrderStatus(id: number, status: string) {
  requireValue(id, 'id');
  requireValue(status, 'status');
  const { data, error } = await getSupabase()
    .from('outbound')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateOutboundOrderStatus] 更新失败:', error.message, { id, status });
    throw error;
  }

  return data;
}

/**
 * 审批出库单并扣减库存
 * 注意：
 * 1. 更新状态和扣减库存非原子操作，存在竞态风险。
 * 2. 扣减前会检查库存是否充足，防止超卖。
 * 生产环境建议使用数据库 RPC 事务 + 行级锁。
 */
export async function approveOutboundOrder(id: number) {
  requireValue(id, 'id');

  // 1. 获取出库单（不含明细，避免关联查询被RLS阻止）
  const { data: order, error: orderError } = await getSupabase()
    .from('outbound')
    .select('*')
    .eq('id', id)
    .single();

  if (orderError) {
    console.error('[approveOutboundOrder] 查询出库单失败:', orderError.message, { id });
    throw orderError;
  }
  if (!order) {
    throw new Error('出库单不存在');
  }

  // 1.5 单独查询出库明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('outbound_items')
    .select('*')
    .eq('outbound_id', id);

  if (itemsError) {
    console.error('[approveOutboundOrder] 查询明细失败:', itemsError.message, { id });
    throw itemsError;
  }

  // 2. 更新状态为已完成
  const { error: updateError } = await getSupabase()
    .from('outbound')
    .update({ status: 'completed' })
    .eq('id', id);

  if (updateError) {
    console.error('[approveOutboundOrder] 更新状态失败:', updateError.message, { id });
    throw updateError;
  }

  // 3. 串行扣减库存（避免并行竞态）
  const outboundItems = (items || []) as any[];

  if (outboundItems.length === 0) {
    return { ...order, outbound_items: [] };
  }

  for (const item of outboundItems) {
    if (!item.material_id || !item.quantity) {
      console.warn('[approveOutboundOrder] 跳过无效明细:', item);
      continue;
    }

    // 先获取当前库存
    const { data: currentInv, error: invError } = await getSupabase()
      .from('inventory')
      .select('quantity')
      .eq('material_id', item.material_id)
      .single();

    if (invError && invError.code !== 'PGRST116') {
      console.error('[approveOutboundOrder] 查询库存失败:', invError.message, { materialId: item.material_id });
      throw invError;
    }

    const currentQty = currentInv?.quantity || 0;

    // 检查库存是否充足（防止超卖）
    if (currentQty < item.quantity) {
      const errorMsg = `库存不足：物资ID=${item.material_id}，当前库存=${currentQty}，出库数量=${item.quantity}`;
      console.error('[approveOutboundOrder]', errorMsg);
      throw new Error(errorMsg);
    }

    const newQty = currentQty - item.quantity;

    // 使用 upsert 更新库存
    const { error: upsertError } = await getSupabase()
      .from('inventory')
      .upsert({
        material_id: item.material_id,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'material_id' });

    if (upsertError) {
      console.error('[approveOutboundOrder] 更新库存失败:', upsertError.message, { materialId: item.material_id });
      throw upsertError;
    }
  }

  return order;
}

export async function completeOutboundOrder(id: number) {
  return await approveOutboundOrder(id);
}

export async function deleteOutboundOrder(id: number) {
  requireValue(id, 'id');

  // 先查询出库单状态（不含明细，避免关联查询被RLS阻止）
  const { data: order, error: orderError } = await getSupabase()
    .from('outbound')
    .select('id, status')
    .eq('id', id)
    .single();

  if (orderError) {
    console.error('[deleteOutboundOrder] 查询出库单失败:', orderError.message, { id });
    throw new Error('查询出库单失败: ' + orderError.message);
  }
  if (!order) {
    throw new Error('出库单不存在');
  }

  // 如果已审批/已完成，需要先回滚库存
  if (order.status === 'approved' || order.status === 'completed') {
    // 单独查询出库明细
    const { data: items, error: itemsError } = await getSupabase()
      .from('outbound_items')
      .select('material_id, quantity')
      .eq('outbound_id', id);

    if (itemsError) {
      console.error('[deleteOutboundOrder] 查询明细失败:', itemsError.message, { id });
      throw itemsError;
    }

    const outboundItems = (items || []) as any[];
    for (const item of outboundItems) {
      if (!item.material_id || !item.quantity) continue;

      // 查询当前库存
      const { data: currentInv, error: invError } = await getSupabase()
        .from('inventory')
        .select('quantity')
        .eq('material_id', item.material_id)
        .single();

      if (invError && invError.code !== 'PGRST116') {
        console.error('[deleteOutboundOrder] 查询库存失败:', invError.message, { materialId: item.material_id });
        throw invError;
      }

      const currentQty = currentInv?.quantity || 0;
      const newQty = currentQty + item.quantity;

      // 回滚库存（加回出库数量）
      const { error: upsertError } = await getSupabase()
        .from('inventory')
        .upsert({
          material_id: item.material_id,
          quantity: newQty,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'material_id' });

      if (upsertError) {
        console.error('[deleteOutboundOrder] 回滚库存失败:', upsertError.message, { materialId: item.material_id });
        throw upsertError;
      }
    }
  }

  // 删除出库单（关联的 outbound_items 通过外键级联删除或单独删除）
  const { error: itemsDeleteError } = await getSupabase()
    .from('outbound_items')
    .delete()
    .eq('outbound_id', id);

  if (itemsDeleteError) {
    console.error('[deleteOutboundOrder] 删除明细失败:', itemsDeleteError.message, { id });
    throw itemsDeleteError;
  }

  const { error } = await getSupabase()
    .from('outbound')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteOutboundOrder] 删除出库单失败:', error.message, { id });
    throw error;
  }
}

export async function checkInventory(materialId: number, quantity: number): Promise<{ sufficient: boolean; current: number }> {
  requireValue(materialId, 'materialId');
  requireValue(quantity, 'quantity');

  const { data: inv, error } = await getSupabase()
    .from('inventory')
    .select('quantity')
    .eq('material_id', materialId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[checkInventory] 查询失败:', error.message, { materialId });
    throw error;
  }

  const currentQty = inv?.quantity || 0;
  return {
    sufficient: currentQty >= quantity,
    current: currentQty,
  };
}

// ============================================
// 库存相关函数
// ============================================

export interface Inventory {
  id: number;
  material_id: number;
  quantity: number;
  location?: string;
  updated_at: string;
  material?: Material;
}

export async function getInventories(params?: any) {
  // 先查询库存数据
  let query = getSupabase()
    .from('inventory')
    .select('*');

  query = applyDateRange(query, 'updated_at', params?.startDate, params?.endDate);

  const { data: inventoryData, error } = await query.order('updated_at', { ascending: false });
  if (error) {
    console.error('[getInventories] 查询失败:', error.message);
    throw error;
  }

  if (!inventoryData || inventoryData.length === 0) return [];

  // 获取所有不重复的 material_id
  const materialIds = [...new Set(inventoryData.map((item: any) => item.material_id).filter(Boolean))];
  console.log('[getInventories] inventoryData count:', inventoryData.length, 'materialIds:', materialIds);

  if (materialIds.length === 0) {
    console.warn('[getInventories] 所有 inventory 记录的 material_id 为空');
    return inventoryData.map((item: any) => ({ ...item, material: null }));
  }

  // 单独查询物资数据（含分类）
  const { data: materialsData, error: matError } = await getSupabase()
    .from('materials')
    .select('id, code, name, categories(name)')
    .in('id', materialIds);

  console.log('[getInventories] materialsData count:', materialsData?.length, 'matError:', matError?.message);

  if (matError) {
    console.error('[getInventories] 查询物资失败:', matError.message);
    return inventoryData.map((item: any) => ({ ...item, material: null }));
  }

  if (!materialsData || materialsData.length === 0) {
    console.warn('[getInventories] materials 表未返回任何数据');
    return inventoryData.map((item: any) => ({ ...item, material: null }));
  }

  // 建立 id -> material 的映射
  const materialMap: Record<number, any> = {};
  (materialsData || []).forEach((mat: any) => {
    materialMap[mat.id] = {
      id: mat.id,
      code: mat.code || '-',
      name: mat.name || '未知物资',
      categories: mat.categories ? { name: mat.categories.name } : null,
    };
  });

  // 合并数据
  const result = inventoryData.map((item: any) => ({
    ...item,
    material: item.material_id ? materialMap[item.material_id] || null : null,
  }));
  console.log('[getInventories] 合并结果样本:', result.slice(0, 3).map((r: any) => ({ id: r.id, material_id: r.material_id, material_name: r.material?.name })));
  return result;
}

export async function deleteInventory(id: number) {
  requireValue(id, 'id');
  const { error } = await getSupabase()
    .from('inventory')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteInventory] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 盘点相关函数
// ============================================

export interface StocktakingOrder {
  id: number;
  order_no: string;
  operator: string;
  status: string;
  remark?: string;
  created_at: string;
  updated_at: string;
  items?: StocktakingItem[];
}

export interface StocktakingItem {
  id: number;
  stocktaking_id: number;
  material_id: number;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  remark?: string;
}

export interface RecycleOrder {
  id: number;
  order_no: string;
  operator: string;
  recycler: string;
  recycle_date: string;
  status: string;
  remark?: string;
  created_at: string;
  updated_at: string;
  items?: RecycleItem[];
}

export interface RecycleItem {
  id: number;
  recycle_id: number;
  material_id: number;
  quantity: number;
  remark?: string;
  materials?: {
    name: string;
    code: string;
    unit: string;
  };
}

export async function getStocktakingOrders(params?: any) {
  const pg = getPaginationParams(params);
  let query = getSupabase()
    .from('stocktaking')
    .select('*');

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  query = applyDateRange(query, 'created_at', params?.startDate, params?.endDate);

  if (pg) {
    query = query.range(pg.start, pg.end);
  }

  const { data: orders, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[getStocktakingOrders] 查询失败:', error.message);
    throw error;
  }

  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: any) => o.id);

  // 单独查询盘点明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('stocktaking_items')
    .select('*')
    .in('stocktaking_id', orderIds);

  if (itemsError) {
    console.error('[getStocktakingOrders] 查询明细失败:', itemsError.message);
  }

  // 查询物资信息
  const materialIds = [...new Set((items || []).map((item: any) => item.material_id).filter(Boolean))];
  const { data: materialsData, error: matError } = await getSupabase()
    .from('materials')
    .select('id, name, code, unit')
    .in('id', materialIds);

  if (matError) {
    console.error('[getStocktakingOrders] 查询物资失败:', matError.message);
  }

  const materialMap: Record<number, any> = {};
  (materialsData || []).forEach((mat: any) => {
    materialMap[mat.id] = {
      name: mat.name || '未知物资',
      code: mat.code || '-',
      unit: mat.unit || '个',
    };
  });

  const itemsByOrderId: Record<number, any[]> = {};
  (items || []).forEach((item: any) => {
    const oid = item.stocktaking_id;
    if (!itemsByOrderId[oid]) itemsByOrderId[oid] = [];
    itemsByOrderId[oid].push({
      ...item,
      materials: item.material_id ? materialMap[item.material_id] || null : null,
    });
  });

  return orders.map((order: any) => ({
    ...order,
    stocktaking_items: itemsByOrderId[order.id] || [],
  }));
}

export async function createStocktakingOrder(order: Omit<StocktakingOrder, 'id' | 'order_no' | 'created_at' | 'updated_at' | 'status' | 'items'> & { status?: string; items?: any[] }) {
  requireValue(order.operator, 'operator');
  const orderNo = generateOrderNo(ORDER_NO_PREFIX.STOCKTAKING);

  // 创建盘点单
  const { data: orderData, error: orderError } = await getSupabase()
    .from('stocktaking')
    .insert([{
      order_no: orderNo,
      operator: order.operator,
      status: order.status || 'draft',
      remark: order.remark,
    }])
    .select()
    .single();

  if (orderError) {
    console.error('[createStocktakingOrder] 创建盘点单失败:', orderError.message);
    throw orderError;
  }

  // 创建盘点明细
  if (order.items && order.items.length > 0) {
    const items = order.items.map((item: any) => ({
      stocktaking_id: orderData.id,
      material_id: requireValue(item.material_id, 'items[].material_id'),
      system_quantity: item.system_quantity || 0,
      actual_quantity: item.actual_quantity ?? 0,
      difference: item.difference || 0,
      remark: item.remark || '',
    }));

    const { error: itemsError } = await getSupabase()
      .from('stocktaking_items')
      .insert(items);

    if (itemsError) {
      console.error('[createStocktakingOrder] 插入明细失败，补偿删除盘点单:', itemsError.message, { orderId: orderData.id });
      await getSupabase().from('stocktaking').delete().eq('id', orderData.id);
      throw itemsError;
    }
  }

  return orderData;
}

export async function updateStocktakingOrder(id: number, order: Partial<StocktakingOrder>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('stocktaking')
    .update(order)
    .eq('id', id)
    .select('*, stocktaking_items(*)')
    .single();
  if (error) {
    console.error('[updateStocktakingOrder] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

/**
 * 更新盘点明细的实际数量
 */
export async function updateStocktakingItemActualQuantity(itemId: number, actualQuantity: number) {
  requireValue(itemId, 'itemId');
  const { error } = await getSupabase()
    .from('stocktaking_items')
    .update({ actual_quantity: actualQuantity })
    .eq('id', itemId);
  if (error) {
    console.error('[updateStocktakingItemActualQuantity] 更新失败:', error.message, { itemId });
    throw error;
  }
}

/**
 * 完成盘点并调整库存
 * 注意：更新库存非原子操作，生产环境建议使用数据库 RPC 事务。
 */
export async function approveStocktakingOrder(id: number) {
  requireValue(id, 'id');

  // 1. 获取盘点单（不含明细，避免关联查询被RLS阻止）
  const { data: order, error: orderError } = await getSupabase()
    .from('stocktaking')
    .select('*')
    .eq('id', id)
    .single();

  if (orderError) {
    console.error('[approveStocktakingOrder] 查询盘点单失败:', orderError.message, { id });
    throw orderError;
  }
  if (!order) {
    throw new Error('盘点单不存在');
  }

  // 1.5 单独查询盘点明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('stocktaking_items')
    .select('*')
    .eq('stocktaking_id', id);

  if (itemsError) {
    console.error('[approveStocktakingOrder] 查询明细失败:', itemsError.message, { id });
    throw itemsError;
  }

  const stocktakingItems = (items || []) as any[];

  // 2. 检查是否所有物资都已填写实际数量
  const hasUnfilled = stocktakingItems.some((item: any) =>
    item.actual_quantity === null || item.actual_quantity === undefined
  );
  if (hasUnfilled) {
    throw new Error('请确保所有物资都已填写实际盘点数量');
  }

  // 3. 计算差异并更新明细
  for (const item of stocktakingItems) {
    const difference = (item.actual_quantity || 0) - (item.system_quantity || 0);
    const { error: itemError } = await getSupabase()
      .from('stocktaking_items')
      .update({ difference })
      .eq('id', item.id);

    if (itemError) {
      console.error('[approveStocktakingOrder] 更新差异失败:', itemError.message, { itemId: item.id });
      throw itemError;
    }
  }

  // 4. 更新盘点单状态为已完成
  const { error: updateError } = await getSupabase()
    .from('stocktaking')
    .update({ status: 'completed' })
    .eq('id', id);

  if (updateError) {
    console.error('[approveStocktakingOrder] 更新状态失败:', updateError.message, { id });
    throw updateError;
  }

  // 5. 根据差异调整库存
  for (const item of stocktakingItems) {
    if (!item.material_id) continue;

    const difference = (item.actual_quantity || 0) - (item.system_quantity || 0);
    if (difference === 0) continue;

    const { data: currentInv, error: invError } = await getSupabase()
      .from('inventory')
      .select('quantity')
      .eq('material_id', item.material_id)
      .single();

    if (invError && invError.code !== 'PGRST116') {
      console.error('[approveStocktakingOrder] 查询库存失败:', invError.message, { materialId: item.material_id });
      throw invError;
    }

    const currentQty = currentInv?.quantity || 0;
    const newQty = currentQty + difference;

    if (newQty < 0) {
      throw new Error(`库存不足：物资ID=${item.material_id}，当前库存=${currentQty}，需扣减=${-difference}`);
    }

    const { error: upsertError } = await getSupabase()
      .from('inventory')
      .upsert({
        material_id: item.material_id,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'material_id' });

    if (upsertError) {
      console.error('[approveStocktakingOrder] 更新库存失败:', upsertError.message, { materialId: item.material_id });
      throw upsertError;
    }
  }

  return order;
}

/**
 * 删除盘点单并回滚库存
 */
export async function deleteStocktakingOrder(id: number) {
  requireValue(id, 'id');

  // 先查询盘点单状态及明细
  const { data: order, error: orderError } = await getSupabase()
    .from('stocktaking')
    .select('status, stocktaking_items(*)')
    .eq('id', id)
    .single();

  if (orderError) {
    console.error('[deleteStocktakingOrder] 查询盘点单失败:', orderError.message, { id });
    throw new Error('查询盘点单失败: ' + orderError.message);
  }
  if (!order) {
    throw new Error('盘点单不存在');
  }

  // 如果已完成，需要回滚库存（反向调整差异）
  if (order.status === 'completed') {
    const items = (order as any).stocktaking_items || [];
    for (const item of items) {
      if (!item.material_id) continue;

      const difference = (item.actual_quantity || 0) - (item.system_quantity || 0);
      if (difference === 0) continue;

      // 回滚：反向操作差异
      const { data: currentInv, error: invError } = await getSupabase()
        .from('inventory')
        .select('quantity')
        .eq('material_id', item.material_id)
        .single();

      if (invError && invError.code !== 'PGRST116') {
        console.error('[deleteStocktakingOrder] 查询库存失败:', invError.message, { materialId: item.material_id });
        throw invError;
      }

      const currentQty = currentInv?.quantity || 0;
      const newQty = currentQty - difference; // 反向回滚：如果差异为正（盘盈），则减去；如果差异为负（盘亏），则加回

      if (newQty < 0) {
        throw new Error(`库存不足，无法回滚：物资ID=${item.material_id}，当前库存=${currentQty}，需回滚=${-difference}`);
      }

      const { error: upsertError } = await getSupabase()
        .from('inventory')
        .upsert({
          material_id: item.material_id,
          quantity: newQty,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'material_id' });

      if (upsertError) {
        console.error('[deleteStocktakingOrder] 回滚库存失败:', upsertError.message, { materialId: item.material_id });
        throw upsertError;
      }
    }
  }

  // 删除盘点单（stocktaking_items 通过外键级联删除）
  const { error } = await getSupabase()
    .from('stocktaking')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteStocktakingOrder] 删除盘点单失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 回收相关函数
// ============================================

export async function getRecycleOrders(params?: any) {
  const pg = getPaginationParams(params);
  let query = getSupabase()
    .from('recycle')
    .select('*');

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  query = applyDateRange(query, 'created_at', params?.startDate, params?.endDate);

  if (pg) {
    query = query.range(pg.start, pg.end);
  }

  const { data: orders, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('[getRecycleOrders] 查询失败:', error.message);
    throw error;
  }

  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o: any) => o.id);

  // 单独查询回收明细
  const { data: items, error: itemsError } = await getSupabase()
    .from('recycle_items')
    .select('*')
    .in('recycle_id', orderIds);

  if (itemsError) {
    console.error('[getRecycleOrders] 查询明细失败:', itemsError.message);
  }

  // 查询物资信息
  const materialIds = [...new Set((items || []).map((item: any) => item.material_id).filter(Boolean))];
  const { data: materialsData, error: matError } = await getSupabase()
    .from('materials')
    .select('id, name, code, unit')
    .in('id', materialIds);

  if (matError) {
    console.error('[getRecycleOrders] 查询物资失败:', matError.message);
  }

  const materialMap: Record<number, any> = {};
  (materialsData || []).forEach((mat: any) => {
    materialMap[mat.id] = {
      name: mat.name || '未知物资',
      code: mat.code || '-',
      unit: mat.unit || '个',
    };
  });

  const itemsByOrderId: Record<number, any[]> = {};
  (items || []).forEach((item: any) => {
    const oid = item.recycle_id;
    if (!itemsByOrderId[oid]) itemsByOrderId[oid] = [];
    itemsByOrderId[oid].push({
      ...item,
      materials: item.material_id ? materialMap[item.material_id] || null : null,
    });
  });

  return orders.map((order: any) => ({
    ...order,
    recycle_items: itemsByOrderId[order.id] || [],
  }));
}

export async function createRecycleOrder(order: Omit<RecycleOrder, 'id' | 'order_no' | 'created_at' | 'updated_at'> & { items?: any[] }) {
  requireValue(order.operator, 'operator');
  requireValue(order.recycler, 'recycler');
  const orderNo = generateOrderNo('HS');

  const { data: orderData, error: orderError } = await getSupabase()
    .from('recycle')
    .insert([{
      order_no: orderNo,
      operator: order.operator,
      recycler: order.recycler,
      recycle_date: order.recycle_date || new Date().toISOString().split('T')[0],
      status: order.status || 'pending',
      remark: order.remark,
    }])
    .select()
    .single();

  if (orderError) {
    console.error('[createRecycleOrder] 创建回收单失败:', orderError.message);
    throw orderError;
  }

  // 插入明细
  if (order.items && order.items.length > 0) {
    const { error: itemsError } = await getSupabase()
      .from('recycle_items')
      .insert(order.items.map((item: any) => ({
        recycle_id: orderData.id,
        material_id: item.material_id,
        quantity: item.quantity,
        remark: item.remark,
      })));

    if (itemsError) {
      console.error('[createRecycleOrder] 插入明细失败:', itemsError.message);
      // 补偿删除主单
      await getSupabase().from('recycle').delete().eq('id', orderData.id);
      throw itemsError;
    }
  }

  return orderData;
}

export async function updateRecycleOrderStatus(id: number, status: string) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('recycle')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[updateRecycleOrderStatus] 更新失败:', error.message, { id, status });
    throw error;
  }
  return data;
}

export async function deleteRecycleOrder(id: number) {
  requireValue(id, 'id');
  const { error } = await getSupabase()
    .from('recycle')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteRecycleOrder] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 用量统计函数
// ============================================

export async function getMaterialOutboundQuantity(materialId: number): Promise<number> {
  requireValue(materialId, 'materialId');

  try {
    // 先查该物资已审批出库单的ID（只统计已审批的）
    const { data: approvedOrders, error: orderError } = await getSupabase()
      .from('outbound')
      .select('id')
      .in('status', ['approved', 'completed']);

    if (orderError) {
      console.error('[getMaterialOutboundQuantity] 查询出库单失败:', orderError.message);
      return 0;
    }

    if (!approvedOrders || approvedOrders.length === 0) return 0;

    const orderIds = approvedOrders.map((o: any) => o.id);

    // 查这些出库单中该物资的出库总量
    const { data, error } = await getSupabase()
      .from('outbound_items')
      .select('quantity')
      .eq('material_id', materialId)
      .in('outbound_id', orderIds);

    if (error) {
      console.error('[getMaterialOutboundQuantity] 查询失败:', error.message);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    const total = data.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    return total;
  } catch (error: any) {
    console.error('[getMaterialOutboundQuantity] 异常:', error.message);
    return 0;
  }
}

export async function getOutboundUsageStats(startDate?: string, endDate?: string) {
  try {
    // 先查询时间范围内的出库单ID
    let ordersQuery = getSupabase()
      .from('outbound')
      .select('id, created_at');

    if (startDate) {
      ordersQuery = ordersQuery.gte('created_at', startDate + 'T00:00:00');
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte('created_at', endDate + 'T23:59:59');
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      console.error('[getOutboundUsageStats] 查询出库单失败:', ordersError.message);
      throw ordersError;
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    const orderIds = orders.map((o: any) => o.id);

    // 查询出库明细
    const { data: items, error: itemsError } = await getSupabase()
      .from('outbound_items')
      .select('material_id, quantity')
      .in('outbound_id', orderIds);

    if (itemsError) {
      console.error('[getOutboundUsageStats] 查询明细失败:', itemsError.message);
      throw itemsError;
    }

    if (!items || items.length === 0) {
      return [];
    }

    // 查询物资信息
    const materialIds = [...new Set(items.map((item: any) => item.material_id).filter(Boolean))];
    const { data: materialsData, error: matError } = await getSupabase()
      .from('materials')
      .select('id, name, code, unit')
      .in('id', materialIds);

    if (matError) {
      console.error('[getOutboundUsageStats] 查询物资失败:', matError.message);
    }

    const materialMap: Record<number, any> = {};
    (materialsData || []).forEach((mat: any) => {
      materialMap[mat.id] = mat;
    });

    // 按物资分组统计
    const stats: Record<number, { material_id: number; name: string; code: string; unit: string; total_quantity: number }> = {};

    items.forEach((item: any) => {
      const mid = item.material_id;
      if (!mid) return;
      if (!stats[mid]) {
        const mat = materialMap[mid];
        stats[mid] = {
          material_id: mid,
          name: mat?.name || '未知物资',
          code: mat?.code || '-',
          unit: mat?.unit || '个',
          total_quantity: 0,
        };
      }
      stats[mid].total_quantity += Number(item.quantity) || 0;
    });

    // 按消耗量降序排序
    return Object.values(stats).sort((a, b) => b.total_quantity - a.total_quantity);
  } catch (error: any) {
    console.error('[getOutboundUsageStats] 统计失败:', error.message);
    throw error;
  }
}

// ============================================
// 报表相关函数
// ============================================

export async function getDashboardStats() {
  try {
    const [
      { count: materialsCount },
      { count: suppliersCount },
      { count: inboundCount },
      { count: outboundCount },
    ] = await Promise.all([
      getSupabase().from('materials').select('*', { count: 'exact', head: false }),
      getSupabase().from('suppliers').select('*', { count: 'exact', head: false }),
      getSupabase().from('inbound').select('*', { count: 'exact', head: false }),
      getSupabase().from('outbound').select('*', { count: 'exact', head: false }),
    ]);

    const now = new Date();
    const monthStart = now.toISOString().split('T')[0].slice(0, 7) + '-01';

    const [
      { count: inboundThisMonth },
      { count: outboundThisMonth },
    ] = await Promise.all([
      getSupabase().from('inbound').select('*', { count: 'exact', head: false }).gte('created_at', monthStart),
      getSupabase().from('outbound').select('*', { count: 'exact', head: false }).gte('created_at', monthStart),
    ]);

    let warningCount = 0;
    try {
      const { data: inventories, error: invError } = await getSupabase()
        .from('inventory')
        .select('quantity, materials(min_stock)');

      if (invError) {
        console.warn('[getDashboardStats] 获取预警数量失败:', invError.message);
      } else if (inventories) {
        warningCount = inventories.filter(inv =>
          inv.materials?.min_stock !== null &&
          inv.quantity < inv.materials.min_stock
        ).length;
      }
    } catch (e) {
      console.warn('[getDashboardStats] 获取预警数量异常:', e);
    }

    return {
      totalMaterials: materialsCount || 0,
      totalSuppliers: suppliersCount || 0,
      totalInbound: inboundCount || 0,
      totalOutbound: outboundCount || 0,
      inboundThisMonth: inboundThisMonth || 0,
      outboundThisMonth: outboundThisMonth || 0,
      warningCount,
    };
  } catch (error) {
    console.error('[getDashboardStats] 统计失败:', error);
    throw error;
  }
}

// ============================================
// 部门管理相关函数
// ============================================

export interface Department {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export async function getDepartments() {
  const { data, error } = await getSupabase()
    .from('departments')
    .select('*')
    .order('name');
  if (error) {
    console.error('[getDepartments] 查询失败:', error.message);
    throw error;
  }
  return data || [];
}

export async function createDepartment(department: Omit<Department, 'id' | 'created_at'>) {
  requireValue(department.name, 'name');
  const { data, error } = await getSupabase()
    .from('departments')
    .insert([department])
    .select()
    .single();
  if (error) {
    console.error('[createDepartment] 创建失败:', error.message);
    throw error;
  }
  return data;
}

export async function updateDepartment(id: number, department: Partial<Department>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('departments')
    .update(department)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[updateDepartment] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

export async function deleteDepartment(id: number) {
  requireValue(id, 'id');
  const { error } = await getSupabase()
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteDepartment] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 角色管理相关函数
// ============================================

export interface Role {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export async function getRoles() {
  const { data, error } = await getSupabase()
    .from('roles')
    .select('*')
    .order('name');
  if (error) {
    console.error('[getRoles] 查询失败:', error.message);
    throw error;
  }
  return data || [];
}

export async function createRole(role: Omit<Role, 'id' | 'created_at'>) {
  requireValue(role.name, 'name');
  requireValue(role.code, 'code');
  const { data, error } = await getSupabase()
    .from('roles')
    .insert([role])
    .select()
    .single();
  if (error) {
    console.error('[createRole] 创建失败:', error.message);
    throw error;
  }
  return data;
}

export async function updateRole(id: number, role: Partial<Role>) {
  requireValue(id, 'id');
  const { data, error } = await getSupabase()
    .from('roles')
    .update(role)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[updateRole] 更新失败:', error.message, { id });
    throw error;
  }
  return data;
}

export async function deleteRole(id: number) {
  requireValue(id, 'id');
  const { error } = await getSupabase()
    .from('roles')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[deleteRole] 删除失败:', error.message, { id });
    throw error;
  }
}

// ============================================
// 权限管理相关函数
// ============================================

export interface Permission {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export async function getPermissions() {
  const { data, error } = await getSupabase()
    .from('permissions')
    .select('*')
    .order('name');
  if (error) {
    console.error('[getPermissions] 查询失败:', error.message);
    throw error;
  }
  return data || [];
}

export async function getRolePermissions(roleId: number) {
  requireValue(roleId, 'roleId');
  const { data, error } = await getSupabase()
    .from('role_permissions')
    .select('*, permissions(*)')
    .eq('role_id', roleId);
  if (error) {
    console.error('[getRolePermissions] 查询失败:', error.message, { roleId });
    throw error;
  }
  return data || [];
}

/**
 * 更新角色权限
 * 注意：删除旧权限和插入新权限非原子操作。
 * 生产环境建议使用数据库 RPC 事务。
 */
export async function updateRolePermissions(roleId: number, permissionIds: number[]) {
  requireValue(roleId, 'roleId');

  // 先删除该角色的所有权限
  const { error: deleteError } = await getSupabase()
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId);

  if (deleteError) {
    console.error('[updateRolePermissions] 删除旧权限失败:', deleteError.message, { roleId });
    throw deleteError;
  }

  // 再插入新权限
  if (permissionIds.length > 0) {
    const permissions = permissionIds.map(permission_id => ({ role_id: roleId, permission_id }));
    const { error } = await getSupabase()
      .from('role_permissions')
      .insert(permissions);
    if (error) {
      console.error('[updateRolePermissions] 插入新权限失败:', error.message, { roleId });
      throw error;
    }
  }
}

// ============================================
// 用户管理相关函数
// ============================================

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  department?: string;
  created_at: string;
  last_sign_in?: string;
}

export async function getAllUsers(): Promise<AdminUser[]> {
  // 优先使用 service role key 获取用户列表
  if (adminSupabase) {
    try {
      const { data: authUsersData, error: authError } = await getAdminSupabase().auth.admin.listUsers();
      if (authError) {
        console.error('[getAllUsers] admin API 获取用户列表失败:', authError.message);
      } else {
        const authUsers = authUsersData?.users || [];

        if (authUsers.length > 0) {
          const userIds = authUsers.map(u => u.id);

          const { data: profiles, error: profilesError } = await getAdminSupabase()
            .from('user_profiles')
            .select('*')
            .in('id', userIds)
            .order('created_at', { ascending: false });

          if (profilesError) {
            console.error('[getAllUsers] 查询用户资料失败:', profilesError.message);
          } else {
            return authUsers.map(user => {
              const profile = profiles?.find(p => p.id === user.id);
              return {
                id: user.id,
                email: user.email || '',
                full_name: profile?.full_name || '',
                role: profile?.role || 'staff',
                department: profile?.department || '',
                created_at: user.created_at || '',
                last_sign_in: user.last_sign_in_at || '',
              };
            });
          }
        }
      }
    } catch (error) {
      console.error('[getAllUsers] 使用 service key 获取用户失败:', error);
    }
  }

  // 降级方案：只从 user_profiles 表获取
  try {
    const { data: profiles, error } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAllUsers] 降级方案查询失败:', error.message);
      throw error;
    }

    if (profiles) {
      return profiles.map(p => ({
        id: p.id,
        email: '',
        full_name: p.full_name || '',
        role: p.role || 'staff',
        department: p.department || '',
        created_at: p.created_at || '',
      }));
    }
  } catch (error) {
    console.error('[getAllUsers] 获取用户列表失败:', error);
  }

  return [];
}

export async function updateUserRole(userId: string, role: string, department?: string) {
  requireValue(userId, 'userId');
  requireValue(role, 'role');
  const { error } = await getSupabase()
    .from('user_profiles')
    .upsert({ id: userId, role, department });
  if (error) {
    console.error('[updateUserRole] 更新失败:', error.message, { userId });
    throw error;
  }
}

/**
 * 删除用户
 * 注意：先删除认证用户，再删除关联数据，防止数据孤儿。
 */
export async function deleteUser(userId: string) {
  requireValue(userId, 'userId');

  // 1. 先删除认证用户（需要管理员权限）
  try {
    const { error: authError } = await getAdminSupabase().auth.admin.deleteUser(userId);
    if (authError) {
      console.error('[deleteUser] 删除认证用户失败:', authError.message, { userId });
      throw authError;
    }
  } catch (error) {
    console.error('[deleteUser] 删除认证用户异常:', error, { userId });
    throw error;
  }

  // 2. 删除用户资料
  const { error: profileError } = await getSupabase()
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (profileError) {
    console.warn('[deleteUser] 删除用户资料失败（已删除认证用户）:', profileError.message, { userId });
  }

  // 3. 删除用户角色关联
  const { error: roleError } = await getSupabase()
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  if (roleError) {
    console.warn('[deleteUser] 删除用户角色关联失败:', roleError.message, { userId });
  }
}

// ============================================
// 密码管理函数
// ============================================

/**
 * 管理员重置用户密码
 * 使用 Supabase Admin API 直接修改用户密码
 */
export async function adminResetUserPassword(userId: string, newPassword: string) {
  requireValue(userId, 'userId');
  requireValue(newPassword, 'newPassword');

  if (newPassword.length < 6) {
    throw new Error('密码长度至少6位');
  }

  const { error } = await getAdminSupabase().auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error('[adminResetUserPassword] 重置失败:', error.message, { userId });
    throw error;
  }
}

/**
 * 用户修改自己的密码
 * 需要先验证当前密码（通过重新登录方式验证）
 */
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  requireValue(currentPassword, 'currentPassword');
  requireValue(newPassword, 'newPassword');

  if (newPassword.length < 6) {
    throw new Error('新密码长度至少6位');
  }

  // 验证当前密码：尝试用当前密码重新登录
  const { data: { user: currentUser } } = await getSupabase().auth.getUser();
  if (!currentUser?.email) {
    throw new Error('无法获取当前用户邮箱');
  }

  const { error: verifyError } = await getSupabase().auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  });

  if (verifyError) {
    console.warn('[updateUserPassword] 当前密码验证失败');
    throw new Error('当前密码不正确');
  }

  // 验证通过，更新密码
  const { data, error } = await getSupabase().auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('[updateUserPassword] 更新密码失败:', error.message);
    throw error;
  }

  return data.user;
}
