// ================================================================
//  actions.js – معالجات الأحداث والعمليات غير المتزامنة
// ================================================================
import { store }   from './store.js';
import { toast }   from './toast.js';
import * as db     from './db.js';
import * as ui     from './ui.js';
export { db };  // re-export for app.js direct access
import { today, n, uid, downloadJson, readJsonFile } from './utils.js';
import { Validators, hasErrors, calcItemTotal, getRemainingItems } from './logic.js';
import { EXPENSE_KEYS } from './config.js';

// ── مساعد: جلب معرّف المستخدم الحالي من المخزن ──────────────────
function userId() { return store.get().user?.id; }

// ================================================================
//  AUTH
// ================================================================
export async function handleLogin(email, password) {
  try {
    const { user } = await db.signIn(email, password);
    store.set({ user: { id: user.id, email: user.email } });
    toast.success('تم تسجيل الدخول بنجاح');
    return true;
  } catch (err) {
    throw err;
  }
}

export async function handleSignup(email, password) {
  try {
    const { user } = await db.signUp(email, password);
    toast.success('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد التسجيل.');
    return true;
  } catch (err) {
    throw err;
  }
}

export async function handleLogout() {
  await db.signOut();
  store.set({ user: null, jobs: [], trucks: [], items: [], clients: [] });
}

// ================================================================
//  JOBS
// ================================================================
export async function loadJobs() {
  store.setLoading('jobs', true);
  try {
    const jobs = await db.fetchJobs(userId());
    store.set({ jobs });
  } finally {
    store.setLoading('jobs', false);
  }
}

export async function addJob(fields) {
  const errors = Validators.job(fields);
  if (hasErrors(errors)) return { errors };

  ui.showLoader('جارٍ إنشاء الشغل...');
  try {
    const newJob = await db.insertJob(userId(), {
      type:      fields.type,
      ownership: fields.ownership,
      supplier:  fields.supplier.trim(),
      city:      fields.city.trim(),
      phone:     fields.phone?.trim() || '',
      payment:   fields.payment,
      share:     n(fields.share),
      name:      `${fields.type} ${fields.city.trim()}`,
    });
    const jobs = [...store.get().jobs, { ...newJob, truck_count: 0 }];
    store.set({ jobs });
    toast.success('تم إنشاء الشغل بنجاح');
    return { job: newJob };
  } finally {
    ui.hideLoader();
  }
}

// ================================================================
//  TRUCKS
// ================================================================
export async function loadTrucks(jobId) {
  store.setLoading('trucks', true);
  try {
    const trucks = await db.fetchTrucks(userId(), jobId);
    store.set({ trucks });
  } finally {
    store.setLoading('trucks', false);
  }
}

export async function addTruck(jobId, loadDate, distDate) {
  if (!loadDate || !distDate) { toast.error('يجب تحديد التواريخ'); return; }
  ui.showLoader('جارٍ إضافة العربية...');
  try {
    const state = store.get();
    const num   = (state.trucks.length || 0) + 1;
    const truck = await db.insertTruck(userId(), {
      job_id:    jobId,
      num,
      load_date: loadDate,
      dist_date: distDate,
      expenses:  { noloon: 0, masareef: 0, mashal: 0, ras: 0, gate: 0, misc: 0 },
      our_expenses: 0,
    });
    store.set({ trucks: [...state.trucks, truck] });
    toast.success(`تم إضافة العربية رقم ${num}`);
    return truck;
  } finally {
    ui.hideLoader();
  }
}

// ================================================================
//  ITEMS (PURCHASE)
// ================================================================
export async function loadTruckData(truckId) {
  store.setLoading('truck', true);
  try {
    const uid = userId();
    const [items, clients] = await Promise.all([
      db.fetchItems(uid, truckId),
      db.fetchClients(uid, truckId),
    ]);
    store.set({ items, clients });
  } finally {
    store.setLoading('truck', false);
  }
}

export async function saveItem(truckId, fields, existingId = null) {
  const errors = Validators.item(fields);
  if (hasErrors(errors)) return { errors };

  const total = calcItemTotal(
    fields.unit_type, n(fields.count),
    n(fields.weight_or_count), n(fields.price), n(fields.bai3a)
  );

  const payload = {
    id:        existingId || uid(),
    truck_id:  truckId,
    name:      fields.name.trim(),
    count:     n(fields.count),
    unit_type: fields.unit_type,
    weight:    fields.unit_type === 'weight' ? n(fields.weight_or_count) : 0,
    price:     n(fields.price),
    bai3a:     n(fields.bai3a),
    total,
  };

  ui.showLoader('جارٍ الحفظ...');
  try {
    const saved = await db.upsertItem(userId(), payload);
    const state = store.get();
    const items = existingId
      ? state.items.map(i => i.id === existingId ? saved : i)
      : [...state.items, saved];
    store.set({ items });
    toast.success(existingId ? 'تم تعديل الصنف' : 'تم إضافة الصنف');
    return { item: saved };
  } finally {
    ui.hideLoader();
  }
}

export async function removeItem(itemId) {
  ui.showLoader('جارٍ الحذف...');
  try {
    await db.deleteItem(userId(), itemId);
    store.set({ items: store.get().items.filter(i => i.id !== itemId) });
    toast.success('تم حذف الصنف');
  } finally {
    ui.hideLoader();
  }
}

export async function saveExpenses(truck, expObj) {
  ui.showLoader('جارٍ حفظ المصاريف...');
  try {
    const updated = await db.updateTruck(userId(), truck.id, {
      expenses: { ...truck.expenses, ...expObj }
    });
    const trucks = store.get().trucks.map(t => t.id === truck.id ? updated : t);
    store.set({ trucks });
    toast.success('تم حفظ المصاريف');
    return updated;
  } finally {
    ui.hideLoader();
  }
}

export async function saveOurExpenses(truck, amount) {
  ui.showLoader('جارٍ الحفظ...');
  try {
    const updated = await db.updateTruck(userId(), truck.id, { our_expenses: n(amount) });
    const trucks = store.get().trucks.map(t => t.id === truck.id ? updated : t);
    store.set({ trucks });
    toast.success('تم حفظ مصاريفنا');
    return updated;
  } finally {
    ui.hideLoader();
  }
}

// ================================================================
//  CLIENTS (DISTRIBUTION)
// ================================================================
export async function saveClient(truckId, truck, fields, existingId = null) {
  const errors = Validators.client(fields);
  if (hasErrors(errors)) return { errors };

  // التحقق من الكميات المتاحة
  const truckObj = { items: store.get().items, clients: store.get().clients };
  const remaining = getRemainingItems(truckObj);
  for (const item of fields.items) {
    if (!item.name) continue;
    const rem = remaining[item.name];
    if (!rem) continue;
    // عند التعديل: أعِد الكميات القديمة أولاً
    let available = rem.count;
    if (existingId) {
      const old = store.get().clients.find(c => c.id === existingId);
      const oldItem = (old?.items || []).find(i => i.name === item.name);
      if (oldItem) available += n(oldItem.count);
    }
    if (n(item.count) > available) {
      return { errors: { items: `الكمية غير كافية من ${item.name} (المتاح: ${available})` } };
    }
  }

  const netInvoice = fields.items.reduce((s, i) => s + n(i.qaem), 0);
  const payload = {
    id:           existingId || uid(),
    truck_id:     truckId,
    name:         fields.name.trim(),
    city:         fields.city?.trim() || '',
    payment_type: fields.payment_type,
    noloon:       n(fields.noloon),
    mashal:       n(fields.mashal),
    items:        fields.items.filter(i => i.name?.trim()),
    net_invoice:  netInvoice,
  };

  ui.showLoader('جارٍ الحفظ...');
  try {
    const saved = await db.upsertClient(userId(), payload);
    const state = store.get();
    const clients = existingId
      ? state.clients.map(c => c.id === existingId ? saved : c)
      : [...state.clients, saved];
    store.set({ clients });

    // تحديث دفتر العملاء الآجل
    if (fields.payment_type === 'آجل') {
      await db.upsertCustomerEntry(userId(), {
        customer_name: fields.name.trim(),
        entry_type:   'invoice',
        description:  'فاتورة',
        amount:       netInvoice,
        entry_date:   store.get().trucks.find(t => t.id === truckId)?.dist_date || today(),
        ref_id:       saved.id,
      });
    }

    // تحديث دفتر المورد
    await syncSupplierLedger(truckId);

    toast.success(existingId ? 'تم تعديل العميل' : 'تم إضافة العميل');
    return { client: saved };
  } finally {
    ui.hideLoader();
  }
}

export async function removeClient(clientId) {
  ui.showLoader('جارٍ الحذف...');
  try {
    await db.deleteClientRecord(userId(), clientId);
    await db.deleteCustomerEntry(userId(), clientId);
    store.set({ clients: store.get().clients.filter(c => c.id !== clientId) });
    toast.success('تم حذف العميل');
  } finally {
    ui.hideLoader();
  }
}

export async function updateClientNetInvoice(clientId, newVal) {
  const state = store.get();
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const updated = { ...client, net_invoice: n(newVal) };
  ui.showLoader('جارٍ الحفظ...');
  try {
    const saved = await db.upsertClient(userId(), updated);
    const clients = state.clients.map(c => c.id === clientId ? saved : c);
    store.set({ clients });

    if (client.payment_type === 'آجل') {
      const truck = state.trucks.find(t => t.id === client.truck_id);
      await db.upsertCustomerEntry(userId(), {
        customer_name: client.name,
        entry_type:   'invoice',
        description:  'فاتورة',
        amount:       n(newVal),
        entry_date:   truck?.dist_date || today(),
        ref_id:       clientId,
      });
    }
    toast.success('تم تحديث الفاتورة');
  } finally {
    ui.hideLoader();
  }
}

export async function updateClientItemField(clientId, idx, field, val) {
  const state   = store.get();
  const client  = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const items = [...client.items];
  if (field === 'count') items[idx] = { ...items[idx], count: n(val) };
  else if (field === 'name') items[idx] = { ...items[idx], name: String(val) };
  else if (field === 'qaem') items[idx] = { ...items[idx], qaem: n(val) };

  const newNet = items.reduce((s, i) => s + n(i.qaem), 0);
  const updated = { ...client, items, net_invoice: newNet };
  const saved = await db.upsertClient(userId(), updated);
  const clients = state.clients.map(c => c.id === clientId ? saved : c);
  store.set({ clients });

  if (client.payment_type === 'آجل') {
    const truck = state.trucks.find(t => t.id === client.truck_id);
    await db.upsertCustomerEntry(userId(), {
      customer_name: client.name,
      entry_type: 'invoice',
      description: 'فاتورة',
      amount: newNet,
      entry_date: truck?.dist_date || today(),
      ref_id: clientId,
    });
  }
}

export async function deleteClientItem(clientId, idx) {
  const state  = store.get();
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;
  const items  = client.items.filter((_, i) => i !== idx);
  const newNet = items.reduce((s, i) => s + n(i.qaem), 0);
  const updated = { ...client, items, net_invoice: newNet };
  const saved = await db.upsertClient(userId(), updated);
  const clients = state.clients.map(c => c.id === clientId ? saved : c);
  store.set({ clients });
  if (client.payment_type === 'آجل') {
    await db.upsertCustomerEntry(userId(), {
      customer_name: client.name,
      entry_type: 'invoice',
      description: 'فاتورة',
      amount: newNet,
      ref_id: clientId,
    });
  }
}

export async function addClientItemInDetail(clientId) {
  const state  = store.get();
  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;
  const items  = [...client.items, { name: '', count: 0, qaem: 0 }];
  const saved  = await db.upsertClient(userId(), { ...client, items });
  const clients = state.clients.map(c => c.id === clientId ? saved : c);
  store.set({ clients });
}

// ================================================================
//  مزامنة دفتر المورد بعد أي تغيير على العربية
// ================================================================
export async function syncSupplierLedger(truckId) {
  const state  = store.get();
  const truck  = state.trucks.find(t => t.id === truckId);
  if (!truck) return;
  const job    = state.jobs.find(j => j.id === truck.job_id);
  if (!job) return;

  const truckObj = {
    ...truck,
    items:   state.items.filter(i => i.truck_id === truckId),
    clients: state.clients.filter(c => c.truck_id === truckId),
  };
  const purchases = job.ownership === 'لحسابنا'
    ? truckObj.items.reduce((s, i) => s + n(i.total), 0) + EXPENSE_KEYS.reduce((s, { key }) => s + n((truck.expenses || {})[key]), 0)
    : 0;
  const invoices = truckObj.clients.reduce((s, c) => s + n(c.net_invoice), 0);

  await db.upsertSupplierEntry(userId(), {
    job_id:    job.id,
    truck_id:  truckId,
    entry_type:'truck',
    purchases,
    net:       invoices,
    entry_date: truck.load_date || today(),
    description:`عربية رقم ${truck.num}`,
  });
}

// ================================================================
//  CUSTOMER LEDGER
// ================================================================
export async function loadCustomerData() {
  store.setLoading('customers', true);
  try {
    const entries = await db.fetchCustomerLedger(userId());
    const names   = await db.fetchAllCustomers(userId());
    store.set({ customerEntries: entries, customerNames: names });
    return entries;
  } finally {
    store.setLoading('customers', false);
  }
}

export async function addCustomerPayment(customerName, amount, date, notes) {
  const errors = {};
  if (!customerName) errors.name = 'اختر العميل';
  if (n(amount) <= 0) errors.amount = 'المبلغ يجب أن يكون أكبر من صفر';
  if (hasErrors(errors)) return { errors };

  ui.showLoader();
  try {
    await db.insertCustomerPayment(userId(), customerName, n(amount), date || today(), notes);
    // أيضاً سجّل في الكاش فلو
    await db.insertCashflowEntry(userId(), {
      flow_type:  'in',
      party_name: customerName,
      amount:     n(amount),
      entry_date: date || today(),
      notes:      notes || '',
    });
    toast.success('تم تسجيل الدفعة');
    return true;
  } finally {
    ui.hideLoader();
  }
}

// ================================================================
//  CASHFLOW
// ================================================================
export async function loadCashflow() {
  store.setLoading('cashflow', true);
  try {
    const entries = await db.fetchCashflow(userId());
    store.set({ cashflow: entries });
    return entries;
  } finally {
    store.setLoading('cashflow', false);
  }
}

export async function recordCollection(customerName, amount, date, notes) {
  if (!customerName || n(amount) <= 0) { toast.error('اختر العميل وأدخل المبلغ'); return; }
  ui.showLoader();
  try {
    const entry = await db.insertCashflowEntry(userId(), {
      flow_type:  'in',
      party_name: customerName,
      amount:     n(amount),
      entry_date: date || today(),
      notes:      notes || '',
    });
    await db.insertCustomerPayment(userId(), customerName, n(amount), date || today(), notes);
    store.set({ cashflow: [entry, ...store.get().cashflow] });
    toast.success('تم تسجيل التحصيل');
  } finally {
    ui.hideLoader();
  }
}

export async function recordPayment(jobId, amount, date, notes) {
  if (!jobId || n(amount) <= 0) { toast.error('اختر الشغل وأدخل المبلغ'); return; }
  const job = store.get().jobs.find(j => j.id === jobId);
  ui.showLoader();
  try {
    const entry = await db.insertCashflowEntry(userId(), {
      flow_type:  'out',
      party_name: job?.supplier || jobId,
      job_id:     jobId,
      amount:     n(amount),
      entry_date: date || today(),
      notes:      notes || '',
    });
    await db.insertSupplierPayment(userId(), jobId, n(amount), date || today());
    store.set({ cashflow: [entry, ...store.get().cashflow] });
    toast.success('تم تسجيل الدفعة');
  } finally {
    ui.hideLoader();
  }
}

// ================================================================
//  EXPORT / IMPORT
// ================================================================
export async function exportBackup() {
  ui.showLoader('جارٍ تجهيز النسخة الاحتياطية...');
  try {
    const uid = userId();
    const [jobs, cashflow] = await Promise.all([
      db.fetchJobs(uid),
      db.fetchCashflow(uid),
    ]);
    downloadJson({ jobs, cashflow, exportedAt: new Date().toISOString() },
      `نسخة_سوق_الجملة_${today()}.json`);
    toast.success('تم تصدير النسخة الاحتياطية');
  } finally {
    ui.hideLoader();
  }
}

// ================================================================
//  WHATSAPP
// ================================================================
export function shareCustomerWhatsApp(name, entries) {
  if (!entries.length) { toast.error('لا توجد حركات لهذا العميل'); return; }
  const last    = entries[entries.length - 1];
  const finalBal = last.balance || 0;
  const status  = finalBal > 0 ? 'عليه (مدين)' : 'له (دائن)';
  let msg = `*بيان حساب من وكالة الجملة*\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `👤 *العميل:* ${name}\n`;
  msg += `📅 *بتاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `💰 *الرصيد الحالي:* ${finalBal.toLocaleString('ar-EG')} ج.م\n`;
  msg += `📝 *الحالة:* ${status}\n`;
  msg += `━━━━━━━━━━━━━━\n`;
  msg += `_يرجى مراجعة الحساب وشكراً لتعاملكم معنا_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// ================================================================
//  AUDIT LOG
// ================================================================
export async function loadAuditLog() {
  const entries = await db.fetchAuditLog(userId());
  store.set({ auditLog: entries });
  return entries;
}
