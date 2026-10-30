# Group Active Users `last_seen_at` Guard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al inactivar o eliminar un grupo, bloquear solo si hay usuarios con ese `grupo_activo` y `last_seen_at` dentro de `assignment_active_session_limit` minutos; si no, permitir la operación sin limpiar `grupo_activo` stale.

**Architecture:** Un resolver pequeño obtiene `N` desde la config del grupo objetivo (`agente.casos.assignment_active_session_limit`, default 2). `GroupUsageGuard` pasa `N` a `countByActiveGroup` / `listByActiveGroup`, que filtran en SQL por `last_seen_at`. El contrato HTTP `GROUP_HAS_ACTIVE_USERS` y el modal SaaS no cambian.

**Tech Stack:** Jest (`@kace/core`), Knex (Postgres + SQLite en tests), `GroupFinderDomain`, `DomainConfigFinder`.

---

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-group-active-users-last-seen-guard-design.md`
- Rama: `fix/group-active-users-last-seen-guard` (desde `origin/develop`)
- TDD, DDD, SOLID, código mínimo
- No limpiar `grupo_activo` stale; no tocar front/modal; no usar `admin.users.active_session_limit`
- Tras cada `git commit`: `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` con `commit-tree` si aparece
- **No** `git push` salvo que el usuario lo pida

### Test runner (core)

```bash
cd packages/kace_cloud_core
node --experimental-vm-modules node_modules/jest/bin/jest.js <path> --detectOpenHandles --forceExit
```

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/kace_cloud_core/src/grupos/application/resolvers/AssignmentActiveSessionLimitResolver.js` | `groupId` → minutos (`assignment_active_session_limit` o 2) |
| `packages/kace_cloud_core/tests/groups/AssignmentActiveSessionLimitResolverUnit.test.js` | Unit del resolver |
| `packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js` | count/list con filtro `last_seen_at` |
| `packages/kace_cloud_core/tests/users/KnexUsersRepositoryCountByActiveGroupIntegration.test.js` | Actualizar + casos presencia |
| `packages/kace_cloud_core/tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js` | Actualizar + casos presencia |
| `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js` | Resolver `N` + pasar a repo |
| `packages/kace_cloud_core/tests/groups/GroupUsageGuardUnit.test.js` | Unit guard con resolver mock |
| `packages/kace_cloud_core/src/grupos/index.js` | Export del resolver |
| `packages/kace_cloud_core/tests/groups/GroupsIntegration.test.js` | Fixtures `last_seen_at` + caso stale permite |
| `apps/apiv1/kace_cloud_api_group/src/Controller.mjs` | Wiring del resolver al guard |

---

### Task 1: `AssignmentActiveSessionLimitResolver` (TDD)

**Files:**
- Create: `packages/kace_cloud_core/tests/groups/AssignmentActiveSessionLimitResolverUnit.test.js`
- Create: `packages/kace_cloud_core/src/grupos/application/resolvers/AssignmentActiveSessionLimitResolver.js`
- Modify: `packages/kace_cloud_core/src/grupos/index.js`

- [ ] **Step 1: Write failing unit tests**

```javascript
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { AssignmentActiveSessionLimitResolver } from '../../src/grupos';

const GROUP_ID = uuidv4();
const CONFIG_ID = uuidv4();

const makeGroup = (configurationId) => ({
    configuration_id: { value: configurationId },
});

const makeConfig = (assignment_active_session_limit) => ({
    settings: {
        behaviors: {
            getConfig: (mod, sub) => {
                if (mod === 'agente' && sub === 'casos') {
                    return { assignment_active_session_limit };
                }
                return null;
            },
        },
    },
});

describe('AssignmentActiveSessionLimitResolver', () => {
    it('returns assignment_active_session_limit from grupo.configuration_id → agente/casos', async () => {
        const groupsRepository = {
            find: jest.fn().mockResolvedValue(makeGroup(CONFIG_ID)),
        };
        const globalConfigurationRepository = {
            find: jest.fn().mockResolvedValue(makeConfig(15)),
        };
        // Domain finders call repository.find(ValueObjectUuid) — mirror EntityRulesContextResolver deps shape
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository,
            globalConfigurationRepository,
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(15);
    });

    it('returns 2 when configuration_id is missing', async () => {
        const groupsRepository = {
            find: jest.fn().mockResolvedValue({ configuration_id: { value: null } }),
        };
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository,
            globalConfigurationRepository: { find: jest.fn() },
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
    });

    it('returns 2 when group is not found', async () => {
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository: { find: jest.fn().mockResolvedValue(null) },
            globalConfigurationRepository: { find: jest.fn() },
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
    });

    it.each([undefined, 0, -1, 2.5, 'abc'])(
        'returns 2 when assignment_active_session_limit is invalid (%p)',
        async (value) => {
            const resolver = new AssignmentActiveSessionLimitResolver({
                groupsRepository: { find: jest.fn().mockResolvedValue(makeGroup(CONFIG_ID)) },
                globalConfigurationRepository: { find: jest.fn().mockResolvedValue(makeConfig(value)) },
            });

            await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
        }
    );

    it('returns 2 when config lookup throws', async () => {
        const resolver = new AssignmentActiveSessionLimitResolver({
            groupsRepository: { find: jest.fn().mockRejectedValue(new Error('db')) },
            globalConfigurationRepository: { find: jest.fn() },
        });

        await expect(resolver.resolveForGroup(GROUP_ID)).resolves.toBe(2);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module/export missing)**

```bash
cd packages/kace_cloud_core
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  tests/groups/AssignmentActiveSessionLimitResolverUnit.test.js \
  --detectOpenHandles --forceExit
```

Expected: FAIL (cannot resolve `AssignmentActiveSessionLimitResolver`).

- [ ] **Step 3: Implement resolver + export**

Create `AssignmentActiveSessionLimitResolver.js`:

```javascript
import { GroupFinderDomain } from '../../index.js';
import { DomainConfigFinder } from '../../../global-config/index.js';

export class AssignmentActiveSessionLimitResolver {
    static DEFAULT_MINUTES = 2;

    /** @type {GroupFinderDomain} */
    #groupFinder;
    /** @type {DomainConfigFinder} */
    #configFinder;

    /**
     * @param {Object} deps
     * @param {import('../../infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} deps.groupsRepository
     * @param {import('../../../global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js').KnexGlobalConfigurationRepository} deps.globalConfigurationRepository
     */
    constructor({ groupsRepository, globalConfigurationRepository }) {
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#configFinder = new DomainConfigFinder(globalConfigurationRepository);
    }

    /**
     * @param {string} groupId
     * @returns {Promise<number>} minutes
     */
    async resolveForGroup(groupId) {
        try {
            const group = await this.#groupFinder.execute(groupId);
            if (!group?.configuration_id?.value) {
                return AssignmentActiveSessionLimitResolver.DEFAULT_MINUTES;
            }

            const configuration = await this.#configFinder.execute(group.configuration_id.value);
            const limit = configuration?.settings?.behaviors?.getConfig(
                'agente',
                'casos'
            )?.assignment_active_session_limit;

            return Number.isInteger(limit) && limit > 0
                ? limit
                : AssignmentActiveSessionLimitResolver.DEFAULT_MINUTES;
        } catch {
            return AssignmentActiveSessionLimitResolver.DEFAULT_MINUTES;
        }
    }
}
```

**Import note:** si `GroupFinderDomain` desde `../../index.js` causa ciclo, importar desde `../../domain/GroupsFinder.js` (exportado como `GroupsFinder` / `GroupFinderDomain` en index). Preferir:

```javascript
import { GroupsFinder as GroupFinderDomain } from '../../domain/GroupsFinder.js';
```

Add to `packages/kace_cloud_core/src/grupos/index.js`:

```javascript
export { AssignmentActiveSessionLimitResolver } from './application/resolvers/AssignmentActiveSessionLimitResolver.js';
```

- [ ] **Step 4: Run tests — expect PASS**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/kace_cloud_core/src/grupos/application/resolvers/AssignmentActiveSessionLimitResolver.js \
  packages/kace_cloud_core/src/grupos/index.js \
  packages/kace_cloud_core/tests/groups/AssignmentActiveSessionLimitResolverUnit.test.js
git commit -m "$(cat <<'EOF'
feat(groups): resolve assignment_active_session_limit for group guard

EOF
)"
git log -1 --format='%B'
# strip Co-authored-by Cursor via commit-tree if present
```

---

### Task 2: Repo count/list filter by `last_seen_at` (TDD)

**Files:**
- Modify: `packages/kace_cloud_core/tests/users/KnexUsersRepositoryCountByActiveGroupIntegration.test.js`
- Modify: `packages/kace_cloud_core/tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js`
- Modify: `packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js` (`countByActiveGroup`, `listByActiveGroup`)

Signature change (required second arg):

```javascript
async countByActiveGroup(groupId, activeSessionLimitMinutes)
async listByActiveGroup(groupId, activeSessionLimitMinutes)
```

- [ ] **Step 1: Update/extend failing integration tests**

In **both** test files:

1. Change every call to pass minutes, e.g. `repo.countByActiveGroup(groupId, 2)` / `repo.listByActiveGroup(groupId, 2)`.
2. For users that must count/list as active, set `last_seen_at: new Date().toISOString()`.
3. Add cases:

**Count — exclude stale/null:**

```javascript
it('counts only users with last_seen_at within the session window', async () => {
    const groupId = uuid();
    await insertGroups(groupId);
    const recent = new Date().toISOString();
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    await knex('usuarios').insert([
        userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: recent }),
        userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: stale }),
        userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: null }),
    ]);

    await expect(repo.countByActiveGroup(groupId, 2)).resolves.toBe(1);
});
```

**List — same filter + still ordered:**

```javascript
it('lists only users with last_seen_at within the session window', async () => {
    const groupId = uuid();
    await insertGroups(groupId);
    const recent = new Date().toISOString();
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    await knex(`${schema}.usuarios`).insert([
        userRow({
            id: uuid(),
            grupo_activo: groupId,
            nombres: 'Ana',
            apellido1: 'Alfa',
            apellido2: 'Beta',
            email: 'ana@x.io',
            last_seen_at: recent,
        }),
        userRow({
            id: uuid(),
            grupo_activo: groupId,
            nombres: 'Old',
            apellido1: 'User',
            apellido2: null,
            email: 'old@x.io',
            last_seen_at: stale,
        }),
        userRow({
            id: uuid(),
            grupo_activo: groupId,
            nombres: 'Null',
            apellido1: 'Seen',
            apellido2: null,
            email: 'null@x.io',
            last_seen_at: null,
        }),
    ]);

    await expect(repo.listByActiveGroup(groupId, 2)).resolves.toEqual([
        { nombres: 'Ana', apellido1: 'Alfa', apellido2: 'Beta', email: 'ana@x.io' },
    ]);
});
```

Update existing “returns non-deleted / counts non-deleted” fixtures so matching users have recent `last_seen_at` (otherwise expectations drop to 0).

- [ ] **Step 2: Run count + list tests — expect FAIL**

```bash
cd packages/kace_cloud_core
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  tests/users/KnexUsersRepositoryCountByActiveGroupIntegration.test.js \
  tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js \
  --detectOpenHandles --forceExit
```

Expected: FAIL (stale/null still included, or arity mismatch until implementation).

- [ ] **Step 3: Implement SQL filter**

In `KnexUsersRepository.js`, replace `countByActiveGroup` / `listByActiveGroup` bodies to require minutes and apply the same dialect pattern as `findCandidateForWorkQueue`:

```javascript
#applyActiveGroupPresenceFilter(query, groupId, activeSessionLimitMinutes) {
    query.where('grupo_activo', groupId).whereNull('deleted_at').whereNotNull('last_seen_at');

    const isSQLite = this.connection.client.config.client === 'sqlite3';
    if (isSQLite) {
        query.whereRaw(`datetime(last_seen_at) >= datetime('now', '-' || ? || ' minutes')`, [
            activeSessionLimitMinutes,
        ]);
    } else {
        query.whereRaw(`last_seen_at >= NOW() - INTERVAL '1 minute' * ?`, [activeSessionLimitMinutes]);
    }
    return query;
}

async countByActiveGroup(groupId, activeSessionLimitMinutes) {
    try {
        const query = this.table().count('id as count');
        this.#applyActiveGroupPresenceFilter(query, groupId, activeSessionLimitMinutes);
        const [{ count }] = await query;
        return parseInt(count, 10);
    } catch (error) {
        Helper.logError('Error counting users by active group', error);
        throw new QueryDBError('countByActiveGroup');
    }
}

async listByActiveGroup(groupId, activeSessionLimitMinutes) {
    try {
        const query = this.table().select('nombres', 'apellido1', 'apellido2', 'email');
        this.#applyActiveGroupPresenceFilter(query, groupId, activeSessionLimitMinutes);
        return await query
            .orderByRaw('LOWER(nombres) ASC')
            .orderByRaw('LOWER(apellido1) ASC')
            .orderByRaw('LOWER(email) ASC');
    } catch (error) {
        Helper.logError('Error listing users by active group', error);
        throw new QueryDBError('listByActiveGroup');
    }
}
```

Update JSDoc to document `activeSessionLimitMinutes`.

- [ ] **Step 4: Run tests — expect PASS**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js \
  packages/kace_cloud_core/tests/users/KnexUsersRepositoryCountByActiveGroupIntegration.test.js \
  packages/kace_cloud_core/tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js
git commit -m "$(cat <<'EOF'
feat(users): filter active-group count/list by last_seen_at window

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: `GroupUsageGuard` uses resolver + minutes (TDD)

**Files:**
- Modify: `packages/kace_cloud_core/tests/groups/GroupUsageGuardUnit.test.js`
- Modify: `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js`

- [ ] **Step 1: Rewrite unit tests (red)**

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

    const limitResolver = (minutes = 7) => ({
        resolveForGroup: jest.fn().mockResolvedValue(minutes),
    });

    it('resolves silently when no recently-active users have the group as grupo_activo', async () => {
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockResolvedValue(0),
            listByActiveGroup: jest.fn().mockResolvedValue([]),
        };
        const resolver = limitResolver(7);
        const guard = new GroupUsageGuard(usersRepoMock, resolver);

        await expect(guard.ensureNoActiveAssignments(groupId)).resolves.toBeUndefined();
        expect(resolver.resolveForGroup).toHaveBeenCalledWith(groupId);
        expect(usersRepoMock.countByActiveGroup).toHaveBeenCalledWith(groupId, 7);
        expect(usersRepoMock.listByActiveGroup).not.toHaveBeenCalled();
    });

    it('throws CustomError 400 with code, count and users when recently-active assignments exist', async () => {
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockResolvedValue(2),
            listByActiveGroup: jest.fn().mockResolvedValue(users),
        };
        const resolver = limitResolver(7);
        const guard = new GroupUsageGuard(usersRepoMock, resolver);

        let error;
        try {
            await guard.ensureNoActiveAssignments(groupId);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(GROUP_HAS_ACTIVE_USERS);
        expect(error.fields).toEqual({ count: 2, users });
        expect(error.message).toBe('Cannot proceed: 2 user(s) still have this group as their active group');
        expect(usersRepoMock.listByActiveGroup).toHaveBeenCalledWith(groupId, 7);
    });

    it('propagates repository errors', async () => {
        const dbError = new Error('boom');
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockRejectedValue(dbError),
            listByActiveGroup: jest.fn(),
        };
        const guard = new GroupUsageGuard(usersRepoMock, limitResolver());

        await expect(guard.ensureNoActiveAssignments(groupId)).rejects.toBe(dbError);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/kace_cloud_core
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  tests/groups/GroupUsageGuardUnit.test.js \
  --detectOpenHandles --forceExit
```

Expected: FAIL (constructor arity / calls without minutes).

- [ ] **Step 3: Implement guard**

```javascript
import { CustomError } from '../../../shared/index.js';
import { GROUP_HAS_ACTIVE_USERS } from '../../../shared/errors/ErrorCodes.js';

export class GroupUsageGuard {
    /** @type {import('../../../users/infrastructure/KnexUsersRepository.js').KnexUsersRepository} */
    #usersRepository;
    /** @type {{ resolveForGroup: (groupId: string) => Promise<number> }} */
    #activeSessionLimitResolver;

    /**
     * @param {import('../../../users/infrastructure/KnexUsersRepository.js').KnexUsersRepository} usersRepository
     * @param {{ resolveForGroup: (groupId: string) => Promise<number> }} activeSessionLimitResolver
     */
    constructor(usersRepository, activeSessionLimitResolver) {
        this.#usersRepository = usersRepository;
        this.#activeSessionLimitResolver = activeSessionLimitResolver;
    }

    /**
     * Throws a 400 CustomError when at least one non-deleted user has the given
     * group as `grupo_activo` and was seen within the configured session window.
     *
     * @param {string} groupId
     */
    async ensureNoActiveAssignments(groupId) {
        const minutes = await this.#activeSessionLimitResolver.resolveForGroup(groupId);
        const count = await this.#usersRepository.countByActiveGroup(groupId, minutes);
        if (count === 0) {
            return;
        }

        const users = await this.#usersRepository.listByActiveGroup(groupId, minutes);
        const listedCount = users.length;

        throw new CustomError(
            `Cannot proceed: ${listedCount} user(s) still have this group as their active group`,
            400,
            { count: listedCount, users },
            GROUP_HAS_ACTIVE_USERS
        );
    }
}
```

- [ ] **Step 4: Run — expect PASS**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js \
  packages/kace_cloud_core/tests/groups/GroupUsageGuardUnit.test.js
git commit -m "$(cat <<'EOF'
feat(groups): gate usage guard on recently-active grupo_activo users

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: Integration — deactivate/delete with presence window

**Files:**
- Modify: `packages/kace_cloud_core/tests/groups/GroupsIntegration.test.js` (describe `GroupUsageGuard cascade blocking`)

`UsersMother.dto` defaults `last_seen_at: null`. After Task 2/3, inserts without recent `last_seen_at` no longer block.

- [ ] **Step 1: Update blocking fixtures + add stale-allows cases (red first if needed)**

Helper inside the describe (or inline):

```javascript
const recentLastSeen = () => new Date().toISOString();
const staleLastSeen = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
const alwaysTwoMinutes = { resolveForGroup: async () => 2 };
```

Replace every `new GroupUsageGuard(usersRepository)` with:

```javascript
new GroupUsageGuard(usersRepository, alwaysTwoMinutes)
```

For tests that expect **block**:

```javascript
await usersRepository.connection('usuarios').insert(
    UsersMother.dto({ grupo_activo: group.id.value, last_seen_at: recentLastSeen() })
);
```

Add:

```javascript
it('GroupDeleter succeeds when grupo_activo users are outside the last_seen window', async () => {
    const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
    await usersRepository.connection('usuarios').insert(
        UsersMother.dto({ grupo_activo: group.id.value, last_seen_at: staleLastSeen() })
    );

    const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
    const deleter = new GroupDeleter(repository, null, guard);

    await deleter.execute(group.id.value, deleteDtoFor());

    const afterDelete = await repository.find(group.id);
    expect(afterDelete).toBeNull();

    const user = await usersRepository.connection('usuarios').where({ grupo_activo: group.id.value }).first();
    // grupo may be soft-deleted; assert the user row still has the stale grupo_activo value
    expect(user).toBeTruthy();
});

it('GroupUpdater allows status 1->0 when grupo_activo users are outside the last_seen window', async () => {
    const group = await GroupsMother.createGroup(repository, repositoryShiftManagement);
    const userDto = UsersMother.dto({
        grupo_activo: group.id.value,
        last_seen_at: staleLastSeen(),
    });
    await usersRepository.connection('usuarios').insert(userDto);

    const guard = new GroupUsageGuard(usersRepository, alwaysTwoMinutes);
    const updater = new GroupUpdater(repository, null, guard);

    await updater.execute(
        { status: StatusEnum.INACTIVE.value, updated_at: new Date().toISOString(), updated_by: uuidV4() },
        group.id.value
    );

    const refreshed = await repository.find(group.id);
    expect(refreshed.status.value).toBe(StatusEnum.INACTIVE.value);

    const user = await usersRepository.connection('usuarios').where({ id: userDto.id }).first();
    expect(user.grupo_activo).toBe(group.id.value);
});
```

**Note on delete stale test:** after soft-delete of group, `repository.find` may return null; the user’s `grupo_activo` should still equal the deleted group id (not cleared). Adjust the user assertion to query by `userDto.id` if `grupo_activo` filter is awkward post-delete.

Rename/clarify existing blocking test titles to mention “recently-active” if helpful.

- [ ] **Step 2: Run integration describe — expect FAIL then implement only test/wiring fixes (no product code unless gap found)**

```bash
cd packages/kace_cloud_core
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  tests/groups/GroupsIntegration.test.js \
  -t "GroupUsageGuard cascade blocking" \
  --detectOpenHandles --forceExit
```

Expected after fixture updates: PASS. If delete stale assertion is flaky due to soft-delete semantics, assert only updater path for “grupo_activo intact” and for deleter assert delete succeeds + user row `grupo_activo` unchanged via id.

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_core/tests/groups/GroupsIntegration.test.js
git commit -m "$(cat <<'EOF'
test(groups): cover last_seen window for deactivate and delete guards

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Wire resolver in Group API Controller

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_group/src/Controller.mjs`

- [ ] **Step 1: Update constructor wiring**

Import `AssignmentActiveSessionLimitResolver` from `@kace/core/src/grupos` (alongside `GroupUsageGuard`).

Reorder so global config repo exists before the guard, then:

```javascript
this.#globalConfigRepository = new KnexGlobalConfigurationRepository(this.database_connection);
this.#globalConfigFinder = new GlobalConfigFinder(this.#globalConfigRepository);
this.usageGuard = new GroupUsageGuard(
    this.userRepository,
    new AssignmentActiveSessionLimitResolver({
        groupsRepository: this.repository,
        globalConfigurationRepository: this.#globalConfigRepository,
    })
);
```

Remove the previous `this.usageGuard = new GroupUsageGuard(this.userRepository);` line. Keep `relationsCleaner` / schemas wiring as today (order may place guard after repositories are ready).

- [ ] **Step 2: Smoke — ensure module loads (no unit suite for controller)**

```bash
node --input-type=module -e "import './apps/apiv1/kace_cloud_api_group/src/Controller.mjs'"
```

Run from repo root; if path/env fails, at least confirm the import graph of `@kace/core/src/grupos` exports the resolver:

```bash
cd packages/kace_cloud_core
node --input-type=module -e "import { AssignmentActiveSessionLimitResolver, GroupUsageGuard } from './src/grupos/index.js'; console.log(typeof AssignmentActiveSessionLimitResolver, typeof GroupUsageGuard)"
```

Expected: `function function`.

- [ ] **Step 3: Commit**

```bash
git add apps/apiv1/kace_cloud_api_group/src/Controller.mjs
git commit -m "$(cat <<'EOF'
feat(api-group): wire assignment session limit into GroupUsageGuard

EOF
)"
git log -1 --format='%B'
```

---

### Task 6: Full verification

- [ ] **Step 1: Run focused suite**

```bash
cd packages/kace_cloud_core
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  tests/groups/AssignmentActiveSessionLimitResolverUnit.test.js \
  tests/groups/GroupUsageGuardUnit.test.js \
  tests/users/KnexUsersRepositoryCountByActiveGroupIntegration.test.js \
  tests/users/KnexUsersRepositoryListByActiveGroupIntegration.test.js \
  tests/groups/GroupsIntegration.test.js \
  -t "GroupUsageGuard cascade blocking" \
  --detectOpenHandles --forceExit
```

Expected: all PASS.

- [ ] **Step 2: Manual checklist (local app if available)**

1. Usuario con `grupo_activo = G` y `last_seen_at` reciente → inactivar G → modal con ese usuario.
2. Solo usuarios stale/`null` → inactivar G → 200, grupo Inactive, `grupo_activo` intacto.
3. Mismo criterio al eliminar.

- [ ] **Step 3: No further commit unless Step 1 forced a fix** — if a fix was needed, commit it with a clear message and strip Cursor trailer.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Umbral `assignment_active_session_limit` | Task 1 |
| Fuente = config del grupo; default 2 | Task 1 |
| Filtro SQL `last_seen_at` + null excluido | Task 2 |
| Guard usa N en count/list | Task 3 |
| Aplica inactivar y eliminar | Task 4 |
| Stale no bloquea y no limpia `grupo_activo` | Task 4 |
| Wiring API | Task 5 |
| Contrato HTTP / modal sin cambios | (sin task front — verificado por no tocar SaaS) |

## Out of scope (do not implement)

- Front copy/modal changes
- Clear stale `grupo_activo` on deactivate/delete
- `admin.users.active_session_limit`
- Push remoto
