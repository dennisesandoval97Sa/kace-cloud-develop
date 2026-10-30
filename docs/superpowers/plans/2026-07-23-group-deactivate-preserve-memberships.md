# Group Deactivate Preserve Memberships — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al inactivar un grupo, conservar `rel_usuarios_grupos`; si hay usuarios con ese `grupo_activo`, devolver 400 tipado con listado (nombre/email) y mostrar un diálogo informativo responsive sin opción de desalojo forzado.

**Architecture:** Quitar `GroupRelationsCleaner` del path de deactivate en `GroupUpdater`. Ampliar `GroupUsageGuard` + repo de users para listar bloqueadores. Serializar el error vía `Response` con `publicErrorCode` + `publicData` + `exposePublicErrorDetails` (si no, producción oculta `errors`/mensaje). En SaaS, detectar el código y abrir un `AlertDialog` informativo.

**Tech Stack:** Jest (`@kace/core`), Vitest (`kace-saas`), Knex, React, Radix AlertDialog, i18n (`locale/es.json` + `en.json`).

---

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-group-deactivate-preserve-memberships-design.md`
- Rama local (sin push, sin upstream): `fix/group-deactivate-preserve-memberships`
- TDD, DDD, SOLID, código mínimo; sin force-clear / websocket / cambios a `session/alive`
- Delete de grupo: sin cambio de producto (sigue cleaner + guard)
- Código de error público: `GROUP_HAS_ACTIVE_USERS = '0x030024'` (hex del sistema; el nombre del constant es el branching estable)
- Tras cada `git commit`: `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` con `commit-tree` si aparece
- **No** `git push`

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` | Constant `GROUP_HAS_ACTIVE_USERS = '0x030024'` |
| `packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js` | `listByActiveGroup(groupId)` |
| `packages/kace_cloud_core/tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js` | Integration del listado |
| `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js` | Error tipado con `count` + `users` |
| `packages/kace_cloud_core/tests/groups/GroupUsageGuardUnit.test.js` | Unit del guard ampliado |
| `packages/kace_cloud_core/src/grupos/application/update/GroupUpdater.js` | No cleaner en deactivate; update simple |
| `packages/kace_cloud_core/tests/groups/GroupsIntegration.test.js` | Invertir test wipe-on-deactivate |
| `apps/apiv1/kace_cloud_api_group/src/Controller.mjs` | Mapear CustomError tipado → Response con `publicData` |
| `apps/kace-saas/src/errors/publicErrorCodes.js` | Registrar `GROUP_HAS_ACTIVE_USERS` |
| `apps/kace-saas/src/locale/es.json` / `en.json` | i18n del diálogo + error público |
| `apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.js` | Formateo nombre + parse del error axios |
| `apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.spec.js` | Vitest presentador |
| `apps/kace-saas/src/pages/Group/components/GroupActiveUsersBlockDialog.jsx` | AlertDialog informativo responsive |
| `apps/kace-saas/src/pages/Group/GroupsUpdateHandler.jsx` | Abrir diálogo en onError tipado |

---

### Task 1: Error code + `listByActiveGroup` (TDD)

**Files:**
- Modify: `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js`
- Create: `packages/kace_cloud_core/tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js`
- Modify: `packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js`

- [ ] **Step 1: Add public error code**

In `ErrorCodes.js`, after `CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND`:

```javascript
export const GROUP_HAS_ACTIVE_USERS = '0x030024';
```

- [ ] **Step 2: Write failing integration test for listByActiveGroup**

Create `KnexUsersRepositoryListByActiveGroupIntegration.test.js` mirroring the count test helpers (`userRow`, truncate, insertGroups):

```javascript
import { v4 as uuid } from 'uuid';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { knexConfigPostgres as knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

const CREATED_BY = uuid();

function userRow(override = {}) {
    return {
        login: `user_${uuid()}`,
        nombres: 'Fixture',
        apellido1: 'User',
        apellido2: 'Test',
        email: 'fixture@x.io',
        telefono: '1234567890',
        movil: '0987654321',
        rol_id: globalRoleId,
        is_active: '1',
        created_at: new Date(),
        created_by: CREATED_BY,
        account_type: 1,
        ...override,
    };
}

describe('KnexUsersRepository.listByActiveGroup', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);

    beforeAll(async () => {
        await TestHelper.resetSchemaAndMigrate(knexConfig);
    });

    afterAll(async () => {
        await knex.destroy();
    });

    beforeEach(async () => {
        await knex.raw('TRUNCATE TABLE usuarios CASCADE');
        await knex.raw('TRUNCATE TABLE grupos CASCADE');
    });

    async function insertGroups(...ids) {
        await knex('grupos').insert(ids.map((id) => ({ id, nombre: `g_${id.slice(0, 8)}`, status: 1 })));
    }

    it('returns empty array when nobody has the group as grupo_activo', async () => {
        const groupId = uuid();
        await knex('usuarios').insert([userRow({ id: uuid(), grupo_activo: null })]);
        await expect(repo.listByActiveGroup(groupId)).resolves.toEqual([]);
    });

    it('returns non-deleted users with expected fields ordered by name', async () => {
        const groupId = uuid();
        const otherGroupId = uuid();
        await insertGroups(groupId, otherGroupId);

        await knex('usuarios').insert([
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Zoe',
                apellido1: 'Zeta',
                apellido2: null,
                email: 'zoe@x.io',
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Ana',
                apellido1: 'Alfa',
                apellido2: 'Beta',
                email: 'ana@x.io',
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Gone',
                apellido1: 'X',
                apellido2: 'Y',
                email: 'gone@x.io',
                deleted_at: new Date(),
            }),
            userRow({
                id: uuid(),
                grupo_activo: otherGroupId,
                nombres: 'Other',
                apellido1: 'User',
                apellido2: 'Z',
                email: 'other@x.io',
            }),
        ]);

        const rows = await repo.listByActiveGroup(groupId);
        expect(rows).toEqual([
            { nombres: 'Ana', apellido1: 'Alfa', apellido2: 'Beta', email: 'ana@x.io' },
            { nombres: 'Zoe', apellido1: 'Zeta', apellido2: null, email: 'zoe@x.io' },
        ]);
    });
});
```

- [ ] **Step 3: Run test — expect FAIL (method missing)**

```bash
cd packages/kace_cloud_core && node --experimental-vm-modules node_modules/jest/bin/jest.js tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js --forceExit
```

Expected: FAIL — `listByActiveGroup is not a function` (or similar).

- [ ] **Step 4: Implement `listByActiveGroup`**

In `KnexUsersRepository.js`, after `countByActiveGroup`:

```javascript
/**
 * Lists non-deleted users whose `grupo_activo` references the given group.
 * @param {string} groupId
 * @returns {Promise<Array<{ nombres: string, apellido1: string, apellido2: string|null, email: string }>>}
 */
async listByActiveGroup(groupId) {
    try {
        return await this.table()
            .where('grupo_activo', groupId)
            .whereNull('deleted_at')
            .select('nombres', 'apellido1', 'apellido2', 'email')
            .orderBy([
                { column: 'nombres', order: 'asc' },
                { column: 'apellido1', order: 'asc' },
                { column: 'email', order: 'asc' },
            ]);
    } catch (error) {
        Helper.logError('Error listing users by active group', error);
        throw new QueryDBError('listByActiveGroup');
    }
}
```

- [ ] **Step 5: Run test — expect PASS**

Same command as Step 3. Expected: PASS.

- [ ] **Step 6: Commit (local only)**

```bash
git add packages/kace_cloud_core/src/shared/errors/ErrorCodes.js \
  packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js \
  packages/kace_cloud_core/tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js
git commit -m "$(cat <<'EOF'
feat(users): list users by active group for deactivate guard

EOF
)"
git log -1 --format='%B'
# If Co-authored-by Cursor appears, rewrite with commit-tree (workspace rule).
```

---

### Task 2: Ampliar `GroupUsageGuard` (TDD)

**Files:**
- Modify: `packages/kace_cloud_core/tests/groups/GroupUsageGuardUnit.test.js`
- Modify: `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js`

- [ ] **Step 1: Update unit tests to expect structured error**

Replace the body of `GroupUsageGuardUnit.test.js` with:

```javascript
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { GroupUsageGuard } from '../../src/grupos';
import { CustomError } from '../../src/shared/index.js';
import { GROUP_HAS_ACTIVE_USERS } from '../../src/shared/errors/ErrorCodes.js';

describe('GroupUsageGuard', () => {
    const groupId = uuidv4();
    const users = [
        { nombres: 'Ana', apellido1: 'Alfa', apellido2: 'Beta', email: 'ana@x.io' },
        { nombres: 'Zoe', apellido1: 'Zeta', apellido2: null, email: 'zoe@x.io' },
    ];

    it('resolves silently when no users have the group as grupo_activo', async () => {
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockResolvedValue(0),
            listByActiveGroup: jest.fn().mockResolvedValue([]),
        };
        const guard = new GroupUsageGuard(usersRepoMock);

        await expect(guard.ensureNoActiveAssignments(groupId, { action: 'eliminar' })).resolves.toBeUndefined();
        expect(usersRepoMock.countByActiveGroup).toHaveBeenCalledWith(groupId);
        expect(usersRepoMock.listByActiveGroup).not.toHaveBeenCalled();
    });

    it('throws CustomError 400 with code, count and users when assignments exist', async () => {
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockResolvedValue(2),
            listByActiveGroup: jest.fn().mockResolvedValue(users),
        };
        const guard = new GroupUsageGuard(usersRepoMock);

        let error;
        try {
            await guard.ensureNoActiveAssignments(groupId, { action: 'inactivar' });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(GROUP_HAS_ACTIVE_USERS);
        expect(error.fields).toEqual({ count: 2, users });
        expect(error.message).toMatch(/inactivar/);
        expect(error.message).toMatch(/2/);
        expect(usersRepoMock.listByActiveGroup).toHaveBeenCalledWith(groupId);
    });

    it('propagates repository errors', async () => {
        const dbError = new Error('boom');
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockRejectedValue(dbError),
            listByActiveGroup: jest.fn(),
        };
        const guard = new GroupUsageGuard(usersRepoMock);

        await expect(guard.ensureNoActiveAssignments(groupId, { action: 'eliminar' })).rejects.toBe(dbError);
    });
});
```

- [ ] **Step 2: Run unit test — expect FAIL**

```bash
cd packages/kace_cloud_core && node --experimental-vm-modules node_modules/jest/bin/jest.js tests/groups/GroupUsageGuardUnit.test.js --forceExit
```

Expected: FAIL — missing `publicErrorCode` / `fields` shape / `listByActiveGroup` call.

- [ ] **Step 3: Implement guard**

Replace `GroupUsageGuard.js` with:

```javascript
import { CustomError } from '../../../shared/index.js';
import { GROUP_HAS_ACTIVE_USERS } from '../../../shared/errors/ErrorCodes.js';

export class GroupUsageGuard {
    /** @type {KnexUsersRepository} */
    #usersRepository;

    /**
     * @param {KnexUsersRepository} usersRepository repository exposing countByActiveGroup + listByActiveGroup
     */
    constructor(usersRepository) {
        this.#usersRepository = usersRepository;
    }

    /**
     * Throws a 400 CustomError when at least one non-deleted user has the given
     * group set as their active group (`usuarios.grupo_activo`).
     *
     * @param {string} groupId
     * @param {{ action: string }} options localized verb used in the error message (e.g. 'eliminar', 'inactivar')
     */
    async ensureNoActiveAssignments(groupId, { action }) {
        const count = await this.#usersRepository.countByActiveGroup(groupId);
        if (count === 0) {
            return;
        }

        const users = await this.#usersRepository.listByActiveGroup(groupId);

        throw new CustomError(
            `No se puede ${action} el grupo: ${count} usuario(s) lo tienen como grupo activo. Reasigne sus grupos primero.`,
            400,
            { count, users },
            GROUP_HAS_ACTIVE_USERS
        );
    }
}
```

- [ ] **Step 4: Run unit test — expect PASS**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit (local only)**

```bash
git add packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js \
  packages/kace_cloud_core/tests/groups/GroupUsageGuardUnit.test.js
git commit -m "$(cat <<'EOF'
feat(groups): return active users list from usage guard

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: `GroupUpdater` deja de limpiar relaciones al inactivar (TDD)

**Files:**
- Modify: `packages/kace_cloud_core/tests/groups/GroupsIntegration.test.js` (bloque `Group relations cleanup on delete/deactivate`)
- Modify: `packages/kace_cloud_core/src/grupos/application/update/GroupUpdater.js`
- Modify: `apps/apiv1/kace_cloud_api_group/src/Controller.mjs` (quitar `relationsCleaner` del constructor de `GroupUpdater` si ya no se usa)

- [ ] **Step 1: Invert integration test for deactivate**

In `GroupsIntegration.test.js`, replace the test named  
`GroupUpdater wipes rel_usuarios_grupos on deactivation (status 1->2) and records history`  
with:

```javascript
it('GroupUpdater preserves rel_usuarios_grupos on deactivation (status 1->2)', async () => {
    const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
    await insertRelations(group.id.value, 2);

    const cleaner = new GroupRelationsCleaner(knex());
    const updater = new GroupUpdater(repository, null, undefined, cleaner);

    await updater.execute(
        { status: StatusEnum.INACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
        group.id.value
    );

    const remaining = await knex()('rel_usuarios_grupos').where({ grupo_id: group.id.value });
    const history = await knex()('rel_usuarios_grupos_history').select('*');
    expect(remaining).toHaveLength(2);
    expect(history).toHaveLength(0);

    const refreshed = await repository.find(group.id);
    expect(refreshed.status.value).toBe(StatusEnum.INACTIVE.value);
});
```

Keep delete wipe tests unchanged.

- [ ] **Step 2: Run focused integration — expect FAIL (still wipes)**

```bash
cd packages/kace_cloud_core && node --experimental-vm-modules node_modules/jest/bin/jest.js tests/groups/GroupsIntegration.test.js -t "preserves rel_usuarios_grupos on deactivation" --forceExit
```

Expected: FAIL — `remaining` length 0 or history length > 0.

- [ ] **Step 3: Minimal `GroupUpdater` change**

In `GroupUpdater.js`:

1. Remove `#relationsCleaner` field, constructor param, and JSDoc about wiping on deactivation.
2. Replace the deactivate transaction branch with a plain update (guard stays):

```javascript
async execute(updateDto, id) {
    const group = await this.#finder.execute(id);

    if (group === null) {
        throw new CustomError(`The group you are trying update does not exist`, 404);
    }

    if (updateDto.nombre) {
        await this.#uniquenessValidator.validate('nombre', updateDto.nombre, id);
    }

    const previousStatus = group.status?.value;
    const isDeactivating =
        updateDto.status !== undefined &&
        Number(previousStatus) === StatusEnum.ACTIVE.value &&
        Number(updateDto.status) === StatusEnum.INACTIVE.value;

    if (isDeactivating && this.#usageGuard) {
        await this.#usageGuard.ensureNoActiveAssignments(id, { action: 'inactivar' });
    }

    const originalValues = group.toJson();
    group.update(updateDto);

    await this.#repository.update(group);
    await this.#repository.saveHistory(group, originalValues);

    group.flushChanges();

    if (this.#actionExecutionService) {
        await this.#actionExecutionService.execute(ActionTriggers.UPDATE_GROUP.value, group);
    }
}
```

Constructor becomes:

```javascript
constructor(repository, actionExecutionService, usageGuard) {
    this.#repository = repository;
    this.#finder = new GroupFinderDomain(repository);
    this.#uniquenessValidator = new UniquenessValidator(repository);
    this.#actionExecutionService = actionExecutionService;
    this.#usageGuard = usageGuard;
}
```

- [ ] **Step 4: Update call sites that pass a 4th cleaner arg**

In `Controller.mjs` `actionUpdate`:

```javascript
await new GroupUpdater(
    this.repository,
    this.actionExecutionService,
    this.usageGuard
).execute(data.value, id);
```

In `GroupsIntegration.test.js`, any `new GroupUpdater(..., cleaner)` for deactivate tests can drop the cleaner arg (delete tests still use `GroupDeleter` + cleaner).

Update `GroupUpdater` JSDoc/index exports if they mention cleaner on update.

- [ ] **Step 5: Run deactivate + delete relation tests — expect PASS**

```bash
cd packages/kace_cloud_core && node --experimental-vm-modules node_modules/jest/bin/jest.js tests/groups/GroupsIntegration.test.js -t "Group relations cleanup" --forceExit
```

Expected: PASS (delete still wipes; deactivate preserves).

- [ ] **Step 6: Commit (local only)**

```bash
git add packages/kace_cloud_core/src/grupos/application/update/GroupUpdater.js \
  packages/kace_cloud_core/tests/groups/GroupsIntegration.test.js \
  apps/apiv1/kace_cloud_api_group/src/Controller.mjs
git commit -m "$(cat <<'EOF'
fix(groups): keep memberships when deactivating a group

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: Serializar error tipado en API groups

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_group/src/Controller.mjs`

**Why:** `HttpResponse.custom(message, statusCode, event)` solo manda `message`. En producción, `Response` oculta `errors` salvo `publicData` / `exposePublicErrorDetails`.

- [ ] **Step 1: Add helper (private function) near bottom of Controller file**

```javascript
import { Response } from '@kace/api-common/src/http_responses/Response.js';
import { GROUP_HAS_ACTIVE_USERS } from '@kace/core/src/shared/errors/ErrorCodes.js';

function groupHasActiveUsersResponse(error, event) {
    if (!(error instanceof CustomError) || error.publicErrorCode !== GROUP_HAS_ACTIVE_USERS) {
        return null;
    }

    const fields = error.fields && typeof error.fields === 'object' ? error.fields : {};
    return new Response({
        message: error.message,
        statusCode: error.statusCode,
        event,
        publicErrorCode: GROUP_HAS_ACTIVE_USERS,
        publicData: {
            count: fields.count ?? 0,
            users: Array.isArray(fields.users) ? fields.users : [],
        },
        exposePublicErrorDetails: true,
    });
}
```

Wire imports at top (merge with existing `ErrorCodes` import that already pulls `GROUP_CREATE_USERS_NOT_FOUND`).

- [ ] **Step 2: Use helper in `actionUpdate` and `actionDelete` catch blocks**

Before `HttpResponse.custom(...)`:

```javascript
const activeUsersResponse = groupHasActiveUsersResponse(error, this.event);
if (activeUsersResponse) return activeUsersResponse;
```

Keep existing `objectIdentityErrorResponse` / `CustomError` / 500 paths.

- [ ] **Step 3: Manual contract check (no full API suite required)**

Body esperado en prod-like (sin tenant debug) para inactivar bloqueado:

```json
{
  "message": "No se puede inactivar el grupo: N usuario(s)...",
  "data": {
    "code": "0x030024",
    "count": N,
    "users": [{ "nombres": "...", "apellido1": "...", "apellido2": "...", "email": "..." }]
  }
}
```

If unit tests for Controller exist, add one; otherwise rely on Task 5 front parser tests + manual verification during execution.

- [ ] **Step 4: Commit (local only)**

```bash
git add apps/apiv1/kace_cloud_api_group/src/Controller.mjs
git commit -m "$(cat <<'EOF'
fix(groups): expose active users payload on deactivate guard error

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Front — presentador + i18n + códigos públicos (TDD)

**Files:**
- Modify: `apps/kace-saas/src/errors/publicErrorCodes.js`
- Modify: `apps/kace-saas/src/locale/es.json`
- Modify: `apps/kace-saas/src/locale/en.json`
- Create: `apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.js`
- Create: `apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.spec.js`

- [ ] **Step 1: Register public code**

In `publicErrorCodes.js` `PUBLIC_ERROR_CODES`, after `CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND`:

```javascript
GROUP_HAS_ACTIVE_USERS: "0x030024",
```

- [ ] **Step 2: Add locale strings**

Under `app.errors.public` in both locale files:

```json
"GROUP_HAS_ACTIVE_USERS": "No se puede inactivar el grupo porque hay usuarios con este grupo activo."
```

(en.json English equivalent:)

```json
"GROUP_HAS_ACTIVE_USERS": "The group cannot be deactivated because users still have it as their active group."
```

Also add dialog keys under the existing root `group` object in both locale files (sibling of `group.form`):

```json
"activeUsersBlock": {
  "title": "No se puede inactivar el grupo",
  "description": "{{count}} usuario(s) tienen este grupo activo. Deben cambiar de grupo antes de continuar.",
  "showing": "Mostrando {{count}} usuarios",
  "close": "Cerrar"
}
```

(English translations in `en.json`.) Keys used as `t("group.activeUsersBlock.title")`, etc.

- [ ] **Step 3: Write failing vitest for display helpers**

Create `activeGroupUsersDisplay.spec.js`:

```javascript
import { describe, expect, it } from "vitest";
import {
    formatActiveGroupUserName,
    parseGroupHasActiveUsersError,
} from "./activeGroupUsersDisplay";
import { PUBLIC_ERROR_CODES } from "@/errors/publicErrorCodes";

describe("formatActiveGroupUserName", () => {
    it("joins nombres and apellidos without double spaces when apellido2 is empty", () => {
        expect(
            formatActiveGroupUserName({
                nombres: "Ana",
                apellido1: "Pérez",
                apellido2: null,
            }),
        ).toBe("Ana Pérez");
        expect(
            formatActiveGroupUserName({
                nombres: "Ana",
                apellido1: "Pérez",
                apellido2: "",
            }),
        ).toBe("Ana Pérez");
    });

    it("includes apellido2 when present", () => {
        expect(
            formatActiveGroupUserName({
                nombres: "Ana",
                apellido1: "Pérez",
                apellido2: "López",
            }),
        ).toBe("Ana Pérez López");
    });
});

describe("parseGroupHasActiveUsersError", () => {
    it("returns null for unrelated errors", () => {
        expect(parseGroupHasActiveUsersError(new Error("boom"))).toBeNull();
        expect(
            parseGroupHasActiveUsersError({
                response: { data: { data: { code: "0x050001" } } },
            }),
        ).toBeNull();
    });

    it("extracts count and users from axios-shaped payload", () => {
        const users = [
            { nombres: "Ana", apellido1: "A", apellido2: "B", email: "a@x.io" },
        ];
        expect(
            parseGroupHasActiveUsersError({
                response: {
                    data: {
                        message: "No se puede inactivar...",
                        data: {
                            code: PUBLIC_ERROR_CODES.GROUP_HAS_ACTIVE_USERS,
                            count: 1,
                            users,
                        },
                    },
                },
            }),
        ).toEqual({ count: 1, users, message: "No se puede inactivar..." });
    });
});
```

- [ ] **Step 4: Run vitest — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Group/utils/activeGroupUsersDisplay.spec.js
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement helpers**

Create `activeGroupUsersDisplay.js`:

```javascript
import { PUBLIC_ERROR_CODES } from "@/errors/publicErrorCodes";
import { findPublicErrorCode } from "@/errors/publicErrorCodes";

export function formatActiveGroupUserName({ nombres, apellido1, apellido2 } = {}) {
    return [nombres, apellido1, apellido2].filter((part) => Boolean(part && String(part).trim())).join(" ");
}

export function parseGroupHasActiveUsersError(error) {
    const responseData = error?.response?.data;
    const code = findPublicErrorCode(responseData?.data?.code, responseData?.code);
    if (code !== PUBLIC_ERROR_CODES.GROUP_HAS_ACTIVE_USERS) {
        return null;
    }

    const users = Array.isArray(responseData?.data?.users) ? responseData.data.users : [];
    const count = Number(responseData?.data?.count ?? users.length) || users.length;

    return {
        count,
        users,
        message: responseData?.message ?? "",
    };
}
```

(Prefer a single import line from `@/errors/publicErrorCodes`.)

- [ ] **Step 6: Run vitest — expect PASS**

Same command as Step 4. Expected: PASS.

- [ ] **Step 7: Commit (local only)**

```bash
git add apps/kace-saas/src/errors/publicErrorCodes.js \
  apps/kace-saas/src/locale/es.json \
  apps/kace-saas/src/locale/en.json \
  apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.js \
  apps/kace-saas/src/pages/Group/utils/activeGroupUsersDisplay.spec.js
git commit -m "$(cat <<'EOF'
feat(saas): parse group active-users guard error for UI

EOF
)"
git log -1 --format='%B'
```

---

### Task 6: Front — diálogo responsive + wiring en `GroupsUpdateHandler`

**Files:**
- Create: `apps/kace-saas/src/pages/Group/components/GroupActiveUsersBlockDialog.jsx`
- Modify: `apps/kace-saas/src/pages/Group/GroupsUpdateHandler.jsx`

- [ ] **Step 1: Create informational dialog**

`GroupActiveUsersBlockDialog.jsx`:

```jsx
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui-shared/src/components/ui/alert-dialog";
import { formatActiveGroupUserName } from "../utils/activeGroupUsersDisplay";

const GroupActiveUsersBlockDialog = ({ open, count = 0, users = [], onClose }) => {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={(next) => !next && onClose?.()}>
            <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg sm:max-w-xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("group.activeUsersBlock.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("group.activeUsersBlock.description", { count })}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                    <ul className="divide-y divide-border">
                        {users.map((user) => (
                            <li
                                key={user.email}
                                className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                            >
                                <span className="text-sm font-medium text-foreground break-words">
                                    {formatActiveGroupUserName(user)}
                                </span>
                                <span className="text-xs text-muted-foreground break-all sm:text-right">
                                    {user.email}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                {count > 8 ? (
                    <p className="text-xs text-muted-foreground">
                        {t("group.activeUsersBlock.showing", { count })}
                    </p>
                ) : null}

                <AlertDialogFooter>
                    <AlertDialogAction onClick={onClose}>
                        {t("group.activeUsersBlock.close")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

GroupActiveUsersBlockDialog.propTypes = {
    open: PropTypes.bool,
    count: PropTypes.number,
    users: PropTypes.arrayOf(
        PropTypes.shape({
            nombres: PropTypes.string,
            apellido1: PropTypes.string,
            apellido2: PropTypes.string,
            email: PropTypes.string,
        }),
    ),
    onClose: PropTypes.func,
};

export default GroupActiveUsersBlockDialog;
```

Adjust the AlertDialog import path if the project aliases `@/components/ui/...` differently — prefer the same import path used by `alert-modal.jsx` under `ui-shared`.

**UX checks (manual):**
- Mobile narrow: nombre y email apilados, sin overflow-x.
- Desktop: nombre | email en una fila.
- >8 usuarios: lista con scroll (`max-h-64`).
- Solo botón Cerrar (sin desalojar).

- [ ] **Step 2: Wire handler**

In `GroupsUpdateHandler.jsx`:

1. State: `const [activeUsersBlock, setActiveUsersBlock] = useState(null);` // `{ count, users } | null`
2. Import `parseGroupHasActiveUsersError` and `GroupActiveUsersBlockDialog`.
3. In mutation `onError` (and/or the error path that receives axios errors — note: axios rejects before `sendInformation` throws `new Error(message)`, so `err.response.data` should be available):

```javascript
onError: (err, _vars, context) => {
    queryClient.setQueryData(["groupsData"], context?.previousData);
    const blocked = parseGroupHasActiveUsersError(err);
    if (blocked) {
        setActiveUsersBlock({ count: blocked.count, users: blocked.users });
        return;
    }
    toast.error(getTranslatedError(err, t));
},
```

4. Render dialog next to the form:

```jsx
<GroupActiveUsersBlockDialog
    open={Boolean(activeUsersBlock)}
    count={activeUsersBlock?.count}
    users={activeUsersBlock?.users}
    onClose={() => setActiveUsersBlock(null)}
/>
```

- [ ] **Step 3: Run vitest helpers + smoke**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Group/utils/activeGroupUsersDisplay.spec.js
```

Expected: PASS.

- [ ] **Step 4: Commit (local only)**

```bash
git add apps/kace-saas/src/pages/Group/components/GroupActiveUsersBlockDialog.jsx \
  apps/kace-saas/src/pages/Group/GroupsUpdateHandler.jsx \
  apps/kace-saas/src/locale/es.json \
  apps/kace-saas/src/locale/en.json
git commit -m "$(cat <<'EOF'
feat(saas): show active users dialog when group deactivate is blocked

EOF
)"
git log -1 --format='%B'
```

---

### Task 7: Verificación final (local)

- [ ] **Step 1: Core tests**

```bash
cd packages/kace_cloud_core && node --experimental-vm-modules node_modules/jest/bin/jest.js \
  tests/groups/GroupUsageGuardUnit.test.js \
  tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js \
  tests/groups/GroupsIntegration.test.js \
  --forceExit
```

Expected: PASS.

- [ ] **Step 2: SaaS vitest**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Group/utils/activeGroupUsersDisplay.spec.js
```

Expected: PASS.

- [ ] **Step 3: Manual QA checklist**

1. Grupo con membresías y **sin** nadie con `grupo_activo` → inactivar → 200; search de relaciones sigue mostrando usuarios.
2. Usuario A selecciona el grupo como activo → admin intenta inactivar → diálogo con nombre+email de A; grupo sigue Active.
3. A cambia de grupo a mano → admin inactiva → OK; membresías de A en el grupo inactivo siguen en BD.
4. Responsive del diálogo en viewport móvil y desktop.
5. Confirmar `git status` / branch sin upstream; **no push**.

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| No cleaner on deactivate; preserve memberships | Task 3 |
| Keep guard block | Task 2–3 |
| 400 with count + users fields | Task 1–2, 4 |
| Informational responsive dialog, no force-clear | Task 5–6 |
| Delete unchanged | Task 3 (tests kept) |
| No websocket / alive changes | Out of plan (constraints) |
| Local branch only | Global constraints + Task 7 |

## Placeholder / consistency scan

- Error code unified as `GROUP_HAS_ACTIVE_USERS` / `0x030024` across core, API, SaaS.
- `publicData: { count, users }` is the prod-safe channel (not `errors`).
- No force-clear flag or evacuate endpoint in any task.
