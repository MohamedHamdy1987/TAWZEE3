// ================================================================
//  ui.js – دوال الرسم (Rendering)
// ================================================================
import { escapeHtml, fmt, dateStr, today, n, paginate, totalPages } from './utils.js';
import { store } from './store.js';
import { EXPENSE_KEYS, PAGE_SIZE } from './config.js';
import {
  getRemainingItems, buildTruckSummary, calcSupplierAccount,
  rebuildCustomerBalance, calcDailyCashflow, buildDashboard,
  recalcTruck
} from './logic.js';

// ── حماية اختراق XSS: جميع النصوص تمرّ عبر escapeHtml قبل الإدراج ──

// ================================================================
//  الـ LOADER العام
// ================================================================
export function showLoader(msg = 'جارٍ التحميل...') {
  const l = document.getElementById('global-loader');
  if (!l) return;
  l.querySelector('.loader-text').textContent = msg;
  l.classList.add('show');
}
export function hideLoader() {
  document.getElementById('global-loader')?.classList.remove('show');
}

// ================================================================
//  التنقل بين الصفحات
// ================================================================
export function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');
}

// ================================================================
//  MODAL helpers
// ================================================================
export function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ================================================================
//  DASHBOARD
// ================================================================
export function renderDashboard() {
  const state = store.get();
  const dash = buildDashboard(
    state.jobs,
    state.trucks,
    {}  // يمكن توسيعه لاحقًا
  );

  setEl('dash-total-profit',   fmt(dash.totalProfit)  + ' ج');
  setEl('dash-total-revenue',  fmt(dash.totalRevenue) + ' ج');
  setEl('dash-active-jobs',    dash.activeJobs);
  setEl('dash-total-trucks',   dash.totalTrucks);

  const topEl = document.getElementById('dash-top-debtors');
  if (topEl) {
    if (!dash.topDebtors.length) {
      topEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">لا توجد مديونيات</div></div>';
    } else {
      topEl.innerHTML = dash.topDebtors.map(d =>
        `<div class="ledger-row ledger-credit" style="justify-content:space-between">
          <span class="ledger-amount-pos">${escapeHtml(d.name)}</span>
          <span style="font-weight:700;color:var(--red)">${fmt(d.balance)} ج</span>
        </div>`
      ).join('');
    }
  }
}

// ================================================================
//  JOBS
// ================================================================
export function renderJobs(searchTerm = '') {
  const state = store.get();
  const term = searchTerm.toLowerCase();
  const all = state.jobs.filter(j =>
    (j.name || '').toLowerCase().includes(term) ||
    (j.supplier || '').toLowerCase().includes(term) ||
    (j.city || '').toLowerCase().includes(term)
  );

  const { page } = state.pagination.jobs;
  const pages    = totalPages(all.length, PAGE_SIZE);
  const paged    = paginate(all, page, PAGE_SIZE);

  const list  = document.getElementById('jobs-list');
  const empty = document.getElementById('jobs-empty');
  if (!list) return;

  if (!all.length) {
    list.innerHTML = '';
    empty && (empty.style.display = 'block');
    renderPagination('jobs-pagination', page, pages, 'jobs');
    return;
  }
  empty && (empty.style.display = 'none');

  list.innerHTML = paged.map(j => {
    const truckCount = j.truck_count || 0;
    return `<div class="card" style="cursor:pointer;margin-bottom:10px" data-job-id="${j.id}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:800;font-size:1rem">${escapeHtml(j.name)}</div>
          <div style="font-size:0.8rem;color:var(--text2);margin-top:4px">
            👤 ${escapeHtml(j.supplier)} | 📍 ${escapeHtml(j.city)}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="tag tag-blue">🚛 ${truckCount}</span>
          <span class="tag tag-orange">${escapeHtml(j.payment)}</span>
          <span class="tag ${j.ownership === 'لحسابنا' ? 'tag-green' : 'tag-purple'}">${escapeHtml(j.ownership)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination('jobs-pagination', page, pages, 'jobs');
}

// ================================================================
//  TRUCKS
// ================================================================
export function renderTrucks() {
  const state = store.get();
  const trucks = state.trucks;
  const list   = document.getElementById('trucks-list');
  const empty  = document.getElementById('trucks-empty');
  if (!list) return;

  if (!trucks.length) {
    list.innerHTML = '';
    empty && (empty.style.display = 'block');
    return;
  }
  empty && (empty.style.display = 'none');

  list.innerHTML = trucks.map(t => {
    const itemsTotal    = n(t.items_total);
    const invoicesTotal = n(t.invoices_total);
    const profit = invoicesTotal - itemsTotal - n(t.expenses_total);
    return `<div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <div style="font-weight:800">🚛 عربية رقم ${t.num}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="tag tag-blue">📅 تحميل: ${dateStr(t.load_date)}</span>
          <span class="tag tag-green">📅 توزيع: ${dateStr(t.dist_date)}</span>
          <span class="tag ${profit >= 0 ? 'tag-green' : 'tag-red'}">${profit >= 0 ? '✅' : '❌'} ${fmt(Math.abs(Math.round(profit)))} ج</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="stat-box"><div class="stat-val">${n(t.items_count)}</div><div class="stat-lbl">أصناف</div></div>
        <div class="stat-box"><div class="stat-val" style="font-size:1rem">${fmt(itemsTotal)}</div><div class="stat-lbl">مشتريات</div></div>
        <div class="stat-box"><div class="stat-val" style="font-size:1rem">${fmt(invoicesTotal)}</div><div class="stat-lbl">فواتير</div></div>
        <div class="stat-box"><div class="stat-val">${n(t.clients_count)}</div><div class="stat-lbl">عملاء</div></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary btn-sm" data-open-truck="${t.id}">📂 فتح العربية</button>
      </div>
    </div>`;
  }).join('');
}

// ================================================================
//  TRUCK CONTENT (TABS)
// ================================================================
export function renderTruckContent(job, truck, items, clients) {
  const isOurs = job.ownership === 'لحسابنا';
  const truckObj = { ...truck, items, clients };
  const { purchases, expenses: expTotal, totalCost: truckFinalCost, invoices: invoiceTotal, profit } = recalcTruck(truckObj);

  const html = `
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div style="font-weight:800;font-size:1.1rem">🚛 عربية رقم ${truck.num} &nbsp;
        <span style="font-size:0.8rem;color:var(--text2)">${dateStr(truck.load_date)}</span>
      </div>
      ${!isOurs ? `<button class="btn btn-ghost btn-sm" id="btn-our-expenses">💰 مصاريفنا</button>` : ''}
    </div>
    <div style="margin:10px 0;padding:12px;border-radius:10px;
      background:${profit >= 0 ? '#e8f5e9' : '#ffebee'};
      color:${profit >= 0 ? '#2e7d32' : '#c62828'};
      font-weight:800;text-align:center;font-size:1rem">
      💰 صافي العربية: ${profit >= 0 ? '+' : '-'}${fmt(Math.abs(Math.round(profit)))} ج
    </div>
    <div class="truck-tabs">
      <button class="truck-tab active" data-tab="purchases">🛒 المشتريات</button>
      <button class="truck-tab" data-tab="distribution">📦 التوزيع</button>
      <button class="truck-tab" data-tab="summary">📊 ملخص العربية</button>
    </div>
    <div class="truck-tab-content active" id="tab-purchases">
      ${isOurs ? renderPurchasesTab(truckObj, expTotal, truckFinalCost) : '<div class="card">هذا الشغل لحساب المورد، لا توجد مشتريات.</div>'}
    </div>
    <div class="truck-tab-content" id="tab-distribution">
      ${renderDistributionTab(truckObj, invoiceTotal, isOurs)}
    </div>
    <div class="truck-tab-content" id="tab-summary">
      ${isOurs ? renderSummaryTab(truckObj) : renderSupplierSummaryTab(truckObj, invoiceTotal)}
    </div>
  </div>`;

  document.getElementById('truck-content').innerHTML = html;

  // ربط تبديل التبويبات
  document.querySelectorAll('.truck-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.truck-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.truck-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

function renderPurchasesTab(truck, expTotal, truckFinalCost) {
  let html = `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div class="card-title" style="margin-bottom:0">🧾 المشتريات</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-sm" id="btn-add-item">➕ صنف</button>
        <button class="btn btn-ghost btn-sm" id="btn-add-expense">💸 مصاريف</button>
      </div>
    </div>
    <div class="table-wrap" style="margin-top:12px">
      <table>
        <thead>
          <tr>
            <th>عدد</th><th>صنف</th><th>الوزن/العدد</th>
            <th>السعر</th><th>بياعة</th><th>الثمن</th><th></th>
          </tr>
        </thead>
        <tbody>`;

  (truck.items || []).forEach((item, idx) => {
    const unitLabel = item.unit_type === 'weight'
      ? `${fmt(item.weight)} كيلو`
      : `${n(item.count)} وحدة`;
    html += `
      <tr>
        <td>${n(item.count)}</td>
        <td><b>${escapeHtml(item.name)}</b></td>
        <td>${unitLabel}</td>
        <td>${fmt(item.price)}</td>
        <td>${fmt(item.bai3a)}</td>
        <td style="color:var(--accent);font-weight:700">${fmt(item.total)}</td>
        <td>
          <button class="btn-icon" data-edit-item="${idx}" title="تعديل">✏️</button>
          <button class="btn-icon" data-delete-item="${item.id}" title="حذف">🗑</button>
        </td>
      </tr>`;
  });

  const totalCount  = (truck.items || []).reduce((s, i) => s + n(i.count), 0);
  const totalWeight = (truck.items || []).reduce((s, i) => s + n(i.weight), 0);
  const totalGoods  = (truck.items || []).reduce((s, i) => s + n(i.total), 0);

  html += `
      <tr class="tfoot-row">
        <td>${totalCount} طرد</td><td>الإجمالي</td>
        <td>${fmt(totalWeight)} كيلو</td>
        <td colspan="2"></td><td>${fmt(totalGoods)}</td><td></td>
      </tr>
        </tbody>
      </table>
    </div>
    <div class="card" style="margin-top:10px;padding:12px">
      <div style="font-size:0.82rem;font-weight:700;margin-bottom:8px">💸 المصاريف</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:0.8rem">`;

  EXPENSE_KEYS.forEach(({ key, label }) => {
    html += `<div style="display:flex;justify-content:space-between;padding:4px 8px;background:var(--surface2);border-radius:6px">
      <span style="color:var(--text2)">${label}</span>
      <span style="font-weight:700">${fmt((truck.expenses || {})[key])}</span>
    </div>`;
  });

  html += `</div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;padding:8px;background:var(--surface3);border-radius:6px;font-weight:700">
        <span>إجمالي المصاريف</span>
        <span style="color:var(--red)">${fmt(expTotal)}</span>
      </div>
    </div>
    <div class="big-total">
      <div class="big-total-lbl">ثمن العربية النهائي</div>
      <div class="big-total-val">${fmt(truckFinalCost)} ج</div>
    </div>
  </div>`;
  return html;
}

function renderDistributionTab(truck, invoiceTotal, isOurs) {
  const remaining = getRemainingItems(truck);

  let remainingHtml = `<div class="card" style="margin-bottom:10px">
    <div class="card-title">📦 المتبقي من العربية</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">`;
  for (const [name, rem] of Object.entries(remaining)) {
    const cnt = Math.max(0, rem.count);
    const cls = cnt === 0 ? 'tag-red' : cnt < 10 ? 'tag-orange' : 'tag-green';
    remainingHtml += `<div class="tag ${cls}">${escapeHtml(name)}: ${cnt} طرد</div>`;
  }
  remainingHtml += `</div></div>`;

  let html = `<div class="card">
    <div class="card-title">📦 التوزيع</div>
    ${remainingHtml}
    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
      <div></div>
      <button class="btn btn-primary btn-sm" id="btn-add-client">➕ عميل</button>
    </div>`;

  if (!(truck.clients || []).length) {
    html += `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">لا توجد توزيعات بعد</div></div>`;
  } else {
    html += `<div class="table-wrap"><table>
      <thead><tr>
        <th>العميل</th><th>البلد</th><th>الأصناف</th>
        <th>نولون</th><th>مشال</th><th>نوع الدفع</th>
        <th>صافي الفاتورة</th><th></th>
      </tr></thead><tbody>`;
    (truck.clients || []).forEach((c, idx) => {
      const itemsSummary = (c.items || []).map(i => `${n(i.count)} ${escapeHtml(i.name)}`).join(' + ');
      html += `<tr>
        <td><b>${escapeHtml(c.name)}</b></td>
        <td>${escapeHtml(c.city || '-')}</td>
        <td>
          <span style="cursor:pointer;color:var(--blue);text-decoration:underline"
            data-open-client-detail="${c.id}">
            ${itemsSummary || '-'}
          </span>
        </td>
        <td>${fmt(c.noloon)}</td>
        <td>${fmt(c.mashal)}</td>
        <td><span class="tag ${c.payment_type === 'نقدي' ? 'tag-green' : 'tag-orange'}">${escapeHtml(c.payment_type)}</span></td>
        <td>
          <input type="number" class="form-control" style="width:120px;display:inline-block"
            value="${n(c.net_invoice)}"
            data-update-invoice="${c.id}">
        </td>
        <td>
          <button class="btn-icon" data-edit-client="${idx}" title="تعديل">✏️</button>
          <button class="btn-icon" data-delete-client="${c.id}" title="حذف">🗑</button>
        </td>
      </tr>`;
    });
    html += `<tr class="tfoot-row">
      <td colspan="6">إجمالي الفواتير</td>
      <td>${fmt(invoiceTotal)} ج</td><td></td>
    </tr></tbody></table></div>`;
  }

  html += `</div>`;

  if (!isOurs) {
    html += `<div class="card">
      <div class="grid-2">
        <div>
          <div class="form-label">مصاريفنا على العربية</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${fmt(truck.our_expenses)} ج</div>
        </div>
        <div>
          <div class="form-label">صافي العربية النهائي</div>
          <div style="font-size:1.2rem;font-weight:800;color:var(--green)">${fmt(invoiceTotal - n(truck.our_expenses))} ج</div>
        </div>
      </div>
    </div>`;
  }
  return html;
}

function renderSummaryTab(truck) {
  const summary = buildTruckSummary(truck);
  const { totals, costPerKg, grandProfit, items, weightComparison } = summary;

  let rows = '';
  items.forEach(item => {
    const cls = item.profit >= 0 ? 'profit-pos' : 'profit-neg';
    rows += `<tr>
      <td><b>${escapeHtml(item.name)}</b></td>
      <td>${item.count}</td>
      <td>${fmt(item.qaem)}</td>
      <td>${fmt(item.expenseShare)}</td>
      <td>${fmt(item.commission)}</td>
      <td>${fmt(item.netSale)}</td>
      <td>${fmt(item.purchTotal)}</td>
      <td class="${cls}">${item.profit >= 0 ? '✅ ' : '❌ '}${fmt(Math.abs(item.profit))}</td>
    </tr>`;
  });

  let weightTable = '';
  if (weightComparison.length) {
    const wRows = weightComparison.map(w => {
      const cls = w.diff > 0 ? 'profit-neg' : w.diff < 0 ? 'profit-pos' : '';
      const label = w.diff > 0
        ? `🔴 ${fmt(w.diff)} كيلو نقص`
        : w.diff < 0 ? `🟢 ${fmt(-w.diff)} كيلو زيادة` : '-';
      return `<tr>
        <td><b>${escapeHtml(w.name)}</b></td>
        <td>${fmt(w.purchased)} كيلو</td>
        <td>${fmt(w.sold)} كيلو</td>
        <td class="${cls}">${label}</td>
      </tr>`;
    }).join('');
    weightTable = `<div class="card" style="margin-top:12px">
      <div class="card-title">⚖️ مقارنة الوزن (مشتريات vs مبيعات)</div>
      <div class="table-wrap"><table>
        <thead><tr><th>الصنف</th><th>وزن المشتريات</th><th>وزن المبيعات</th><th>الفرق</th></tr></thead>
        <tbody>${wRows}</tbody>
      </table></div>
    </div>`;
  }

  return `<div class="card">
    <div class="card-title">📊 ملخص العربية</div>
    <div class="grid-4">
      <div class="stat-box"><div class="stat-val" style="font-size:1rem">${fmt(totals.totalCost)}</div><div class="stat-lbl">تكلفة العربية</div></div>
      <div class="stat-box"><div class="stat-val" style="font-size:1rem">${fmt(totals.invoices)}</div><div class="stat-lbl">إجمالي الفواتير</div></div>
      <div class="stat-box">
        <div class="stat-val" style="font-size:1rem;color:${grandProfit >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${fmt(Math.abs(grandProfit))}
        </div>
        <div class="stat-lbl">${grandProfit >= 0 ? '✅ ربح' : '❌ خسارة'}</div>
      </div>
      <div class="stat-box"><div class="stat-val" style="font-size:0.9rem">${fmt(costPerKg)}</div><div class="stat-lbl">تكلفة الكيلو</div></div>
    </div>
    ${rows ? `
    <div class="table-wrap" style="margin-top:12px">
      <table>
        <thead><tr>
          <th>الصنف</th><th>الكمية</th><th>القايم</th>
          <th>المصاريف</th><th>العمولة 7%</th>
          <th>الصافي</th><th>المشتريات</th><th>النتيجة</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>` : '<div class="empty-state"><div class="empty-state-text">لا توجد بيانات كافية للتحليل</div></div>'}
    ${weightTable}
    <div class="big-total">
      <div class="big-total-lbl">إجمالي ربح/خسارة العربية</div>
      <div class="big-total-val ${grandProfit >= 0 ? 'profit-pos' : 'profit-neg'}">
        ${grandProfit >= 0 ? '+' : ''}${fmt(grandProfit)} ج
      </div>
    </div>
  </div>`;
}

function renderSupplierSummaryTab(truck, invoiceTotal) {
  const net = invoiceTotal - n(truck.our_expenses);
  return `<div class="card">
    <div class="card-title">📊 ملخص العربية (لحساب المورد)</div>
    <div class="grid-2">
      <div class="stat-box"><div class="stat-val">${fmt(invoiceTotal)}</div><div class="stat-lbl">إجمالي الفواتير</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--red)">${fmt(truck.our_expenses)}</div><div class="stat-lbl">مصاريفنا</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--green)">${fmt(net)}</div><div class="stat-lbl">صافي العربية للمورد</div></div>
    </div>
  </div>`;
}

// ================================================================
//  CUSTOMERS
// ================================================================
export function renderCustomers(entries, page = 1) {
  const el = document.getElementById('customers-list-render');
  if (!el) return;

  // تجميع الحركات لكل عميل
  const byName = {};
  entries.forEach(e => {
    if (!byName[e.customer_name]) byName[e.customer_name] = [];
    byName[e.customer_name].push(e);
  });

  const names = Object.keys(byName);
  if (!names.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">لا توجد حسابات آجلة</div></div>';
    return;
  }

  const pages  = totalPages(names.length, PAGE_SIZE);
  const paged  = paginate(names, page, PAGE_SIZE);

  el.innerHTML = paged.map(name => {
    const withBalances = rebuildCustomerBalance(byName[name]);
    const last = withBalances[withBalances.length - 1];
    const bal  = last?.balance || 0;
    return `<div class="card" style="cursor:pointer;margin-bottom:8px" data-open-customer="${escapeHtml(name)}">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:700">${escapeHtml(name)}</div>
        <div style="font-size:1.1rem;font-weight:800;color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">
          ${bal > 0 ? 'مدين' : 'دائن'}: ${fmt(Math.abs(bal))} ج
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination('customers-pagination', page, pages, 'customers');
}

export function renderCustomerDetail(name, entries) {
  const el = document.getElementById('customer-ledger-render');
  if (!el) return;

  const withBal = rebuildCustomerBalance(entries);
  const finalBal = withBal.length ? withBal[withBal.length - 1].balance : 0;

  let html = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;
    background:var(--surface2);padding:10px;border-radius:12px;border:1px solid var(--accent)">
    <div style="font-weight:800;font-size:1.1rem;">👤 ${escapeHtml(name)}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-ghost btn-sm" id="btn-add-customer-payment">➕ دفعة</button>
      <button id="btn-whatsapp-customer"
        style="background:#25D366;border:none;width:42px;height:42px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 8px rgba(0,0,0,0.2)"
        title="مشاركة عبر واتساب">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-1.557-.594-2.686-1.594-1.129-1-1.912-2.15-2.132-2.527-.221-.378-.023-.583.17-.775.174-.172.378-.435.567-.653.189-.217.252-.371.378-.619.126-.248.063-.465-.031-.653-.094-.188-.837-2.022-1.144-2.764-.3-.722-.601-.622-.824-.633-.212-.011-.454-.013-.697-.013-.242 0-.636.091-.97.454-.333.364-1.272 1.242-1.272 3.03 0 1.788 1.303 3.515 1.484 3.763.182.248 2.564 3.915 6.212 5.492.868.375 1.543.599 2.072.767.872.277 1.666.238 2.294.145.699-.104 2.146-.877 2.449-1.724.302-.847.302-1.574.212-1.724-.091-.151-.333-.242-.716-.433z"/>
        </svg>
      </button>
    </div>
  </div>`;

  withBal.forEach(e => {
    if (e.entry_type === 'invoice') {
      html += `<div class="ledger-row ledger-credit">
        <div>فاتورة: ${escapeHtml(e.description || '')}</div>
        <div class="ledger-amount-pos">+${fmt(e.amount)} ج</div>
        <div style="font-size:0.7rem">${dateStr(e.entry_date)}</div>
      </div>`;
    } else {
      html += `<div class="ledger-row ledger-debit">
        <div>دفعة: ${escapeHtml(e.description || '')}</div>
        <div class="ledger-amount-neg">-${fmt(e.amount)} ج</div>
        <div style="font-size:0.7rem">${dateStr(e.entry_date)}</div>
      </div>`;
    }
  });

  html += `<div class="ledger-row ledger-balance">
    <div>الرصيد الحالي</div>
    <div class="${finalBal > 0 ? 'ledger-amount-neg' : 'ledger-amount-pos'}">
      ${finalBal > 0 ? 'مدين: ' + fmt(finalBal) : 'دائن: ' + fmt(-finalBal)} ج
    </div>
  </div>`;

  el.innerHTML = html;
}

// ================================================================
//  SUPPLIERS
// ================================================================
export function renderSuppliers(jobs, supplierData) {
  const el = document.getElementById('suppliers-list-render');
  if (!el) return;

  if (!jobs.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤝</div><div class="empty-state-text">لا توجد موردين</div></div>';
    return;
  }

  el.innerHTML = jobs.map(j => {
    const { entries = [], payments = [] } = supplierData[j.id] || {};
    const { isOurs, totalPurch, totalNet, totalRec, remaining } = calcSupplierAccount(j, entries, payments);
    return `<div class="card" style="cursor:pointer;margin-bottom:8px" data-open-supplier="${j.id}">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:700">${escapeHtml(j.supplier)}
            <span style="font-size:0.78rem;color:var(--text2)">(${escapeHtml(j.name)})</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text2)">
            ${j.truck_count || 0} عربية | ${escapeHtml(j.ownership)}
          </div>
        </div>
        <div style="text-align:left">
          <div style="font-weight:800;color:var(--red)">المتبقي: ${fmt(remaining)} ج</div>
          <div style="font-size:0.75rem;color:var(--text2)">واصل: ${fmt(totalRec)} ج</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function renderSupplierDetail(job, entries, payments) {
  const el = document.getElementById('supplier-detail-render');
  if (!el) return;

  const { isOurs, totalPurch, totalNet, totalRec, profit, myShare, remaining } = calcSupplierAccount(job, entries, payments);

  let html = `<div class="card">
    <div class="card-title">📒 ${escapeHtml(job.supplier)} – ${escapeHtml(job.name)}</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>التاريخ</th>${isOurs ? '<th>المشتريات</th>' : ''}
        <th>الصافي</th><th>الواصل</th>
      </tr></thead><tbody>`;

  entries.forEach(e => {
    html += `<tr>
      <td>${dateStr(e.entry_date)}</td>
      ${isOurs ? `<td>${fmt(e.purchases)} ج</td>` : ''}
      <td>${fmt(e.net)} ج</td>
      <td>—</td>
    </tr>`;
  });
  html += `</tbody></table></div></div>`;

  html += `<div class="grid-4">
    ${isOurs ? `<div class="stat-box"><div class="stat-val" style="font-size:0.95rem">${fmt(totalPurch)}</div><div class="stat-lbl">إجمالي المشتريات</div></div>` : ''}
    <div class="stat-box"><div class="stat-val" style="font-size:0.95rem">${fmt(totalNet)}</div><div class="stat-lbl">إجمالي الصافي</div></div>
    <div class="stat-box"><div class="stat-val" style="font-size:0.95rem">${fmt(totalRec)}</div><div class="stat-lbl">إجمالي الواصل</div></div>
    ${isOurs ? `<div class="stat-box"><div class="stat-val" style="font-size:0.95rem;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(Math.abs(profit))}</div><div class="stat-lbl">${profit >= 0 ? 'الربح' : 'الخسارة'}</div></div>` : ''}
  </div>`;

  if (isOurs && profit > 0) {
    html += `<div class="card">
      <div class="card-title">🤝 توزيع الربح (${job.share}% / ${100 - job.share}%)</div>
      <div class="grid-2">
        <div class="stat-box"><div class="stat-val" style="color:var(--green)">${fmt(Math.round(myShare))}</div><div class="stat-lbl">نصيبنا</div></div>
        <div class="stat-box"><div class="stat-val" style="color:var(--purple)">${fmt(Math.round(profit - myShare))}</div><div class="stat-lbl">نصيب المورد</div></div>
      </div>
    </div>`;
  }

  html += `<div class="big-total">
    <div class="big-total-lbl">💰 المتبقي للمورد</div>
    <div class="big-total-val" style="color:${remaining > 0 ? 'var(--red)' : 'var(--green)'}">
      ${fmt(Math.abs(remaining))} ج
    </div>
  </div>`;

  html += `<div class="card">
    <div class="card-title">💸 تسجيل دفعة للمورد</div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">المبلغ</label><input class="form-control" type="number" id="sup-pay-amount" placeholder="0"></div>
      <div class="form-group"><label class="form-label">التاريخ</label><input class="form-control" type="date" id="sup-pay-date" value="${today()}"></div>
    </div>
    <button class="btn btn-primary btn-sm" id="btn-record-supplier-payment">✅ تسجيل دفعة</button>
  </div>`;

  if (payments.length) {
    html += `<div class="card"><div class="card-title">📋 سجل الدفعات</div>`;
    payments.forEach(r => {
      html += `<div class="ledger-row ledger-debit">
        <span class="ledger-amount-neg">-${fmt(r.amount)} ج</span>
        <span style="margin-right:8px">${dateStr(r.entry_date)}</span>
      </div>`;
    });
    html += `</div>`;
  }

  el.innerHTML = html;
}

// ================================================================
//  CASHFLOW
// ================================================================
export function renderCashflowLog(entries) {
  const { totalIn, totalOut, net } = calcDailyCashflow(entries, today());

  setEl('cf-total-in',  fmt(totalIn)  + ' ج');
  setEl('cf-total-out', fmt(totalOut) + ' ج');

  const netEl = document.getElementById('cf-net');
  if (netEl) {
    netEl.textContent = fmt(Math.abs(net)) + ' ج';
    netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  }

  const log = document.getElementById('cf-log');
  if (!log) return;

  if (!entries.length) {
    log.innerHTML = '<div class="empty-state"><div class="empty-state-text">لا توجد معاملات بعد</div></div>';
    return;
  }

  log.innerHTML = [...entries].reverse().map(t => `
    <div class="ledger-row ${t.flow_type === 'in' ? 'ledger-credit' : 'ledger-debit'}">
      <div>
        <span class="${t.flow_type === 'in' ? 'ledger-amount-pos' : 'ledger-amount-neg'}">
          ${t.flow_type === 'in' ? '+' : '-'}${fmt(t.amount)} ج
        </span>
        &nbsp;&nbsp;${escapeHtml(t.party_name)}
        ${t.notes ? `<span style="font-size:0.75rem"> – ${escapeHtml(t.notes)}</span>` : ''}
      </div>
      <div>
        <span class="tag ${t.flow_type === 'in' ? 'tag-green' : 'tag-red'}">
          ${t.flow_type === 'in' ? '📥 تحصيل' : '📤 دفع'}
        </span>
        <span style="margin-right:8px">${dateStr(t.entry_date)}</span>
      </div>
    </div>`).join('');
}

// ================================================================
//  CLIENT DETAIL MODAL
// ================================================================
export function renderClientDetailModal(client) {
  document.getElementById('detail-client-name').textContent = client.name;

  let html = `<div class="table-wrap"><table>
    <thead><tr><th>عدد</th><th>صنف</th><th>القايم (ج)</th><th></th></tr></thead><tbody>`;

  (client.items || []).forEach((ci, idx) => {
    html += `<tr>
      <td><input type="number" class="form-control" style="width:80px" value="${n(ci.count)}"
        data-client-field="${client.id}" data-field-idx="${idx}" data-field="count"></td>
      <td><input type="text" class="form-control" style="width:120px" value="${escapeHtml(ci.name)}"
        data-client-field="${client.id}" data-field-idx="${idx}" data-field="name"></td>
      <td><input type="number" class="form-control" style="width:120px" value="${n(ci.qaem)}"
        data-client-field="${client.id}" data-field-idx="${idx}" data-field="qaem"></td>
      <td><button class="btn-icon" data-delete-client-item="${client.id}" data-item-idx="${idx}">🗑</button></td>
    </tr>`;
  });

  html += `</tbody></table></div>
  <div style="margin-top:8px">
    <button class="btn btn-ghost btn-sm" data-add-client-item="${client.id}">➕ إضافة صنف</button>
  </div>`;

  document.getElementById('client-detail-table').innerHTML = html;
  openModal('modal-client-detail');
}

// ================================================================
//  AUDIT LOG
// ================================================================
export function renderAuditLog(entries) {
  const el = document.getElementById('audit-log-render');
  if (!el) return;

  if (!entries.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-text">لا توجد سجلات</div></div>';
    return;
  }

  const actionLabels = { create: '➕ إنشاء', update: '✏️ تعديل', delete: '🗑 حذف' };
  el.innerHTML = entries.map(e => `
    <div class="audit-row">
      <span class="audit-action">${actionLabels[e.action] || e.action} – ${escapeHtml(e.description || '')}</span>
      <span class="audit-meta">${dateStr(e.created_at?.slice(0, 10))} ${e.created_at?.slice(11, 16) || ''}</span>
    </div>`).join('');
}

// ================================================================
//  PAGINATION
// ================================================================
export function renderPagination(containerId, current, total, storeKey) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }

  let html = `<div class="pagination">
    <button class="page-btn" data-pg-key="${storeKey}" data-pg="${current - 1}" ${current <= 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" data-pg-key="${storeKey}" data-pg="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-pg-key="${storeKey}" data-pg="${current + 1}" ${current >= total ? 'disabled' : ''}>›</button>
  </div>`;

  el.innerHTML = html;
}

// ================================================================
//  CUSTOMER SELECT (في شاشة الكاش فلو)
// ================================================================
export function populateCustomerSelect(names) {
  const sel = document.getElementById('cf-customer-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- اختر العميل --</option>' +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
}

export function populateSupplierSelect(jobs) {
  const sel = document.getElementById('cf-supplier-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- اختر الشغل --</option>' +
    jobs.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.supplier)} (${escapeHtml(j.name)})</option>`).join('');
}

// ================================================================
//  DOM helpers
// ================================================================
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
