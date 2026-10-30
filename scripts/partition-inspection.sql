-- scripts/partition-inspection.sql
-- Ejecutar contra cada tenant DB ANTES de aplicar las migraciones de particionamiento.
-- Aborta el merge si: nulls > 0 en alguna tabla, espacio libre < 2.5x del tamaño de la tabla más grande,
-- o orphans en history_cases.entity_id contra casos.id.

\echo '=== Tamaños de tablas ==='
SELECT
    relname                                   AS table_name,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_relation_size(c.oid))   AS data_size,
    pg_size_pretty(pg_indexes_size(c.oid))    AS index_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('event_logs', 'history_cases', 'history_usuarios', 'history_aux_cases')
  AND c.relkind = 'r'
  AND n.nspname = current_schema()
ORDER BY pg_total_relation_size(c.oid) DESC;

\echo '=== NULLs en partition keys (debe ser 0 en las 4) ==='
SELECT 'event_logs.occurred_at' AS col,
       (SELECT COUNT(*) FROM event_logs WHERE occurred_at IS NULL) AS nulls
UNION ALL
SELECT 'history_cases.created_at',
       (SELECT COUNT(*) FROM history_cases WHERE created_at IS NULL)
UNION ALL
SELECT 'history_usuarios.created_at',
       (SELECT COUNT(*) FROM history_usuarios WHERE created_at IS NULL)
UNION ALL
SELECT 'history_aux_cases.created_at',
       (SELECT COUNT(*) FROM history_aux_cases WHERE created_at IS NULL);

\echo '=== Filas más antiguas (define oldest_month para pre-crear particiones históricas) ==='
SELECT 'event_logs'        AS table_name, MIN(occurred_at) AS oldest_row, COUNT(*) AS row_count FROM event_logs
UNION ALL
SELECT 'history_cases',     MIN(created_at),  COUNT(*) FROM history_cases
UNION ALL
SELECT 'history_usuarios',  MIN(created_at),  COUNT(*) FROM history_usuarios
UNION ALL
SELECT 'history_aux_cases', MIN(created_at),  COUNT(*) FROM history_aux_cases;

\echo '=== Orphans en history_cases.entity_id (debe ser 0; bloquea recreate de FK) ==='
SELECT COUNT(*) AS orphan_count
FROM history_cases h
WHERE NOT EXISTS (SELECT 1 FROM casos c WHERE c.id = h.entity_id);

\echo '=== Espacio libre del tablespace (comparar con max(total_size) × 2.5) ==='
SELECT pg_size_pretty(pg_tablespace_size('pg_default')) AS tablespace_used_size;
-- Nota: pg_tablespace_size mide lo USADO, no lo libre. Ejecutar `df -h` en el RDS host
-- o consultar CloudWatch FreeStorageSpace para el dato real.
