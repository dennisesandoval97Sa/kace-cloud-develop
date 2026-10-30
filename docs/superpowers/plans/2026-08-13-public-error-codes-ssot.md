# Public Error Codes SSOT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `@kace/error-codes` como única fuente de códigos públicos, remapear a `0x` + 6 dígitos decimales consecutivos por categoría, y cortar todos los imports de `ErrorCodes.js` / `publicErrorCodes.js`.

**Architecture:** Paquete workspace sin dependencias de runtime. Un archivo por categoría con códigos hoy, `catalog.js` ensambla y falla si hay duplicados, `helpers.js` consulta forma y membresía. Core, api-common, apiv1 y kace-saas importan el barrel. Sin re-export en `@kace/core`. Copy i18n se queda en el frontal.

**Tech Stack:** Node 22 ESM, pnpm workspaces, Jest (`--experimental-vm-modules`), Vitest (kace-saas)

**Spec:** `docs/superpowers/specs/2026-08-13-public-error-codes-ssot-design.md`

**Branch:** `feat/error-codes-ssot` (desde `origin/develop`)

## Global Constraints

- Canonical format: `0x` + 6 decimal digits. Pattern `/^0x\d{6}$/` (`x` lowercase, digits `0-9` only).
- `0x` is a published prefix, not hex encoding. `0x03000A` is invalid.
- Per-category consecutive suffixes `0001`…`N` with no gaps. Category `0C` → `12`, `0F` → `15`.
- Hard cutover: no hex aliases, no `legacy_code`, no dual-write, no `@kace/core` facade.
- Package name `@kace/error-codes`, version `1.24.3`, `"type": "module"`, zero runtime dependencies.
- Locale files stay keyed by error **name**. Do not change locale copy. `getPublicErrorCodeI18nKey(code, namespace)` requires a non-empty `namespace` string (no default). Production `src/helpers.js` must not contain `app.errors.public` (tests may use it as a sample argument). FE callers pass `'app.errors.public'` today.
- No comments in generated application code.
- TDD: red → minimal implementation → green → commit.
- One atomic PR to `develop`. Do not land on `release/*`.
- After every `git commit`, strip Cursor trailers (`Co-authored-by: Cursor`) with `git commit-tree` + `git reset --soft` if the hook injects them. Never `git commit --amend` to strip them.
- Do not globally replace overlapping hex strings (HTTP `0x050004`/`0x050005` collide with new values). Use the per-file table in Tasks 4–6.

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/kace_cloud_error_codes/package.json` | Workspace package `@kace/error-codes` |
| `packages/kace_cloud_error_codes/jest.config.js` | Jest ESM, same as `@kace/file-extensions` |
| `packages/kace_cloud_error_codes/src/categories.js` | Prefix table `01`–`15` (not public API) |
| `packages/kace_cloud_error_codes/src/catalog/*.js` | Named literal constants per category |
| `packages/kace_cloud_error_codes/src/catalog.js` | `assembleCatalog` + frozen maps |
| `packages/kace_cloud_error_codes/src/helpers.js` | Pattern + normalize/find/getName/isKnown/getI18nKey |
| `packages/kace_cloud_error_codes/index.js` | Public barrel |
| `packages/kace_cloud_error_codes/tests/catalog.test.js` | Format, uniqueness, consecutive, pinned remap, assemble throw |
| `packages/kace_cloud_error_codes/tests/helpers.test.js` | Helper contract |
| `packages/kace_cloud_core/package.json` | Add `workspace:*` dep |
| `packages/kace_cloud_api_common/package.json` | Add `workspace:*` dep |
| `apps/kace-saas/package.json` | Add `workspace:*` dep |
| `apps/apiv1/*/package.json` | Add dep only where `ErrorCodes.js` is imported |
| Consumer source/tests listed in Tasks 4–6 | Import path + remapped literals |
| `apps/kace-saas/vite.config.js` | Inline `@kace/error-codes` for Vitest |
| `apps/kace-saas/src/errors/publicErrorCodeI18n.test.js` | Thin locale copy test |
| Deleted: `ErrorCodes.js`, `ErrorCodes.test.js`, `publicErrorCodes.js`, `publicErrorCodes.test.js` | Old dictionaries |

---

### Task 1: Scaffold + failing catalog tests

**Files:**
- Create: `packages/kace_cloud_error_codes/package.json`
- Create: `packages/kace_cloud_error_codes/jest.config.js`
- Create: `packages/kace_cloud_error_codes/tests/catalog.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: runnable Jest package that fails because `../src/catalog.js` and `../src/categories.js` do not exist

- [ ] **Step 1: Create `package.json`**

```json
{
    "name": "@kace/error-codes",
    "version": "1.24.3",
    "description": "Shared public error code catalog for Kace Cloud",
    "type": "module",
    "main": "index.js",
    "scripts": {
        "tests": "node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit --bail --maxWorkers=100%",
        "format": "prettier --write .",
        "format:check": "prettier --check ."
    },
    "license": "ISC",
    "devDependencies": {
        "@jest/globals": "^29.7.0",
        "@kace/prettier_config": "workspace:*",
        "@types/jest": "^29.5.12",
        "jest": "^29.7.0",
        "prettier": "3.3.3"
    }
}
```

- [ ] **Step 2: Create `jest.config.js`**

```js
import { config } from 'dotenv';

config({ path: '../../.env' });

export const testEnvironment = 'node';
export const moduleFileExtensions = ['js', 'json', 'node'];
export const transform = {};
export const coverageDirectory = 'coverage';
export const coverageReporters = ['lcov', 'text'];
export const coveragePathIgnorePatterns = ['/node_modules/', '/tests/'];
export const testTimeout = 120000;
```

- [ ] **Step 3: Write failing `tests/catalog.test.js`**

```js
import { describe, expect, it } from '@jest/globals';
import { CATEGORY_PREFIXES } from '../src/categories.js';
import {
    assembleCatalog,
    PUBLIC_ERROR_CODES,
    PUBLIC_ERROR_CODE_ENTRIES,
    PUBLIC_ERROR_CODE_NAMES_BY_CODE,
} from '../src/catalog.js';
import * as namedExports from '../index.js';

const PUBLIC_ERROR_CODE_PATTERN = /^0x\d{6}$/;

const EXPECTED_PUBLIC_ERROR_CODES = {
    GENERAL_INTERNAL_ERROR: '0x010001',
    VALIDATION_ERROR: '0x030001',
    CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION: '0x030002',
    CASE_TRANSITION_NOT_ALLOWED: '0x030003',
    CASE_TRANSITION_CONDITIONS_NOT_MET: '0x030004',
    CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE: '0x030005',
    BOARD_REQUIRES_ACTIVE_GROUP: '0x030006',
    BOARD_EXPORT_NO_RECORDS: '0x030007',
    AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY: '0x030008',
    CLASSIFICATION_GROUP_RELATION_NOT_FOUND: '0x030009',
    BOARD_BULK_ACTIONS_INCOMPATIBLE: '0x030010',
    RESOURCE_ALREADY_EXISTS: '0x030011',
    INTERACTION_EMAIL_ALREADY_LINKED: '0x030012',
    CASE_DESCRIPTION_EDIT_LOCKED: '0x030013',
    CHANNEL_HUB_REGISTRATION_FLOW_INVALID: '0x030014',
    WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED: '0x030015',
    BROKER_ADAPTER_VHOST_REQUIRED: '0x030016',
    BROKER_MAPPER_QUEUE_REQUIRED: '0x030017',
    USER_CREATE_GROUPS_REQUIRED: '0x030018',
    USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS: '0x030019',
    USER_CREATE_GROUPS_NOT_FOUND: '0x030020',
    MAIL_ACCOUNT_HOST_NOT_ALLOWED: '0x030021',
    CSV_EXPORT_VIEW_NOT_FOUND: '0x030022',
    APPOINTMENT_TIME_SLOT_ALREADY_EXISTS: '0x030023',
    APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT: '0x030024',
    LITERAL_ENTITY_NOT_FOUND: '0x030025',
    LITERAL_NAME_ALREADY_EXISTS: '0x030026',
    LITERAL_TYPE_NOT_FOUND: '0x030027',
    APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE: '0x030028',
    APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT: '0x030029',
    APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND: '0x030030',
    APPOINTMENT_TIME_SLOT_NOT_FOUND: '0x030031',
    APPOINTMENT_TIME_SLOT_ALREADY_DELETED: '0x030032',
    AUX_EXPORT_NO_RECORDS: '0x030033',
    GROUP_CREATE_USERS_NOT_FOUND: '0x030034',
    CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND: '0x030035',
    SQL_BLACKLIST_WORD_DETECTED: '0x030036',
    TEMPLATE_INVALID_TYPE: '0x030037',
    TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED: '0x030038',
    GROUP_HAS_ACTIVE_USERS: '0x030039',
    BROKER_MAPPER_VALIDATION_FAILED: '0x030040',
    DATABASE_ERROR: '0x040001',
    BAD_REQUEST_ERROR: '0x050001',
    NOT_FOUND_ERROR: '0x050002',
    METHOD_NOT_ALLOWED_ERROR: '0x050003',
    REQUEST_TIMEOUT_ERROR: '0x050004',
    CONFLICT_ERROR: '0x050005',
    AUTH_FINGERPRINT_MISMATCH: '0x070001',
    AUTH_GET_TOKEN_CLAIMS: '0x070002',
    AUTH_USER_NOT_FOUND: '0x070003',
    AUTH_USER_INACTIVE: '0x070004',
    AUTH_SESSION_KEY_MISMATCH: '0x070005',
    AUTH_NOT_USER_AUTHENTICATED: '0x070006',
    AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE: '0x070007',
    AUTH_SESSION_COOKIE_STALE: '0x070008',
    AUTHORIZATION_ERROR: '0x080001',
    HELP_ATTACHMENT_FILENAME_REJECTED: '0x120001',
    TENANT_CONTEXT_ERROR: '0x150001',
};

describe('public error code catalog', () => {
    it('exports the remapped catalog', () => {
        expect(PUBLIC_ERROR_CODES).toEqual(EXPECTED_PUBLIC_ERROR_CODES);
    });

    it('uses unique 0x + 6 decimal digit identifiers', () => {
        const codes = PUBLIC_ERROR_CODE_ENTRIES.map(({ code }) => code);
        expect(codes.every((code) => PUBLIC_ERROR_CODE_PATTERN.test(code))).toBe(true);
        expect(new Set(codes).size).toBe(codes.length);
        expect(new Set(Object.keys(PUBLIC_ERROR_CODES)).size).toBe(Object.keys(PUBLIC_ERROR_CODES).length);
    });

    it('assigns consecutive suffixes per category prefix', () => {
        const groups = {};
        for (const [name, code] of Object.entries(PUBLIC_ERROR_CODES)) {
            const prefix = code.slice(2, 4);
            const seq = Number(code.slice(4));
            groups[prefix] ??= [];
            groups[prefix].push({ name, seq });
        }

        const usedPrefixes = Object.values(CATEGORY_PREFIXES);
        for (const [prefix, items] of Object.entries(groups)) {
            expect(usedPrefixes).toContain(prefix);
            const sequences = items.map(({ seq }) => seq).sort((a, b) => a - b);
            expect(sequences).toEqual(sequences.map((_, index) => index + 1));
        }
    });

    it('indexes names by code', () => {
        expect(PUBLIC_ERROR_CODE_NAMES_BY_CODE['0x030010']).toBe('BOARD_BULK_ACTIONS_INCOMPATIBLE');
        expect(PUBLIC_ERROR_CODE_NAMES_BY_CODE['0x050002']).toBe('NOT_FOUND_ERROR');
        expect(PUBLIC_ERROR_CODE_NAMES_BY_CODE['0x120001']).toBe('HELP_ATTACHMENT_FILENAME_REJECTED');
        expect(PUBLIC_ERROR_CODE_NAMES_BY_CODE['0x150001']).toBe('TENANT_CONTEXT_ERROR');
    });

    it('re-exports every catalog name from the barrel', () => {
        for (const name of Object.keys(EXPECTED_PUBLIC_ERROR_CODES)) {
            expect(namedExports[name]).toBe(EXPECTED_PUBLIC_ERROR_CODES[name]);
        }
    });

    it('throws when assembling duplicate names or codes', () => {
        expect(() =>
            assembleCatalog([{ FOO: '0x030001' }, { FOO: '0x030002' }])
        ).toThrow('Duplicate public error code name: FOO');
        expect(() =>
            assembleCatalog([{ FOO: '0x030001' }, { BAR: '0x030001' }])
        ).toThrow('Duplicate public error code value: 0x030001');
    });
});
```

- [ ] **Step 4: Install workspace link and run tests (expect fail)**

Run from repo root:

```bash
pnpm install
pnpm --filter @kace/error-codes tests
```

Expected: FAIL — `Cannot find module '../src/catalog.js'` (or `../src/categories.js` / `../index.js`).

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_error_codes/package.json packages/kace_cloud_error_codes/jest.config.js packages/kace_cloud_error_codes/tests/catalog.test.js pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
test(error-codes): add catalog invariants before the package exists

EOF
)"
```

If `Co-authored-by: Cursor` appears in `git log -1 --format='%B'`, strip it with `commit-tree` + `reset --soft` (workspace rule). Include `pnpm-lock.yaml` only if `pnpm install` changed it.

---

### Task 2: Implement catalog + barrel names

**Files:**
- Create: `packages/kace_cloud_error_codes/src/categories.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/general.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/validation.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/database.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/http.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/auth.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/authorization.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/files.js`
- Create: `packages/kace_cloud_error_codes/src/catalog/tenant.js`
- Create: `packages/kace_cloud_error_codes/src/catalog.js`
- Create: `packages/kace_cloud_error_codes/index.js`

**Interfaces:**
- Consumes: `EXPECTED_PUBLIC_ERROR_CODES` values from Task 1 tests
- Produces: `CATEGORY_PREFIXES`, `assembleCatalog(modules)`, `PUBLIC_ERROR_CODES`, `PUBLIC_ERROR_CODE_ENTRIES`, `PUBLIC_ERROR_CODE_NAMES_BY_CODE`, named constant exports from `index.js`

- [ ] **Step 1: Create `src/categories.js`**

```js
export const CATEGORY_PREFIXES = Object.freeze({
    GENERAL: '01',
    CONFIGURATION: '02',
    VALIDATION: '03',
    DATABASE: '04',
    HTTP: '05',
    INTEGRATIONS: '06',
    AUTH: '07',
    AUTHORIZATION: '08',
    CRYPTO: '09',
    CACHE: '10',
    QUEUES: '11',
    FILES: '12',
    OBSERVABILITY: '13',
    FEATURE_FLAGS: '14',
    TENANT: '15',
});
```

- [ ] **Step 2: Create category literal modules**

`src/catalog/general.js`:

```js
export const GENERAL_INTERNAL_ERROR = '0x010001';
```

`src/catalog/validation.js`:

```js
export const VALIDATION_ERROR = '0x030001';
export const CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION = '0x030002';
export const CASE_TRANSITION_NOT_ALLOWED = '0x030003';
export const CASE_TRANSITION_CONDITIONS_NOT_MET = '0x030004';
export const CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE = '0x030005';
export const BOARD_REQUIRES_ACTIVE_GROUP = '0x030006';
export const BOARD_EXPORT_NO_RECORDS = '0x030007';
export const AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY = '0x030008';
export const CLASSIFICATION_GROUP_RELATION_NOT_FOUND = '0x030009';
export const BOARD_BULK_ACTIONS_INCOMPATIBLE = '0x030010';
export const RESOURCE_ALREADY_EXISTS = '0x030011';
export const INTERACTION_EMAIL_ALREADY_LINKED = '0x030012';
export const CASE_DESCRIPTION_EDIT_LOCKED = '0x030013';
export const CHANNEL_HUB_REGISTRATION_FLOW_INVALID = '0x030014';
export const WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED = '0x030015';
export const BROKER_ADAPTER_VHOST_REQUIRED = '0x030016';
export const BROKER_MAPPER_QUEUE_REQUIRED = '0x030017';
export const USER_CREATE_GROUPS_REQUIRED = '0x030018';
export const USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS = '0x030019';
export const USER_CREATE_GROUPS_NOT_FOUND = '0x030020';
export const MAIL_ACCOUNT_HOST_NOT_ALLOWED = '0x030021';
export const CSV_EXPORT_VIEW_NOT_FOUND = '0x030022';
export const APPOINTMENT_TIME_SLOT_ALREADY_EXISTS = '0x030023';
export const APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT = '0x030024';
export const LITERAL_ENTITY_NOT_FOUND = '0x030025';
export const LITERAL_NAME_ALREADY_EXISTS = '0x030026';
export const LITERAL_TYPE_NOT_FOUND = '0x030027';
export const APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE = '0x030028';
export const APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT = '0x030029';
export const APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND = '0x030030';
export const APPOINTMENT_TIME_SLOT_NOT_FOUND = '0x030031';
export const APPOINTMENT_TIME_SLOT_ALREADY_DELETED = '0x030032';
export const AUX_EXPORT_NO_RECORDS = '0x030033';
export const GROUP_CREATE_USERS_NOT_FOUND = '0x030034';
export const CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND = '0x030035';
export const SQL_BLACKLIST_WORD_DETECTED = '0x030036';
export const TEMPLATE_INVALID_TYPE = '0x030037';
export const TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED = '0x030038';
export const GROUP_HAS_ACTIVE_USERS = '0x030039';
export const BROKER_MAPPER_VALIDATION_FAILED = '0x030040';
```

`src/catalog/database.js`:

```js
export const DATABASE_ERROR = '0x040001';
```

`src/catalog/http.js`:

```js
export const BAD_REQUEST_ERROR = '0x050001';
export const NOT_FOUND_ERROR = '0x050002';
export const METHOD_NOT_ALLOWED_ERROR = '0x050003';
export const REQUEST_TIMEOUT_ERROR = '0x050004';
export const CONFLICT_ERROR = '0x050005';
```

`src/catalog/auth.js`:

```js
export const AUTH_FINGERPRINT_MISMATCH = '0x070001';
export const AUTH_GET_TOKEN_CLAIMS = '0x070002';
export const AUTH_USER_NOT_FOUND = '0x070003';
export const AUTH_USER_INACTIVE = '0x070004';
export const AUTH_SESSION_KEY_MISMATCH = '0x070005';
export const AUTH_NOT_USER_AUTHENTICATED = '0x070006';
export const AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE = '0x070007';
export const AUTH_SESSION_COOKIE_STALE = '0x070008';
```

`src/catalog/authorization.js`:

```js
export const AUTHORIZATION_ERROR = '0x080001';
```

`src/catalog/files.js`:

```js
export const HELP_ATTACHMENT_FILENAME_REJECTED = '0x120001';
```

`src/catalog/tenant.js`:

```js
export const TENANT_CONTEXT_ERROR = '0x150001';
```

- [ ] **Step 3: Create `src/catalog.js`**

```js
import * as general from './catalog/general.js';
import * as validation from './catalog/validation.js';
import * as database from './catalog/database.js';
import * as http from './catalog/http.js';
import * as auth from './catalog/auth.js';
import * as authorization from './catalog/authorization.js';
import * as files from './catalog/files.js';
import * as tenant from './catalog/tenant.js';

export function assembleCatalog(modules) {
    const catalog = {};
    const seenCodes = new Set();

    for (const moduleExports of modules) {
        for (const [name, code] of Object.entries(moduleExports)) {
            if (Object.hasOwn(catalog, name)) {
                throw new Error(`Duplicate public error code name: ${name}`);
            }
            if (seenCodes.has(code)) {
                throw new Error(`Duplicate public error code value: ${code}`);
            }
            catalog[name] = code;
            seenCodes.add(code);
        }
    }

    return Object.freeze(catalog);
}

export const PUBLIC_ERROR_CODES = assembleCatalog([
    general,
    validation,
    database,
    http,
    auth,
    authorization,
    files,
    tenant,
]);

export const PUBLIC_ERROR_CODE_ENTRIES = Object.freeze(
    Object.entries(PUBLIC_ERROR_CODES).map(([name, code]) => Object.freeze({ name, code }))
);

export const PUBLIC_ERROR_CODE_NAMES_BY_CODE = Object.freeze(
    PUBLIC_ERROR_CODE_ENTRIES.reduce((acc, { name, code }) => {
        acc[code] = name;
        return acc;
    }, {})
);
```

- [ ] **Step 4: Create `index.js` (catalog exports only)**

```js
export * from './src/catalog/general.js';
export * from './src/catalog/validation.js';
export * from './src/catalog/database.js';
export * from './src/catalog/http.js';
export * from './src/catalog/auth.js';
export * from './src/catalog/authorization.js';
export * from './src/catalog/files.js';
export * from './src/catalog/tenant.js';
export {
    PUBLIC_ERROR_CODES,
    PUBLIC_ERROR_CODE_ENTRIES,
    PUBLIC_ERROR_CODE_NAMES_BY_CODE,
} from './src/catalog.js';
```

Do not export `assembleCatalog` or `CATEGORY_PREFIXES` from the barrel.

- [ ] **Step 5: Run catalog tests (expect pass)**

```bash
pnpm --filter @kace/error-codes tests
```

Expected: PASS (only `catalog.test.js` exists).

- [ ] **Step 6: Commit**

```bash
git add packages/kace_cloud_error_codes
git commit -m "$(cat <<'EOF'
feat(error-codes): publish remapped catalog split by category

EOF
)"
```

Strip Cursor trailers if present.

---

### Task 3: Helpers

**Files:**
- Create: `packages/kace_cloud_error_codes/tests/helpers.test.js`
- Create: `packages/kace_cloud_error_codes/src/helpers.js`
- Modify: `packages/kace_cloud_error_codes/index.js`

**Interfaces:**
- Consumes: `PUBLIC_ERROR_CODES`, `PUBLIC_ERROR_CODE_NAMES_BY_CODE` from `src/catalog.js`
- Produces: `PUBLIC_ERROR_CODE_PATTERN` (`/^0x\d{6}$/`), `normalizePublicErrorCode(code)`, `findPublicErrorCode(...codes)`, `getPublicErrorCodeName(code)`, `isKnownPublicErrorCode(code)`, `getPublicErrorCodeI18nKey(code, namespace)`

- [ ] **Step 1: Write failing `tests/helpers.test.js`**

```js
import { describe, expect, it } from '@jest/globals';
import {
    PUBLIC_ERROR_CODE_PATTERN,
    normalizePublicErrorCode,
    findPublicErrorCode,
    getPublicErrorCodeName,
    isKnownPublicErrorCode,
    getPublicErrorCodeI18nKey,
} from '../index.js';

describe('public error code helpers', () => {
    it('exposes the decimal 0x pattern', () => {
        expect(PUBLIC_ERROR_CODE_PATTERN.test('0x030010')).toBe(true);
        expect(PUBLIC_ERROR_CODE_PATTERN.test('0x03000A')).toBe(false);
        expect(PUBLIC_ERROR_CODE_PATTERN.test('030001')).toBe(false);
    });

    it('normalizes trimmed canonical codes', () => {
        expect(normalizePublicErrorCode(' 0x030001 ')).toBe('0x030001');
    });

    it('rejects non-canonical shapes', () => {
        expect(normalizePublicErrorCode('0x03000A')).toBeUndefined();
        expect(normalizePublicErrorCode('0x03000f')).toBeUndefined();
        expect(normalizePublicErrorCode('0X030001')).toBeUndefined();
        expect(normalizePublicErrorCode('030001')).toBeUndefined();
        expect(normalizePublicErrorCode('0x0C0001')).toBeUndefined();
        expect(normalizePublicErrorCode('')).toBeUndefined();
        expect(normalizePublicErrorCode(null)).toBeUndefined();
        expect(normalizePublicErrorCode(0x030001)).toBeUndefined();
    });

    it('finds the first well-formed code even if unknown', () => {
        expect(findPublicErrorCode('nope', '0x999999', '0x030001')).toBe('0x999999');
        expect(findPublicErrorCode('0x03000A', '030001')).toBeUndefined();
    });

    it('resolves known names and i18n keys', () => {
        expect(getPublicErrorCodeName('0x030010')).toBe('BOARD_BULK_ACTIONS_INCOMPATIBLE');
        expect(isKnownPublicErrorCode('0x030010')).toBe(true);
        expect(getPublicErrorCodeI18nKey('0x030010', 'app.errors.public')).toBe(
            'app.errors.public.BOARD_BULK_ACTIONS_INCOMPATIBLE'
        );
        expect(getPublicErrorCodeI18nKey('0x030010', 'app.public.errors')).toBe(
            'app.public.errors.BOARD_BULK_ACTIONS_INCOMPATIBLE'
        );
        expect(getPublicErrorCodeI18nKey('0x030010')).toBeUndefined();
        expect(getPublicErrorCodeI18nKey('0x030010', '')).toBeUndefined();
        expect(getPublicErrorCodeName('0x999999')).toBeUndefined();
        expect(isKnownPublicErrorCode('0x999999')).toBe(false);
        expect(getPublicErrorCodeI18nKey('0x999999', 'app.errors.public')).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run helpers tests (expect fail)**

```bash
pnpm --filter @kace/error-codes tests
```

Expected: FAIL — `PUBLIC_ERROR_CODE_PATTERN` / helpers are not exported from `index.js`.

- [ ] **Step 3: Create `src/helpers.js`**

```js
import { PUBLIC_ERROR_CODE_NAMES_BY_CODE } from './catalog.js';

export const PUBLIC_ERROR_CODE_PATTERN = /^0x\d{6}$/;

export function normalizePublicErrorCode(code) {
    if (typeof code !== 'string') {
        return undefined;
    }

    const trimmedCode = code.trim();
    return PUBLIC_ERROR_CODE_PATTERN.test(trimmedCode) ? trimmedCode : undefined;
}

export function findPublicErrorCode(...codes) {
    for (const code of codes) {
        const normalizedCode = normalizePublicErrorCode(code);
        if (normalizedCode) {
            return normalizedCode;
        }
    }

    return undefined;
}

export function getPublicErrorCodeName(code) {
    const normalizedCode = normalizePublicErrorCode(code);
    return normalizedCode ? PUBLIC_ERROR_CODE_NAMES_BY_CODE[normalizedCode] : undefined;
}

export function isKnownPublicErrorCode(code) {
    return Boolean(getPublicErrorCodeName(code));
}

export function getPublicErrorCodeI18nKey(code, namespace) {
    const codeName = getPublicErrorCodeName(code);
    if (!codeName || typeof namespace !== 'string' || namespace.length === 0) {
        return undefined;
    }
    return `${namespace}.${codeName}`;
}
```

- [ ] **Step 4: Export helpers from `index.js`**

Append to `packages/kace_cloud_error_codes/index.js`:

```js
export {
    PUBLIC_ERROR_CODE_PATTERN,
    normalizePublicErrorCode,
    findPublicErrorCode,
    getPublicErrorCodeName,
    isKnownPublicErrorCode,
    getPublicErrorCodeI18nKey,
} from './src/helpers.js';
```

- [ ] **Step 5: Run package tests (expect pass)**

```bash
pnpm --filter @kace/error-codes tests
```

Expected: PASS (`catalog.test.js` and `helpers.test.js`).

- [ ] **Step 6: Commit**

```bash
git add packages/kace_cloud_error_codes/src/helpers.js packages/kace_cloud_error_codes/tests/helpers.test.js packages/kace_cloud_error_codes/index.js
git commit -m "$(cat <<'EOF'
feat(error-codes): add catalog helpers with decimal 0x normalize

EOF
)"
```

Strip Cursor trailers if present.

---

### Task 4: Cut over `@kace/core` and `@kace/api-common`

**Files:**
- Modify: `packages/kace_cloud_core/package.json` — add `"@kace/error-codes": "workspace:*"` next to `"@kace/file-extensions"`
- Modify: `packages/kace_cloud_api_common/package.json` — add `"@kace/error-codes": "workspace:*"` next to `"@kace/core"`
- Modify every core/api-common file that imports `ErrorCodes.js` / `ErrorCodes` (list below)
- Modify hardcoded remapped literals in api-common tests (list below)
- Do **not** delete `ErrorCodes.js` yet (apiv1 still imports the core path)

**Interfaces:**
- Consumes: `@kace/error-codes` named exports and maps from Tasks 2–3
- Produces: core and api-common compile/test against the package; `ErrorCodes.js` unused by these two packages

**Import replacement (exact):**

| From | To |
|------|----|
| `from '.../ErrorCodes.js'` | `from '@kace/error-codes'` |
| `from '.../ErrorCodes'` | `from '@kace/error-codes'` |
| `from '@kace/core/src/shared/errors/ErrorCodes.js'` | `from '@kace/error-codes'` |
| `jest.unstable_mockModule('@kace/core/src/shared/errors/ErrorCodes.js', ...)` | `jest.unstable_mockModule('@kace/error-codes', ...)` |

Core source (relative `ErrorCodes`):

- `packages/kace_cloud_core/src/workspaces/domain/WorkspaceChannelHubAccountRequirement.js`
- `packages/kace_cloud_core/src/users/application/create/UserCreator.js`
- `packages/kace_cloud_core/src/templates/domain/Types.js`
- `packages/kace_cloud_core/src/transition-rules/domain/TransitionRuleValidator.js`
- `packages/kace_cloud_core/src/template-attachments/application/create/TemplateAttachmentCreator.js`
- `packages/kace_cloud_core/src/shared/validation/UniquenessValidator.js`
- `packages/kace_cloud_core/src/shared/errors/CaseDescriptionEditLockedError.js`
- `packages/kace_cloud_core/src/shared/domain/guards/SQLInjectionGuard.js`
- `packages/kace_cloud_core/src/shared/domain/guards/SQLInjectionCriteriaGuard.js`
- `packages/kace_cloud_core/src/mail-accounts/application/update/MailAccountUpdater.js`
- `packages/kace_cloud_core/src/mail-accounts/application/create/MailAccountCreator.js` (import has no `.js`)
- `packages/kace_cloud_core/src/literals/domain/ValidationService.js`
- `packages/kace_cloud_core/src/literals/application/create/LiteralCreator.js`
- `packages/kace_cloud_core/src/literals/application/update/LiteralUpdater.js`
- `packages/kace_cloud_core/src/interactions/domain/InteractionEmailAlreadyLinkedError.js`
- `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js`
- `packages/kace_cloud_core/src/helps_attachments/domain/ValueObjectPath.js`
- `packages/kace_cloud_core/src/grupos/application/create/GroupCreator.js`
- `packages/kace_cloud_core/src/exports/application/ExportAuxTableData.js`
- `packages/kace_cloud_core/src/csv-export-views/domain/CsvExportViewValidationService.js`
- `packages/kace_cloud_core/src/classifications/application/create/ClassificationCreator.js`
- `packages/kace_cloud_core/src/classification-group-relationships/application/batch/ClassificationGroupBatchDeleter.js`
- `packages/kace_cloud_core/src/classification-group-relationships/application/delete/ClassificationGroupDeleter.js`
- `packages/kace_cloud_core/src/channel-hub-accounts/domain/ChannelHubRegistrationFlowValidator.js`
- `packages/kace_cloud_core/src/cases/application/transitions-updater/CaseTransitionsUpdater.js`
- `packages/kace_cloud_core/src/cases/application/assign/CaseGroupAssigner.js`
- `packages/kace_cloud_core/src/cases/application/bulk-transitions-updater/CaseBulkTransitionsUpdater.js`
- `packages/kace_cloud_core/src/boards/domain/BoardBulkActionsPolicy.js`
- `packages/kace_cloud_core/src/auxiliaries/application/delete/AuxiliaryDeleter.js`
- `packages/kace_cloud_core/src/boards/application/export/BoardExportData.js`
- `packages/kace_cloud_core/src/appointment-time-slots/domain/AppointmentTimeSlots.js`
- `packages/kace_cloud_core/src/appointment-time-slots/domain/AppointmentTimeSlotsValidator.js`
- `packages/kace_cloud_core/src/appointment-time-slots/infraestructure/persistence/KnexAppointmentTimeSlots.js`
- `packages/kace_cloud_core/src/appointment-time-slots/application/delete/AppointmentTimeSlotsDeleter.js`
- `packages/kace_cloud_core/src/appointment-time-slots/application/update/AppointmentTimeSlotsUpdater.js`
- `packages/kace_cloud_core/src/auth-cognito/application/authentication-user/AuthenticationUser.js`
- `packages/kace_cloud_core/src/appointment-time-slots/application/create/AppointmentTimeSlotsCreator.js`

Core tests that import `ErrorCodes` (path only; they use names, not remapped literals except `ErrorCodes.test.js` which stays until Task 7):

- `packages/kace_cloud_core/tests/workspaces/WorkspacesIntegration.test.js`
- `packages/kace_cloud_core/tests/users/UsersIntegration.test.js`
- `packages/kace_cloud_core/tests/templates/TemplatesUnitTest.test.js`
- `packages/kace_cloud_core/tests/template-attachments/TemplateAttachmentUnitTest.test.js`
- `packages/kace_cloud_core/tests/shared/validation/UniquenessValidator.test.js`
- `packages/kace_cloud_core/tests/shared/domain/guards/SQLInjectionGuardMode.test.js`
- `packages/kace_cloud_core/tests/mail-accounts/MailAccountHostValidation.test.js`
- `packages/kace_cloud_core/tests/interactions/InteractionsIntegration.test.js`
- `packages/kace_cloud_core/tests/grupos/GroupsIntegration.test.js`
- `packages/kace_cloud_core/tests/grupos/GroupUsageGuardUnit.test.js`
- `packages/kace_cloud_core/tests/classifications/ClassificationsIntegration.test.js`
- `packages/kace_cloud_core/tests/classification-group-relationships/ClassificationGroupIntegration.test.js`
- `packages/kace_cloud_core/tests/channel-hub-accounts/ChannelHubRegistrationFlowValidator.test.js`
- `packages/kace_cloud_core/tests/boards/BoardBulkActionsPolicy.test.js`
- `packages/kace_cloud_core/tests/auxiliaries/AuxiliariesIntegration.test.js`
- `packages/kace_cloud_core/tests/auth-cognito/AuthCognito.fingerprint.integration.test.js`
- `packages/kace_cloud_core/tests/appointment-time-slots/AppointmentTimeSlotsIntegration.test.js`

api-common source:

- `packages/kace_cloud_api_common/src/http_responses/Response.js`
- `packages/kace_cloud_api_common/src/middleware/withTenantContext.js`
- `packages/kace_cloud_api_common/src/middleware/tenantMiddleware.js`
- `packages/kace_cloud_api_common/src/controllers/BaseController.js`

api-common tests:

- `packages/kace_cloud_api_common/tests/middleware/withTenantContextDbTarget.test.js`
- `packages/kace_cloud_api_common/tests/http_responses/HttpResponse.test.js`
- `packages/kace_cloud_api_common/tests/http_responses/AuthFailResponse.test.js`
- `packages/kace_cloud_api_common/tests/http_responses/PublicErrorResponse.test.js`
- `packages/kace_cloud_api_common/tests/controllers/baseControllerGetGlobalConfig.test.js` (mock module path)

- [ ] **Step 1: Add workspace dependencies and install**

In `packages/kace_cloud_core/package.json` dependencies:

```json
"@kace/error-codes": "workspace:*",
"@kace/file-extensions": "workspace:*",
```

In `packages/kace_cloud_api_common/package.json` dependencies:

```json
"@kace/core": "workspace:*",
"@kace/error-codes": "workspace:*",
```

```bash
pnpm install
```

- [ ] **Step 2: Replace import paths in the files listed above**

Use a targeted replace of the import specifier only. Do not rewrite call sites.

- [ ] **Step 3: Update remapped literals in api-common tests**

`packages/kace_cloud_api_common/tests/http_responses/PublicErrorResponse.test.js`:

| Old | New | Meaning |
|-----|-----|---------|
| `'0x050005'` | `'0x050003'` | `METHOD_NOT_ALLOWED_ERROR` |
| `'0x050009'` | `'0x050005'` | `CONFLICT_ERROR` |
| `'0x03000C'` | `'0x030012'` | `INTERACTION_EMAIL_ALREADY_LINKED` |

`0x070008` stays.

`packages/kace_cloud_api_common/tests/http_responses/SuppressedErrorLogging.test.js`:

| Old | New |
|-----|-----|
| `public_error_code: '0x050005'` | `public_error_code: '0x050003'` |

`0x030001`, `0x010001`, `0x040001` stay.

Prefer importing the named constant from `@kace/error-codes` instead of a new literal when the test already imports codes.

- [ ] **Step 4: Run focused tests (expect pass)**

```bash
pnpm --filter @kace/error-codes tests
pnpm --filter @kace/api-common test -- tests/http_responses/PublicErrorResponse.test.js tests/http_responses/AuthFailResponse.test.js tests/http_responses/HttpResponse.test.js tests/http_responses/SuppressedErrorLogging.test.js tests/middleware/withTenantContextDbTarget.test.js tests/controllers/baseControllerGetGlobalConfig.test.js
```

If api-common script does not accept a path that way, run:

```bash
cd packages/kace_cloud_api_common && node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit tests/http_responses/PublicErrorResponse.test.js tests/http_responses/AuthFailResponse.test.js tests/http_responses/HttpResponse.test.js tests/http_responses/SuppressedErrorLogging.test.js tests/middleware/withTenantContextDbTarget.test.js tests/controllers/baseControllerGetGlobalConfig.test.js
```

Expected: PASS.

Then run one core file that imported ErrorCodes:

```bash
cd packages/kace_cloud_core && node --experimental-vm-modules --max-old-space-size=6144 node_modules/jest/bin/jest.js tests/shared/validation/UniquenessValidator.test.js tests/boards/BoardBulkActionsPolicy.test.js --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core packages/kace_cloud_api_common pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
refactor(core): consume public error codes from @kace/error-codes

EOF
)"
```

Do not stage `ErrorCodes.js` deletion in this commit. Strip Cursor trailers if present.

---

### Task 5: Cut over apiv1

**Files:**
- Modify `package.json` of each app below: add `"@kace/error-codes": "workspace:*"`
- Modify imports from `@kace/core/src/shared/errors/ErrorCodes.js` → `@kace/error-codes`
- Modify hardcoded remapped literals in the listed tests

**Interfaces:**
- Consumes: `@kace/error-codes` from Tasks 2–3
- Produces: no apiv1 import of `@kace/core/src/shared/errors/ErrorCodes.js`

Apps that import ErrorCodes (need the dependency):

- `apps/apiv1/kace_cloud_api_workspaces`
- `apps/apiv1/kace_cloud_api_users`
- `apps/apiv1/kace_cloud_api_template_attachments`
- `apps/apiv1/kace_cloud_api_metrics`
- `apps/apiv1/kace_cloud_api_interactions_batch`
- `apps/apiv1/kace_cloud_api_interactions`
- `apps/apiv1/kace_cloud_api_group`
- `apps/apiv1/kace_cloud_api_geolocation`
- `apps/apiv1/kace_cloud_api_dashboard_counts_refresh`
- `apps/apiv1/kace_cloud_api_custom_lists`
- `apps/apiv1/kace_cloud_api_classifications`
- `apps/apiv1/kace_cloud_api_case_re_open`
- `apps/apiv1/kace_cloud_api_broker_mapper`
- `apps/apiv1/kace_cloud_api_broker`
- `apps/apiv1/kace_cloud_api_case_clone`
- `apps/apiv1/kace_cloud_api_boards`
- `apps/apiv1/kace_cloud_api_appointments`

Import files (source + tests) in those apps that contain `@kace/core/src/shared/errors/ErrorCodes.js`.

Literal-only tests (no package dep required unless they also import):

| File | Old | New |
|------|-----|-----|
| `apps/apiv1/kace_cloud_api_helps_attachments/test/helpsAttachmentsCreateResponse.test.mjs` | `'0x0C0001'` | `'0x120001'` |
| `apps/apiv1/kace_cloud_api_cases/test/lockCaseDescriptionEdit.test.mjs` | `'0x03000D'` | `'0x030013'` (also rename the `it(...)` title) |
| `apps/apiv1/kace_cloud_api_interactions_bulk/test/handler.test.mjs` | `'0x050004'` | `'0x050002'` |
| `apps/apiv1/kace_cloud_api_cases_bulk/test/handler.test.mjs` | `'0x050004'` | `'0x050002'` |

- [ ] **Step 1: Add deps, replace imports, replace the four literal files**

```bash
pnpm install
```

- [ ] **Step 2: Prove no apiv1 ErrorCodes import remains**

```bash
rg "shared/errors/ErrorCodes" apps/apiv1
```

Expected: no matches.

- [ ] **Step 3: Run the affected apiv1 tests**

```bash
cd apps/apiv1/kace_cloud_api_group && node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit tests/GroupCreateErrorResponse.test.mjs
cd apps/apiv1/kace_cloud_api_broker_mapper && node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit tests/BrokerMapperValidationResponse.test.mjs
cd apps/apiv1/kace_cloud_api_helps_attachments && node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit test/helpsAttachmentsCreateResponse.test.mjs
cd apps/apiv1/kace_cloud_api_cases && node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit test/lockCaseDescriptionEdit.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/apiv1 pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
refactor(apiv1): import public error codes from @kace/error-codes

EOF
)"
```

Strip Cursor trailers if present.

---

### Task 6: Cut over kace-saas + delete old dictionaries

**Files:**
- Modify: `apps/kace-saas/package.json` — add `"@kace/error-codes": "workspace:*"` next to `"@kace/file-extensions"`
- Modify: `apps/kace-saas/vite.config.js` — `test.server.deps.inline` becomes `["@kace/plugins", "@kace/file-extensions", "@kace/error-codes"]`
- Modify FE imports from `@/errors/publicErrorCodes` → `@kace/error-codes`
- Modify `apps/kace-saas/src/utils/getTranslatedError.js`: `getPublicErrorCodeI18nKey(code)` → `getPublicErrorCodeI18nKey(code, 'app.errors.public')` (FE owns the namespace)
- Modify remapped FE literals (list below)
- Create: `apps/kace-saas/src/errors/publicErrorCodeI18n.test.js`
- Delete: `apps/kace-saas/src/errors/publicErrorCodes.js`
- Delete: `apps/kace-saas/src/errors/publicErrorCodes.test.js`
- Delete: `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js`
- Delete: `packages/kace_cloud_core/tests/shared/errors/ErrorCodes.test.js`

**Interfaces:**
- Consumes: package helpers + `PUBLIC_ERROR_CODES` from Tasks 2–3
- Produces: FE and BE have a single catalog; old dictionary files are gone

FE import files:

- `apps/kace-saas/src_v2/features/boards/pages/BoardsResources.jsx`
- `apps/kace-saas/src_v2/features/boards/hooks/useBoardResourceActions.hook.js`
- `apps/kace-saas/src_v2/features/boards/hooks/useBoard.hook.js`
- `apps/kace-saas/src/utils/src/services/authErrorCode.js`
- `apps/kace-saas/src/utils/src/services/authErrorCode.test.js`
- `apps/kace-saas/src/utils/apiAuthEvents.js`
- `apps/kace-saas/src/utils/getTranslatedError.js`
- `apps/kace-saas/src/utils/getTranslatedError.test.js`
- `apps/kace-saas/src/pages/TimeSlots/hooks/useTimeSlotsUpdate.js`
- `apps/kace-saas/src/pages/TimeSlots/hooks/useTimeSlotsUpdate.test.js`
- `apps/kace-saas/src/pages/Literal/helpers.js`
- `apps/kace-saas/src/pages/Helps/hooks/useHelpAttachments.js`
- `apps/kace-saas/src/pages/Helps/hooks/useHelpAttachments.test.js`
- `apps/kace-saas/src/pages/Group/utils/resolveGroupDeleteErrorMessage.spec.js`
- `apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.js`
- `apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.spec.js`
- `apps/kace-saas/src/pages/Classifications/hooks/useRelationshipAction.js`
- `apps/kace-saas/src/pages/Classifications/hooks/useRelationshipAction.test.js`
- `apps/kace-saas/src/pages/ExportAndIMportAuxiliaries/ExportAuxiliaries.jsx`
- `apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.test.jsx`
- `apps/kace-saas/src/pages/Classifications/ClassificationsAssingFormHandler.test.jsx`
- `apps/kace-saas/src/pages/Classifications/ClassificationsAssingFormHandler.jsx`

FE remapped literals (do not touch `0x070007`, `0x070002`, `0x050001`):

| File | Old | New |
|------|-----|-----|
| `apps/kace-saas/src/utils/getTranslatedError.test.js` | `"0x0C0001"` | `"0x120001"` |
| `apps/kace-saas/src/pages/Helps/components/HelpsAttachments.test.jsx` | `"0x0C0001"` | `"0x120001"` |
| `apps/kace-saas/src/pages/Helps/HelpsUpdate.test.jsx` | `"0x0C0001"` | `"0x120001"` |
| `apps/kace-saas/src/components/core/Attachment/components/FileList.test.jsx` | `"0x0C0001"` | `"0x120001"` |
| `apps/kace-saas/src/pages/Broker/Mappers/components/MappersCreate.spec.jsx` | `"0x030028"` | `"0x030040"` |

- [ ] **Step 1: Write failing thin i18n test**

Create `apps/kace-saas/src/errors/publicErrorCodeI18n.test.js` (Vitest, same assertions as the old mapper copy test):

```js
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("public error code i18n", () => {
    it("publishes exact mapper validation guidance in English and Spanish", () => {
        const testDir = path.dirname(fileURLToPath(import.meta.url));
        const localeDir = path.resolve(testDir, "../locale");
        const en = JSON.parse(readFileSync(path.join(localeDir, "en.json"), "utf8"));
        const es = JSON.parse(readFileSync(path.join(localeDir, "es.json"), "utf8"));

        expect(en.app.errors.public.BROKER_MAPPER_VALIDATION_FAILED).toBe(
            "Complete the mapper name and REST flow, and complete every field in each added mapping rule.",
        );
        expect(es.app.errors.public.BROKER_MAPPER_VALIDATION_FAILED).toBe(
            "Completa el nombre y el flujo REST del mapper, y todos los campos de cada regla de mapeo agregada.",
        );
        expect(en.broker.mappers.requiredFieldsGuidance).toBe(
            "Fields marked with * are required. Every added mapping rule must be complete.",
        );
        expect(es.broker.mappers.requiredFieldsGuidance).toBe(
            "Los campos marcados con * son obligatorios. Cada regla de mapeo agregada debe estar completa.",
        );
    });
});
```

- [ ] **Step 2: Add dep, inline Vite, switch imports, update literals, delete old files**

Delete only after imports no longer reference them.

- [ ] **Step 3: Verify old origins are gone**

```bash
rg "shared/errors/ErrorCodes" --glob '!docs/**' --glob '!**/node_modules/**'
rg "publicErrorCodes" --glob '!docs/**' --glob '!**/node_modules/**'
```

Expected: no source/test matches. `publicErrorCodeI18n.test.js` is allowed (different filename).

- [ ] **Step 4: Run FE and package tests (expect pass)**

```bash
pnpm --filter @kace/error-codes tests
cd apps/kace-saas && pnpm exec vitest run src/errors/publicErrorCodeI18n.test.js src/utils/getTranslatedError.test.js src/utils/src/services/authErrorCode.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas packages/kace_cloud_core/src/shared/errors/ErrorCodes.js packages/kace_cloud_core/tests/shared/errors/ErrorCodes.test.js pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
refactor(saas): cut over public error codes and remove old dictionaries

EOF
)"
```

Strip Cursor trailers if present.

---

### Task 7: Final verification

**Files:**
- None to create. Read-only sweep + leftover literal hunt.

**Interfaces:**
- Consumes: completed Tasks 1–6
- Produces: proof the spec checklist is met

- [ ] **Step 1: Hunt leftover old origins and remapped literals**

```bash
rg "shared/errors/ErrorCodes" --glob '!docs/**' --glob '!**/node_modules/**'
rg "from [\"']@/errors/publicErrorCodes" --glob '!docs/**' --glob '!**/node_modules/**'
rg "0x03000[A-Fa-f]|0x0C0001|0x0F0001|0x050008|0x050009" --glob '!docs/**' --glob '!**/node_modules/**'
```

Expected: no matches. (`0x050008` / `0x050009` are old HTTP values and must not remain.)

Also confirm these new values exist in the package only as intended:

```bash
rg "0x120001|0x150001|0x030040|0x050002" packages/kace_cloud_error_codes
```

Expected: matches in catalog + tests.

- [ ] **Step 2: Re-run package tests**

```bash
pnpm --filter @kace/error-codes tests
```

Expected: PASS.

- [ ] **Step 3: Commit only if Step 1 found leftovers you had to fix**

If the sweep is clean, do not create an empty commit.

---

## Self-review (author)

**Spec coverage**

| Spec requirement | Task |
|------------------|------|
| Package `@kace/error-codes` 1.24.3, no runtime deps | 1 |
| Category files + reserved prefixes, no empty modules | 2 |
| Literals `0x` + 6 decimal digits | 2 |
| `assembleCatalog` throw on duplicate name/code | 1–2 |
| Helpers + pattern + reject hex letters / bare digits / `0X` | 3 |
| `find` is shape-only | 3 |
| `getI18nKey(code, namespace)` required namespace; copy stays in FE | 3, 6 |
| Full remap table | 1–2 |
| Hard cutover, no facade | 4–6 |
| All listed imports | 4–6 |
| Vite inline | 6 |
| Thin i18n test, delete scrape mirror | 6 |
| Delete `ErrorCodes.js` / `publicErrorCodes.js` | 6 |
| HTTP / files / tenant literal updates | 4–6 |
| No new e2e / no i18n copy changes | (out of scope, no task) |

**Placeholder scan:** none.

**Type consistency:** helper names and catalog maps are identical from Task 1 through Task 6 (`normalizePublicErrorCode`, `PUBLIC_ERROR_CODES`, `assembleCatalog`).
