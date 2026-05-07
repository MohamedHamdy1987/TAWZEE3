// ================================================================
//  store.js – مخزن الحالة المركزي (State Management)
// ================================================================

/**
 * الحالة المركزية للتطبيق.
 * يتم قراءتها عبر store.get() وتحديثها عبر store.set().
 * لا يجوز تعديل الحالة مباشرةً من خارج هذا الملف.
 */
const _state = {
  user:            null,   // { id, email }
  jobs:            [],     // Job[]
  currentJobId:    null,
  currentTruckId:  null,
  trucks:          [],     // Truck[] للشغل الحالي
  items:           [],     // Item[] للعربية الحالية
  clients:         [],     // Client[] للعربية الحالية
  customerNames:   [],     // string[]
  cashflow:        [],     // CashflowEntry[]
  auditLog:        [],     // AuditEntry[]

  // تتبع الصفحات للقوائم المُقسّمة
  pagination: {
    jobs:      { page: 1 },
    customers: { page: 1 },
    cashflow:  { page: 1 },
  },

  // حالة التحميل لكل قطاع
  loading: {
    jobs:      false,
    trucks:    false,
    truck:     false,
    customers: false,
    cashflow:  false,
  },
};

// الاستماع للتغييرات
const _listeners = new Set();

export const store = {
  /** جلب نسخة من الحالة الحالية */
  get() { return { ..._state }; },

  /** تحديث جزء من الحالة وإطلاق الأحداث */
  set(patch) {
    Object.assign(_state, patch);
    _listeners.forEach(fn => fn({ ..._state }));
  },

  /** تحديث حالة التحميل */
  setLoading(key, value) {
    _state.loading[key] = value;
    _listeners.forEach(fn => fn({ ..._state }));
  },

  /** تحديث الصفحة الحالية لقائمة */
  setPage(key, page) {
    _state.pagination[key].page = page;
    _listeners.forEach(fn => fn({ ..._state }));
  },

  /** تسجيل مستمع للتغييرات */
  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn); // إلغاء الاشتراك
  },
};
