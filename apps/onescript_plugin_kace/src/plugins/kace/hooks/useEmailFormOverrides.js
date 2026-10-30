import { useState, useCallback, useMemo } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';

const LOCKED_FIELDS = [
  'from',
  'to',
  'cc',
  'bcc',
  'subject',
  'template',
  'body',
  'attachments',
  'reply',
  'replyAll',
  'newEmail',
  'cancel',
  'send',
];

const HIDDEN_FIELDS = [
  'from',
  'reply',
  'replyAll',
  'newEmail',
  'cancel',
  'send',
];

const toKey = (field, suffix) =>
  `${field}${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;

const VALUE_FIELDS = ['from', 'to', 'cc', 'bcc', 'subject'];

/**
 * Manages reactive overrides for locked/hidden props in the EmailForm.
 * Scripts can call setFieldLocked/setFieldHidden/setFieldValue to modify state without DOM manipulation.
 *
 * @param {Record<string, boolean>} baseProps - Initial locked/hidden values from component config
 * @param {() => Record<string, unknown>} getSubmissionData
 * @param {Record<string, (v: string) => void>} [fieldSetters] - Map of field name to setter function
 */
export function useEmailFormOverrides(
  baseProps,
  getSubmissionData,
  fieldSetters = {}
) {
  const [overrideState, setOverrideState] = useState({});

  const overrides = useMemo(() => {
    const result = { ...baseProps };
    for (const [key, value] of Object.entries(overrideState)) {
      if (key in result) result[key] = value;
    }
    return result;
  }, [baseProps, overrideState]);

  const setFieldLocked = useCallback((field, value) => {
    const key = toKey(field, 'Locked');
    if (!LOCKED_FIELDS.includes(field)) {
      console.warn(`[EmailForm] setFieldLocked: unknown field "${field}"`);
      return;
    }
    setOverrideState((prev) => ({ ...prev, [key]: Boolean(value) }));
  }, []);

  const setFieldHidden = useCallback((field, value) => {
    const key = toKey(field, 'Hidden');
    if (!HIDDEN_FIELDS.includes(field)) {
      console.warn(`[EmailForm] setFieldHidden: unknown field "${field}"`);
      return;
    }
    setOverrideState((prev) => ({ ...prev, [key]: Boolean(value) }));
  }, []);

  const setFieldValue = useCallback(
    (field, value) => {
      if (!VALUE_FIELDS.includes(field)) {
        console.warn(`[EmailForm] setFieldValue: unknown field "${field}"`);
        return;
      }
      const setter = fieldSetters[field];
      if (setter) setter(value);
      else console.warn(`[EmailForm] setFieldValue: no setter for "${field}"`);
    },
    [fieldSetters]
  );

  const runCode = useCallback(
    (code, extra = {}) => {
      if (!code?.trim()) return;
      try {
        const kaceEngine = KaceEngine();
        const context = {
          kaceEngine,
          apiService: kaceEngine.getService('apiService'),
          storeService: kaceEngine.getService('storeService'),
          setFieldLocked,
          setFieldHidden,
          setFieldValue,
          submissionData: getSubmissionData(),
          ...extra,
        };
        return evaluateKace(code, context);
      } catch (e) {
        console.error('[EmailForm] Error executing custom code:', e);
      }
    },
    [setFieldLocked, setFieldHidden, setFieldValue, getSubmissionData]
  );

  return { overrides, setFieldLocked, setFieldHidden, setFieldValue, runCode };
}
