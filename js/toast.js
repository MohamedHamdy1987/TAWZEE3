// ================================================================
//  toast.js – نظام الإشعارات (Toast Notifications)
// ================================================================
import { TOAST_DURATION } from './config.js';

let container;

function getContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

/**
 * @param {string} message  – النص
 * @param {'success'|'error'|'info'} type – النوع
 * @param {number} [duration] – مدة الظهور بالمللي ثانية
 */
export function showToast(message, type = 'info', duration = TOAST_DURATION) {
  const c = getContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;

  el.addEventListener('click', () => dismiss(el));
  c.appendChild(el);

  const timer = setTimeout(() => dismiss(el), duration);
  el._timer = timer;
}

function dismiss(el) {
  clearTimeout(el._timer);
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

export const toast = {
  success: (msg) => showToast(msg, 'success'),
  error:   (msg) => showToast(msg, 'error'),
  info:    (msg) => showToast(msg, 'info'),
};
