import { useEffect, useRef } from 'react';

/**
 * Tras pasar de `loading` a datos con opciones, intenta reabrir un `<select>` nativo
 * (el navegador a menudo cierra al repintar opciones) para no exigir otro click al usuario.
 *
 * @param {{ loading: boolean, hasOptions: boolean, selectRef: { current: HTMLSelectElement | null } }} p
 */
export function useReopenNativeSelectOnLoad({
  loading,
  hasOptions,
  selectRef,
}) {
  const wasLoading = useRef(false);

  useEffect(() => {
    if (loading) {
      wasLoading.current = true;
      return;
    }
    if (wasLoading.current && hasOptions && selectRef.current) {
      wasLoading.current = false;
      const el = selectRef.current;
      requestAnimationFrame(() => {
        if (typeof el.showPicker === 'function') {
          try {
            el.showPicker();
          } catch {
            el.focus();
            el.click();
          }
        } else {
          el.focus();
        }
      });
    } else if (!loading) {
      wasLoading.current = false;
    }
  }, [loading, hasOptions, selectRef]);
}
