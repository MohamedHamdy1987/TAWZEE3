// ================================================================
//  config.js – إعدادات Supabase والثوابت العامة
// ================================================================

export const SUPABASE_URL = 'https://rqbcutturzlcolytvmzf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYmN1dHR1cnpsY29seXR2bXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzQ0NDgsImV4cCI6MjA5MzcxMDQ0OH0.6w-IGjdJBfRnjwq8PFye-VpIKAdkDVWxaZwMLAhyAJE';

// حجم الصفحة الافتراضي للقوائم المُقسّمة
export const PAGE_SIZE = 20;

// مُدّة ظهور الـ Toast (ms)
export const TOAST_DURATION = 3500;

// أنواع الشغل
export const JOB_TYPES = ['تشكيلة', 'صنف واحد', 'صَبّة'];

// طرق الدفع
export const PAYMENT_METHODS = ['بنك', 'بريد', 'فودافون كاش'];

// المصاريف المعيارية للعربيات
export const EXPENSE_KEYS = [
  { key: 'noloon',   label: 'نولون'    },
  { key: 'masareef', label: 'مصاريف'   },
  { key: 'mashal',   label: 'مشال'     },
  { key: 'ras',      label: 'رص'       },
  { key: 'gate',     label: 'بوابة'    },
  { key: 'misc',     label: 'نثريات'   },
];

// نسبة العمولة الثابتة
export const COMMISSION_RATE = 0.07;
