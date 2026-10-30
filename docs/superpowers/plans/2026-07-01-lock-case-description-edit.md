# Lock Case Description Edit via Global Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject case-description updates from the with-auxiliary API and disable the OS plugin's `RichTextEditor` when a new `lock_case_description_edit` flag is enabled in `global_configurations` Behaviors.

**Architecture:** Server-side enforcement lives in the `actionUpdateWithAux` controller in `apps/apiv1/kace_cloud_api_cases/src/controller.mjs`, gated on the new flag plus a present `payload.description`. A new `CaseDescriptionEditLockedError` carrying `publicCode: CASE_DESCRIPTION_EDIT_LOCKED` is thrown before any side effect. Client-side, the OS plugin's `useRichTextEditor` hook reads the same flag and the `RichTextEditor` consumes a `disabled` prop, while `caseService.submitCaseData` skips the description block in the update payload when the flag is active.

**Tech Stack:** Node.js (Jest for the API, Vitest/jsdom for the OS plugin), shared `kace_cloud_core` package, existing `global_configurations` Behaviors schema.

**Branch:** `feat/lock-case-description-edit-via-global-config` (already created from `origin/develop` at `692d9d04`).

**Spec:** `docs/superpowers/specs/2026-07-01-lock-case-description-edit-design.md`

---

## File Structure

### New files

- `packages/kace_cloud_core/src/shared/errors/CaseDescriptionEditLockedError.js` — error class extending `CustomError`, carrying the new public code.

### Modified files

- `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` — register `CASE_DESCRIPTION_EDIT_LOCKED = '0x03000D'`.
- `packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js` — whitelist `lock_case_description_edit: false` under `application.agente.casos`.
- `apps/apiv1/kace_cloud_api_cases/src/controller.mjs` — gate the `CaseDescriptionUpdater` call in `actionUpdateWithAux` on the new flag.
- `apps/onescript_plugin_kace/src/plugins/kace/data/constants.js` — add `LOCK_CASE_DESCRIPTION_EDIT` to `GLOBAL_CONFIG_PATHS`.
- `apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.js` — read the flag, expose `locked` boolean.
- `apps/onescript_plugin_kace/src/plugins/kace/components/rich-text-editor/RichTextEditor.jsx` — pass `disabled={locked}` to the editor wrapper.
- `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js` — skip `caseData.description` assignment in the update path when the flag is active.

### New test files

- `apps/apiv1/kace_cloud_api_cases/test/lockCaseDescriptionEdit.test.mjs` — Jest unit test for the controller.
- `apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.test.js` — Vitest unit test for the hook.
- Extend `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.test.js` — new `describe` block for the description-strip behavior.

---

## Task 1: Add the Public Error Code constant

**Files:**
- Modify: `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js`

- [ ] **Step 1: Open `ErrorCodes.js` and find the validation block (0x03NNNN)**

The block starts at the `export const VALIDATION_ERROR = '0x030001';` line. The last code in this block is `export const INTERACTION_EMAIL_ALREADY_LINKED = '0x03000C';`. The next free code is `0x03000D`.

- [ ] **Step 2: Add the new constant at the end of the validation block**

Add this line right after the `INTERACTION_EMAIL_ALREADY_LINKED` line:

```javascript
export const CASE_DESCRIPTION_EDIT_LOCKED = '0x03000D';
```

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_core/src/shared/errors/ErrorCodes.js
git commit -m "feat(public-errors): register CASE_DESCRIPTION_EDIT_LOCKED (0x03000D)"
```

---

## Task 2: Add the CaseDescriptionEditLockedError class

**Files:**
- Create: `packages/kace_cloud_core/src/shared/errors/CaseDescriptionEditLockedError.js`

- [ ] **Step 1: Create the error class file**

Write the following content to `packages/kace_cloud_core/src/shared/errors/CaseDescriptionEditLockedError.js`:

```javascript
import { CustomError } from './CustomError.js';
import { CASE_DESCRIPTION_EDIT_LOCKED } from './ErrorCodes.js';

export class CaseDescriptionEditLockedError extends CustomError {
    constructor(message = 'Case description editing is locked by global configuration', fields = []) {
        super(message, 400, fields, CASE_DESCRIPTION_EDIT_LOCKED);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/kace_cloud_core/src/shared/errors/CaseDescriptionEditLockedError.js
git commit -m "feat(shared): add CaseDescriptionEditLockedError"
```

---

## Task 3: Whitelist the new flag in the Behaviors schema

**Files:**
- Modify: `packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js`

- [ ] **Step 1: Locate the `application.agente.casos` block**

In `Behaviors.js`, find the `casos:` section under `agente:`. It contains keys like `case_require_state_change`, `allow_description_empty`, `async_case_post_processing`, etc.

- [ ] **Step 2: Add the new key to the `casos` block**

Insert the following line as a new key inside the `casos` object (the order does not matter, but place it next to the other description-related flag for readability — right after `allow_description_empty`):

```javascript
                    lock_case_description_edit: false,
```

The full snippet around the insertion should look like:

```javascript
                    allow_description_empty: null,
                    lock_case_description_edit: false,
                    cast_type: null,
```

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js
git commit -m "fix(global-config): whitelist lock_case_description_edit in Behaviors schema"
```

---

## Task 4: Enforce the lock in the API controller (TDD)

**Files:**
- Create: `apps/apiv1/kace_cloud_api_cases/test/lockCaseDescriptionEdit.test.mjs`
- Modify: `apps/apiv1/kace_cloud_api_cases/src/controller.mjs`

- [ ] **Step 1: Write the failing test**

Create `apps/apiv1/kace_cloud_api_cases/test/lockCaseDescriptionEdit.test.mjs` with the following content. The test mirrors the `advanceSearchAuthorization.test.mjs` mocking pattern (`jest.unstable_mockModule`) and exercises `actionUpdateWithAux` in three scenarios.

```javascript
import { jest } from '@jest/globals';

const getGlobalConfigMock = jest.fn();
const caseDescriptionUpdaterExecute = jest.fn();

class CaseDescriptionEditLockedError extends Error {
    constructor() {
        super('Case description editing is locked by global configuration');
        this.statusCode = 400;
        this.publicErrorCode = '0x03000D';
    }
}

const HttpResponse = {
    ok: (payload) => ({ statusCode: 200, ...payload }),
    forbidden: (payload) => ({ statusCode: 403, ...payload }),
    validationsFail: (payload) => ({ statusCode: 400, ...payload }),
    internalServerError: (payload) => ({ statusCode: 500, ...payload }),
    badRequest: (payload) => ({ statusCode: 400, ...payload }),
};

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: class {
        constructor(event, knexConfig) {
            this.event = event;
            this.user = event.__user;
            this.repository = {};
            this.database_connection = knexConfig;
            this.payload = () => JSON.parse(this.event.body || '{}');
            this.pathParameters = () => event.pathParameters || {};
            this.validateId = () => true;
            this.validatePayload = () => ({ value: {}, error: null });
            this.getGlobalConfig = getGlobalConfigMock;
        }
        getActionExecutionService() {
            return {};
        }
    },
    HttpResponse,
    objectIdentityErrorResponse: (error) =>
        error instanceof CaseDescriptionEditLockedError
            ? HttpResponse.validationsFail({ errors: error.message, publicErrorCode: error.publicErrorCode })
            : null,
}));

jest.unstable_mockModule('@kace/core/src/case-descriptions/index.js', () => ({
    CaseDescriptionUpdater: class {
        constructor() {}
        async execute() {
            caseDescriptionUpdaterExecute();
        }
    },
}));

const { Controller } = await import('../src/controller.mjs');

const makeController = (payloadOverrides = {}, globalConfig = {}) => {
    getGlobalConfigMock.mockResolvedValue(globalConfig);
    caseDescriptionUpdaterExecute.mockClear();
    const event = {
        body: JSON.stringify({
            case: { id: 'case-123' },
            aux_cases: {},
            ...payloadOverrides,
        }),
        __user: { hasPermission: () => true, id: { value: 'u1' } },
        pathParameters: { id: 'case-123' },
    };
    const knexConfig = { client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true };
    return new Controller(event, knexConfig);
};

describe('actionUpdateWithAux description lock', () => {
    it('throws when flag is active and payload contains description', async () => {
        const controller = makeController(
            {
                description: { id: 'desc-1', descripcion: 'new' },
            },
            { behaviors: { application: { agente: { casos: { lock_case_description_edit: true } } } } }
        );

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(400);
        expect(response.publicErrorCode).toBe('0x03000D');
        expect(caseDescriptionUpdaterExecute).not.toHaveBeenCalled();
    });

    it('does not throw when flag is active but payload has no description', async () => {
        const controller = makeController(
            {},
            { behaviors: { application: { agente: { casos: { lock_case_description_edit: true } } } } }
        );

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(caseDescriptionUpdaterExecute).not.toHaveBeenCalled();
    });

    it('proceeds normally when flag is inactive and payload contains description', async () => {
        const controller = makeController(
            {
                description: { id: 'desc-1', descripcion: 'new' },
            },
            { behaviors: { application: { agente: { casos: { lock_case_description_edit: false } } } } }
        );

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);
        expect(caseDescriptionUpdaterExecute).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter kace_cloud_api_cases jest test/lockCaseDescriptionEdit.test.mjs`
Expected: FAIL — the current controller does not consult the global config, so the first test will not see the new error.

- [ ] **Step 3: Add the lock check in `actionUpdateWithAux`**

In `apps/apiv1/kace_cloud_api_cases/src/controller.mjs`, locate the block that calls `new CaseDescriptionUpdater(...).execute(...)` (around line 1046-1053). The current code looks like:

```javascript
            if (payload.description) {
                const caseDescriptionUpdater = new CaseDescriptionUpdater(
                    this.descriptionRepository,
                    this.repository,
                    this.user
                );
                await caseDescriptionUpdater.execute(payload.description.id, payload.description);
            }
```

Add the import at the top of the file alongside the other error imports:

```javascript
import { CaseDescriptionEditLockedError } from '@kace/core/src/shared/errors/CaseDescriptionEditLockedError.js';
```

Then add a helper property on the controller for getting the lock flag (or reuse `this.getGlobalConfig()` which is already inherited from `BaseController` per the `getGlobalConfig` mock setup). The check before the `CaseDescriptionUpdater` instantiation is:

```javascript
            if (payload.description) {
                const globalConfig = await this.getGlobalConfig();
                const descriptionLockActive =
                    globalConfig?.behaviors?.application?.agente?.casos?.lock_case_description_edit === true;
                if (descriptionLockActive) {
                    throw new CaseDescriptionEditLockedError();
                }

                const caseDescriptionUpdater = new CaseDescriptionUpdater(
                    this.descriptionRepository,
                    this.repository,
                    this.user
                );
                await caseDescriptionUpdater.execute(payload.description.id, payload.description);
            }
```

Note: `this.getGlobalConfig()` is already used elsewhere in the same file at line 1011 for `TransitionStaleChecker.check` — that is the exact same call pattern. The base `BaseController` is what defines this method.

- [ ] **Step 4: Re-run the test to confirm it passes**

Run: `pnpm --filter kace_cloud_api_cases jest test/lockCaseDescriptionEdit.test.mjs`
Expected: PASS — three green tests.

- [ ] **Step 5: Run the rest of the API test suite to confirm no regression**

Run: `pnpm --filter kace_cloud_api_cases jest`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/apiv1/kace_cloud_api_cases/test/lockCaseDescriptionEdit.test.mjs apps/apiv1/kace_cloud_api_cases/src/controller.mjs
git commit -m "feat(case-descriptions-api): enforce lock policy in actionUpdateWithAux"
```

---

## Task 5: Expose the new flag constant in the OS plugin (TDD for the hook)

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/data/constants.js`
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.test.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.js`

- [ ] **Step 1: Add the constant to `GLOBAL_CONFIG_PATHS`**

In `apps/onescript_plugin_kace/src/plugins/kace/data/constants.js`, find the `GLOBAL_CONFIG_PATHS` object and add a new key after `ALLOW_DESCRIPTIONS_EMPTY`:

```javascript
  ALLOW_DESCRIPTIONS_EMPTY:
    'config.global_config.behaviors.application.agente.casos.allow_description_empty',
  LOCK_CASE_DESCRIPTION_EDIT:
    'config.global_config.behaviors.application.agente.casos.lock_case_description_edit',
```

- [ ] **Step 2: Write the failing test for the hook**

Create `apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.test.js`:

```javascript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import useRichTextEditor from './useRichTextEditor.js';

const mocks = vi.hoisted(() => ({
    useEventData: vi.fn(),
    useGlobalConfig: vi.fn(),
    storeGet: vi.fn(),
    userCanEditCaseSync: vi.fn(() => true),
}));

vi.mock('#plugins/kace/hooks/useEventData.js', () => ({
    default: () => ({
        descriptionLoading: false,
        data: { cases: { case_data: { id: 'case-1', descripcion_caso: { descripcion: 'init' } } } },
    }),
}));

vi.mock('#plugins/kace/hooks/useGlobalConfig.js', () => ({
    useGlobalConfig: mocks.useGlobalConfig,
}));

vi.mock('../KaceEngine.js', () => ({
    KaceEngine: () => ({
        getService: (name) => {
            if (name === 'storeService') return { get: mocks.storeGet };
            if (name === 'user') return { canEditCaseSync: mocks.userCanEditCaseSync };
            return null;
        },
    }),
}));

import { GLOBAL_CONFIG_PATHS } from '#plugins/kace/data/constants.js';

afterEach(() => {
    vi.clearAllMocks();
});

describe('useRichTextEditor — lock_case_description_edit', () => {
    beforeEach(() => {
        mocks.storeGet.mockImplementation((key) => {
            if (key === 'cases.case_data') {
                return { id: 'case-1', descripcion_caso: { descripcion: 'init' } };
            }
            return null;
        });
    });

    it('returns locked=true when the flag is true and the case is being updated', () => {
        mocks.useGlobalConfig.mockImplementation((_onEvent, path) => {
            if (path === GLOBAL_CONFIG_PATHS.LOCK_CASE_DESCRIPTION_EDIT) return true;
            return null;
        });

        const { result } = renderHook(() => useRichTextEditor(vi.fn(), vi.fn()));

        expect(result.current.locked).toBe(true);
    });

    it('returns locked=false when the flag is false', () => {
        mocks.useGlobalConfig.mockReturnValue(false);

        const { result } = renderHook(() => useRichTextEditor(vi.fn(), vi.fn()));

        expect(result.current.locked).toBe(false);
    });

    it('returns locked=false when the flag is absent and the case is being created', () => {
        mocks.storeGet.mockImplementation((key) => {
            if (key === 'cases.case_data') return { descripcion_caso: { descripcion: '' } };
            return null;
        });
        mocks.useGlobalConfig.mockReturnValue(null);

        const { result } = renderHook(() => useRichTextEditor(vi.fn(), vi.fn()));

        expect(result.current.locked).toBe(false);
    });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `pnpm --filter onescript_plugin_kace vitest run src/plugins/kace/hooks/useRichTextEditor.test.js`
Expected: FAIL — `result.current.locked` is `undefined`.

- [ ] **Step 4: Update `useRichTextEditor` to read the flag and expose `locked`**

In `apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.js`, add a new `useGlobalConfig` call right after the existing `allowedDescriptionEmptyFromStore` block (around line 50):

```javascript
  const lockCaseDescriptionEdit = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.LOCK_CASE_DESCRIPTION_EDIT
  );
```

Then, just before the `return` statement (around line 136), compute the `locked` boolean:

```javascript
  const locked = isUpdate && lockCaseDescriptionEdit === true;
```

And add `locked` to the returned object (the `return` block at line 136-150):

```javascript
  return {
    editorRef,
    activeFormats,
    disabledDescription,
    locked,
    showDescription,
    /**
     * Valor efectivo de `show_description` (null = aún sin `global_config` en store).
     */
    showDescriptionFromStore,
    descriptionLoading,
    handleFormat,
    handleInput,
    handleKeyUp,
    handleMouseUp,
  };
```

- [ ] **Step 5: Re-run the test to confirm it passes**

Run: `pnpm --filter onescript_plugin_kace vitest run src/plugins/kace/hooks/useRichTextEditor.test.js`
Expected: PASS — three green tests.

- [ ] **Step 6: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/data/constants.js apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.js apps/onescript_plugin_kace/src/plugins/kace/hooks/useRichTextEditor.test.js
git commit -m "feat(os-plugin): expose lock_case_description_edit from useRichTextEditor"
```

---

## Task 6: Wire the disabled prop in RichTextEditor

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/rich-text-editor/RichTextEditor.jsx`

- [ ] **Step 1: Pull `locked` from the hook and pass it to the editor wrapper**

In `RichTextEditor.jsx`, in the destructuring of the hook (line 19-30), add `locked` to the list of fields pulled from the hook:

```jsx
  const {
    editorRef,
    activeFormats,
    disabledDescription,
    locked,
    showDescription,
    showDescriptionFromStore,
    descriptionLoading,
    handleFormat,
    handleInput,
    handleKeyUp,
    handleMouseUp,
  } = useRichTextEditor(updateValue, onEvent);
```

In the returned JSX, the editor wrapper already receives `disabled || disabledDescription` on the toolbar (line 99) and on the `contentEditable` attribute (line 105). Extend both checks to include `locked` so the same `kace-component--disabled` styling applies:

```jsx
            <EditorToolbar
              activeFormats={activeFormats}
              onFormat={handleFormat}
              disabled={disabled || disabledDescription || locked}
            />

            <div
              ref={editorRef}
              className="editor-content"
              contentEditable={!(disabled || disabledDescription || locked)}
              onInput={handleInput}
              onKeyUp={handleKeyUp}
              onMouseUp={handleMouseUp}
              data-placeholder={''}
              suppressContentEditableWarning={true}
              style={{ minHeight: '200px' }}
            />
```

- [ ] **Step 2: Run the OS plugin test suite to confirm no regression**

Run: `pnpm --filter onescript_plugin_kace vitest run`
Expected: all existing tests pass (no behavioral change for cases where the flag is absent or false).

- [ ] **Step 3: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/rich-text-editor/RichTextEditor.jsx
git commit -m "feat(os-plugin): force RichEditor readOnly when lock_case_description_edit is true"
```

---

## Task 7: Strip description from the update payload in caseService (TDD)

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.test.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js`

- [ ] **Step 1: Add the failing test inside `caseService.test.js`**

Append a new `describe` block at the end of `caseService.test.js` (after the existing `CaseService.applyEmbeddedPayloadFlags` block). The new block tests the update payload behavior under the new flag.

First, add the import for the path constant at the top of the file, right after the existing `vitest` import:

```javascript
import { GLOBAL_CONFIG_PATHS } from '#plugins/kace/data/constants.js';
```

Then append the new describe block:

```javascript
describe('CaseService.submitCaseData description lock', () => {
    const buildService = (globalConfig) => {
        const apiPost = vi.fn().mockResolvedValue({ data: { data: { id: 'case-123' } } });
        const service = new CaseService({
            apiService: { post: apiPost },
            store: {},
        });
        service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
        service.storeService = {
            get: vi.fn((key) => {
                if (key === 'cases.case_id') return 'case-123';
                if (key === 'config.global_config') return globalConfig;
                return null;
            }),
            set: vi.fn(),
        };
        return { service, apiPost };
    };

    const updateCaseData = () => ({
        case: {
            id: 'case-123',
            cliente_id: 'client-1',
            transicion_id: 't-1',
            clasificacion_id: 'c-1',
            responsable_id: 'u-1',
            descripcion_caso_id: 'd-1',
            grupo_id: 'g-1',
        },
        aux_cases: { caso_id: 'case-123', data: {} },
    });

    it('omits description from the update payload when lock_case_description_edit is true', async () => {
        const { service, apiPost } = buildService({
            behaviors: {
                application: { agente: { casos: { lock_case_description_edit: true } } },
            },
        });

        await service.submitCaseData({
            caseData: updateCaseData(),
            description: 'should-not-be-sent',
        });

        const [, body] = apiPost.mock.calls[0];
        expect(body).not.toHaveProperty('description');
    });

    it('includes description in the update payload when the flag is false', async () => {
        const { service, apiPost } = buildService({
            behaviors: {
                application: { agente: { casos: { lock_case_description_edit: false } } },
            },
        });

        await service.submitCaseData({
            caseData: updateCaseData(),
            description: 'sent-as-usual',
        });

        const [, body] = apiPost.mock.calls[0];
        expect(body).toHaveProperty('description');
        expect(body.description).toEqual({ id: 'd-1', descripcion: 'sent-as-usual' });
    });

    it('includes description in the create payload even when the flag is true', async () => {
        const apiPost = vi.fn().mockResolvedValue({ data: { data: { id: 'case-123' } } });
        const service = new CaseService({
            apiService: { post: apiPost },
            store: {},
        });
        service.uploadPendingCaseAttachments = vi.fn().mockResolvedValue();
        service.storeService = {
            get: vi.fn((key) => {
                if (key === 'cases.generated_case_id') return 'case-123';
                if (key === 'config.global_config') {
                    return {
                        behaviors: {
                            application: { agente: { casos: { lock_case_description_edit: true } } },
                        },
                    };
                }
                return null;
            }),
            set: vi.fn(),
        };

        await service.submitCaseData({
            caseData: {
                case: { id: 'case-123', descripcion_caso_id: 'd-1' },
                aux_cases: { caso_id: 'case-123', data: {} },
            },
            description: 'created-with-description',
        });

        const [, body] = apiPost.mock.calls[0];
        expect(body).toHaveProperty('description');
        expect(apiPost.mock.calls[0][0]).toBe('/cases/auxiliary');
    });
});
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `pnpm --filter onescript_plugin_kace vitest run src/plugins/kace/services/caseService.test.js`
Expected: FAIL — the first test will see `body.description` populated, the others may pass by accident.

- [ ] **Step 3: Update `submitCaseData` to skip the description block**

In `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js`, locate the block that sets `caseData.description` (lines 401-404):

```javascript
      caseData.description = {
        id: caseData.case.descripcion_caso_id,
        descripcion: description,
      };
```

Wrap that block in a guard that consults the global config and the `isUpdate` flag. The `isUpdate` variable already exists at line 377, and `storeService` is available in scope.

First, add the helper at the top of `submitCaseData`, right after the `caseId` / `isUpdate` block (after line 380):

```javascript
      const globalConfig = storeService?.get?.('config.global_config');
      const lockCaseDescriptionEdit =
        globalConfig?.behaviors?.application?.agente?.casos?.lock_case_description_edit === true;
```

Then change the description block to:

```javascript
      if (!(isUpdate && lockCaseDescriptionEdit)) {
        caseData.description = {
          id: caseData.case.descripcion_caso_id,
          descripcion: description,
        };
      }
```

- [ ] **Step 4: Re-run the test to confirm it passes**

Run: `pnpm --filter onescript_plugin_kace vitest run src/plugins/kace/services/caseService.test.js`
Expected: PASS — three green tests.

- [ ] **Step 5: Run the full OS plugin test suite to confirm no regression**

Run: `pnpm --filter onescript_plugin_kace vitest run`
Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js apps/onescript_plugin_kace/src/plugins/kace/services/caseService.test.js
git commit -m "feat(os-plugin): strip description from update payload when lock is active"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the API test suite**

Run: `pnpm --filter kace_cloud_api_cases jest`
Expected: all tests pass (existing + new lock test).

- [ ] **Step 2: Run the OS plugin test suite**

Run: `pnpm --filter onescript_plugin_kace vitest run`
Expected: all tests pass (existing + new lock tests).

- [ ] **Step 3: Run the shared core test suite for the Behaviors schema**

Run: `pnpm --filter kace_cloud_core test -- --testPathPattern global-config`
Expected: all tests pass — the new whitelist key does not break the Behaviors aggregator.

- [ ] **Step 4: Confirm the working tree only contains the intended changes**

Run: `git status`
Expected: a clean working tree with the seven commits created by Tasks 1-7, no untracked files related to this feature (untracked files from the previous abandoned branch may remain — leave them alone, do not commit them).

- [ ] **Step 5: Push the branch and open a PR**

Run: `git push -u origin feat/lock-case-description-edit-via-global-config`
Then create a PR targeting `develop` (not `main`) with the title `feat: lock case description edit via global config` and the body summarizing the design doc.

---

## Self-Review

- **Spec coverage:**
  - Decision 1 (flag key + path): Task 3 ✅
  - Decision 2 (Public Error Code): Tasks 1 + 2 ✅
  - Decision 3 (controller enforcement): Task 4 ✅
  - Decision 4a (readOnly editor in OS plugin): Tasks 5 + 6 ✅
  - Decision 4b (skip description in payload): Task 7 ✅
  - Decision 5 (test coverage): Tasks 4 (API), 5 (hook), 7 (service) ✅
  - Behavior section (configuration storage, API behavior, OS plugin editor, OS plugin payload, error contract): all tasks together ✅
  - Files to change: covered in Task 1-7 file lists ✅

- **Placeholder scan:** no TBD, TODO, or hand-wavy steps. Every code step shows the full code to add.

- **Type consistency:**
  - `locked` is defined in Task 5 (hook return) and consumed in Task 6 (JSX) — same name ✅
  - `CaseDescriptionEditLockedError` is defined in Task 2 and thrown in Task 4 — same import path ✅
  - `GLOBAL_CONFIG_PATHS.LOCK_CASE_DESCRIPTION_EDIT` is added in Task 5 step 1 and consumed in Task 5 step 4 — same key ✅
  - `lock_case_description_edit` field name is consistent across Task 3 (schema), Task 4 (controller check), Task 5 (hook read), Task 7 (service check) ✅
