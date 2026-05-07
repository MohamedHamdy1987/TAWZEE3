// ================================================================
//  utils.js – دوال المساعدة المشتركة
// ================================================================

/** تحويل أي قيمة إلى رقم آمن */
export function n(v) { return Number(v) || 0; }

/** تنسيق الأرقام بالطريقة العربية المصرية */
export function fmt(v) { return n(v).toLocaleString('ar-EG'); }

/** اليوم بصيغة ISO */
export function today() { return new Date().toISOString().slice(0, 10); }

/** تحويل تاريخ ISO إلى نص عربي قابل للقراءة */
export function dateStr(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** توليد معرّف فريد */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** تعقيم HTML لمنع XSS */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** تأخير تنفيذ دالة (debounce) */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** تحقق من أن القيمة عدد موجب */
export function isPositiveNumber(v) { return n(v) > 0; }

/** تعقيم مدخلات النص (trim + escape) */
export function sanitizeText(str) {
  return escapeHtml(String(str || '').trim());
}

/** تحويل كائن الحالة إلى JSON قابل للتنزيل */
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** قراءة ملف JSON المرفوع */
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(JSON.parse(e.target.result)); }
      catch { reject(new Error('الملف غير صالح أو تالف')); }
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsText(file);
  });
}

/** تقسيم مصفوفة إلى صفحات */
export function paginate(arr, page, size) {
  const start = (page - 1) * size;
  return arr.slice(start, start + size);
}

/** حساب إجمالي صفحات التقسيم */
export function totalPages(count, size) {
  return Math.max(1, Math.ceil(count / size));
}
