# Aux Cases Schema Spanish Validation Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate every validation error surfaced by the `kace_schema` and `kace_aux_cases_schema` components (top alert, per-field error, Form.io form-level alerts) into Spanish, without changing any other behavior or affecting forms outside this plugin.

**Architecture:** A small `locale/es.json` holds three maps (Joi, Form.io, alert prefix). A `util/validationLocale.js` loader exposes them via three getters. The Joi getter is passed to `validate()` via the `messages` option in `useSchema.js`. The Form.io getter is passed to `<Form>` via `options.i18n` + `options.language` in `Schema.jsx`. The alert prefix is read inside `Schema.jsx` to replace the hard-coded "Validation failed: " string.

**Tech Stack:** Vitest + jsdom, Joi 17 (`messages` option), formiojs 4.21.7 (per-form i18n via `<Form options>`), React 18.

**Working directory for every command:** `apps/onescript_plugin_kace` (run `cd` from the monorepo root or use the path directly).

**Test runner note:** the package script `"test": "vitest ."` triggers watch mode and the full suite. To run a single file, use `npx vitest run <path>` (one-shot, no watch). For full-suite smoke checks (`pnpm test`), bump the heap if needed (`NODE_OPTIONS=--max-old-space-size=4096 pnpm test`) — the suite can OOM at default 4 GB.

---

## File Structure

- `apps/onescript_plugin_kace/src/locale/es.json` (new) — single source of truth for Spanish strings.
- `apps/onescript_plugin_kace/src/util/validationLocale.js` (new) — thin loader with three getters.
- `apps/onescript_plugin_kace/src/util/validationLocale.test.js` (new) — Vitest unit tests for the loader.
- `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.validation.test.js` (new) — Vitest test that exercises the Joi `messages` override end-to-end.
- `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js` (modify) — passes `messages: getJoiMessages()` to `validate()`.
- `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx` (modify) — uses `getAlertPrefix()` for the alert and `getFormioMessages()` / `language: 'es'` for `<Form>`.

The schema component itself (`aux-cases-schema/AuxCasesSchema.jsx` and `aux-cases-schema/index.js`) needs no change: it reuses `<Schema>`, so the new wiring flows through automatically.

---

## Task 1: Create the locale file

**Files:**
- Create: `apps/onescript_plugin_kace/src/locale/es.json`

- [ ] **Step 1: Create the file with the three top-level keys**

Create `apps/onescript_plugin_kace/src/locale/es.json` with this exact content:

```json
{
  "alertPrefix": "Error de validación",
  "joiMessages": {
    "any.required": "es obligatorio",
    "any.invalid": "contiene un valor no válido",
    "any.only": "no es un valor permitido",
    "string.empty": "no puede estar vacío",
    "string.min": "debe tener al menos {#limit} caracteres",
    "string.max": "debe tener como máximo {#limit} caracteres",
    "string.length": "debe tener exactamente {#limit} caracteres",
    "string.email": "debe ser un correo electrónico válido",
    "string.uri": "debe ser una URI válida",
    "string.uriRelativeOnly": "debe ser una URI relativa válida",
    "string.isoDate": "debe ser una fecha ISO válida",
    "string.guid": "debe ser un UUID válido",
    "string.base64": "debe estar en formato base64",
    "string.dataUri": "debe ser un data URI válido",
    "string.ip": "debe ser una dirección IP válida",
    "string.ipVersion": "debe ser una IP versión {#version}",
    "string.pattern.base": "no coincide con el formato requerido",
    "string.pattern.ISO 8601 with timezone": "debe ser una fecha ISO 8601 con zona horaria",
    "string.pattern.ISO 8601 without timezone": "debe ser una fecha ISO 8601 sin zona horaria",
    "string.alphanum": "solo puede contener caracteres alfanuméricos",
    "number.base": "debe ser un número",
    "number.min": "debe ser mayor o igual a {#limit}",
    "number.max": "debe ser menor o igual a {#limit}",
    "number.greater": "debe ser mayor que {#limit}",
    "number.less": "debe ser menor que {#limit}",
    "number.integer": "debe ser un número entero",
    "number.positive": "debe ser un número positivo",
    "number.negative": "debe ser un número negativo",
    "number.precision": "debe tener como máximo {#limit} decimales",
    "number.multiple": "debe ser múltiplo de {#multiple}",
    "number.port": "debe ser un puerto válido",
    "number.unsafe": "debe estar dentro del rango seguro de JavaScript",
    "date.base": "debe ser una fecha válida",
    "date.min": "debe ser posterior a {#limit}",
    "date.max": "debe ser anterior a {#limit}",
    "date.greater": "debe ser posterior a {#limit}",
    "date.less": "debe ser anterior a {#limit}",
    "date.iso": "debe ser una fecha ISO 8601 válida",
    "date.isoDate": "debe ser una fecha ISO válida",
    "date.timestamp.javascript": "debe ser un timestamp en milisegundos",
    "date.timestamp.unix": "debe ser un timestamp en segundos",
    "date.format": "no coincide con el formato {#format}",
    "array.min": "debe tener al menos {#limit} elementos",
    "array.max": "debe tener como máximo {#limit} elementos",
    "array.unique": "contiene elementos duplicados",
    "object.unknown": "no es un campo permitido"
  },
  "formioMessages": {
    "unsavedRowsError": "Guarda todas las filas antes de continuar.",
    "invalidRowsError": "Corrige las filas inválidas antes de continuar.",
    "invalidRowError": "Fila inválida. Corrígela o elimínala.",
    "alertMessageWithLabel": "{{label}}: {{message}}",
    "alertMessage": "{{message}}",
    "complete": "Envío completado",
    "error": "Por favor corrige los siguientes errores antes de enviar.",
    "errorListHotkey": "Pulsa Ctrl + Alt + X para volver a la lista de errores.",
    "errorsListNavigationMessage": "Haz clic para ir al campo con el siguiente error.",
    "submitError": "Por favor revisa el formulario y corrige todos los errores antes de enviar.",
    "required": "{{field}} es obligatorio",
    "unique": "{{field}} debe ser único",
    "array": "{{field}} debe ser un arreglo",
    "array_nonempty": "{{field}} debe ser un arreglo no vacío",
    "nonarray": "{{field}} no debe ser un arreglo",
    "select": "{{field}} contiene una selección no válida",
    "pattern": "{{field}} no coincide con el patrón {{pattern}}",
    "minLength": "{{field}} debe tener al menos {{length}} caracteres.",
    "maxLength": "{{field}} no debe tener más de {{length}} caracteres.",
    "minWords": "{{field}} debe tener al menos {{length}} palabras.",
    "maxWords": "{{field}} no debe tener más de {{length}} palabras.",
    "min": "{{field}} no puede ser menor que {{min}}.",
    "max": "{{field}} no puede ser mayor que {{max}}.",
    "maxDate": "{{field}} no debe contener una fecha posterior a {{- maxDate}}",
    "minDate": "{{field}} no debe contener una fecha anterior a {{- minDate}}",
    "maxYear": "{{field}} no debe contener un año posterior a {{maxYear}}",
    "minYear": "{{field}} no debe contener un año anterior a {{minYear}}",
    "invalid_email": "{{field}} debe ser un correo electrónico válido.",
    "invalid_url": "{{field}} debe ser una URL válida.",
    "invalid_regex": "{{field}} no coincide con el patrón {{regex}}.",
    "invalid_date": "{{field}} no es una fecha válida.",
    "invalid_day": "{{field}} no es un día válido.",
    "mask": "{{field}} no coincide con la máscara.",
    "valueIsNotAvailable": "{{ field }} es un valor no válido.",
    "stripe": "{{stripe}}",
    "month": "Mes",
    "day": "Día",
    "year": "Año",
    "january": "Enero",
    "february": "Febrero",
    "march": "Marzo",
    "april": "Abril",
    "may": "Mayo",
    "june": "Junio",
    "july": "Julio",
    "august": "Agosto",
    "september": "Septiembre",
    "october": "Octubre",
    "november": "Noviembre",
    "december": "Diciembre",
    "next": "Siguiente",
    "previous": "Anterior",
    "cancel": "Cancelar",
    "submit": "Enviar formulario",
    "confirmCancel": "¿Seguro que quieres cancelar?",
    "saveDraftInstanceError": "No se puede guardar el borrador porque no hay instancia de formio.",
    "saveDraftAuthError": "No se puede guardar el borrador sin un usuario autenticado.",
    "restoreDraftInstanceError": "No se puede restaurar el borrador porque no hay instancia de formio.",
    "saveDraftError": "No se pudo guardar el borrador.",
    "restoreDraftError": "No se pudo restaurar el borrador.",
    "time": "Hora no válida",
    "cancelButtonAriaLabel": "Botón cancelar. Haz clic para reiniciar el formulario",
    "previousButtonAriaLabel": "Botón anterior. Haz clic para volver a la pestaña anterior",
    "nextButtonAriaLabel": "Botón siguiente. Haz clic para ir a la siguiente pestaña",
    "submitButtonAriaLabel": "Botón enviar formulario. Haz clic para enviar el formulario",
    "reCaptchaTokenValidationError": "ReCAPTCHA: error de validación del token",
    "reCaptchaTokenNotSpecifiedError": "ReCAPTCHA: el token no está especificado en el envío"
  }
}
```

- [ ] **Step 2: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/onescript_plugin_kace/src/locale/es.json','utf8')); console.log('ok')"`

Expected: `ok` on stdout, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/onescript_plugin_kace/src/locale/es.json
git commit -m "feat(locale): add Spanish strings for Joi and Form.io validation"
```

---

## Task 2: Create the locale loader (TDD)

**Files:**
- Create: `apps/onescript_plugin_kace/src/util/validationLocale.test.js`
- Create: `apps/onescript_plugin_kace/src/util/validationLocale.js`

- [ ] **Step 1: Write the failing test**

Create `apps/onescript_plugin_kace/src/util/validationLocale.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  getJoiMessages,
  getFormioMessages,
  getAlertPrefix,
} from './validationLocale.js';

describe('validationLocale', () => {
  describe('getJoiMessages', () => {
    it('returns the joiMessages map with the expected Spanish templates', () => {
      const messages = getJoiMessages();
      expect(messages['any.required']).toBe('es obligatorio');
      expect(messages['any.invalid']).toBe('contiene un valor no válido');
      expect(messages['string.min']).toBe('debe tener al menos {#limit} caracteres');
      expect(messages['string.max']).toBe('debe tener como máximo {#limit} caracteres');
      expect(messages['string.email']).toBe('debe ser un correo electrónico válido');
      expect(messages['number.integer']).toBe('debe ser un número entero');
      expect(messages['array.min']).toBe('debe tener al menos {#limit} elementos');
    });

    it('covers the ISO 8601 pattern names used by DateSchemaBuilder', () => {
      const messages = getJoiMessages();
      expect(messages['string.pattern.ISO 8601 with timezone'])
        .toBe('debe ser una fecha ISO 8601 con zona horaria');
      expect(messages['string.pattern.ISO 8601 without timezone'])
        .toBe('debe ser una fecha ISO 8601 sin zona horaria');
    });
  });

  describe('getFormioMessages', () => {
    it('returns the formioMessages map with the expected Spanish templates', () => {
      const messages = getFormioMessages();
      expect(messages.error)
        .toBe('Por favor corrige los siguientes errores antes de enviar.');
      expect(messages.submitError)
        .toBe('Por favor revisa el formulario y corrige todos los errores antes de enviar.');
      expect(messages.required).toBe('{{field}} es obligatorio');
      expect(messages.pattern).toBe('{{field}} no coincide con el patrón {{pattern}}');
      expect(messages.invalid_email).toBe('{{field}} debe ser un correo electrónico válido.');
      expect(messages.submit).toBe('Enviar formulario');
    });
  });

  describe('getAlertPrefix', () => {
    it('returns the Spanish alert prefix', () => {
      expect(getAlertPrefix()).toBe('Error de validación');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/util/validationLocale.test.js` (from `apps/onescript_plugin_kace`)

Expected: FAIL — `Cannot find module './validationLocale.js'` (or equivalent import resolution error).

- [ ] **Step 3: Write the minimal implementation**

Create `apps/onescript_plugin_kace/src/util/validationLocale.js`:

```js
import es from '../locale/es.json';

export const getJoiMessages = () => es.joiMessages;
export const getFormioMessages = () => es.formioMessages;
export const getAlertPrefix = () => es.alertPrefix;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/util/validationLocale.test.js` (from `apps/onescript_plugin_kace`)

Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/util/validationLocale.js apps/onescript_plugin_kace/src/util/validationLocale.test.js
git commit -m "feat(util): add validationLocale loader with Spanish getters"
```

---

## Task 3: Wire Joi messages into `useSchema.js` (TDD)

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.validation.test.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js:99-128` (imports) and `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js:406` (the `.validate()` call)

- [ ] **Step 1: Write the failing test**

Create `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.validation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import Joi from 'joi';
import { getJoiMessages } from '#util/validationLocale.js';

describe('Joi validate with Spanish messages', () => {
  it('translates any.required when the field is missing', () => {
    const schema = Joi.object({ nombre: Joi.string().required() });
    const { error } = schema.validate(
      {},
      { messages: getJoiMessages() }
    );
    expect(error).toBeDefined();
    expect(error.details[0].type).toBe('any.required');
    expect(error.details[0].message).toBe('es obligatorio');
  });

  it('translates string.min with the limit placeholder', () => {
    const schema = Joi.object({ code: Joi.string().min(5) });
    const { error } = schema.validate(
      { code: 'abc' },
      { messages: getJoiMessages() }
    );
    expect(error.details[0].type).toBe('string.min');
    expect(error.details[0].message).toBe('debe tener al menos 5 caracteres');
  });

  it('translates string.email with a bad address', () => {
    const schema = Joi.object({ email: Joi.string().email({ tlds: false }) });
    const { error } = schema.validate(
      { email: 'not-an-email' },
      { messages: getJoiMessages() }
    );
    expect(error.details[0].type).toBe('string.email');
    expect(error.details[0].message).toBe('debe ser un correo electrónico válido');
  });

  it('translates number.integer for a non-integer', () => {
    const schema = Joi.object({ n: Joi.number().integer() });
    const { error } = schema.validate(
      { n: 1.5 },
      { messages: getJoiMessages() }
    );
    expect(error.details[0].type).toBe('number.integer');
    expect(error.details[0].message).toBe('debe ser un número entero');
  });

  it('translates any.invalid for a value rejected by any rule', () => {
    const schema = Joi.object({ v: Joi.any().invalid('forbidden') });
    const { error } = schema.validate(
      { v: 'forbidden' },
      { messages: getJoiMessages() }
    );
    expect(error.details[0].type).toBe('any.invalid');
    expect(error.details[0].message).toBe('contiene un valor no válido');
  });
});
```

Note: the test file lives in the same `hooks/` directory as `useSchema.js`; the relative path `../../util/validationLocale.js` resolves to `apps/onescript_plugin_kace/src/util/validationLocale.js`.

- [ ] **Step 2: Run the test to verify it passes already**

Run: `npx vitest run src/plugins/kace/hooks/useSchema.validation.test.js` (from `apps/onescript_plugin_kace`)

Expected: PASS — this test does not touch `useSchema.js`; it just confirms the messages work in plain Joi. If it fails, the locale file is broken (go back to Task 1 and re-verify).

- [ ] **Step 3: Open `useSchema.js` and add the import + the `messages` option**

In `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js`:

1. At the top of the file, add this import alongside the existing ones (after line 15 — after the `removeKeysFromSubmissionData` import):

```js
import { getJoiMessages } from '#util/validationLocale.js';
```

2. In `validateFormData` (the function starting at line 376), locate the `.validate(...)` call (around line 406) and change it from:

```js
const { error, value } = schemaBuilderResult.validate(
  payloadForValidation,
  { context: { isUpdate } }
);
```

to:

```js
const { error, value } = schemaBuilderResult.validate(
  payloadForValidation,
  { context: { isUpdate }, messages: getJoiMessages() }
);
```

- [ ] **Step 4: Run the full test suite for the hook to make sure nothing else regressed**

Run: `npx vitest run src/plugins/kace/hooks` (from `apps/onescript_plugin_kace`)

Expected: all existing tests still pass (none of them exercise `validateFormData` directly today, but the new test must also pass).

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.validation.test.js
git commit -m "feat(schema): pass Spanish messages to Joi validate() in useSchema"
```

---

## Task 4: Wire the alert prefix into `Schema.jsx`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx:1-16` (imports) and `Schema.jsx:355-361` (the `setAlert` call)

- [ ] **Step 1: Add the import**

In `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx`, add this import alongside the existing imports (after line 16 — after the `createFormComponentRedrawFns` import):

```js
import { getAlertPrefix } from '#util/validationLocale.js';
```

- [ ] **Step 2: Replace the hard-coded "Validation failed:" prefix**

In the same file, locate the block around line 350-361 (the `setAlert('danger', 'Validation failed: ${errorMessage}')` call) and change it to:

```js
const errorMessage = validationResult.errors
  .map((e) => `${e.path}: ${e.message}`)
  .join('; ');
if (
  formRef.current &&
  typeof formRef.current.setAlert === 'function'
) {
  formRef.current.setAlert(
    'danger',
    `${getAlertPrefix()}: ${errorMessage}`
  );
}
```

The only change vs. the original is the string passed to `setAlert`: `Validation failed: ` is replaced with `` `${getAlertPrefix()}: ` `` (which expands to `Error de validación: `).

- [ ] **Step 3: Run the full test suite as a smoke check**

Run: `pnpm --filter onescript-plugin-tutorial test`

Expected: all existing tests still pass. (No new test is added for the prefix itself because the unit test on the loader already covers the string value; verifying the call site is a one-liner substitution that is best checked manually in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx
git commit -m "feat(schema): use Spanish alert prefix from locale"
```

---

## Task 5: Wire Form.io i18n options into `<Form>`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx:1-16` (imports, add `getFormioMessages`), `Schema.jsx:205-211` (the `onFormReady` callback), and `Schema.jsx:615-620` (the `<Form options>` prop)

- [ ] **Step 1: Add the import**

In `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx`, add `getFormioMessages` to the import you added in Task 4:

```js
import { getAlertPrefix, getFormioMessages } from '#util/validationLocale.js';
```

- [ ] **Step 2: Inject the Spanish bundle via `addLanguage` in `onFormReady`**

Formio uses a singleton i18next instance. If any other Webform on the page (e.g. a kace-saas form) is constructed before this one, i18next is already initialized in English and `Webform.prototype.localize` short-circuits — our `options.i18n` would be merged into the global i18n config but never reach the i18next instance. The supported workaround is `Webform.prototype.addLanguage(code, lang, active)`: it calls `i18next.addResourceBundle(...)` (which works on an already-initialized i18next) and, with `active: true`, sets the Webform's `language` property to trigger `changeLanguage`.

In `Schema.jsx`, find the `onFormReady` callback (around line 205) and add the `addLanguage` call as the very first action (right after `formRef.current = instance`):

```js
const onFormReady = (instance) => {
  formRef.current = instance;
  if (instance && typeof instance.addLanguage === 'function') {
    instance.addLanguage('es', getFormioMessages(), true);
  }
  if (instance && resolvedGlobalRoot) {
    instance.globalRoot = resolvedGlobalRoot;
    instance.options = instance.options || {};
    instance.options.globalRoot = resolvedGlobalRoot;
  }
  // ... rest of onFormReady unchanged
};
```

Do not change any of the other lines in `onFormReady`.

- [ ] **Step 3: Add `i18n` and `language` to the `<Form options>` prop**

Locate the `<Form>` call around line 615. Change the `options={...}` prop from:

```jsx
options={{
  readOnly: formIsReadOnly,
  ...(resolvedGlobalRoot != null
    ? { globalRoot: resolvedGlobalRoot }
    : {}),
}}
```

to:

```jsx
options={{
  readOnly: formIsReadOnly,
  i18n: { es: getFormioMessages() },
  language: 'es',
  ...(resolvedGlobalRoot != null
    ? { globalRoot: resolvedGlobalRoot }
    : {}),
}}
```

The two new entries (`i18n` and `language`) go AFTER `readOnly` and BEFORE the spread of `resolvedGlobalRoot`. The `onFormReady` change in Step 2 is what actually applies the Spanish to the i18next singleton; this step sets the form's options for completeness (and so a host app that constructs a Webform manually without `onFormReady` still gets the config).

- [ ] **Step 4: Run the full test suite as a smoke check**

Run: `npx vitest run src/plugins/kace/hooks` (from `apps/onescript_plugin_kace`)

Expected: all existing tests still pass.

- [ ] **Step 5: Run the linter**

Run: `pnpm --filter onescript-plugin-tutorial lint`

Expected: no errors. (As of writing, the lint command in this app has a pre-existing crash unrelated to this plan; if it crashes with `TypeError: Cannot set properties of undefined`, document it and move on — it is out of scope for this spec.)

- [ ] **Step 6: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx
git commit -m "feat(schema): pass Form.io i18n bundle and language to <Form>"
```

---

## Task 5b: Fix KaceBaseComponent to use Spanish validation messages

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js:1-12` (imports), `KaceBaseComponent.js:135-142` (the hardcoded "is required" message), and `KaceBaseComponent.js:151-154` (the in-component Joi validate call)

This task is the one that actually unblocks the per-component Form.io errors. Without it, `Schema.jsx`'s Spanish Joi message is discarded by the `!comp.error` guard in the Spanish override (line 343 of `Schema.jsx`) because `KaceBaseComponent.checkValidity` runs first and stamps the field with the hardcoded English string.

- [ ] **Step 1: Add the import**

In `apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js`, add the import alongside the existing ones (right after the `storeService` import):

```js
import { getJoiMessages } from '#util/validationLocale.js';
```

- [ ] **Step 2: Replace the hardcoded "is required" message**

Locate the block that hardcodes "is required" (around line 135-142, inside the `if (kace_schema.required === true)` block). Change it from:

```js
this.setCustomValidity(
  `${this.component.label || 'This field'} is required`,
  dirty
);
```

to:

```js
this.setCustomValidity(
  this.t(this.errorMessage('required'), {
    field: this.component.label || 'This field',
  }),
  dirty
);
```

`this.t(...)` resolves through the Webform's i18next (which carries our Spanish `required: "{{field}} es obligatorio"` after Task 5). `errorMessage('required')` returns the i18n key unless the form has a custom `component.errors.required` string.

- [ ] **Step 3: Pass `messages` to the in-component Joi validate call**

A few lines below, locate the in-component Joi validate (around line 151-154) and change it from:

```js
const schemaBuilderResult = SchemaBuilder.build(schemaForValidation);
const { error } = schemaBuilderResult.validate(value, {
  context: { isUpdate: false },
});
```

to:

```js
const schemaBuilderResult = SchemaBuilder.build(schemaForValidation);
const { error } = schemaBuilderResult.validate(value, {
  context: { isUpdate: false },
  messages: getJoiMessages(),
});
```

This is the same pattern already used in `useSchema.js`; the locale loader is the single source of truth for both validation surfaces.

- [ ] **Step 4: Run the full test suite as a smoke check**

Run: `npx vitest run src/plugins/kace/hooks` (from `apps/onescript_plugin_kace`)

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js
git commit -m "feat(shared): use Spanish for KaceBaseComponent required + Joi messages"
```

---

## Task 6: Manual end-to-end verification

**Files:** none modified.

- [ ] **Step 1: Run the dev build**

Run: `pnpm --filter onescript-plugin-tutorial watch-dev`

Expected: vite starts and reports "ready" with no errors. Keep the process running for the next steps.

- [ ] **Step 2: Render the schema in a form**

In the host app, open a form that contains a `kace_schema` or `kace_aux_cases_schema` component with at least:
- One `textfield` (e.g. key `nombre`, label `Nombre`, `validate.required: true`).
- One `textfield` with a `validate.pattern` regex of `^\d+$` (e.g. key `telefono`, label `Teléfono`).
- One `email` component (key `email`, label `Email`).
- One `textfield` with `validate.minLength: 5` (e.g. key `codigo`, label `Código`).

- [ ] **Step 3: Trigger the empty-required failure**

Submit the form with all fields empty.

Expected (in Spanish, no English text anywhere):
- Field-level under `Nombre`: `Nombre es obligatorio`.
- Field-level under `Email`: `Email es obligatorio`.
- Top alert header: `Por favor corrige los siguientes errores antes de enviar.`
- Top alert body bullets: `nombre: es obligatorio`, `email: es obligatorio` (one per failing field, with the Joi wrapper prefix `Error de validación: ` if the Joi-level alert is also triggered; in some forms only one of the two alerts is shown — confirm at least the bullets are Spanish).
- Top alert footer: `Por favor revisa el formulario y corrige todos los errores antes de enviar.`

- [ ] **Step 4: Trigger the pattern failure**

Type `weshhjhhjk` into the `telefono` field and submit.

Expected:
- Field-level under `Teléfono`: a Spanish message containing `no coincide con el patrón` and `/^\d+$/`.
- Top alert bullet: `telefono: no coincide con el patrón /^\d+$/`.

- [ ] **Step 5: Trigger the min-length failure**

Type `abc` into the `codigo` field and submit.

Expected:
- Field-level under `Código`: a Spanish message containing `al menos 5 caracteres`.
- Top alert bullet: `codigo: debe tener al menos 5 caracteres`.

- [ ] **Step 6: Trigger the email failure**

Type `not-an-email` into the `email` field and submit.

Expected:
- Field-level under `Email`: a Spanish message containing `correo electrónico válido`.

- [ ] **Step 7: Render the `kace_aux_cases_schema` variant**

Open a form that uses `kace_aux_cases_schema` (not just `kace_schema`) and repeat the empty-required scenario from Step 3.

Expected: identical Spanish text (the wiring is shared via `<Schema>`).

- [ ] **Step 8: Stop the dev build**

Stop the `pnpm watch-dev` process started in Step 1.

- [ ] **Step 9: Final verification**

Run: `pnpm --filter onescript-plugin-tutorial test && pnpm --filter onescript-plugin-tutorial lint`

Expected: all tests green, no lint errors. If anything fails, fix forward — do not amend prior commits, add a new fix-up commit.

---

## Self-Review

1. **Spec coverage:**
   - Joi messages override → Task 3.
   - Form.io i18n override → Task 5.
   - Alert prefix replacement → Task 4.
   - Locale file with three top-level keys → Task 1.
   - Loader module → Task 2.
   - Unit tests for loader and Joi → Tasks 2 and 3.
   - Manual verification (form-level alerts, per-component errors, pattern, min, email, both schema variants) → Task 6.
   - Branch from `origin/develop` → already done before this plan.
   - Out of scope items (kace-saas forms, label substitution, language switcher) → not present, by design.

2. **Placeholder scan:** no TBDs, TODOs, or vague "add appropriate error handling" phrases remain. Every step has explicit code or commands.

3. **Type consistency:** `getJoiMessages`, `getFormioMessages`, and `getAlertPrefix` are introduced in Task 2 and referenced identically in Tasks 3, 4, and 5. The Form.io option is `i18n: { es: getFormioMessages() }` everywhere; the language code is `'es'` in both the locale file's `formioMessages` map name and the `<Form options.language>` value.
