import { TIMER_SESSION_EXPIRATION_MS } from '#plugins/kace/env/index.js';

const STORAGE_KEY_PREFIX = 'kace_timer';
const RECOVERY_WINDOW_MS = TIMER_SESSION_EXPIRATION_MS;

class TimerStorageService {
  /**
   * Genera la key única para el timer basada en caseId.
   * @param {string|number} caseId
   * @returns {string}
   */
  _getStorageKey(caseId) {
    return `${STORAGE_KEY_PREFIX}_${caseId}`;
  }

  /**
   * Guarda el estado del timer en localStorage.
   * @param {string|number} caseId
   * @param {{timerId: string, events?: Array<{type: string, at: number}>}} timerData
   * @returns {boolean}
   */
  saveTimerState(caseId, timerData) {
    if (!caseId) {
      console.warn('TimerStorageService: No se puede guardar sin caseId');
      return false;
    }

    try {
      const dataToSave = {
        timerId: timerData.timerId,
        events: Array.isArray(timerData.events) ? timerData.events : [],
        timestamp: Date.now(),
        caseId: caseId,
      };

      const key = this._getStorageKey(caseId);
      localStorage.setItem(key, JSON.stringify(dataToSave));

      return true;
    } catch (error) {
      console.error('Error guardando timer en localStorage:', error);
      return false;
    }
  }

  /**
   * Recupera el estado del timer desde localStorage
   * Retorna null si no existe o si está fuera de la ventana de recuperación
   * @param {string|number} caseId
   * @returns {{timerId: string, events: Array<{type: string, at: number}>, minutesSinceLastSave: number} | null}
   */
  recoverTimerState(caseId) {
    if (!caseId) {
      console.warn('TimerStorageService: No se puede recuperar sin caseId');
      return null;
    }

    try {
      const key = this._getStorageKey(caseId);
      const savedData = localStorage.getItem(key);

      if (!savedData) {
        return null;
      }

      const parsedData = JSON.parse(savedData);

      // Validar integridad de los datos
      if (!this._validateTimerData(parsedData)) {
        console.warn('TimerStorageService: Datos inválidos en localStorage');
        this.clearTimerState(caseId);
        return null;
      }

      // Validar ventana de recuperación
      const timeSinceLastSave = Date.now() - parsedData.timestamp;
      const minutesSinceLastSave = timeSinceLastSave / 60000;

      if (timeSinceLastSave > RECOVERY_WINDOW_MS) {
        console.warn(
          `TimerStorageService: Timer muy antiguo (${minutesSinceLastSave.toFixed(1)} min). Ignorando.`
        );
        this.clearTimerState(caseId);
        return null;
      }

      return {
        timerId: parsedData.timerId,
        events: parsedData.events,
        minutesSinceLastSave: minutesSinceLastSave,
      };
    } catch (error) {
      console.error('Error recuperando timer de localStorage:', error);
      this.clearTimerState(caseId);
      return null;
    }
  }

  /**
   * Valida que los datos del timer sean correctos.
   * @param {any} data
   * @returns {boolean}
   */
  _validateTimerData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.timerId) return false;
    if (!Array.isArray(data.events)) return false;
    if (typeof data.timestamp !== 'number') return false;
    if (!data.caseId) return false;

    const areEventsValid = data.events.every((ev) => {
      if (!ev || typeof ev !== 'object') return false;
      const hasType = typeof ev.type === 'string' && ev.type.length > 0;
      const hasAt = typeof ev.at === 'number';
      return hasType && hasAt;
    });

    if (!areEventsValid) return false;

    if (data.timestamp < Date.now() - 365 * 24 * 60 * 60 * 1000) {
      // No más viejo de 1 año
      return false;
    }

    return true;
  }

  /**
   * Limpia el estado del timer del localStorage.
   * @param {string|number} caseId
   * @returns {void}
   */
  clearTimerState(caseId) {
    if (!caseId) return;

    try {
      const key = this._getStorageKey(caseId);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error limpiando timer de localStorage:', error);
    }
  }

  /**
   * Verifica si existe un timer guardado para el caso.
   * @param {string|number} caseId
   * @returns {boolean}
   */
  hasTimerState(caseId) {
    if (!caseId) return false;

    try {
      const key = this._getStorageKey(caseId);
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Limpia todos los timers del sessionStorage (útil para debugging).
   * @returns {void}
   */
  clearAllTimers() {
    try {
      const keys = Object.keys(localStorage);
      const timerKeys = keys.filter((key) =>
        key.startsWith(STORAGE_KEY_PREFIX)
      );

      timerKeys.forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error limpiando todos los timers:', error);
    }
  }
}

// Exportar instancia singleton
export default new TimerStorageService();
