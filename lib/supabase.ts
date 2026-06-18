import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// 验证配置
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 配置缺失！请检查 .env.local 文件');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING');
}

// 创建普通客户端（用于普通操作）
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 创建管理员客户端（用于管理操作）
let adminSupabase: ReturnType<typeof createClient> | null = null;
if (supabaseServiceKey && supabaseUrl) {
  adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
}

// 简单的消息提示替代 antd message
function showNotification(message: string, type: 'error' | 'success' = 'error') {
  console[type === 'error' ? 'error' : 'log'](message);
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    return profile ? { ...session.user, ...profile } : null;
  } catch (error) {
    console.error('getCurrentUser error:', error);
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
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
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
  let query = supabase.from('suppliers').select('*');
  
  if (params?.keyword) {
    query = query.ilike('name', `%${params.keyword}%`);
  }
  
  // 先获取总数
  let countQuery = supabase.from('suppliers').select('*', { count: 'exact', head: true });
  
  if (params?.keyword) {
    countQuery = countQuery.ilike('name', `%${params.keyword}%`);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  
  const { count } = await countQuery;
  
  return {
    data: data || [],
    total: count || 0,
  };
}

export async function createSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert([supplier])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id: number, supplier: Partial<Supplier>) {
  const { data, error } = await supabase
    .from('suppliers')
    .update(supplier)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSupplier(id: number) {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);
  if (error) throw error;
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
  // 优化：使用外键连接一次性获取分类数据，避免多次网络请求
  let query = supabase
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
  
  if (params?.startDate && params?.endDate) {
    query = query
      .gte('created_at', params.startDate + ' 00:00:00')
      .lte('created_at', params.endDate + ' 23:59:59');
  } else if (params?.startDate) {
    query = query.gte('created_at', params.startDate + ' 00:00:00');
  } else if (params?.endDate) {
    query = query.lte('created_at', params.endDate + ' 23:59:59');
  }
  
  // 分页
  if (params?.page && params?.pageSize) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;
    query = query.range(start, end);
  }
  
  const { data, error, count } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  
  // 优化：使用 head 查询总数，但只在需要分页时查询
  let totalCount = 0;
  if (params?.page && params?.pageSize) {
    // 构建相同的查询条件来获取总数
    let countQuery = supabase
      .from('materials')
      .select('*', { count: 'exact', head: true });
    
    if (params?.keyword) {
      countQuery = countQuery.or(`name.ilike.%${params.keyword}%,code.ilike.%${params.keyword}%`);
    }
    
    if (params?.category_id) {
      countQuery = countQuery.eq('category_id', params.category_id);
    }
    
    if (params?.status !== undefined) {
      countQuery = countQuery.eq('status', params.status);
    }
    
    if (params?.startDate && params?.endDate) {
      countQuery = countQuery
        .gte('created_at', params.startDate + ' 00:00:00')
        .lte('created_at', params.endDate + ' 23:59:59');
    } else if (params?.startDate) {
      countQuery = countQuery.gte('created_at', params.startDate + ' 00:00:00');
    } else if (params?.endDate) {
      countQuery = countQuery.lte('created_at', params.endDate + ' 23:59:59');
    }
    
    const { count: pageCount } = await countQuery;
    totalCount = pageCount || 0;
  }
  
  return {
    data: data || [],
    total: totalCount,
  };
}

export async function createMaterial(material: Omit<Material, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('materials')
    .insert([material])
    .select('*, categories(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(id: number, material: Partial<Material>) {
  const { data, error } = await supabase
    .from('materials')
    .update(material)
    .eq('id', id)
    .select('*, categories(name)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(id: number) {
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', id);
  if (error) throw error;
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
  // 优化：使用外键连接一次性获取关联数据
  let query = supabase
    .from('inbound')
    .select('*, suppliers(name), inbound_items(*, materials(name, code))');
  
  if (params?.status) {
    query = query.eq('status', params.status);
  }
  
  if (params?.startDate && params?.endDate) {
    query = query
      .gte('created_at', params.startDate + ' 00:00:00')
      .lte('created_at', params.endDate + ' 23:59:59');
  }
  
  if (params?.page && params?.pageSize) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;
    query = query.range(start, end);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createInboundOrder(order: Omit<InboundOrder, 'id' | 'order_no' | 'created_at' | 'updated_at'>) {
  // 生成入库单号
  const orderNo = `RK${new Date().toISOString().slice(0,10).replace(/-/g, '')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  
  // 创建入库单
  const { data: orderData, error: orderError } = await supabase
    .from('inbound')
    .insert([{
      order_no: orderNo,
      supplier_id: order.supplier_id,
      operator: order.operator,
      status: order.status || 'draft',
      remark: order.remark,
    }])
    .select()
    .single();
  
  if (orderError) throw orderError;
  
  // 如果有物资明细，插入明细
  if (order.items && order.items.length > 0) {
    const items = order.items.map((item: any) => ({
      inbound_id: orderData.id,
      material_id: item.material_id,
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      total_amount: item.total_amount || 0,
      remark: item.remark || '',
    }));
    
    const { error: itemsError } = await supabase
      .from('inbound_items')
      .insert(items);
    
    if (itemsError) throw itemsError;
  }
  
  return orderData;
}

export async function updateInboundOrder(id: number, order: Partial<InboundOrder>) {
  const { data, error } = await supabase
    .from('inbound')
    .update(order)
    .eq('id', id)
    .select('*, inbound_items(*)')
    .single();
  if (error) throw error;
  return data;
}

// 只更新入库单状态（移除调试日志）
export async function updateInboundOrderStatus(id: number, status: string) {
  const { data, error } = await supabase
    .from('inbound')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('更新入库单状态失败:', error);
    throw error;
  }
  
  return data;
}

// 审批入库单并更新库存（移除调试日志）
export async function approveInboundOrder(id: number) {
  // 1. 获取入库单明细
  const { data: order, error: orderError } = await supabase
    .from('inbound')
    .select('*, inbound_items(*)')
    .eq('id', id)
    .single();
  
  if (orderError) throw orderError;
  if (!order) throw new Error('入库单不存在');
  
  // 2. 更新状态为已完成
  const { error: updateError } = await supabase
    .from('inbound')
    .update({ status: 'completed' })
    .eq('id', id);
  
  if (updateError) throw updateError;
  
  // 3. 更新库存 - 累加数量
  const items = (order as any).inbound_items || [];
  
  if (items.length === 0) {
    return order;
  }
  
  // 优化：并行处理所有库存更新
  const updatePromises = items.map(async (item: any) => {
    if (!item.material_id || !item.quantity) {
      return;
    }
    
    // 先查询当前库存
    const { data: existingInv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('material_id', item.material_id)
      .single();
    
    const currentQuantity = existingInv?.quantity || 0;
    const newQuantity = currentQuantity + item.quantity;
    
    // 使用 upsert 更新库存
    await supabase
      .from('inventory')
      .upsert({
        material_id: item.material_id,
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'material_id' });
  });
  
  await Promise.all(updatePromises);
  
  return order;
}

// 完成入库单（状态变为 completed）
export async function completeInboundOrder(id: number) {
  const { error } = await supabase
    .from('inbound')
    .update({ status: 'completed' })
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteInboundOrder(id: number) {
  const { error } = await supabase
    .from('inbound')
    .delete()
    .eq('id', id);
  if (error) throw error;
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
  // 优化：使用外键连接一次性获取关联数据
  let query = supabase
    .from('outbound')
    .select('*, outbound_items(*, materials(name, code))');
  
  if (params?.status) {
    query = query.eq('status', params.status);
  }
  
  if (params?.startDate && params?.endDate) {
    query = query
      .gte('created_at', params.startDate + ' 00:00:00')
      .lte('created_at', params.endDate + ' 23:59:59');
  }
  
  if (params?.page && params?.pageSize) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;
    query = query.range(start, end);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createOutboundOrder(order: Omit<OutboundOrder, 'id' | 'order_no' | 'created_at' | 'updated_at'>) {
  // 生成出库单号
  const orderNo = `CK${new Date().toISOString().slice(0,10).replace(/-/g, '')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  
  // 创建出库单
  const { data: orderData, error: orderError } = await supabase
    .from('outbound')
    .insert([{
      order_no: orderNo,
      recipient: order.recipient,
      operator: order.operator,
      status: order.status || 'draft',
      purpose: order.purpose,
      remark: order.remark,
    }])
    .select()
    .single();
  
  if (orderError) throw orderError;
  
  // 如果有物资明细，插入明细
  if (order.items && order.items.length > 0) {
    const items = order.items.map((item: any) => ({
      outbound_id: orderData.id,
      material_id: item.material_id,
      quantity: item.quantity,
      remark: item.remark || '',
    }));
    
    const { error: itemsError } = await supabase
      .from('outbound_items')
      .insert(items);
    
    if (itemsError) throw itemsError;
  }
  
  return orderData;
}

export async function updateOutboundOrder(id: number, order: Partial<OutboundOrder>) {
  const { data, error } = await supabase
    .from('outbound')
    .update(order)
    .eq('id', id)
    .select('*, outbound_items(*)')
    .single();
  if (error) throw error;
  return data;
}

// 只更新出库单状态（移除调试日志）
export async function updateOutboundOrderStatus(id: number, status: string) {
  const { data, error } = await supabase
    .from('outbound')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('更新出库单状态失败:', error);
    throw error;
  }
  
  return data;
}

// 审批出库单（移除调试日志）
export async function approveOutboundOrder(id: number) {
  // 1. 获取出库单明细
  const { data: order, error: orderError } = await supabase
    .from('outbound')
    .select('*, outbound_items(*)')
    .eq('id', id)
    .single();
  
  if (orderError) throw orderError;
  if (!order) throw new Error('出库单不存在');
  
  // 2. 更新状态为已完成
  const { error: updateError } = await supabase
    .from('outbound')
    .update({ status: 'completed' })
    .eq('id', id);
  
  if (updateError) throw updateError;
  
  // 3. 扣减库存
  const items = (order as any).outbound_items || [];
  
  if (items.length === 0) {
    return order;
  }
  
  // 优化：并行处理所有库存更新
  const updatePromises = items.map(async (item: any) => {
    if (!item.material_id || !item.quantity) {
      return;
    }
    
    // 先获取当前库存
    const { data: currentInv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('material_id', item.material_id)
      .single();
    
    const currentQty = currentInv?.quantity || 0;
    const newQty = Math.max(0, currentQty - item.quantity);
    
    // 使用 upsert 更新库存
    await supabase
      .from('inventory')
      .upsert({
        material_id: item.material_id,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'material_id' });
  });
  
  await Promise.all(updatePromises);
  
  return order;
}

// 完成出库单
export async function completeOutboundOrder(id: number) {
  return await approveOutboundOrder(id);
}

// 删除出库单
export async function deleteOutboundOrder(id: number) {
  const { error } = await supabase
    .from('outbound')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// 检查库存是否充足
export async function checkInventory(materialId: number, quantity: number): Promise<{ sufficient: boolean; current: number }> {
  const { data: inv } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('material_id', materialId)
    .single();
  
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
  // 优化：使用外键连接一次性获取所有数据，避免多次串行查询
  let query = supabase
    .from('inventory')
    .select('*, materials(*, categories(name))');
  
  if (params?.startDate && params?.endDate) {
    query = query
      .gte('updated_at', params.startDate + ' 00:00:00')
      .lte('updated_at', params.endDate + ' 23:59:59');
  }
  
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  
  if (!data || data.length === 0) return [];
  
  // 数据已经在一次查询中获取，直接格式化返回
  return data.map((item: any) => ({
    ...item,
    material: item.materials ? {
      id: item.materials.id,
      name: item.materials.name || '未知物资',
      code: item.materials.code || '-',
      categories: item.materials.categories ? { name: item.materials.categories.name } : null,
    } : null,
  }));
}

// 删除库存记录
export async function deleteInventory(id: number) {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id);
  if (error) throw error;
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

export async function getStocktakingOrders(params?: any) {
  let query = supabase
    .from('stocktaking')
    .select('*, stocktaking_items(*)');
  
  if (params?.status) {
    query = query.eq('status', params.status);
  }
  
  if (params?.startDate && params?.endDate) {
    query = query
      .gte('created_at', params.startDate + ' 00:00:00')
      .lte('created_at', params.endDate + ' 23:59:59');
  }
  
  if (params?.page && params?.pageSize) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;
    query = query.range(start, end);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createStocktakingOrder(order: Omit<StocktakingOrder, 'id' | 'order_no' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('stocktaking')
    .insert([order])
    .select('*, stocktaking_items(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateStocktakingOrder(id: number, order: Partial<StocktakingOrder>) {
  const { data, error } = await supabase
    .from('stocktaking')
    .update(order)
    .eq('id', id)
    .select('*, stocktaking_items(*)')
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// 报表相关函数
// ============================================

export async function getDashboardStats() {
  // 优化：使用 Promise.all 并行获取所有统计数据，而不是串行等待
  const [
    { count: materialsCount },
    { count: suppliersCount },
    { count: inboundCount },
    { count: outboundCount },
  ] = await Promise.all([
    supabase.from('materials').select('*', { count: 'exact', head: true }),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }),
    supabase.from('inbound').select('*', { count: 'exact', head: true }),
    supabase.from('outbound').select('*', { count: 'exact', head: true }),
  ]);
  
  // 获取本月入库/出库数量 - 并行查询
  const now = new Date();
  const monthStart = now.toISOString().split('T')[0].slice(0, 7) + '-01';
  
  const [
    { count: inboundThisMonth },
    { count: outboundThisMonth },
  ] = await Promise.all([
    supabase.from('inbound').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('outbound').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
  ]);
  
  // 获取库存预警数量
  let warningCount = 0;
  try {
    const { data: inventories } = await supabase
      .from('inventory')
      .select('quantity, materials(min_stock)');
    
    if (inventories) {
      warningCount = inventories.filter(inv => 
        inv.materials?.min_stock !== null && 
        inv.quantity < inv.materials.min_stock
      ).length;
    }
  } catch (e) {
    console.warn('获取预警数量失败:', e);
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
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createDepartment(department: Omit<Department, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('departments')
    .insert([department])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id: number, department: Partial<Department>) {
  const { data, error } = await supabase
    .from('departments')
    .update(department)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDepartment(id: number) {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createRole(role: Omit<Role, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('roles')
    .insert([role])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRole(id: number, role: Partial<Role>) {
  const { data, error } = await supabase
    .from('roles')
    .update(role)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRole(id: number) {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getRolePermissions(roleId: number) {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('*, permissions(*)')
    .eq('role_id', roleId);
  if (error) throw error;
  return data || [];
}

export async function updateRolePermissions(roleId: number, permissionIds: number[]) {
  // 先删除该角色的所有权限
  await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId);
  
  // 再插入新权限
  if (permissionIds.length > 0) {
    const permissions = permissionIds.map(permission_id => ({ role_id: roleId, permission_id }));
    const { error } = await supabase
      .from('role_permissions')
      .insert(permissions);
    if (error) throw error;
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
}

export async function getAllUsers() {
  // 优先使用 service role key 获取用户列表
  if (adminSupabase) {
    try {
      const { data: authUsersData, error: authError } = await adminSupabase.auth.admin.listUsers();
      if (!authError) {
        const authUsers = authUsersData?.users || [];
        
        if (authUsers.length > 0) {
          const userIds = authUsers.map(u => u.id);
          
          const { data: profiles, error: profilesError } = await adminSupabase
            .from('user_profiles')
            .select('*')
            .in('id', userIds)
            .order('created_at', { ascending: false });
          
          if (!profilesError) {
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
      console.error('使用 service key 获取用户失败:', error);
    }
  }
  
  // 降级方案：只从 user_profiles 表获取
  try {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && profiles) {
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
    console.error('获取用户列表失败:', error);
  }
  
  return [];
}

export async function updateUserRole(userId: string, role: string, department?: string) {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, role, department });
  if (error) throw error;
}

export async function deleteUser(userId: string) {
  // 删除用户资料
  await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId);
  
  // 删除用户角色关联
  await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId);
  
  // 删除认证用户 (需要管理员权限)
  const authClient = adminSupabase || supabase;
  const { error } = await authClient.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// ============================================
// 密码管理函数
// ============================================

/**
 * 管理员重置用户密码
 * 使用 Supabase Admin API 直接修改用户密码
 */
export async function adminResetUserPassword(userId: string, newPassword: string) {
  if (!adminSupabase) {
    throw new Error('管理员客户端不可用');
  }
  
  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  
  if (error) throw error;
}

/**
 * 用户修改自己的密码
 */
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  const { data: { user }, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) throw error;
  
  // 验证当前密码（前端无法直接验证，需要用户重新登录）
  // 这里简单处理，让用户重新登录
  return user;
}
