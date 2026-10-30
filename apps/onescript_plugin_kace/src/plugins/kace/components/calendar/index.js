import KaceBaseComponent from '#plugins/kace/shared/KaceBaseComponent.js';
import {
  normalizeIncomingUTC,
  toUTCISOString,
} from '#plugins/kace/utils/dateTimeUTC.js';
import customCalendarEditForm from './custom.form.json';

const CalendarComponent = KaceBaseComponent.create({
  componentType: 'kace_calendar',
  formioBaseComponent: 'datetime',
  builderInfo: {
    title: 'Kace Date / Time',
    icon: 'calendar',
    preview: true,
  },
});

CalendarComponent.COMPONENT_TYPE = 'kace_calendar';

const _originalAttach = CalendarComponent.prototype.attach;
const _originalCheckValidity = CalendarComponent.prototype.checkValidity;

const _originalEditForm = CalendarComponent.editForm;
CalendarComponent.editForm = (/** @type {any[]} */ ...extend) =>
  _originalEditForm([customCalendarEditForm], ...extend);

CalendarComponent.prototype.getValue = function getValue() {
  const raw = Object.getPrototypeOf(CalendarComponent.prototype).getValue.call(
    this
  );
  if (this.component.multiple && Array.isArray(raw)) {
    return raw.map(toUTCISOString);
  }
  return toUTCISOString(raw);
};

CalendarComponent.prototype.setValue = function setValue(
  /** @type {*} */ value,
  /** @type {Record<string, any>} */ flags = {}
) {
  let normalized = value;
  if (this.component.multiple && Array.isArray(value)) {
    normalized = value.map(normalizeIncomingUTC);
  } else {
    normalized = normalizeIncomingUTC(value);
  }

  if (this.component.disableBeforeToday) {
    if (flags.modified) {
      this._userModifiedValue = true;
      this._loadedValueIsHistorical = false;
      this._historicalPreloadedDate = null;
    } else {
      const v = Array.isArray(normalized) ? normalized[0] : normalized;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parsed = v ? new Date(v) : null;
      this._loadedValueIsHistorical = Boolean(
        parsed && Number.isFinite(parsed.getTime()) && parsed < today
      );
      this._historicalPreloadedDate = this._loadedValueIsHistorical
        ? parsed
        : null;
      this._userModifiedValue = false;
    }
  }

  return Object.getPrototypeOf(CalendarComponent.prototype).setValue.call(
    this,
    normalized,
    flags
  );
};

CalendarComponent.prototype.attach = function attach(
  /** @type {HTMLElement} */ element
) {
  const result = _originalAttach.call(this, element);

  if (this.component.disableBeforeToday) {
    Promise.resolve(result).then(() => this._injectDisableBeforeToday());
  }

  return result;
};

CalendarComponent.prototype._injectDisableBeforeToday =
  function _injectDisableBeforeToday() {
    const widget =
      (typeof this.getWidget === 'function' && this.getWidget(0)) ||
      this.refs?.input?.[0]?.widget ||
      null;
    const calendar = widget?.calendar;
    if (!calendar) return;

    calendar.set('allowInvalidPreload', true);

    calendar.set('disable', [
      function isBeforeToday(/** @type {Date} */ date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
      },
    ]);

    const hasValue =
      this.dataValue !== null &&
      this.dataValue !== undefined &&
      this.dataValue !== '';
    const hasCalendarSelection =
      Array.isArray(calendar.selectedDates) &&
      calendar.selectedDates.length > 0;
    if (this._historicalPreloadedDate && hasValue && !hasCalendarSelection) {
      widget.setValue(this.dataValue);
    }

    if (!calendar._kaceTimeLockHooked) {
      const self = this;
      const onChange = Array.isArray(calendar.config.onChange)
        ? calendar.config.onChange
        : [];
      const onValueUpdate = Array.isArray(calendar.config.onValueUpdate)
        ? calendar.config.onValueUpdate
        : [];
      const syncLock = function syncLock() {
        self._syncHistoricalHourLock();
      };
      calendar.set('onChange', [...onChange, syncLock]);
      calendar.set('onValueUpdate', [...onValueUpdate, syncLock]);
      calendar._kaceTimeLockHooked = true;
    }
    this._syncHistoricalHourLock();
  };

CalendarComponent.prototype._isBeforeToday = function _isBeforeToday(
  /** @type {Date | null | undefined} */ dateValue
) {
  if (!(dateValue instanceof Date) || !Number.isFinite(dateValue.getTime()))
    return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(dateValue);
  candidate.setHours(0, 0, 0, 0);
  return candidate < today;
};

CalendarComponent.prototype._syncHistoricalHourLock =
  function _syncHistoricalHourLock() {
    const widget =
      (typeof this.getWidget === 'function' && this.getWidget(0)) ||
      this.refs?.input?.[0]?.widget ||
      null;
    const calendar = widget?.calendar;
    if (!calendar) return;

    const selected = Array.isArray(calendar.selectedDates)
      ? calendar.selectedDates[0]
      : null;
    const lockHours = this._isBeforeToday(selected);

    if (calendar.hourElement) {
      calendar.hourElement.disabled = lockHours;
      calendar.hourElement.readOnly = lockHours;
    }
    if (calendar.minuteElement) {
      calendar.minuteElement.disabled = lockHours;
      calendar.minuteElement.readOnly = lockHours;
    }
    if (calendar.secondElement) {
      calendar.secondElement.disabled = lockHours;
      calendar.secondElement.readOnly = lockHours;
    }
    if (calendar.amPM) {
      calendar.amPM.disabled = lockHours;
    }
    if (calendar._input) {
      calendar._input.readOnly = lockHours;
    }
    if (calendar.altInput) {
      calendar.altInput.readOnly = lockHours;
    }
  };

CalendarComponent.prototype.checkValidity = function checkValidity(
  /** @type {*} */ data,
  /** @type {*} */ dirty,
  /** @type {*} */ rowData
) {
  if (this.component.disableBeforeToday && this._userModifiedValue && dirty) {
    const value = this.dataValue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(v) < today) {
        this.setCustomValidity(
          `${this.component.label || 'Este campo'} no permite fechas anteriores al día de hoy`,
          dirty
        );
        this.pristine = false;
        return false;
      }
    }
  }

  return _originalCheckValidity.call(this, data, dirty, rowData);
};

export default CalendarComponent;
