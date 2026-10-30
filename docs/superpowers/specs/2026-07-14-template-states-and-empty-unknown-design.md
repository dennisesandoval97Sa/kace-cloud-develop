# Email Templates: Add States to Field Picker, Drop `{{Unknown}}` for Unresolved Body/Subject Placeholders

## Context

The email template editor in `apps/kace-saas/src/pages/Templates/components/TemplatesForm.jsx` exposes a "Fields" dropdown next to the **Asunto** input and inside the **Cuerpo** rich editor. The dropdown is driven by `DEFAULT_FIELDS_OPTIONS` in `apps/kace-saas/src/components/core/Editor/constants.js`, and each entry produces a submenu that lists the columns of a target table. The current entries are `cases`, `clients`, `users`, `classifications`, `aux_cases`, `aux_clients`. There is no entry for `estados`, so template authors cannot insert `{{estados.nombre}}` (or any other state field) into the subject or body of a template — even though the case data already carries the current and next state at runtime.

Independently, the template render path (`replaceTemplateVariables` in `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js:125`) hard-codes a literal `'{{Unknown}}'` for any placeholder it cannot resolve when the input is a body/subject string (`forEmail === false`). This produces visible noise (`{{Unknown}}`) in outbound emails whenever a template references an optional or absent field — most often auxiliaries (`aux_cases.*`, `aux_clients.*`) that are not configured for the current case. The same code path also surfaces this noise inside the `cuerpo` when an agent drafts a template manually before the case has all data populated.

Reproduction:

1. **States missing from the picker.** Open the template editor, click the **Fields** button next to **Asunto** or in the **Cuerpo** toolbar. The dropdown lists `Cases`, `Clients`, `Responsible`, `Classifications`, `Case auxiliary`, `Client auxiliary`. There is no `States` entry. To get `{{estados.nombre}}` the author has to type the placeholder by hand, which is fragile and inconsistent with the rest of the dropdown UX.
2. **`{{Unknown}}` leak in body.** Create a template whose `cuerpo` contains `{{aux_cases.email}}` (or any field that resolves to `undefined` for the case in question). Send it. The rendered email body shows the literal string `{{Unknown}}` where the email address should have been. Same for `{{caso.campo_inexistente}}`.

The expected behavior is:

- A new `States` entry in the picker, between `Classifications` and `Case auxiliary`, that inserts `{{estados.X}}` (where `X` is any column from the `estados` table).
- `{{estados.X}}` resolves to the case's **next** state (`estado_siguiente`), so a template can read "Your case is now in *Pendiente*" without configuration.
- `{{estados_actual.X}}` and `{{estados_siguiente.X}}` are also available as explicit aliases for symmetry, pointing to the current and next state respectively.
- When a body/subject placeholder cannot be resolved, the render returns the empty string instead of the literal `{{Unknown}}`. Email recipient fields (`destinatario`, `copia`, `copia_oculta`) keep their current behavior (placeholder is left literal, and `renderEmailsOrFail` throws on the unresolved variable), because an empty email address must still be a hard error.

## Decisions

- **Dropdown** entry is `{ text: "states", schema: "estados", url: "estados" }`. Reuses the existing generic endpoint `GET /schema-fields/{url}` (`DropdownSubMenu.jsx:26`) to fetch the column list — no new endpoint, no new migration.
- **Search + alphabetical sort** apply to both the top-level model menu (`DropdownMenuModel.jsx`) and each per-model submenu (`DropdownSubMenu.jsx`). Sort is case- and accent-insensitive via `String.prototype.localeCompare` with `sensitivity: "base"`. Search is a synchronous in-memory `Array.prototype.filter` over a sorted copy; the query is local React state that resets when the dropdown closes (Radix unmounts the content). The shared `DropdownSearch` component is a controlled `<input type="search">` with `e.stopPropagation()` on keydown so Radix's keyboard nav (Escape to close, ArrowDown to first item) does not fire while the user is typing.
- **Default alias `estados` → `estado_siguiente`.** This is the user-facing default for the most common authoring intent: "tell the recipient the state the case just moved to." `estados_actual` and `estados_siguiente` are exposed as parallel explicit aliases.
- **Backend data path** mirrors the existing `clientFinder` / `classificationFinder` pattern: `buildEmailTemplateContext` accepts two new optional finders, `stateFinder` and `transitionFinder`. When the entity is a `Case` with a `transicion_id`, the function resolves the transition, then looks up `estado_actual` and `estado_siguiente` via `stateFinder`. The `SendEmail` action wires both finders through its constructor.
- **Frontend data path** mirrors the existing `caseData.cliente` / `caseData.responsable` reads: `buildFrontendTemplateContext` reads `caseData.estado_actual` and `caseData.estado_siguiente` and exposes them as the same three aliases.
- **`{{Unknown}}` → empty string** is a one-line change in `replaceTemplateVariables`. No flag, no config, no per-template opt-out. Rationale: the placeholder is gone or the field is empty — either way, the right rendering is "nothing." Email recipient fields (`forEmail === true`) keep the old behavior because an empty `to:` must still fail loudly.
- **No new i18n strings beyond the dropdown label.** The dropdown label uses `t("app.title.states")`, which is added in both `en.json` and `es.json` under the same namespace as the other top-level entries.
- **No database migrations.** `estados` is an existing table. `transiciones` is an existing table. The case entity already exposes `transicion_id`.
- **No new test framework.** The repo already uses `vitest` (kace-saas) and the test runner used by the kace-cloud-core package's existing specs. New tests follow the patterns in the existing `EmailTemplatesUtils.test.js` (frontend) and the surrounding core-package test layout.

## Code Changes

### 1. `apps/kace-saas/src/components/core/Editor/constants.js`

Add the new entry between `classifications` and `aux_cases`:

```js
export const DEFAULT_FIELDS_OPTIONS = [
    { text: "cases",           schema: "cases",           url: "cases" },
    { text: "clients",         schema: "clients",         url: "clients" },
    { text: "users",           schema: "usuarios",        url: "usuarios" },
    { text: "classifications", schema: "clasificaciones", url: "clasificaciones" },
    { text: "states",          schema: "estados",         url: "estados" },     // NEW
    { text: "aux_cases",       schema: "aux_cases",       url: "aux_cases" },
    { text: "aux_clients",     schema: "aux_clients",     url: "aux_clients" },
];
```

`DropdownSubMenu.jsx:65` already does `handleSelectChange(`${schema.toLowerCase()}.${option.value}`)`, so clicking `nombre` in the new submenu inserts `{{estados.nombre}}` — exactly what the runtime resolver expects.

### 2. `apps/kace-saas/src/locale/{en,es}.json`

Add `app.title.states` next to `app.title.classifications` (alphabetical, matching the surrounding entries):

`en.json` (around line 1029):
```json
"classifications": "Classifications",
"states": "States",
"classifications-levels": "Classification levels",
```

`es.json` (around line 1080):
```json
"classifications": "Clasificaciones",
"states": "Estados",
"classifications-levels": "Niveles de clasificaciones",
```

### 3. `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js`

#### 3a. `buildEmailTemplateContext` — accept two new finders and load the states (lines 19–74)

Before:

```js
export async function buildEmailTemplateContext({
    entity,
    clientFinder,
    userFinder,
    classificationFinder,
    auxCasesFinder,
    auxClientsFinder,
}) {
    const jsonEntity = entity.toJson();

    let clients = {};
    let usuarios = {};
    let clasificaciones = {};
    let aux_cases = {};
    let aux_clients = {};

    try {
        if (entity.cliente_id?.value) {
            const found = await clientFinder.execute(entity.cliente_id.value);
            clients = found?.toJson?.().data ?? {};
        }
        // ... user / classification / aux lookups unchanged
    } catch (error) {
        Helper.logError(`Partial error while building the template context:`, { error: error.message });
    }

    return {
        cases: entity instanceof Case ? jsonEntity : undefined,
        jsonEntity,
        clients,
        usuarios,
        clasificaciones,
        aux_cases,
        aux_clients,
    };
}
```

After:

```js
export async function buildEmailTemplateContext({
    entity,
    clientFinder,
    userFinder,
    classificationFinder,
    auxCasesFinder,
    auxClientsFinder,
    stateFinder = null,
    transitionFinder = null,
}) {
    const jsonEntity = entity.toJson();

    let clients = {};
    let usuarios = {};
    let clasificaciones = {};
    let aux_cases = {};
    let aux_clients = {};
    let estados_actual = {};
    let estados_siguiente = {};

    try {
        if (entity.cliente_id?.value) {
            const found = await clientFinder.execute(entity.cliente_id.value);
            clients = found?.toJson?.().data ?? {};
        }
        // ... user / classification / aux lookups unchanged

        if (transitionFinder && stateFinder && entity.transicion_id?.value) {
            const transition = await transitionFinder.execute(entity.transicion_id.value);
            if (transition) {
                const actualId = transition.estado_actual_id?.value ?? transition.estado_actual_id;
                const siguienteId =
                    transition.siguiente_estado_id?.value ?? transition.siguiente_estado_id;
                if (actualId) {
                    const found = await stateFinder.execute(actualId);
                    estados_actual = found?.toJson?.().data ?? {};
                }
                if (siguienteId) {
                    const found = await stateFinder.execute(siguienteId);
                    estados_siguiente = found?.toJson?.().data ?? {};
                }
            }
        }
    } catch (error) {
        Helper.logError(`Partial error while building the template context:`, { error: error.message });
    }

    return {
        cases: entity instanceof Case ? jsonEntity : undefined,
        jsonEntity,
        clients,
        usuarios,
        clasificaciones,
        aux_cases,
        aux_clients,
        estados_actual,
        estados_siguiente,
        estados: estados_siguiente, // default alias → next state
    };
}
```

Both finders are optional and default to `null`. Existing callers that do not pass them keep working unchanged. The `entidad.transicion_id` may be a value object with `.value` or a raw id (Knex repos sometimes return raw rows); the `??` fallback handles both shapes without forcing a repo change.

#### 3b. `replaceTemplateVariables` — add the three new aliases to `aliasContext` (line 126)

Before:

```js
const aliasContext = {
    ...originalContext,
    caso: originalContext.cases,
    cliente: originalContext.clients,
    responsable: originalContext.usuarios,
    clasificacion: originalContext.clasificaciones,
    aux_casos: originalContext.aux_cases,
    aux_clientes: originalContext.aux_clients,
};
```

After:

```js
const aliasContext = {
    ...originalContext,
    caso: originalContext.cases,
    cliente: originalContext.clients,
    responsable: originalContext.usuarios,
    clasificacion: originalContext.clasificaciones,
    aux_casos: originalContext.aux_cases,
    aux_clientes: originalContext.aux_clients,
    estados: originalContext.estados,
    estados_actual: originalContext.estados_actual,
    estados_siguiente: originalContext.estados_siguiente,
};
```

#### 3c. `replaceTemplateVariables` — drop `{{Unknown}}` (line 144)

Before:

```js
if (value === undefined) {
    return forEmail ? `{{${key}}}` : '{{Unknown}}';
}
```

After:

```js
if (value === undefined) {
    return forEmail ? `{{${key}}}` : '';
}
```

Email recipient fields (`forEmail === true`) keep returning the literal placeholder so that `renderEmailsOrFail` (line 163) can still detect the unresolved variable and throw `InvalidArgumentError`. This preserves the existing safety net for empty email addresses.

### 4. `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js`

#### 4a. `buildFrontendTemplateContext` — read state from `caseData` and expose three aliases (line 23)

Before:

```js
export function buildFrontendTemplateContext() {
  const store = storeService.get('cases') ?? {};
  const caseData = store.case_data ?? {};

  const cases = { ...caseData };
  const clients = { ...(caseData.cliente ?? {}) };
  const responsable = { ...(caseData.responsable ?? {}) };
  const clasificaciones = { ...(caseData.clasificacion ?? {}) };

  const auxRaw = caseData.aux_case?.data ?? {};
  const aux_cases = { ...auxRaw, ...Object.values(auxRaw).reduce(/* flatten */) };

  const aux_clients = {};

  return {
    cases, clients, usuarios: responsable, clasificaciones,
    aux_cases, aux_clients,
    caso: cases, cliente: clients, responsable, clasificacion: clasificaciones,
    aux_casos: aux_cases, aux_clientes: aux_clients,
  };
}
```

After:

```js
export function buildFrontendTemplateContext() {
  const store = storeService.get('cases') ?? {};
  const caseData = store.case_data ?? {};

  const cases = { ...caseData };
  const clients = { ...(caseData.cliente ?? {}) };
  const responsable = { ...(caseData.responsable ?? {}) };
  const clasificaciones = { ...(caseData.clasificacion ?? {}) };

  const auxRaw = caseData.aux_case?.data ?? {};
  const aux_cases = { ...auxRaw, ...Object.values(auxRaw).reduce(/* flatten */) };

  const aux_clients = {};

  const estadoActual = caseData.estado_actual ?? {};
  const estadoSiguiente = caseData.estado_siguiente ?? {};

  return {
    cases, clients, usuarios: responsable, clasificaciones,
    aux_cases, aux_clients,
    estados: estadoSiguiente,
    estados_actual: estadoActual,
    estados_siguiente: estadoSiguiente,
    caso: cases, cliente: clients, responsable, clasificacion: clasificaciones,
    aux_casos: aux_cases, aux_clientes: aux_clients,
  };
}
```

Note: `caseData.estado_actual` and `caseData.estado_siguiente` are already loaded by the kace data layer (see `useEmailForm.js` and the case data flow used by the existing `State.jsx` drawer component). No frontend fetch is added.

#### 4b. `replaceTemplateVariables` — empty string for unresolved keys (line 68)

Before:

```js
return templateString.replace(VAR_REGEX, (original, key) => {
  const keys = key.split('.');
  let value = ctx;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined || value === null) {
      return original; // leaves the placeholder literal
    }
  }
  return typeof value === 'object' ? original : String(value);
});
```

After:

```js
return templateString.replace(VAR_REGEX, (original, key) => {
  const keys = key.split('.');
  let value = ctx;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined || value === null) {
      return ''; // unresolved body/subject placeholder → empty
    }
  }
  return typeof value === 'object' ? original : String(value);
});
```

This aligns the frontend with the backend: an unresolved placeholder in a body/subject field is empty, not the literal `{{key}}` or `{{Unknown}}`. Email recipient fields in the frontend go through a separate `resolveTemplate` path that always uses the frontend's `replaceTemplateVariables`; if an email field is empty after resolution, the existing form-level validation should already reject it. The frontend change is safe because the email-validity check happens at submit time, not in the render path.

### 5. `packages/kace_cloud_core/src/actions/domain/types/SendEmail.js`

Wire the two new finders through the constructor and pass them to `buildEmailTemplateContext`. This is the only caller in the core that needs the state data today; new callers can be added later by passing the same finders.

#### 5a. Imports (line 1)

Add:

```js
import { StateFinder } from '../../../state/application/find/StateFinder.js';
import { TransitionsFinder } from '../../../transition/domain/TransitionsFinder.js';
```

#### 5b. Constructor (lines 32–57)

Add two new repository parameters and construct the finders. **The new parameters are appended at the end of the constructor signature, not inserted after `secretRepository`.** This placement is deliberate: every existing caller (`ActionExecutor.js`, `EntityActionExecutor.js`, the unit tests) instantiates `SendEmail` with positional arguments up to `caseAttachmentRepository` and would silently mis-bind the mock case-attachments repository to `stateRepository` if the new params were inserted in the middle. Putting the new params at the tail (positions 13–14, with default `= null`) means every existing caller keeps working with zero changes — the new behavior only activates when a caller explicitly opts in by passing the new repos.

```js
constructor(
    templatesRepository,
    mailAccountRepository,
    clientRepository,
    userRepository,
    classificationRepository,
    auxCasesRepository,
    auxClientsRepository,
    secretRepository,
    caseAttachmentRepository = null,
    caseAttachmentReader = new S3CaseAttachmentReader(),
    emailService = new EmailService(secretRepository),
    eventLogger = new EventLogger(templatesRepository),
    stateRepository = null,         // NEW (appended)
    transitionRepository = null     // NEW (appended)
) {
    this.templateFinder = new TemplateFinder(templatesRepository);
    this.mailAccountFinder = new MailAccountFinder(mailAccountRepository);
    this.clientFinder = new ClientFinder(clientRepository);
    this.userFinder = new UserFinder(userRepository);
    this.classificationFinder = new ClassificationFinder(classificationRepository);
    this.auxCasesFinder = new AuxCasesFinder(auxCasesRepository);
    this.auxClientsFinder = new AuxClientsFinder(auxClientsRepository);
    this.stateFinder = stateRepository ? new StateFinder(stateRepository) : null;         // NEW
    this.transitionFinder = transitionRepository ? new TransitionsFinder(transitionRepository) : null; // NEW
    this.eventLogger = eventLogger;
    this.#emailService = emailService;
    this.caseAttachmentRepository = caseAttachmentRepository;
    this.caseAttachmentReader = caseAttachmentReader;
}
```

**Tradeoff:** the constructor is now 14 positional parameters. A future refactor should consider a parameter object (e.g., `new SendEmail({ templateFinder, mailAccountFinder, ... })`) to avoid positional coupling, but that is out of scope for this change.

`stateRepository` and `transitionRepository` are optional and default to `null`. When null, `buildEmailTemplateContext` skips the state lookup — the existing call sites that do not wire repositories keep working unchanged.

#### 5c. `execute` (line 82)

Pass the new finders:

```js
const context = await buildEmailTemplateContext({
    entity,
    clientFinder: this.clientFinder,
    userFinder: this.userFinder,
    classificationFinder: this.classificationFinder,
    auxCasesFinder: this.auxCasesFinder,
    auxClientsFinder: this.auxClientsFinder,
    stateFinder: this.stateFinder,
    transitionFinder: this.transitionFinder,
});
```

The wiring site (where `SendEmail` is instantiated in the deployer / stack bootstrap) must pass `stateRepository` and `transitionRepository` to make the new context active. **This wiring is a task for the implementation plan**, not part of this spec. The signature change is backward compatible because both new parameters are optional.

### 6. `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.jsx` — search box + alphabetical sort

The submenu currently shows the field list in the order returned by the API (typically column order from the database). Long lists — the `cases` schema has 30+ fields — are hard to scan. Add a search input at the top of the submenu and sort the visible options alphabetically by their `column_name` (the `label` shown to the user). The search and sort apply to both regular fields and aux fields (the latter are sourced from `useAuxiliariesOptions`).

#### 6a. New shared `DropdownSearch` component

Create `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.jsx` to avoid duplicating the search input between `DropdownSubMenu` and `DropdownMenuModel`. The component is presentational, fully controlled, and is a thin wrapper around a styled `<input>`:

```jsx
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export const DropdownSearch = ({ value, onChange, placeholder }) => {
    const { t } = useTranslation();
    return (
        <div className="px-2 py-1 border-b">
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()} // do not let Radix close on Escape
                placeholder={placeholder ?? t("app.dropdown.searchPlaceholder")}
                className="w-full px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1"
                aria-label={t("app.dropdown.searchAriaLabel")}
            />
        </div>
    );
};

DropdownSearch.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
};
```

The `onKeyDown` `stopPropagation` keeps Radix's keyboard nav (Escape to close, ArrowDown to first item) from interfering while the user is typing. Other keys (Tab, arrow keys when the input is not focused) keep their default behavior.

#### 6b. `DropdownSubMenu` — state, sort, filter (lines 17–47)

Add `useState` for the search query. Compute a sorted and filtered view of `options`:

Before:

```jsx
const options = useMemo(
    () =>
        (rows ?? []).map((field) => ({
            label: field.column_name,
            value: field.column_name,
        })),
    [rows],
);
```

After:

```jsx
const [query, setQuery] = useState("");

const options = useMemo(
    () =>
        (rows ?? []).map((field) => ({
            label: field.column_name,
            value: field.column_name,
        })),
    [rows],
);

const visibleOptions = useMemo(() => {
    const sorted = [...options].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((opt) => opt.label.toLowerCase().includes(q));
}, [options, query]);
```

`localeCompare(..., undefined, { sensitivity: "base" })` gives case-insensitive, locale-aware alphabetical order and handles accents correctly (e.g. `descripción` sorts next to `descripcion`).

#### 6c. Render — search input, list, empty state (lines 49–77)

Before, the `DropdownMenuSubContent` maps `options.map(...)`.

After:

```jsx
<DropdownMenuSubContent className="h-96 min-w-60 overflow-x-hidden" /* ... */>
    <DropdownSearch value={query} onChange={setQuery} />
    <ScrollArea className="w-full h-full">
        {visibleOptions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
                {t("app.dropdown.noResults")}
            </div>
        ) : (
            visibleOptions.map((option, index) => (
                <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSelectChange(`${schema.toLowerCase()}.${option.value}`)}
                    /* testids unchanged */
                >
                    <span>{option.label}</span>
                </DropdownMenuItem>
            ))
        )}
    </ScrollArea>
</DropdownMenuSubContent>
```

The search state is local to each submenu instance. When the dropdown closes (Radix unmounts the `DropdownMenuSubContent`), React discards the state and the next open starts with an empty query. No persistence is needed.

### 7. `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.jsx` — search box + alphabetical sort

The top-level menu lists 6–7 models. Even though it is already nearly alphabetical, the new `States` entry interleaves with the others, and adding the search keeps both menus consistent.

Before:

```jsx
<DropdownMenuGroup /* ... */>
    {DEFAULT_FIELDS_OPTIONS.map(({ text, schema, url }) => (
        <DropdownSubMenu
            key={text}
            text={text}
            schema={schema}
            url={url}
            handleSelectChange={handleSelectChange}
        />
    ))}
</DropdownMenuGroup>
```

After:

```jsx
const [query, setQuery] = useState("");

const visibleModels = useMemo(() => {
    const sorted = [...DEFAULT_FIELDS_OPTIONS].sort((a, b) =>
        a.text.localeCompare(b.text, undefined, { sensitivity: "base" })
    );
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((m) => m.text.toLowerCase().includes(q));
}, [query]);

return (
    <DropdownMenu /* ... */>
        <DropdownMenuTrigger /* ... */ />
        <DropdownMenuContent className="w-56" /* ... */>
            <DropdownMenuLabel /* ... */ />
            <DropdownMenuSeparator />
            <DropdownSearch value={query} onChange={setQuery} />
            <DropdownMenuGroup /* ... */>
                {visibleModels.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("app.dropdown.noResults")}
                    </div>
                ) : (
                    visibleModels.map(({ text, schema, url }) => (
                        <DropdownSubMenu
                            key={text}
                            text={text}
                            schema={schema}
                            url={url}
                            handleSelectChange={handleSelectChange}
                        />
                    ))
                )}
            </DropdownMenuGroup>
        </DropdownMenuContent>
    </DropdownMenu>
);
```

`DEFAULT_FIELDS_OPTIONS` is not mutated; the render uses a sorted copy. The search input reuses the new `DropdownSearch` component from section 6a.

### 8. i18n keys for the search affordance

Add three keys to both `apps/kace-saas/src/locale/en.json` and `apps/kace-saas/src/locale/es.json` under `app.dropdown.*` (new namespace; if `app.dropdown` already exists in the file, the new keys are added there):

`en.json`:
```json
"dropdown": {
    "searchPlaceholder": "Search…",
    "searchAriaLabel": "Search fields",
    "noResults": "No matching fields"
}
```

`es.json`:
```json
"dropdown": {
    "searchPlaceholder": "Buscar…",
    "searchAriaLabel": "Buscar campos",
    "noResults": "No se encontraron campos"
}
```

`searchPlaceholder` is a generic English string — fine for a placeholder. `searchAriaLabel` provides a screen-reader-friendly name for the search input.

## Tests

### Backend — `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.spec.js` (new)

Following the patterns in the surrounding core-package specs. The function under test is pure (it takes finders as parameters and does not touch `process.env` or any module-level state), so each test is a plain async function that builds a minimal entity stub and an inline fake finder.

1. **`replaceTemplateVariables` returns `''` for an unresolved body placeholder**
   - Given a template `Hello {{caso.campo_inexistente}} world`.
   - When `replaceTemplateVariables` is called with `forEmail=false` and a context whose `cases.campo_inexistente` is undefined.
   - Then the result is `Hello  world` (one space remains from the original).

2. **`replaceTemplateVariables` returns the literal `{{key}}` for an unresolved email placeholder**
   - Given a template `{{responsable.email}}` and a context whose `usuarios.email` is undefined.
   - When `replaceTemplateVariables` is called with `forEmail=true`.
   - Then the result is the literal string `{{responsable.email}}`.

3. **`buildEmailTemplateContext` populates `estados`, `estados_actual`, `estados_siguiente` from the case's transition**
   - Given a Case stub with `transicion_id = 't-1'`, a fake `transitionFinder` that returns `{ estado_actual_id: 'a-1', siguiente_estado_id: 's-1' }`, and a fake `stateFinder` that returns `{ toJson: () => ({ data: { nombre: 'X' } }) }` for any id.
   - When `buildEmailTemplateContext` runs.
   - Then `context.estados.nombre === 'X'`, `context.estados_actual.nombre === 'X'`, `context.estados_siguiente.nombre === 'X'`.

4. **`buildEmailTemplateContext` returns empty objects when `transicion_id` is null**
   - Given a Case stub with `transicion_id = null`.
   - When `buildEmailTemplateContext` runs.
   - Then `context.estados`, `context.estados_actual`, and `context.estados_siguiente` are each `{}` (not undefined), and `replaceTemplateVariables('Hi {{estados.nombre}}', context)` returns `Hi `.

5. **`buildEmailTemplateContext` returns empty objects when finders are not provided**
   - Given a Case stub with `transicion_id = 't-1'` and **no** `stateFinder` / `transitionFinder` in the options.
   - When `buildEmailTemplateContext` runs.
   - Then `context.estados === {}` and no error is thrown (backward compatibility for existing callers).

### Frontend — `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js` (extend)

The file already has a `buildFrontendTemplateContext` describe block. Add to it:

6. **Context exposes `estados`, `estados_actual`, `estados_siguiente` from `caseData`**
   - Given a mocked store whose `cases.case_data` includes `estado_actual: { nombre: 'En revisión' }` and `estado_siguiente: { nombre: 'Resuelto' }`.
   - When `buildFrontendTemplateContext` runs.
   - Then `context.estados_actual.nombre === 'En revisión'`, `context.estados_siguiente.nombre === 'Resuelto'`, and `context.estados.nombre === 'Resuelto'` (default alias = siguiente).

7. **Context returns empty objects when `estado_actual` and `estado_siguiente` are absent**
   - Given a mocked store with no `estado_actual` and no `estado_siguiente` on `caseData`.
   - When `buildFrontendTemplateContext` runs.
   - Then `context.estados_actual === {}`, `context.estados_siguiente === {}`, `context.estados === {}`, and `replaceTemplateVariables('Hi {{estados.nombre}}', context)` returns `Hi `.

8. **`replaceTemplateVariables` returns `''` for an unresolved body placeholder**
   - Given a context whose `cases` has no `campo_inexistente`.
   - When `replaceTemplateVariables('X {{caso.campo_inexistente}} Y', context)` runs.
   - Then the result is `X  Y`.

### Frontend — `apps/kace-saas/src/components/core/Editor/constants.js` shape

The constants file is plain data; no `DropdownSubMenu` test rewrite is required for this change. A trivial assertion in the existing `DropdownSubMenu.test.jsx` (or a new tiny spec if none exists) confirms the new entry is present and has the expected `text` / `schema` / `url`:

9. **`DEFAULT_FIELDS_OPTIONS` contains the `states` entry**
   - Given the constants module.
   - Then `DEFAULT_FIELDS_OPTIONS` includes an entry `{ text: 'states', schema: 'estados', url: 'estados' }` between `classifications` and `aux_cases`.

### Frontend — `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx` (extend)

The existing spec mocks `useQuery` and `useAuxiliariesOptions` to feed a known set of fields. The new cases drive the search input and assert the rendered option list. All cases use `@testing-library/react`'s `userEvent` for typing into the search input and `within` queries scoped to the submenu's `data-testid` to count options.

10. **Submenu renders options sorted alphabetically by `column_name`**
    - Given a mocked query response `[{ column_name: 'updated_at' }, { column_name: 'canal_id' }, { column_name: 'sla_remaining_days' }]`.
    - When the submenu renders with an empty search query.
    - Then the rendered option order is `canal_id`, `sla_remaining_days`, `updated_at` (alphabetical, case-insensitive, locale-aware).

11. **Submenu search filters options by substring, case-insensitive**
    - Given the same mocked response as test 10 plus extra `[{ column_name: 'sla_elapsed_time' }, { column_name: 'estado_actual' }]`.
    - When the user types `SLA` into the search input.
    - Then the rendered list contains only `sla_remaining_days` and `sla_elapsed_time`, in that order.

12. **Submenu search matches across accents**
    - Given a mocked response that includes a column named `descripción`.
    - When the user types `descrip` into the search input.
    - Then `descripción` is in the rendered list (the filter is case- and accent-insensitive).

13. **Submenu shows the empty state when no option matches the query**
    - Given a mocked response and the user types `zzzzz` into the search input.
    - Then the rendered submenu shows the `app.dropdown.noResults` message and no `DropdownMenuItem` rows.

14. **Submenu search resets when the dropdown closes**
    - Given the user has typed `SLA` into the search input of a submenu, narrowing the list.
    - When the dropdown is closed (`Esc` or click outside) and reopened.
    - Then the search input is empty and the full option list is shown again. (React discards the local `useState` on Radix unmount; this case guards against a future refactor that accidentally lifts the state.)

### Frontend — `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx` (extend or new)

The top-level menu has no `useQuery` dependency — it iterates `DEFAULT_FIELDS_OPTIONS` directly. The new spec is therefore lighter and does not need data mocks.

15. **Top-level menu renders models sorted alphabetically by `text`**
    - Given the constants module as imported by the component.
    - When the menu renders with an empty search query.
    - Then the rendered model order is `aux_cases`, `aux_clients`, `cases`, `classifications`, `clients`, `states`, `users` (alphabetical, case-insensitive). This implicitly verifies that the new `states` entry is included.

16. **Top-level menu search filters models by substring**
    - Given the menu is rendered and the user types `clie` into the search input.
    - Then the rendered list contains only `clients` and `aux_clients`, in that order.

17. **Top-level menu shows the empty state when no model matches**
    - Given the user types `zzzzz` into the search input.
    - Then the rendered menu shows the `app.dropdown.noResults` message and no submenu triggers.

### Frontend — `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.test.jsx` (new)

A small, isolated spec for the new shared component. The test does not need to mount a Radix dropdown; it renders the component standalone.

18. **DropdownSearch is a controlled input with the given value and placeholder**
    - Given `value="abc"` and `placeholder="Find"`.
    - When the component renders.
    - Then the `<input type="search">` has `value="abc"` and `placeholder="Find"`, and `aria-label` is the translated search label.

19. **DropdownSearch calls `onChange` with the new value on each keystroke**
    - Given a `vi.fn()` spy for `onChange`.
    - When the user types `x`, then `y`.
    - Then the spy was called with `"x"` and then `"xy"`.

20. **DropdownSearch stops Escape from bubbling to Radix**
    - Given a parent spy for `keydown` events.
    - When the user presses Escape inside the search input.
    - Then the parent's spy is **not** called (`e.stopPropagation()` worked). The parent spy **is** called for keys other than Escape, confirming the guard is scoped correctly.

## Out of Scope

- **Filtering the `estados` submenu to only user-friendly columns.** All 9 columns of the `estados` table appear in the new submenu (`id`, `nombre`, `tipo_id`, `descripcion`, `icono_awesome_id`, `status`, `color`, `observacion`, plus the timestamps). The 4 useful columns (`nombre`, `descripcion`, `color`, `observacion`) are what authors will click in practice; the rest are visible but harmless. Adding a curated submenu is a future UX task and is intentionally deferred (would require a hardcoded allowlist that has to be revisited every time `estados` gains a column).
- **Filtering the column list server-side.** `GET /schema-fields/estados` already returns columns generically; this spec does not change that endpoint.
- **Persisting state preferences on the template entity.** No new column on `plantillas`. The relationship is purely runtime: a template author chooses to insert `{{estados.X}}` and the case's actual state resolves it. A persistent "this template applies to state X" feature would be a separate change (would require either a new column on `plantillas` or a join table analogous to `classification_template_relations`).
- **A migration to add `estados` to the existing `aux_cases` / `aux_clients` patterns.** The aliases are stand-alone and do not follow the auxiliary flattening pattern.
- **Audit of other call sites of `buildEmailTemplateContext`.** Only `SendEmail.execute` calls it. The other call sites of `replaceTemplateVariables` (frontend `EmailTemplatesUtils.js`) are updated in this same spec.
- **The deployment wiring of `stateRepository` and `transitionRepository` into `SendEmail`'s constructor.** The constructor change in this spec is backward compatible; the actual instantiation sites in the stack / Lambda / API bootstrappers are updated by the implementation plan as a follow-up task.
- **Debouncing the search input.** The list is small (≤50 items per submenu, ≤10 models in the top-level menu) and filtering is a synchronous in-memory `Array.prototype.filter` over a sorted copy. Debouncing would add complexity for no measurable UX win.
- **Fuzzy / multi-token search.** A simple case-insensitive substring match is what the user asked for. Fuzzy matching (e.g., `fzf`-style scoring) and multi-token search (`"sla remaining"`) are explicitly deferred.
- **Persisting the search query across dropdown opens.** The query resets each time the dropdown closes (React state is local and Radix unmounts the content). A future enhancement could persist the last query in `sessionStorage` per user, but that is a separate UX decision.
- **Re-sorting the source data on the backend.** The API returns columns in DB order; the sort happens client-side in the submenu. This keeps the contract of `GET /schema-fields/{url}` unchanged and avoids breaking other consumers.
