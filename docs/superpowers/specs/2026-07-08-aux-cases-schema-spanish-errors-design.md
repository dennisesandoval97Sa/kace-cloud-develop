# Aux Cases Schema Spanish Validation Errors Design

## Context

The `kace_schema` and `kace_aux_cases_schema` components in `apps/onescript_plugin_kace` currently surface validation errors to agents in English, while every other piece of UI in those components is already in Spanish (panel titles, field labels, builder copy, custom JS error throws, etc.).

Three sources of English text leak through on the rendered schema form:

1. The top-of-form red alert produced by `Schema.jsx` after a Joi validation failure. The alert is hard-coded as `` `Validation failed: ${errorMessage}` `` where `errorMessage` is built from `e.path` and Joi's default English `e.message` (e.g. `Validation failed: nombre: "nombre" contains an invalid value`).
2. The field-level error rendered by Form.io's built-in component validators (e.g. `Nombre is required`, `Email must be a valid email`). These come from Form.io's own i18n bundle, which currently runs with the default English locale because nothing in the plugin passes `options.i18n` / `options.language` to `<Form>`.
3. The Form.io form-level alert messages themselves: the header `Please fix the following errors before submitting.` and the footer `Please check the form and correct all errors before submitting.`. Both come from Form.io's English bundle.

There is no i18n framework in `onescript_plugin_kace` today, and the only locale file in the monorepo (`apps/kace-saas/src/locale/es.json`) belongs to a different app and is not designed to be consumed as a library. The plugin needs its own self-contained locale.

### Formio locale reality check

`formiojs@4.21.7` (the version in this monorepo) **ships only `translations/en.js`** — there is no bundled `es` translation, and `Formio.setLocale` does not exist in this version. Formio's i18n is wired through i18next, exposed per-form via two `<Form>` options: `options.i18n` (a `{ es: { key: 'translation' } }` map) and `options.language` (the language code). When `options.i18n[langCode]` is provided, Formio deep-merges it on top of the default English bundle, so we can override any subset of keys without losing the rest. The Webform source confirms this in `node_modules/.../formiojs/Webform.js` lines 169-200.

This means we cannot rely on `Formio.setLocale('es')` (it does not exist in this version) and we cannot rely on a vendor-provided Spanish bundle. We must ship the Spanish messages ourselves.

### i18next singleton caveat

Formio uses a **single i18next instance** shared across every Webform on the page (`Webform.js` line 89: `i18next: _i18next["default"]`). The first Webform to be constructed calls `i18next.init(...)` (in `Webform.prototype.localize`, lines 425-453). If the first form is constructed without our Spanish options (e.g. a kace-saas form rendered above the schema on the same page), i18next is initialized in English and the `initialized` flag is set. Every subsequent Webform's `localize()` short-circuits at line 433-435 (`if (this.i18next.initialized) return ...`) — the Spanish options passed via `options.i18n` are merged into the global i18n config but never reach the i18next instance, so field-level errors keep rendering in English.

The supported workaround is `Webform.prototype.addLanguage(code, lang, active)` (line 414-423). It calls `i18next.addResourceBundle(...)` — which injects resources into an already-initialized i18next — and, with `active: true`, sets the Webform's `language` property (which triggers `changeLanguage` if needed). We call this in `onFormReady` so the Spanish bundle is added and activated regardless of whether the first form on the page is ours.

## Goal

All validation feedback that the plugin shows to agents (top alert + per-field error) is in Spanish, with no English text leaking from Joi or Form.io defaults.

## Non-Goals

- Multi-language i18n framework. The plugin is Spanish-only; this change does not introduce a runtime language switcher.
- Translating custom JS `onChangeCode` / `onSubmitCode` error messages. Those are written by the form author and are out of the plugin's control.
- Translating Form.io builder copy (already in Spanish in `custom.form.json`) or API/network error messages (handled by `util/validationErrors.js`).
- Replacing the field key (e.g. `nombre`) in the top alert with the field's user-facing label. The current alert format `path: message` is preserved; only the message and prefix are translated.
- Backward compatibility for English callers. The plugin does not expose a locale toggle, and no host relies on English validation output.
- Translating validation errors in form.io forms that live in other apps of the monorepo (e.g. kace-saas). The form in image 3 ("Zurich clientes") is one such form — it is rendered by kace-saas, not by this plugin, and the `<Form>` it uses is constructed there. The plugin only owns the `<Form>` rendered by `Schema.jsx`. Each app that needs Spanish validation is responsible for applying this plugin's translations to its own forms, either by reusing the locale file or by mirroring the pattern.

## Decisions

- Use Joi's per-call `messages` option (Joi 17) to translate the messages produced by `@kace/schemabuilder`. This keeps the change scoped to the plugin's own validation, avoids touching `Joi.errors` globally, and lets Joi resolve `{#limit}` / `{#format}` / `{#value}` placeholders at error time.
- Pass `options.i18n: { es: formioSpanishBundle }` and `options.language: 'es'` to the `<Form>` component rendered by `Schema.jsx`. Formio merges this bundle on top of its default English bundle, overriding only the keys we provide. This is the supported way to localize Form.io in this version (no vendor-bundled Spanish exists, and `Formio.setLocale` is not available).
- Keep the error object shape that `useSchema` returns (`{ path, message, type }`) so the alert wrapper in `Schema.jsx` keeps working unchanged in structure — only the human-readable strings change.
- Add a new `apps/onescript_plugin_kace/src/locale/es.json` instead of importing from `kace-saas`. Plugin stays self-contained; future plugins in the same monorepo can extend the same file. kace-saas is free to import from this locale if it wants to reuse the same translations for its own forms.
- If Joi emits a `type` that is not in the map, fall back to Joi's default English message. The change is additive — it does not regress error reporting, it just fails open for unmapped keys.
- If a Form.io key is not in our Spanish bundle, Formio falls back to the default English. Same fail-open behavior.

## API / Contract Changes

None. No backend changes, no public API surface change, no new exports from any package. The `validateFormData` hook continues to return the same shape; the strings inside are different.

### Edit: `apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js`

This is the base class every `kace_*` component (`kace_text_field`, `kace_select`, `kace_checkbox`, `kace_radio`, etc.) extends via `KaceBaseComponent.create({...})`. It has two English-only paths that bypass i18next entirely:

1. **The hardcoded "is required" message** (around line 137 of the current file). The current code is:

   ```js
   this.setCustomValidity(
     `${this.component.label || 'This field'} is required`,
     dirty
   );
   ```

   Replace with a call through the i18next singleton (already set up by the `<Form>` / `addLanguage` wiring above):

   ```js
   this.setCustomValidity(
     this.t(this.errorMessage('required'), {
       field: this.component.label || 'This field',
     }),
     dirty
   );
   ```

   `this.t(...)` resolves to the Webform's i18next, which carries our Spanish `required: "{{field}} es obligatorio"`. `errorMessage('required')` returns the i18n key unless the form has set `component.errors.required` as a custom string.

2. **The component's own Joi validation** (around line 152-154). The current code is:

   ```js
   const schemaBuilderResult = SchemaBuilder.build(schemaForValidation);
   const { error } = schemaBuilderResult.validate(value, {
     context: { isUpdate: false },
   });
   ```

   It does not pass `messages: getJoiMessages()`, so the detail messages from this in-component check are English. Replace with:

   ```js
   import { getJoiMessages } from '#util/validationLocale.js';
   // ...
   const { error } = schemaBuilderResult.validate(value, {
     context: { isUpdate: false },
     messages: getJoiMessages(),
   });
   ```

   This is the same pattern already used in `useSchema.js`; the locale loader is the single source of truth for both validation surfaces.

3. **Add the import** at the top of `KaceBaseComponent.js`:

   ```js
   import { getJoiMessages } from '#util/validationLocale.js';
   ```

### Why the Form.io per-component error used to be English even when i18next was set

`Schema.jsx` calls `comp.setCustomValidity(detail.message, true)` with the Spanish Joi message it generated, but only when `!comp.error`. `KaceBaseComponent.checkValidity` runs **before** the form's submit handler (the form iterates every component's `checkValidity` first; only after that does our `Schema.jsx` submit handler run Joi). So by the time the Spanish Joi error reaches the field, `comp.error` is already set with the English string from `KaceBaseComponent`, and the `!comp.error` guard short-circuits. Fixing `KaceBaseComponent` is what unblocks the Spanish rendering.

## File-Level Design

### New: `apps/onescript_plugin_kace/src/locale/es.json`

Contains three top-level keys:

- `alertPrefix`: the Spanish text shown before the per-error list in the top alert (default: `"Error de validación"`).
- `joiMessages`: a flat map of Joi `error.details[].type` → Spanish template. Covers every type produced by the builders in `@kace/schemabuilder/src/builders/` (`String`, `Number`, `Date`, `Array`, plus the generic `any.*` rules).
- `formioMessages`: a flat map of Form.io i18n keys → Spanish text. Covers every key in `formiojs/translations/en.js` (alerts, per-component validators, button labels, ARIA strings, calendar months). The keys we leave out fall back to Form.io's English defaults automatically.

Keys covered (with templates):

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
  }
}
```

The two `string.pattern.ISO 8601 ...` keys exist because `DateSchemaBuilder.buildWithTimezoneRequired` and `buildWithoutTimezoneInInput` call `Joi.string().pattern(REGEX, 'ISO 8601 with timezone')` / `'ISO 8601 without timezone'` — Joi uses the supplied name as the suffix of the error type, so the override key must match the full type string.

`formioMessages` (covers every key in `formiojs/translations/en.js`; full mirror to keep future maintenance simple):

```json
{
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
```

### New: `apps/onescript_plugin_kace/src/util/validationLocale.js`

Thin loader that imports the JSON and exports three accessors:

- `getJoiMessages(): Record<string, string>` — returns the `joiMessages` map with the first letter of every value capitalized. Cheap to call; safe to pass directly to `validate()`.
- `getAlertPrefix(): string` — returns the `alertPrefix` string.
- `getFormioMessages(): Record<string, string>` — returns the `formioMessages` map with the first letter of every value capitalized. To be wrapped as `{ es: <formioMessages> }` when passed to `<Form options.i18n>`.

The capitalization is applied at module load (no runtime cost per call): a `capitalize` helper upper-cases the first character of each value. This is a presentation rule, not a content change — the source JSON keeps lowercase values, so adding a new key automatically inherits the convention.

The module is plain ESM and has no side effects. No caching wrapper is needed: the JSON is a static import.

### Edit: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js`

In `validateFormData` (function starts at line 376, the `.validate()` call is around line 406), add the `messages` option to the `validate()` call:

```js
import { getJoiMessages } from '#util/validationLocale.js';
// ...
const { error, value } = schemaBuilderResult.validate(
  payloadForValidation,
  { context: { isUpdate }, messages: getJoiMessages() }
);
```

No change to the returned error object shape. The `error.details[].message` will already be in Spanish at this point — Joi handles the substitution.

### Edit: `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx`

Three changes:

1. Replace the hard-coded prefix on line 359 with the localized one:

```js
import { getAlertPrefix } from '#util/validationLocale.js';
// ...
formRef.current.setAlert(
  'danger',
  `${getAlertPrefix()}: ${errorMessage}`
);
```

The `errorMessage` join (`${e.path}: ${e.message}`) is unchanged, so the field key (e.g. `nombre`) still appears in the alert as before.

2. Pass Spanish i18n + `language: 'es'` to the `<Form>` component (around line 615):

```js
import { getFormioMessages } from '#util/validationLocale.js';
// ...
<Form
  // ... other props unchanged
  options={{
    readOnly: formIsReadOnly,
    i18n: { es: getFormioMessages() },
    language: 'es',
    ...(resolvedGlobalRoot != null
      ? { globalRoot: resolvedGlobalRoot }
      : {}),
  }}
/>
```

3. In `onFormReady` (around line 205), call `instance.addLanguage('es', getFormioMessages(), true)` so the Spanish bundle is injected into the i18next singleton even when another Webform has already initialized it. The third argument (`active: true`) sets `webform.language = 'es'`, which triggers `changeLanguage` if needed.

```js
const onFormReady = (instance) => {
  formRef.current = instance;
  if (instance && typeof instance.addLanguage === 'function') {
    instance.addLanguage('es', getFormioMessages(), true);
  }
  // ... rest of onFormReady unchanged
};
```

All three changes affect only the form that this component renders. Other forms in the host application (e.g. the "Zurich clientes" form in kace-saas) are not impacted and must opt in separately if their maintainers want Spanish validation.

## Error Handling

- If `locale/es.json` is missing or malformed at build time, the module fails to import → `useSchema.js` and `Schema.jsx` fail to import → the consumer app fails loudly at startup. This is the desired behavior: a missing locale file is a deployment error, not a runtime one.
- If Joi emits a `type` not in the map, Joi's own default English message is used. The fallback is silent because the Joi `messages` option is opt-in per rule; missing keys are simply not overridden.
- If a Form.io key is not in `formioMessages`, Form.io's default English key is used. The merge logic in `Webform.js` (lines 169-190) only overwrites keys we provide; everything else stays English. Same fail-open behavior as Joi.

## Data Flow

Validation flow with the change applied:

1. User submits a form that contains a `kace_schema` or `kace_aux_cases_schema`.
2. `Schema.jsx` calls `validateFormData(dataStructure, payload)` from `useSchema.js`.
3. `useSchema.js` builds the Joi schema via `@kace/schemabuilder` and calls `validate(payload, { messages: getJoiMessages() })`.
4. Joi returns `{ error, value }` with `error.details[i].message` already in Spanish (substituted placeholders included).
5. `useSchema.js` maps `error.details` into `{ path, message, type }` and returns `{ valid: false, errors, details }`.
6. `Schema.jsx` joins `errors` into `path: message` pairs and calls `formRef.current.setAlert('danger', 'Error de validación: ...')`.
7. `formRef.current` is a Form.io `<Form>` constructed with `options.language: 'es'` and `options.i18n: { es: getFormioMessages() }`. Its i18next instance resolves keys against the Spanish bundle, so the alert header, footer, per-component errors (`Nombre es obligatorio`, `Email debe ser un correo electrónico válido`, `Teléfono no coincide con el patrón /^\d+$/`, etc.) and button labels render in Spanish.

No network, store, or state changes.

## Testing

### Unit

- `util/validationLocale.test.js` (new): asserts `getJoiMessages()`, `getFormioMessages()`, and `getAlertPrefix()` return the expected maps/string, and the module imports without throwing.
- `hooks/useSchema.validation.test.js` (new): builds a small Joi schema (string with `min` + `email`, number with `integer`, date with `iso`) and calls `validate(payload, { messages: getJoiMessages() })` to confirm the error details come back with the Spanish templates. This bypasses the React hook and exercises the override at the Joi layer, which is the actual contract being introduced.
- `components/schema/Schema.test.js` (new, light): renders the `<Form>` in `Schema.jsx` with a stubbed minimal form (one required text field) and asserts the i18n options are forwarded correctly. This is a smoke test for the new `options.i18n` / `options.language` wiring; the actual Form.io locale resolution is verified manually because it depends on a real Form.io Webform instance.
- `hooks/useSchema.utils.test.js` (existing, no change required): the pure utility functions it covers (`preprocessSchema`, etc.) are untouched by this spec.

### Manual

- Render a form with a `textfield` (key `nombre`, label `Nombre`, `validate.required: true`). Submit empty. Expect:
  - Field-level: `Nombre es obligatorio` (Form.io)
  - Top alert header: `Por favor corrige los siguientes errores antes de enviar.` (Form.io)
  - Top alert (Joi wrapper): `Error de validación: nombre: es obligatorio` (Joi)
- Render the same form with a `min: 5` string field and a 3-char value. Expect `debe tener al menos 5 caracteres`.
- Render with an `email` component and an invalid value. Expect field-level `Email debe ser un correo electrónico válido` and a top alert that uses the same Spanish message.
- Render with a `textfield` configured with a custom regex pattern (e.g. `^\d+$`) and a non-matching value. Expect the Form.io pattern error in Spanish, with the field key in place of `{{field}}`.
- Render a `kace_aux_cases_schema` instance (not just `kace_schema`) and repeat the empty-required scenario to confirm both components pick up the change from the shared `Schema.jsx`.
- Spot-check that the form-level alert footer reads `Por favor revisa el formulario y corrige todos los errores antes de enviar.` (Form.io submit error).

## Out Of Scope

- Translating the field key in the top alert to the field's Spanish label (would require either a label-aware Joi wrapper or post-processing the `e.path`; both are larger changes deferred for a future spec).
- Adding a language switcher or runtime locale API.
- Translating validation errors in Form.io forms that are constructed by other apps in the monorepo (e.g. the "Zurich clientes" form in kace-saas). Those forms construct their own `<Form>` instances and would need to opt into the same `options.i18n` / `options.language` pattern using this plugin's `locale/es.json` (or a copy of it). This is a per-app change and is not in this plugin's scope.
- Upgrading `formiojs` to a version that ships a Spanish bundle. That would be a separate dependency upgrade with its own testing surface.

## Relevant Files

- `apps/onescript_plugin_kace/src/plugins/kace/components/aux-cases-schema/AuxCasesSchema.jsx` — container; renders `<Schema>` and reuses all validation behavior. No change.
- `apps/onescript_plugin_kace/src/plugins/kace/components/aux-cases-schema/index.js` — Form.io wrapper for the container. No change.
- `apps/onescript_plugin_kace/src/plugins/kace/components/schema/Schema.jsx` — alerts the agent with the new prefix; passes the new `i18n` / `language` options to `<Form>`.
- `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js` — runs Joi; passes the new messages map.
- `apps/onescript_plugin_kace/src/locale/es.json` — new; the source of truth for Spanish strings (Joi + Form.io).
- `apps/onescript_plugin_kace/src/util/validationLocale.js` — new; loader for the JSON; exports `getJoiMessages`, `getAlertPrefix`, `getFormioMessages`.
- `apps/onescript_plugin_kace/src/plugins/kace/KaceEngine.js` — no change. The earlier draft called `Formio.setLocale` here, but the API does not exist in `formiojs@4.21.7`; the locale is set per-form via `<Form options>` instead.
- `packages/kace_cloud_schemas_builder/src/SchemaBuilder.js` and `src/builders/*.js` — Joi schema source. No change; we only override messages at the call site.
