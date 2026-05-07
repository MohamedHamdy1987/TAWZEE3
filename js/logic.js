// ================================================================
//  logic.js – منطق العمل الصافي (Pure Business Logic)
//  لا تعتمد هذه الدوال على DOM أو قاعدة البيانات مباشرةً
// ================================================================
import { n } from './utils.js';
import { COMMISSION_RATE, EXPENSE_KEYS } from './config.js';

// ================================================================
//  حسابات العربية
// ================================================================

/**
 * احسب إجماليات عربية كاملة من items + expenses + clients
 * @param {object} truck - { items[], expenses{}, clients[], ourExpenses }
 * @returns {{ purchases, expenses, totalCost, invoices, profit }}
 */
export function recalcTruck(truck) {
  const purchases = (truck.items || []).reduce((s, i) => s + n(i.total), 0);
  const expenses  = EXPENSE_KEYS.reduce((s, { key }) => s + n((truck.expenses || {})[key]), 0);
  const invoices  = (truck.clients || []).reduce((s, c) => s + n(c.net_invoice), 0);
  const totalCost = purchases + expenses;
  const profit    = invoices - totalCost;
  return { purchases, expenses, totalCost, invoices, profit };
}

/**
 * احسب سعر صنف من المشتريات
 * @param {'weight'|'unit'} unitType
 * @param {number} count   - عدد الطرود
 * @param {number} val     - الوزن (إذا weight) أو العدد (إذا unit)
 * @param {number} price   - سعر الكيلو أو الوحدة
 * @param {number} bai3a   - البياعة
 */
export function calcItemTotal(unitType, count, val, price, bai3a) {
  if (unitType === 'weight') return (val * price) + n(bai3a);
  return (count * price) + n(bai3a);
}

/**
 * احسب المتبقي من كل صنف في العربية
 * (مشتريات – توزيع)
 * @param {{ items: object[], clients: object[] }} truck
 * @returns {{ [itemName]: { count: number } }}
 */
export function getRemainingItems(truck) {
  const remaining = {};
  (truck.items || []).forEach(item => {
    remaining[item.name] = { count: n(item.count) };
  });
  (truck.clients || []).forEach(client => {
    (client.items || []).forEach(ci => {
      if (remaining[ci.name] !== undefined) {
        remaining[ci.name].count -= n(ci.count);
      }
    });
  });
  return remaining;
}

// ================================================================
//  ملخص العربية (تحليل الربح لكل صنف)
// ================================================================
export function buildTruckSummary(truck) {
  const totals = recalcTruck(truck);
  const expTotal = totals.expenses;

  // تجميع المبيعات لكل صنف مع الأوزان
  const perItemSold = {};
  let totalSoldWeight = 0;

  (truck.clients || []).forEach(client => {
    (client.items || []).forEach(item => {
      const purchaseItem = (truck.items || []).find(i => i.name === item.name);
      if (!perItemSold[item.name]) {
        perItemSold[item.name] = { count: 0, weight: 0, qaem: 0 };
      }
      perItemSold[item.name].count += n(item.count);
      perItemSold[item.name].qaem  += n(item.qaem);

      if (purchaseItem && purchaseItem.unit_type === 'weight' && n(purchaseItem.count) > 0) {
        const weightPerUnit = n(purchaseItem.weight) / n(purchaseItem.count);
        const itemWeight = n(item.count) * weightPerUnit;
        perItemSold[item.name].weight += itemWeight;
        totalSoldWeight += itemWeight;
      }
    });
  });

  const costPerKg = totalSoldWeight ? expTotal / totalSoldWeight : 0;

  const perItemPurch = {};
  (truck.items || []).forEach(i => {
    perItemPurch[i.name] = {
      count: n(i.count),
      weight: n(i.weight),
      total: n(i.total),
      unit_type: i.unit_type,
    };
  });

  // إجمالي الوحدات المبيعة (لتوزيع المصاريف على المنتجات بالعدد)
  const totalUnitsSold = Object.values(perItemSold).reduce((s, it) => s + it.count, 0);
  const costPerUnit = totalUnitsSold ? expTotal / totalUnitsSold : 0;

  const items = [];
  let grandProfit = 0;

  for (const [name, sale] of Object.entries(perItemSold)) {
    const purch = perItemPurch[name] || { total: 0, weight: 0, count: 0, unit_type: 'unit' };
    const qaem = sale.qaem;
    const commission = qaem * COMMISSION_RATE;

    let expenseShare = 0;
    if (purch.unit_type === 'weight') {
      expenseShare = sale.weight * costPerKg;
    } else {
      expenseShare = sale.count * costPerUnit;
    }

    const netSale = qaem - commission - expenseShare;
    const profit  = netSale - purch.total;
    grandProfit  += profit;

    items.push({
      name,
      count: sale.count,
      qaem,
      expenseShare: Math.round(expenseShare),
      commission:   Math.round(commission),
      netSale:      Math.round(netSale),
      purchTotal:   purch.total,
      profit:       Math.round(profit),
    });
  }

  // مقارنة الوزن (مشتريات vs مبيعات)
  const weightComparison = [];
  for (const [name, purch] of Object.entries(perItemPurch)) {
    if (purch.unit_type === 'weight') {
      const soldWeight = perItemSold[name]?.weight || 0;
      weightComparison.push({
        name,
        purchased: n(purch.weight),
        sold: soldWeight,
        diff: n(purch.weight) - soldWeight,
      });
    }
  }

  return {
    totals,
    costPerKg: Math.round(costPerKg),
    grandProfit: Math.round(grandProfit),
    items,
    weightComparison,
  };
}

// ================================================================
//  حسابات حساب المورد
// ================================================================
export function calcSupplierAccount(job, supplierEntries, receivedPayments) {
  const isOurs = job.ownership === 'لحسابنا';
  const totalPurch  = supplierEntries.reduce((s, e) => s + n(e.purchases), 0);
  const totalNet    = supplierEntries.reduce((s, e) => s + n(e.net), 0);
  const totalRec    = receivedPayments.reduce((s, r) => s + n(r.amount), 0);
  const profit      = totalNet - totalPurch;
  const myShare     = profit * (n(job.share) / 100);
  const remaining   = isOurs ? totalPurch - totalRec : totalNet - totalRec;

  return { isOurs, totalPurch, totalNet, totalRec, profit, myShare, remaining };
}

// ================================================================
//  حساب رصيد العميل (من قائمة حركات)
// ================================================================
export function rebuildCustomerBalance(entries) {
  let bal = 0;
  return entries.map(e => {
    if (e.entry_type === 'invoice') bal += n(e.amount);
    else bal -= n(e.amount);
    return { ...e, balance: bal };
  });
}

// ================================================================
//  ملخص الكاش فلو ليوم واحد
// ================================================================
export function calcDailyCashflow(entries, dateStr) {
  const dayEntries = entries.filter(t => t.entry_date === dateStr);
  const totalIn    = dayEntries.filter(t => t.flow_type === 'in').reduce((s, t) => s + n(t.amount), 0);
  const totalOut   = dayEntries.filter(t => t.flow_type === 'out').reduce((s, t) => s + n(t.amount), 0);
  return { totalIn, totalOut, net: totalIn - totalOut };
}

// ================================================================
//  Dashboard – حسابات التلخيص العام
// ================================================================
export function buildDashboard(jobs, trucks, customers) {
  // إجمالي ربح جميع الأشغال
  let totalProfit = 0;
  let totalRevenue = 0;
  const customerBalances = {};

  trucks.forEach(truck => {
    const t = recalcTruck(truck);
    totalProfit  += t.profit;
    totalRevenue += t.invoices;
  });

  // أعلى عملاء مديونية
  Object.entries(customers).forEach(([name, entries]) => {
    const last = entries[entries.length - 1];
    if (last) customerBalances[name] = last.balance || 0;
  });

  const topDebtors = Object.entries(customerBalances)
    .filter(([, bal]) => bal > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, balance]) => ({ name, balance }));

  return {
    totalProfit:  Math.round(totalProfit),
    totalRevenue: Math.round(totalRevenue),
    activeJobs:   jobs.length,
    totalTrucks:  trucks.length,
    topDebtors,
  };
}

// ================================================================
//  التحقق من صحة المدخلات (Validation)
// ================================================================

export const Validators = {
  job(fields) {
    const errors = {};
    if (!fields.supplier?.trim())  errors.supplier  = 'اسم المورد مطلوب';
    if (!fields.city?.trim())      errors.city      = 'البلد مطلوب';
    if (n(fields.share) <= 0 || n(fields.share) > 100)
      errors.share = 'نسبة الشراكة يجب أن تكون بين 1 و 100';
    return errors;
  },

  item(fields) {
    const errors = {};
    if (!fields.name?.trim())       errors.name  = 'اسم الصنف مطلوب';
    if (n(fields.count) <= 0)       errors.count = 'العدد يجب أن يكون أكبر من صفر';
    if (n(fields.price) <= 0)       errors.price = 'السعر يجب أن يكون أكبر من صفر';
    if (fields.unit_type === 'weight' && n(fields.weight) <= 0)
      errors.weight = 'الوزن يجب أن يكون أكبر من صفر';
    return errors;
  },

  client(fields) {
    const errors = {};
    if (!fields.name?.trim())       errors.name  = 'اسم العميل مطلوب';
    if (!fields.items?.length)      errors.items = 'أضف صنفاً واحداً على الأقل';
    return errors;
  },

  payment(fields) {
    const errors = {};
    if (n(fields.amount) <= 0)      errors.amount = 'المبلغ يجب أن يكون أكبر من صفر';
    if (!fields.date)               errors.date   = 'التاريخ مطلوب';
    return errors;
  },
};

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
