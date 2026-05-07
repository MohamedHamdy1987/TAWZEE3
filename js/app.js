// ================================================================
//  app.js – نقطة الدخول الرئيسية، التوجيه والتهيئة
// ================================================================
import { supabase, getSession } from './db.js';
import * as db                  from './db.js';
import { store }                from './store.js';
import { toast }                from './toast.js';
import { today, n, debounce }   from './utils.js';
import { JOB_TYPES, PAYMENT_METHODS, EXPENSE_KEYS } from './config.js';
import * as actions             from './actions.js';
import * as ui                  from './ui.js';
import { recalcTruck }          from './logic.js';

// ── مساعد: جلب معرّف المستخدم الحالي ──────────────────────────
function userId() { return store.get().user?.id; }

// ================================================================
//  بدء تشغيل التطبيق
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. التحقق من جلسة نشطة
  ui.showLoader('جارٍ التحقق من الجلسة...');
  try {
    const session = await getSession();
    if (session?.user) {
      store.set({ user: { id: session.user.id, email: session.user.email } });
      await bootApp();
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    showAuthScreen();
  } finally {
    ui.hideLoader();
  }

  // 2. ربط نموذج تسجيل الدخول
  bindAuthForm();

  // 3. الاستماع لتغييرات الجلسة
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      store.set({ user: { id: session.user.id, email: session.user.email } });
      await bootApp();
    } else if (event === 'SIGNED_OUT') {
      store.set({ user: null });
      showAuthScreen();
    }
  });
});

// ================================================================
//  تهيئة التطبيق بعد تسجيل الدخول
// ================================================================
async function bootApp() {
  const { user } = store.get();
  // عرض البريد في الشريط
  const emailEl = document.getElementById('nav-user-email');
  if (emailEl) emailEl.textContent = user.email;

  // إظهار التطبيق وإخفاء شاشة الدخول
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').style.display   = 'block';

  // تحميل البيانات الأساسية
  ui.showLoader('جارٍ تحميل البيانات...');
  try {
    await actions.loadJobs();
  } finally {
    ui.hideLoader();
  }

  // ربط جميع المستمعين
  bindNavigation();
  bindJobsPage();
  bindTruckPage();
  bindCashflowPage();
  bindModals();
  bindGlobalEvents();

  // عرض الصفحة الرئيسية
  navigateTo('page-home');
}

// ================================================================
//  شاشة الدخول
// ================================================================
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display   = 'none';
}

function bindAuthForm() {
  const loginTab  = document.getElementById('auth-tab-login');
  const signupTab = document.getElementById('auth-tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm= document.getElementById('signup-form');

  loginTab?.addEventListener('click', () => {
    loginTab.classList.add('active');
    signupTab?.classList.remove('active');
    loginForm.style.display  = 'block';
    signupForm.style.display = 'none';
  });
  signupTab?.addEventListener('click', () => {
    signupTab.classList.add('active');
    loginTab?.classList.remove('active');
    loginForm.style.display  = 'none';
    signupForm.style.display = 'block';
  });

  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.remove('show');
    try {
      await actions.handleLogin(email, password);
    } catch (err) {
      errEl.textContent = err.message || 'فشل تسجيل الدخول';
      errEl.classList.add('show');
    }
  });

  document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const errEl    = document.getElementById('signup-error');
    errEl.classList.remove('show');
    if (password.length < 6) {
      errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      errEl.classList.add('show'); return;
    }
    try {
      await actions.handleSignup(email, password);
    } catch (err) {
      errEl.textContent = err.message || 'فشل إنشاء الحساب';
      errEl.classList.add('show');
    }
  });

  // Enter key support
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const loginVisible = loginForm.style.display !== 'none';
    if (loginVisible) document.getElementById('btn-login')?.click();
    else document.getElementById('btn-signup')?.click();
  });
}

// ================================================================
//  التنقل
// ================================================================
function navigateTo(pageId) {
  ui.showPage(pageId);

  if (pageId === 'page-home')      renderHome();
  if (pageId === 'page-customers') renderCustomersPage();
  if (pageId === 'page-suppliers') renderSuppliersPage();
  if (pageId === 'page-cashflow')  renderCashflowPage();
  if (pageId === 'page-audit')     renderAuditPage();
}

function bindNavigation() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });
  document.querySelectorAll('.quick-nav').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      if (page) navigateTo(page);
    });
  });
  document.querySelectorAll('.breadcrumb span[data-page]').forEach(span => {
    span.addEventListener('click', () => navigateTo(span.dataset.page));
  });
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await actions.handleLogout();
  });
}

// ================================================================
//  الصفحة الرئيسية
// ================================================================
function renderHome() {
  ui.renderJobs(document.getElementById('mainSearch')?.value || '');
  ui.renderDashboard();

  // روابط فتح الشغل
  document.getElementById('jobs-list')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-job-id]');
    if (!card) return;
    await openJob(card.dataset.jobId);
  });
}

function bindJobsPage() {
  document.getElementById('addJobBtn')?.addEventListener('click', () => ui.openModal('modal-add-job'));
  document.getElementById('confirmAddJob')?.addEventListener('click', handleAddJob);

  const search = document.getElementById('mainSearch');
  if (search) {
    search.addEventListener('input', debounce(() => ui.renderJobs(search.value), 300));
  }
}

async function handleAddJob() {
  const fields = {
    type:      document.getElementById('job-type').value,
    ownership: document.getElementById('job-ownership').value,
    supplier:  document.getElementById('job-supplier').value,
    city:      document.getElementById('job-city').value,
    phone:     document.getElementById('job-phone').value,
    payment:   document.getElementById('job-payment').value,
    share:     document.getElementById('job-share').value,
  };
  const result = await actions.addJob(fields);
  if (result?.errors) {
    Object.entries(result.errors).forEach(([k, v]) => toast.error(v));
    return;
  }
  ui.closeModal('modal-add-job');
  ui.renderJobs();
  ui.renderDashboard();
}

// ================================================================
//  صفحة الشغل (العربيات)
// ================================================================
async function openJob(jobId) {
  store.set({ currentJobId: jobId });
  const job = store.get().jobs.find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('bc-job').textContent  = job.name;
  document.getElementById('bc-job2').textContent = job.name;
  document.getElementById('job-detail-title').innerHTML = `🚛 عربيات: ${job.name}`;

  await actions.loadTrucks(jobId);
  ui.renderTrucks();
  ui.showPage('page-job');

  // روابط فتح العربية
  document.getElementById('trucks-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-open-truck]');
    if (!btn) return;
    await openTruck(jobId, btn.dataset.openTruck);
  });
}

// ================================================================
//  صفحة العربية
// ================================================================
async function openTruck(jobId, truckId) {
  store.set({ currentJobId: jobId, currentTruckId: truckId });
  const state = store.get();
  const job   = state.jobs.find(j => j.id === jobId);
  const truck = state.trucks.find(t => t.id === truckId);
  if (!job || !truck) return;

  document.getElementById('bc-job2').textContent  = job.name;
  document.getElementById('bc-truck').textContent = `عربية رقم ${truck.num}`;

  await actions.loadTruckData(truckId);
  renderTruckView(job, truck);
  ui.showPage('page-truck');
}

function renderTruckView(job, truck) {
  const state   = store.get();
  const items   = state.items;
  const clients = state.clients;
  ui.renderTruckContent(job, truck, items, clients);
  bindTruckContentEvents(job, truck);
}

function bindTruckPage() {
  document.getElementById('addTruckBtn')?.addEventListener('click', () => {
    document.getElementById('truck-load-date').value = today();
    document.getElementById('truck-dist-date').value = today();
    ui.openModal('modal-add-truck');
  });
  document.getElementById('confirmAddTruck')?.addEventListener('click', async () => {
    const state = store.get();
    const truck = await actions.addTruck(
      state.currentJobId,
      document.getElementById('truck-load-date').value,
      document.getElementById('truck-dist-date').value
    );
    if (truck) { ui.closeModal('modal-add-truck'); ui.renderTrucks(); }
  });
}

function bindTruckContentEvents(job, truck) {
  const content = document.getElementById('truck-content');
  if (!content) return;

  // ── مشتريات ──
  content.addEventListener('click', async e => {
    if (e.target.closest('#btn-add-item')) { openItemModal(null); return; }
    if (e.target.closest('#btn-add-expense')) { openExpenseModal(truck); return; }
    if (e.target.closest('#btn-our-expenses')) { openOurExpensesModal(truck); return; }
    if (e.target.closest('#btn-add-client')) { openClientModal(null, truck); return; }

    const editItemBtn = e.target.closest('[data-edit-item]');
    if (editItemBtn) { openItemModal(parseInt(editItemBtn.dataset.editItem)); return; }

    const delItemBtn = e.target.closest('[data-delete-item]');
    if (delItemBtn && confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      await actions.removeItem(delItemBtn.dataset.deleteItem);
      refreshTruck(job, truck);
      return;
    }

    const editClientBtn = e.target.closest('[data-edit-client]');
    if (editClientBtn) { openClientModal(parseInt(editClientBtn.dataset.editClient), truck); return; }

    const delClientBtn = e.target.closest('[data-delete-client]');
    if (delClientBtn && confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      await actions.removeClient(delClientBtn.dataset.deleteClient);
      refreshTruck(job, truck);
      return;
    }

    const openDetailLink = e.target.closest('[data-open-client-detail]');
    if (openDetailLink) {
      const client = store.get().clients.find(c => c.id === openDetailLink.dataset.openClientDetail);
      if (client) openClientDetailModal(client, truck);
      return;
    }
  });

  // تحديث الفاتورة مباشرة من الجدول
  content.addEventListener('change', async e => {
    const input = e.target.closest('[data-update-invoice]');
    if (input) {
      await actions.updateClientNetInvoice(input.dataset.updateInvoice, input.value);
      await actions.syncSupplierLedger(truck.id);
      refreshTruck(job, truck);
    }
  });
}

async function refreshTruck(job, truckObj) {
  const state   = store.get();
  const truck   = state.trucks.find(t => t.id === truckObj.id) || truckObj;
  renderTruckView(job, truck);
}

// ================================================================
//  مودال إضافة/تعديل صنف
// ================================================================
function openItemModal(idx) {
  const state = store.get();
  clearItemModal();
  if (idx !== null) {
    const item = state.items[idx];
    if (!item) return;
    document.getElementById('item-editing-id').value       = item.id;
    document.getElementById('item-count').value            = item.count;
    document.getElementById('item-name').value             = item.name;
    document.getElementById('item-unit-type').value        = item.unit_type || 'weight';
    document.getElementById('item-weight-or-count').value  = item.unit_type === 'weight' ? item.weight : item.count;
    document.getElementById('item-price').value            = item.price;
    document.getElementById('item-bai3a').value            = item.bai3a;
    calcItemPriceDisplay();
  }
  ui.openModal('modal-add-item');
}
function clearItemModal() {
  ['item-editing-id','item-count','item-name','item-weight-or-count','item-price','item-bai3a'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('item-unit-type').value = 'weight';
  const disp = document.getElementById('item-total-display');
  if (disp) { disp.textContent = '0'; disp.removeAttribute('data-val'); }
}
function calcItemPriceDisplay() {
  const unitType = document.getElementById('item-unit-type').value;
  const count    = n(document.getElementById('item-count').value);
  const val      = n(document.getElementById('item-weight-or-count').value);
  const price    = n(document.getElementById('item-price').value);
  const bai3a    = n(document.getElementById('item-bai3a').value);
  let total = 0;
  if (unitType === 'weight') total = (val * price) + bai3a;
  else total = (count * price) + bai3a;
  const disp = document.getElementById('item-total-display');
  if (disp) { disp.textContent = total.toLocaleString('ar-EG') + ' ج'; disp.dataset.val = total; }
}

// ================================================================
//  مودال المصاريف
// ================================================================
function openExpenseModal(truck) {
  EXPENSE_KEYS.forEach(({ key }) => {
    const el = document.getElementById(`exp-${key}`);
    if (el) el.value = (truck.expenses || {})[key] || 0;
  });
  calcExpenseTotalDisplay();
  ui.openModal('modal-add-expense');
}
function calcExpenseTotalDisplay() {
  const total = EXPENSE_KEYS.reduce((s, { key }) => s + n(document.getElementById(`exp-${key}`)?.value), 0);
  const disp  = document.getElementById('exp-total-display');
  if (disp) disp.textContent = total.toLocaleString('ar-EG') + ' ج';
}

// ================================================================
//  مودال مصاريفنا
// ================================================================
function openOurExpensesModal(truck) {
  const el = document.getElementById('our-expenses-val');
  if (el) el.value = truck.our_expenses || 0;
  ui.openModal('modal-our-expenses');
}

// ================================================================
//  مودال إضافة/تعديل عميل
// ================================================================
function openClientModal(idx, truck) {
  const state = store.get();
  clearClientModal(truck);
  if (idx !== null) {
    const client = state.clients[idx];
    if (!client) return;
    document.getElementById('client-editing-id').value    = client.id;
    document.getElementById('client-name').value          = client.name;
    document.getElementById('client-city').value          = client.city || '';
    document.getElementById('client-payment-type').value  = client.payment_type;
    document.getElementById('client-noloon').value        = client.noloon || 0;
    document.getElementById('client-mashal').value        = client.mashal || 0;
    const container = document.getElementById('client-items-form');
    container.innerHTML = '';
    (client.items || []).forEach(item => addClientItemRow(item.name, item.count, item.qaem, truck));
    if (!client.items?.length) addClientItemRow('', '', '', truck);
  }
  ui.openModal('modal-add-client');
}
function clearClientModal(truck) {
  ['client-editing-id','client-name','client-city'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('client-payment-type').value = 'نقدي';
  document.getElementById('client-noloon').value = 0;
  document.getElementById('client-mashal').value = 0;
  document.getElementById('client-items-form').innerHTML = '';
  addClientItemRow('', '', '', truck);
}
function addClientItemRow(name = '', count = '', qaem = '', truck = null) {
  const state = store.get();
  const items = truck ? store.get().items : state.items;
  const opts  = items.map(i => `<option value="${i.name}" ${i.name === name ? 'selected' : ''}>${i.name}</option>`).join('');
  const div   = document.createElement('div');
  div.className = 'grid-3';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <div class="form-group">
      <label class="form-label">الصنف</label>
      <select class="form-control client-item-name">${opts || '<option>لا توجد أصناف</option>'}</select>
    </div>
    <div class="form-group">
      <label class="form-label">العدد</label>
      <input class="form-control client-item-count" type="number" value="${count}" placeholder="0">
    </div>
    <div class="form-group">
      <label class="form-label">القايم</label>
      <input class="form-control client-item-qaem" type="number" value="${qaem}" placeholder="0">
    </div>`;
  document.getElementById('client-items-form').appendChild(div);
}

// ================================================================
//  مودال تفاصيل عميل (فاتورة)
// ================================================================
function openClientDetailModal(client, truck) {
  ui.renderClientDetailModal(client);
  bindClientDetailEvents(client, truck);
}
function bindClientDetailEvents(client, truck) {
  const modal = document.getElementById('modal-client-detail');
  modal.addEventListener('change', async e => {
    const input = e.target.closest('[data-client-field]');
    if (!input) return;
    const { clientField: clientId, fieldIdx: idx, field } = input.dataset;
    await actions.updateClientItemField(clientId, parseInt(idx), field, input.value);
    const updatedClient = store.get().clients.find(c => c.id === clientId);
    if (updatedClient) ui.renderClientDetailModal(updatedClient);
    refreshTruck(store.get().jobs.find(j => j.id === store.get().currentJobId), truck);
  });
  modal.addEventListener('click', async e => {
    const delBtn = e.target.closest('[data-delete-client-item]');
    if (delBtn) {
      const { deleteClientItem: cId, itemIdx: idx } = delBtn.dataset;
      await actions.deleteClientItem(cId, parseInt(idx));
      const updatedClient = store.get().clients.find(c => c.id === cId);
      if (updatedClient) ui.renderClientDetailModal(updatedClient);
      refreshTruck(store.get().jobs.find(j => j.id === store.get().currentJobId), truck);
      return;
    }
    const addBtn = e.target.closest('[data-add-client-item]');
    if (addBtn) {
      await actions.addClientItemInDetail(addBtn.dataset.addClientItem);
      const updatedClient = store.get().clients.find(c => c.id === addBtn.dataset.addClientItem);
      if (updatedClient) ui.renderClientDetailModal(updatedClient);
    }
  });
}

// ================================================================
//  BIND MODALS (أزرار مشتركة)
// ================================================================
function bindModals() {
  // إغلاق عام
  document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.modal || btn.dataset.modalClose;
      if (id) ui.closeModal(id);
    });
  });

  // Item modal
  document.querySelectorAll('[data-oninput-item]').forEach(el => {
    el.addEventListener('input', calcItemPriceDisplay);
  });
  document.getElementById('item-unit-type')?.addEventListener('change', calcItemPriceDisplay);
  document.getElementById('confirmAddItem')?.addEventListener('click', async () => {
    const state   = store.get();
    const existId = document.getElementById('item-editing-id')?.value || null;
    const fields  = {
      name:            document.getElementById('item-name').value,
      count:           document.getElementById('item-count').value,
      unit_type:       document.getElementById('item-unit-type').value,
      weight_or_count: document.getElementById('item-weight-or-count').value,
      price:           document.getElementById('item-price').value,
      bai3a:           document.getElementById('item-bai3a').value,
    };
    const result = await actions.saveItem(state.currentTruckId, fields, existId || null);
    if (result?.errors) { Object.values(result.errors).forEach(v => toast.error(v)); return; }
    ui.closeModal('modal-add-item');
    const job   = state.jobs.find(j => j.id === state.currentJobId);
    const truck = state.trucks.find(t => t.id === state.currentTruckId);
    if (job && truck) refreshTruck(job, truck);
  });

  // Expense modal
  EXPENSE_KEYS.forEach(({ key }) => {
    document.getElementById(`exp-${key}`)?.addEventListener('input', calcExpenseTotalDisplay);
  });
  document.getElementById('confirmAddExpense')?.addEventListener('click', async () => {
    const state = store.get();
    const truck = state.trucks.find(t => t.id === state.currentTruckId);
    if (!truck) return;
    const expObj = {};
    EXPENSE_KEYS.forEach(({ key }) => { expObj[key] = n(document.getElementById(`exp-${key}`)?.value); });
    const updated = await actions.saveExpenses(truck, expObj);
    ui.closeModal('modal-add-expense');
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (job && updated) refreshTruck(job, updated);
  });

  // Our expenses modal
  document.getElementById('confirmOurExpenses')?.addEventListener('click', async () => {
    const state = store.get();
    const truck = state.trucks.find(t => t.id === state.currentTruckId);
    if (!truck) return;
    const updated = await actions.saveOurExpenses(truck, document.getElementById('our-expenses-val').value);
    ui.closeModal('modal-our-expenses');
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (job && updated) refreshTruck(job, updated);
  });

  // Client modal – إضافة صف صنف
  document.getElementById('addClientItemRowBtn')?.addEventListener('click', () => {
    const state = store.get();
    const truck = state.trucks.find(t => t.id === state.currentTruckId);
    addClientItemRow('', '', '', truck);
  });
  document.getElementById('confirmAddClient')?.addEventListener('click', async () => {
    const state  = store.get();
    const truck  = state.trucks.find(t => t.id === state.currentTruckId);
    const existId= document.getElementById('client-editing-id')?.value || null;
    const names  = document.querySelectorAll('.client-item-name');
    const counts = document.querySelectorAll('.client-item-count');
    const qaems  = document.querySelectorAll('.client-item-qaem');
    const items  = [];
    names.forEach((el, i) => {
      if (el.value?.trim()) items.push({ name: el.value.trim(), count: n(counts[i].value), qaem: n(qaems[i].value) });
    });
    const fields = {
      name:         document.getElementById('client-name').value,
      city:         document.getElementById('client-city').value,
      payment_type: document.getElementById('client-payment-type').value,
      noloon:       document.getElementById('client-noloon').value,
      mashal:       document.getElementById('client-mashal').value,
      items,
    };
    const result = await actions.saveClient(state.currentTruckId, truck, fields, existId || null);
    if (result?.errors) { Object.values(result.errors).forEach(v => toast.error(v)); return; }
    ui.closeModal('modal-add-client');
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (job && truck) refreshTruck(job, truck);
  });
}

// ================================================================
//  صفحة العملاء
// ================================================================
async function renderCustomersPage() {
  const entries = await actions.loadCustomerData();
  ui.renderCustomers(entries, store.get().pagination.customers.page);

  // روابط فتح تفاصيل العميل
  document.getElementById('customers-list-render')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-open-customer]');
    if (!card) return;
    await openCustomerDetail(card.dataset.openCustomer);
  });

  // ترقيم الصفحات
  document.getElementById('customers-pagination')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-pg]');
    if (!btn || btn.disabled) return;
    store.setPage('customers', parseInt(btn.dataset.pg));
    ui.renderCustomers(store.get().customerEntries || entries, store.get().pagination.customers.page);
  });
}

async function openCustomerDetail(name) {
  const entries = await db.fetchCustomerLedger(userId(), name);
  document.getElementById('bc-customer').textContent = name;
  ui.renderCustomerDetail(name, entries);
  ui.showPage('page-customer-detail');

  // دفعة جديدة
  document.getElementById('btn-add-customer-payment')?.addEventListener('click', () => {
    document.getElementById('cp-customer-name').value = name;
    document.getElementById('cp-amount').value = '';
    document.getElementById('cp-date').value   = today();
    document.getElementById('cp-notes').value  = '';
    ui.openModal('modal-customer-payment');
  });

  // واتساب
  document.getElementById('btn-whatsapp-customer')?.addEventListener('click', () => {
    actions.shareCustomerWhatsApp(name, entries);
  });
}

document.getElementById('confirmCustomerPayment')?.addEventListener('click', async () => {
  const name   = document.getElementById('cp-customer-name').value;
  const amount = document.getElementById('cp-amount').value;
  const date   = document.getElementById('cp-date').value;
  const notes  = document.getElementById('cp-notes').value;
  const result = await actions.addCustomerPayment(name, amount, date, notes);
  if (result === true) {
    ui.closeModal('modal-customer-payment');
    const entries = await db.fetchCustomerLedger(userId(), name);
    ui.renderCustomerDetail(name, entries);
  }
});

// ================================================================
//  صفحة الموردين
// ================================================================
async function renderSuppliersPage() {
  const state = store.get();
  // جلب بيانات المورد لكل شغل
  const supplierData = {};
  await Promise.all(state.jobs.map(async j => {
    const [entries, payments] = await Promise.all([
      db.fetchSupplierLedger(userId(), j.id),
      [], // سيتم جلبهم عند فتح التفاصيل
    ]);
    supplierData[j.id] = { entries, payments };
  }));

  ui.renderSuppliers(state.jobs, supplierData);

  document.getElementById('suppliers-list-render')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-open-supplier]');
    if (!card) return;
    await openSupplierDetail(card.dataset.openSupplier, supplierData);
  });
}

async function openSupplierDetail(jobId, supplierData) {
  const state = store.get();
  const job   = state.jobs.find(j => j.id === jobId);
  if (!job) return;
  document.getElementById('bc-supplier').textContent = `${job.supplier} – ${job.name}`;

  const entries  = supplierData[jobId]?.entries || [];
  const payments = await db.fetchSupplierLedger(userId(), jobId)
    .then(rows => rows.filter(r => r.entry_type === 'payment'));

  ui.renderSupplierDetail(job, entries, payments);
  ui.showPage('page-supplier-detail');

  document.getElementById('btn-record-supplier-payment')?.addEventListener('click', async () => {
    const amount = n(document.getElementById('sup-pay-amount').value);
    const date   = document.getElementById('sup-pay-date').value;
    if (!amount) { toast.error('أدخل المبلغ'); return; }
    await actions.recordPayment(jobId, amount, date, '');
    const updatedPayments = await db.fetchSupplierLedger(userId(), jobId)
      .then(rows => rows.filter(r => r.entry_type === 'payment'));
    ui.renderSupplierDetail(job, entries, updatedPayments);
  });
}

// ================================================================
//  صفحة الكاش فلو
// ================================================================
async function renderCashflowPage() {
  const state = store.get();
  ui.populateCustomerSelect(state.customerNames);
  ui.populateSupplierSelect(state.jobs);
  document.getElementById('cf-in-date').value  = today();
  document.getElementById('cf-out-date').value = today();

  const entries = await actions.loadCashflow();
  ui.renderCashflowLog(entries);
}

function bindCashflowPage() {
  document.getElementById('recordCollectionBtn')?.addEventListener('click', async () => {
    await actions.recordCollection(
      document.getElementById('cf-customer-sel').value,
      document.getElementById('cf-in-amount').value,
      document.getElementById('cf-in-date').value,
      document.getElementById('cf-in-notes').value
    );
    document.getElementById('cf-in-amount').value = '';
    document.getElementById('cf-in-notes').value  = '';
    ui.renderCashflowLog(store.get().cashflow);
  });

  document.getElementById('recordPaymentBtn')?.addEventListener('click', async () => {
    await actions.recordPayment(
      document.getElementById('cf-supplier-sel').value,
      document.getElementById('cf-out-amount').value,
      document.getElementById('cf-out-date').value,
      document.getElementById('cf-out-notes').value
    );
    document.getElementById('cf-out-amount').value = '';
    document.getElementById('cf-out-notes').value  = '';
    ui.renderCashflowLog(store.get().cashflow);
  });
}

// ================================================================
//  صفحة سجل الأحداث
// ================================================================
async function renderAuditPage() {
  const entries = await actions.loadAuditLog();
  ui.renderAuditLog(entries);
}

// ================================================================
//  أحداث عامة
// ================================================================
function bindGlobalEvents() {
  // ترقيم صفحات الأشغال
  document.getElementById('jobs-pagination')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-pg]');
    if (!btn || btn.disabled) return;
    store.setPage('jobs', parseInt(btn.dataset.pg));
    ui.renderJobs(document.getElementById('mainSearch')?.value || '');
  });

  // Backup/Restore
  document.getElementById('btn-export')?.addEventListener('click', actions.exportBackup);
  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('تحذير: هل تريد استعادة النسخة الاحتياطية؟')) return;
    try {
      const data = await readJsonFile(file);
      toast.info('تم استيراد الملف. يرجى مراجعة البيانات.');
      console.log('Imported data:', data);
    } catch (err) {
      toast.error(err.message);
    }
  });
}

// ── تصدير للاستخدام في ui.js إذا لزم ──
export { openJob, navigateTo };
