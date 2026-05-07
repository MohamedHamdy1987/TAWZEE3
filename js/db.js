// ================================================================
//  db.js – طبقة قاعدة البيانات (Supabase)
// ================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { toast } from './toast.js';

// ── تهيئة Supabase ──────────────────────────────────────────────
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── المساعد: معالجة أخطاء Supabase بشكل مركزي ─────────────────
function handleError(err, context = '') {
  const msg = err?.message || 'خطأ غير معروف';
  console.error(`[DB Error] ${context}:`, err);
  toast.error(`خطأ في قاعدة البيانات: ${msg}`);
  throw err;
}

// ── جلب معرّف المستخدم الحالي ────────────────────────────────────
export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// ================================================================
//  AUTH
// ================================================================
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ================================================================
//  JOBS
// ================================================================
export async function fetchJobs(userId) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchJobs');
  return data || [];
}

export async function insertJob(userId, job) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...job, user_id: userId })
    .select()
    .single();
  if (error) handleError(error, 'insertJob');
  await logAudit(userId, 'create', 'job', data.id, `إنشاء شغل: ${job.name}`);
  return data;
}

export async function updateJob(userId, id, patch) {
  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) handleError(error, 'updateJob');
  await logAudit(userId, 'update', 'job', id, 'تعديل شغل');
  return data;
}

export async function deleteJob(userId, id) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) handleError(error, 'deleteJob');
  await logAudit(userId, 'delete', 'job', id, 'حذف شغل');
}

// ================================================================
//  TRUCKS
// ================================================================
export async function fetchTrucks(userId, jobId) {
  const { data, error } = await supabase
    .from('trucks')
    .select('*')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .order('num', { ascending: true });
  if (error) handleError(error, 'fetchTrucks');
  return data || [];
}

export async function insertTruck(userId, truck) {
  const { data, error } = await supabase
    .from('trucks')
    .insert({ ...truck, user_id: userId })
    .select()
    .single();
  if (error) handleError(error, 'insertTruck');
  await logAudit(userId, 'create', 'truck', data.id, `إضافة عربية رقم ${truck.num}`);
  return data;
}

export async function updateTruck(userId, id, patch) {
  const { data, error } = await supabase
    .from('trucks')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) handleError(error, 'updateTruck');
  return data;
}

// ================================================================
//  ITEMS (PURCHASE)
// ================================================================
export async function fetchItems(userId, truckId) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .eq('truck_id', truckId)
    .order('created_at', { ascending: true });
  if (error) handleError(error, 'fetchItems');
  return data || [];
}

export async function upsertItem(userId, item) {
  const payload = { ...item, user_id: userId };
  const { data, error } = await supabase
    .from('items')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) handleError(error, 'upsertItem');
  await logAudit(userId, item.id ? 'update' : 'create', 'item', data.id, `صنف: ${item.name}`);
  return data;
}

export async function deleteItem(userId, id) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) handleError(error, 'deleteItem');
  await logAudit(userId, 'delete', 'item', id, 'حذف صنف');
}

// ================================================================
//  CLIENTS (DISTRIBUTION)
// ================================================================
export async function fetchClients(userId, truckId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .eq('truck_id', truckId)
    .order('created_at', { ascending: true });
  if (error) handleError(error, 'fetchClients');
  return data || [];
}

export async function upsertClient(userId, client) {
  const payload = { ...client, user_id: userId };
  const { data, error } = await supabase
    .from('clients')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) handleError(error, 'upsertClient');
  await logAudit(userId, client.id ? 'update' : 'create', 'client', data.id, `عميل: ${client.name}`);
  return data;
}

export async function deleteClientRecord(userId, id) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) handleError(error, 'deleteClient');
  await logAudit(userId, 'delete', 'client', id, 'حذف عميل من التوزيع');
}

// ================================================================
//  CUSTOMER LEDGER
// ================================================================
export async function fetchCustomerLedger(userId, customerName) {
  const query = supabase
    .from('customer_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: true });
  if (customerName) query.eq('customer_name', customerName);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchCustomerLedger');
  return data || [];
}

export async function fetchAllCustomers(userId) {
  const { data, error } = await supabase
    .from('customer_ledger')
    .select('customer_name')
    .eq('user_id', userId);
  if (error) handleError(error, 'fetchAllCustomers');
  // إرجاع قائمة أسماء فريدة
  return [...new Set((data || []).map(r => r.customer_name))];
}

export async function upsertCustomerEntry(userId, entry) {
  const payload = { ...entry, user_id: userId };
  const { data, error } = await supabase
    .from('customer_ledger')
    .upsert(payload, { onConflict: 'ref_id' })
    .select()
    .single();
  if (error) handleError(error, 'upsertCustomerEntry');
  return data;
}

export async function insertCustomerPayment(userId, customerName, amount, date, notes) {
  const { data, error } = await supabase
    .from('customer_ledger')
    .insert({
      user_id: userId,
      customer_name: customerName,
      entry_type: 'payment',
      amount,
      entry_date: date,
      description: notes || 'دفعة',
    })
    .select()
    .single();
  if (error) handleError(error, 'insertCustomerPayment');
  return data;
}

export async function deleteCustomerEntry(userId, refId) {
  const { error } = await supabase
    .from('customer_ledger')
    .delete()
    .eq('ref_id', refId)
    .eq('user_id', userId);
  if (error) handleError(error, 'deleteCustomerEntry');
}

// ================================================================
//  SUPPLIER LEDGER
// ================================================================
export async function fetchSupplierLedger(userId, jobId) {
  const { data, error } = await supabase
    .from('supplier_ledger')
    .select('*')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .order('entry_date', { ascending: true });
  if (error) handleError(error, 'fetchSupplierLedger');
  return data || [];
}

export async function upsertSupplierEntry(userId, entry) {
  const payload = { ...entry, user_id: userId };
  const { data, error } = await supabase
    .from('supplier_ledger')
    .upsert(payload, { onConflict: 'truck_id' })
    .select()
    .single();
  if (error) handleError(error, 'upsertSupplierEntry');
  return data;
}

export async function insertSupplierPayment(userId, jobId, amount, date) {
  const { data, error } = await supabase
    .from('supplier_ledger')
    .insert({
      user_id: userId,
      job_id: jobId,
      entry_type: 'payment',
      amount,
      entry_date: date,
      description: 'دفعة للمورد',
    })
    .select()
    .single();
  if (error) handleError(error, 'insertSupplierPayment');
  return data;
}

// ================================================================
//  CASHFLOW
// ================================================================
export async function fetchCashflow(userId, dateFilter) {
  let query = supabase
    .from('cashflow')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });
  if (dateFilter) query = query.eq('entry_date', dateFilter);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchCashflow');
  return data || [];
}

export async function insertCashflowEntry(userId, entry) {
  const { data, error } = await supabase
    .from('cashflow')
    .insert({ ...entry, user_id: userId })
    .select()
    .single();
  if (error) handleError(error, 'insertCashflowEntry');
  return data;
}

// ================================================================
//  AUDIT LOG
// ================================================================
export async function logAudit(userId, action, entity, entityId, description) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      entity,
      entity_id: String(entityId),
      description,
    });
  } catch (err) {
    // الـ audit log لا يجب أن يوقف العمل عند الفشل
    console.warn('[Audit log failed]', err);
  }
}

export async function fetchAuditLog(userId, limit = 50) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) handleError(error, 'fetchAuditLog');
  return data || [];
}
