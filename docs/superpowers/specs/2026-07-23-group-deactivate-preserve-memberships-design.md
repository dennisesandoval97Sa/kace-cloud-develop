# Grupo inactivo: conservar membresías y bloquear con listado de usuarios activos

## Context

Al actualizar un grupo de Active → Inactive, `GroupUpdater` llama a `GroupRelationsCleaner`, que hace hard-delete de todas las filas de `rel_usuarios_grupos` para ese grupo. Tras un refresh, el MultiSelect de usuarios queda vacío porque `/user-group-relationships/search` devuelve `items: []`.

Eso es incorrecto: **inactivar no debe desasignar usuarios del grupo**. Las membresías deben permanecer. Lo que sí debe bloquearse es inactivar mientras algún usuario tenga ese grupo como `grupo_activo`.

Hoy `GroupUsageGuard` ya impide inactivar/eliminar si hay asignaciones activas, pero el mensaje solo expone un conteo en texto. El admin necesita ver **quiénes** bloquean (nombre + email) en una UI clara y responsive, sin poder forzar la limpieza de `grupo_activo` desde el formulario de grupo.

Rama de trabajo (solo local, sin push): `fix/group-deactivate-preserve-memberships` (desde `origin/develop`).

## Decisions

- Al desactivar (Active → Inactive): **no** ejecutar `GroupRelationsCleaner`. Las filas de `rel_usuarios_grupos` se conservan.
- Al eliminar un grupo: el cleaner **sí** sigue aplicándose (fuera de cambio de comportamiento salvo tests de no-regresión).
- Mantener `GroupUsageGuard` en inactivar: si `countByActiveGroup(groupId) > 0`, el update falla con **400**.
- El 400 incluye payload estructurado: `code`, `count` y `users[]` con `nombres`, `apellido1`, `apellido2`, `email`.
- Front: ante `GROUP_HAS_ACTIVE_USERS`, mostrar `AlertDialog` informativo con lista responsive. **Sin** botón para desalojar / limpiar `grupo_activo`.
- El admin debe esperar a que esos usuarios cambien de grupo manualmente (selector de grupo existente) y reintentar la inactivación.
- Sin websocket. Sin enriquecer `session/alive` ni acelerar polls para este flujo (quedó fuera al retirar el desalojo forzado).
- Sin flag `force_clear_active_users` ni endpoint de evacuate.
- Principios: TDD, DDD, SOLID, código limpio, cambio mínimo necesario.

## Architecture

```text
Admin PUT group (status = Inactive)
        │
        ▼
 GroupUpdater.isDeactivating?
        │
        ├─ yes → GroupUsageGuard.ensureNoActiveAssignments
        │         ├─ count > 0 → 400 GROUP_HAS_ACTIVE_USERS { count, users[] }
        │         │              → SaaS AlertDialog (info + Cerrar)
        │         └─ count = 0 → update status (+ history)
        │                        NO GroupRelationsCleaner
        │
        └─ no  → update normal (sin guard de inactivar)
```

### Flujo de datos del error

1. Guard consulta usuarios con `grupo_activo = groupId` (conteo + proyección de campos de identidad).
2. Lanza error de dominio/aplicación con `code: 'GROUP_HAS_ACTIVE_USERS'`, `count`, `users`.
3. Controller de groups serializa esos campos en la respuesta HTTP 400 (no solo `message`).
4. `GroupsUpdateHandler` detecta el código y abre el diálogo; otros errores siguen en toast.

### UI del diálogo (informativo)

- Título: no se puede inactivar el grupo.
- Resumen: “N usuario(s) tienen este grupo activo. Deben cambiar de grupo antes de continuar.”
- Lista scrolleable (`max-height`), sin scroll horizontal:
  - **Desktop:** nombre completo a la izquierda, email a la derecha (secundario).
  - **Mobile:** nombre y email apilados, padding cómodo.
- Si `N > 8`: scroll interno + texto “Mostrando N usuarios”.
- Acciones: solo **Cerrar** / entender. Sin acción destructiva ni “desalojar”.
- `apellido2` null/vacío: nombre compuesto sin doble espacio.

## Components

| Unidad | Responsabilidad | Depende de |
|--------|-----------------|------------|
| `GroupUsageGuard` | Bloquear inactivar/eliminar si hay `grupo_activo`; devolver conteo + listado | Users repository (count + list by active group) |
| `GroupUpdater` | Orquestar update; invocar guard solo en Active→Inactive; **no** cleaner en deactivate | Repository, guard, (cleaner solo si se usara en otros paths — no en deactivate) |
| `GroupRelationsCleaner` | Soft/hard cleanup de relaciones | Solo delete (y paths existentes que no sean deactivate) |
| Users repository | `countByActiveGroup` existente; nuevo método de listado mínimo (`findByActiveGroup` o equivalente) | Knex |
| Group API `actionUpdate` | Propagar payload tipado del error 400 | Guard / CustomError shape |
| `GroupsUpdateHandler` + diálogo | Detectar `GROUP_HAS_ACTIVE_USERS` y mostrar lista | Design system `AlertDialog` |

### Archivos previstos (mínimo)

| Archivo | Cambio |
|---------|--------|
| `packages/kace_cloud_core/src/grupos/application/update/GroupUpdater.js` | Quitar llamada a `relationsCleaner` en desactivación |
| `packages/kace_cloud_core/src/grupos/application/guards/GroupUsageGuard.js` | Incluir `users[]` + `code` en el error |
| `packages/kace_cloud_core/src/users/infrastructure/KnexUsersRepository.js` | Listar usuarios por `grupo_activo` (campos acordados) |
| `apps/apiv1/kace_cloud_api_group/src/Controller.mjs` | Asegurar serialización de `code` / `count` / `users` en 400 |
| `packages/kace_cloud_core/tests/groups/*` | Actualizar/añadir tests (TDD) |
| `apps/kace-saas/src/pages/Group/GroupsUpdateHandler.jsx` | Branch de error tipado → diálogo |
| `apps/kace-saas/src/pages/Group/components/*` | Componente de diálogo/lista responsive (nombre a definir en plan) |

## Error handling

### Contrato HTTP 400

```json
{
  "message": "No se puede inactivar el grupo: 3 usuario(s) lo tienen como grupo activo. Reasigne sus grupos primero.",
  "code": "GROUP_HAS_ACTIVE_USERS",
  "count": 3,
  "users": [
    {
      "nombres": "Ana",
      "apellido1": "Pérez",
      "apellido2": "López",
      "email": "ana@example.com"
    }
  ]
}
```

- `code` es estable para branching en el front.
- `count` debe coincidir con `users.length`.
- Orden de `users`: estable (p. ej. por `nombres` + `apellido1` + email) para tests predecibles.
- Errores no tipados: comportamiento actual (toast / mapper existente).

### Casos límite

| Caso | Comportamiento |
|------|----------------|
| Inactivar sin nadie con `grupo_activo` | 200; status Inactive; membresías intactas |
| Inactivar con N usuarios activos | 400 + listado; sin cambios en grupo ni relaciones |
| Update de nombre/otros campos con usuarios activos | Sin guard de inactivar (comportamiento actual) |
| Reactivar Inactive → Active | Sin cleaner; sin guard |
| Delete grupo | Guard + cleaner (sin cambio de producto) |
| Usuario con `apellido2` null | UI omite el segmento vacío |

## Testing (TDD)

Orden sugerido: fallar test de “deactivate preserves relations” → quitar cleaner del path → ampliar guard/error → UI.

1. **Unit/Integration `GroupUpdater`:** Active→Inactive no elimina `rel_usuarios_grupos`; no escribe history de cleaner con `group_deactivated`.
2. **Unit `GroupUsageGuard`:** con usuarios mock → error con `code`, `count`, `users` (shape); sin usuarios → resuelve.
3. **Integration repo:** listado por `grupo_activo` devuelve solo no borrados y campos esperados.
4. **Integration groups:** test actual “wipes on deactivation” se **invierte** a “preserves on deactivation”; delete sigue wipe.
5. **Front:** dado error tipado, se abre diálogo con N filas (nombre + email); no hay CTA de desalojo. Preferir test del presentador/helper de filas si el handler es costoso de montar.

Fuera de alcance de tests nuevos: heartbeat, `validate-group`, websockets, force-clear.

## Out of scope

- Desalojo forzado de `grupo_activo` por admin.
- Cambios en delete de grupo.
- Notificación en tiempo real / websocket.
- Cambiar intervalo de `session/alive` o `validate-group`.
- Push a remoto (migración GitHub; rama solo local).

## Success criteria

1. Inactivar un grupo sin usuarios con ese `grupo_activo` deja las membresías en BD.
2. Intentar inactivar con usuarios activos muestra diálogo con nombres y emails correctos y no muta el grupo.
3. Tras que esos usuarios cambien de grupo a mano, el admin puede inactivar con éxito.
4. Tests anteriores de wipe-on-deactivate actualizados; suite relevante en verde.
