import {
  isEmbeddedInKace,
  requestReinitFromParent,
} from '#plugins/kace/shared/kaceParentTokenBridge.js';

const OVERLAY_ID = 'kace-oauth-fatal-overlay';

export function showOAuthRefreshFatalOverlay(message) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (document.getElementById(OVERLAY_ID)) return;

  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-live', 'assertive');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
    fontSize: '15px',
    lineHeight: '1.5',
    boxSizing: 'border-box',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    maxWidth: '420px',
    width: '100%',
    background: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  });

  const title = document.createElement('h2');
  title.textContent = 'No pudimos renovar la sesión';
  Object.assign(title.style, {
    margin: '0 0 12px',
    fontSize: '18px',
    fontWeight: '600',
  });

  const body = document.createElement('p');
  body.textContent =
    message ||
    'Por seguridad, la sesión caducó o el acceso ya no es válido. Puede usar el botón inferior para reiniciar el formulario.';
  Object.assign(body.style, { margin: '0 0 20px', opacity: '0.92' });

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Recargar formulario';
  Object.assign(btn.style, {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#0f172a',
    background: '#38bdf8',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#7dd3fc';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#38bdf8';
  });

  btn.addEventListener('click', async () => {
    if (isEmbeddedInKace()) {
      try {
        await requestReinitFromParent();
        root.remove();
      } catch {
        return;
      }
      return;
    }
    try {
      window.sessionStorage.clear();
    } catch (_) {}
    try {
      window.localStorage.clear();
    } catch (_) {}
    window.location.reload();
  });

  panel.appendChild(title);
  panel.appendChild(body);
  panel.appendChild(btn);
  root.appendChild(panel);
  document.body.appendChild(root);
}
