# Vistas `boards_*` por tenant (manual, no-Knex)

Las vistas con prefijo `boards_*` (p. ej. `boards_cierres_de_expediente`) se **crean
manualmente y son por tenant**. NO se aplican vía migraciones Knex de
`packages/kace_cloud_database`. Este directorio versiona su DDL para que sea revisable,
reproducible y auditable.

## Convención
- Un archivo `.sql` por vista, con el esquema **parametrizable por tenant** (aquí, `asistencia`).
- Aplicar manualmente al tenant correspondiente (ver `docs/database/tenant-views/boards_cierres_de_expediente.sql`).
- Capturar el DDL vigente con: `SELECT pg_get_viewdef('<schema>.<vista>'::regclass, true);`

## Patrón de rendimiento a auditar
Evitar en estas vistas:
1. Casts `::text` sobre llaves de join (anulan índices nativos cuando las columnas ya son `varchar`).
2. Filtros sobre expresiones JSONB sin índice de expresión de soporte.
3. `COUNT(*)` sobre la vista completa para paginar (materializa todo el join).

Ver el caso de referencia: `docs/performance/loadtest-2026-06-24-frontend-selenium.md`.

## Tenants donde existe cada vista
| Vista | Tenants |
|---|---|
| `boards_cierres_de_expediente` | asistencia (SARA) — *auditar otros tenants con el mismo board* |
