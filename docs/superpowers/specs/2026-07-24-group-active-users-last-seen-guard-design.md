# Guard de grupo: usuarios activos por `last_seen_at`

## Context

Al inactivar o eliminar un grupo, `GroupUsageGuard.ensureNoActiveAssignments` bloquea si **cualquier** usuario no borrado tiene `usuarios.grupo_activo = groupId`. Eso incluye sesiones stale: usuarios que dejaron el grupo activo en BD pero ya no estánitan presencia (`last_seen_at` viejo o null).

El producto debe considerar “activo en el grupo” solo a quienes tienen ese `grupo_activo` **y** fueron vistos recientemente según el umbral global `assignment_active_session_limit` (minutos). Si hay al menos uno, se mantiene el 400 tipado `GROUP_HAS_ACTIVE_USERS` y el modal SaaS existente. Si no, se permite inactivar/eliminar.

Hoy el front ya muestra `GroupActiveUsersBlockDialog` ante ese código; no hace falta rediseñar la UI.

Rama de trabajo: `fix/group-active-users-last-seen-guard` (desde `origin/develop`).

## Decisions

- Umbral: `behaviors.application.agente.casos.assignment_active_session_limit` (minutos).
- Fuente del umbral: configuración del **grupo objetivo** (`grupos.configuration_id`). Si falta `configuration_id`, falta la clave, o el valor no es entero `> 0` → default **2** (mismo fallback que core en asignación / rules context).
- Criterio SQL de “recientemente activo”:
  - `grupo_activo = groupId`
  - `deleted_at IS NULL`
  - `last_seen_at IS NOT NULL`
  - `last_seen_at >= now - N minutes`
- Aplica a **inactivar** (Active → Inactive) **y** **eliminar**.
- Usuarios con `grupo_activo` stale o `last_seen_at` null: **no** bloquean; **no** se limpia `grupo_activo` en este flujo.
- Front: sin cambios de contrato ni de modal (solo cambia quién aparece en `users[]`).
- Enfoque: filtrar en repositorio (SQL); el guard orquesta count/list + resolver de `N`.
- Principios: TDD, DDD, SOLID, código limpio, cambio mínimo necesario.

## Architecture

```text
Admin inactiva o elimina grupo G
        │
        ▼
 GroupUpdater / GroupDeleter
        │
        ▼
 GroupUsageGuard.ensureNoActiveAssignments(G)
        │
        ├─ resolver N = assignment_active_session_limit
        │    desde G.configuration_id → agente.casos
        │    (inválido/ausente → 2)
        │
        ├─ countByActiveGroup(G, N)  // filtro last_seen_at en SQL
        │
        ├─ count = 0 → permitir; no tocar grupo_activo stale
        │
        └─ count > 0 → listByActiveGroup(G, N)
                       → 400 GROUP_HAS_ACTIVE_USERS { count, users[] }
                       → modal existente (SaaS)
```

Misma semántica de presencia que cola de trabajo / `User.toRulesContext`: activo si la diferencia en minutos entre `now` y `last_seen_at` es `<= N`.

## Components

| Unidad | Responsabilidad | Depende de |
|--------|-----------------|------------|
| Resolver de umbral (nuevo, pequeño) | `groupId` → `N` minutos; fallback 2 | Group finder/repo + GlobalConfigFinder (o equivalente ya usado en groups API) |
| `GroupUsageGuard` | Obtener `N`, count/list, lanzar `CustomError` + `GROUP_HAS_ACTIVE_USERS` | Users repo + resolver |
| `KnexUsersRepository` | `countByActiveGroup` / `listByActiveGroup` aceptan `minutes` y filtran por `last_seen_at` (Postgres + SQLite en tests) | Knex |
| `GroupUpdater` / `GroupDeleter` | Siguen llamando `ensureNoActiveAssignments(id)` | Guard |
| Group API `Controller` | Cablear resolver al construir el guard | Ya tiene acceso a config/groups |
| SaaS modal / parsers | Sin cambios | Error 400 tipado |

### Archivos previstos (mínimo)

| Archivo | Cambio |
|---------|--------|
| `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js` | Usar resolver + pasar `minutes` al repo |
| `packages/kace_cloud_core/src/grupos/application/...` (nuevo resolver) | Resolver `assignment_active_session_limit` por grupo |
| `packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js` | Filtro SQL por `last_seen_at` en count/list |
| `apps/apiv1/kace_cloud_api_group/src/Controller.mjs` | Wiring del resolver |
| `packages/kace_cloud_core/tests/groups/*` | Actualizar tests de bloqueo + casos stale/null |

## Error handling

### Contrato HTTP 400 (sin cambio de forma)

- `publicErrorCode`: `GROUP_HAS_ACTIVE_USERS` (`0x030027`)
- `publicData`: `{ count, users[] }` con `nombres`, `apellido1`, `apellido2`, `email`
- `count === users.length`
- Orden de `users`: estable actual (`LOWER(nombres)`, `LOWER(apellido1)`, `LOWER(email)`)

### Casos límite

| Caso | Comportamiento |
|------|----------------|
| `grupo_activo = G` y `last_seen_at` dentro de N min | Bloqueo + modal / toast tipado |
| `grupo_activo = G` y `last_seen_at` null o fuera de N | No bloquea; no limpia `grupo_activo` |
| Nadie con `grupo_activo = G` | Permite inactivar/eliminar |
| Config ausente / inválida | `N = 2` |
| Update que no es Active→Inactive | Guard de inactivar no corre |
| Delete con recientemente activos | Bloqueo |
| Delete sin recientemente activos | Permite; cleaner de relaciones sin cambio |

## Testing (TDD)

Orden red → green:

1. **Unit — resolver de umbral:** lee `assignment_active_session_limit`; fallback `2` ante ausencia/ inválido / ≤0 / no entero.
2. **Repo — count/list con `minutes`:** incluye solo ventana; excluye null y timestamps viejos; cubre dialecto Postgres y SQLite de tests.
3. **Unit — `GroupUsageGuard`:** pide `N` al resolver; llama count/list con `(groupId, N)`; `0` → ok; `>0` → error tipado con `users[]`.
4. **Integration — actualizar existentes:** los casos “bloquea” deben insertar `last_seen_at` reciente (hoy muchos solo ponen `grupo_activo` y dejarían de bloquear).
5. **Integration — nuevos:** `last_seen_at` stale o null → permite inactivar/eliminar; `grupo_activo` permanece; sin usuarios → permite; reactivar / update no-status → no consulta guard.

Front: sin tests nuevos salvo rotura accidental del contrato (no prevista).

## Out of scope

- Limpiar `grupo_activo` stale en este flujo (validate-group / logout ya pueden hacerlo en otros paths).
- Cambiar copy o layout del modal.
- Websockets / acelerar `session/alive`.
- Nuevo endpoint o flag `force_clear`.
- Usar `admin.users.active_session_limit` (explícitamente descartado).

## Success criteria

1. Inactivar/eliminar con usuarios solo stale/`null` en `last_seen_at` **sí** se permite.
2. Inactivar/eliminar con al menos un usuario dentro de la ventana **bloquea** y el listado del 400 solo incluye esos usuarios.
3. `N` sale de `assignment_active_session_limit` del grupo objetivo; default 2 si no aplica.
4. Suite relevante de groups/guard en verde tras actualizar fixtures de `last_seen_at`.
