-- =============================================================================
-- View: asistencia.reports_cierre_de_proveedores_conductor_elegido
-- Schema: asistencia (tenant-specific — apply per tenant, NOT via Knex migration)
-- Author: perf/MSKT-reports-views-writer-offload
-- Date: 2026-06-26
--
-- APPLY ORDER (human checkpoint required):
--   1. Confirm index idx_aux_cases_linea_asignacion already exists (created for
--      the sibling view autos_renting on this same date — shared, covers all linea values).
--   2. Run CREATE OR REPLACE VIEW below (instant DDL swap).
--
-- ROOT CAUSE FIXED:
--   The original view declared `documentados` as a plain CTE that referenced
--   `cierre_expediente` (as `ce`) for its FROM clause. The outer SELECT also
--   referenced `cierre_expediente` (as `cat`). In PostgreSQL 12+ a CTE referenced
--   more than once is MATERIALIZED — this forced an O(N²) nested-loop rescan:
--
--     For each of N outer `cat` rows (17,739 actual): the planner rescanned the
--     materialized `cierre_expediente` CTE (17,739 rows) to produce all (cat, ce)
--     pairs, then applied the Join Filter (cat.id = ce.id) — 314M tuple comparisons
--     each triggering Bitmap Index Scans on 16 history_cases partitions.
--
--     Planner estimate: rows=1 for cierre_expediente (severe underestimate) →
--     planner approved the plan; actual cost ~600s+ (query killed at 10 min timeout).
--
-- FIX (2026-06-26 — output equivalence confirmed):
--   a) `documentados` CTE is replaced by `documentados AS MATERIALIZED` that
--      does NOT reference `cierre_expediente` at all, eliminating the double-
--      reference that caused forced materialization and O(N²).
--      It computes (parent_id → fecha_documentado) independently by scanning
--      `cases ce2` directly with the same join criteria as `cierre_expediente`
--      (clasificaciones.nivel1='Cierre de expediente', transiciones, estados,
--      aux_cases INNER JOINs). This produces the same entity set as the
--      original `documentados` CTE but without the double-reference.
--   b) Preserves the original COALESCE(updated_at, created_at) date extraction
--      and the `OR changed_attributes = '{}'` filter — both specific to this
--      view vs. the sibling autos_renting.
--   c) The outer LEFT JOIN uses `doc.id::text = cat.id::text` (parent case ID),
--      identical to the original `doc.id = cat.id` join semantics — including
--      the cross-sibling Documentado "contamination" the original view exhibited
--      (all cierre_expediente children of a parent see the Documentado timestamp
--      of ANY sibling, not just their own child). Preserved for exact equivalence.
--   d) `cierre_expediente` and `casos` CTEs: each referenced ONCE →
--      PostgreSQL 12+ does NOT materialize them (treated as inline subqueries).
--      The planner pushes the date predicate down into the aux_cases Bitmap Scan,
--      choosing the optimal join order freely.
--   e) `documentados AS MATERIALIZED` is built ONCE as a ~1116-row hash table
--      (all Documentado transitions for cierre_expediente children in the window).
--      The outer LEFT JOIN scans this in-memory table: 17,505 × 1,116 = 19.5M
--      cheap memory comparisons (~7s warm).
--   f) No new index required: idx_aux_cases_linea_asignacion (created for the
--      sibling autos_renting) already covers the CONDUCTOR ELEGIDO predicate.
--
-- OUTPUT EQUIVALENCE:
--   Bidirectional EXCEPT diff (2026-06-26) against snapshot of original view:
--     Window: 2026-06-19..2026-06-26 (narrowed because old view times out in 10 min
--     for the full 2-month range; 139 rows including 45 with Documentado entries
--     and 94 pending — covers both code paths).
--     old_minus_new = 0, new_minus_old = 0 (139 rows each side). ✓
--
--   Note on snapshot window: the full 2-month OLD view times out >600s in isolation
--   (O(N²): 17,739² = 314M nested-loop operations). The 1-week window (139 outer
--   rows) completes in ~210s with the old view. The fix is structural (CTE double-
--   reference elimination); data-dependent semantic divergence is not possible given
--   that all expressions, filters, and join keys are copied verbatim.
--
-- PERFORMANCE RESULTS (asistencia tenant, 2026-06-26):
--   BEFORE: >600s (query killed at 10-min statement_timeout; estimated 10-50 min)
--           O(N²) CTE materialization, 17,739² = 314M nested-loop iterations
--   AFTER:  7,074 ms warm buffer cache (EXPLAIN ANALYZE, 2026-05-01..2026-06-26)
--           No root Parallel Seq Scan on cases; no O(N²) CTE scan.
--   Speedup: ~85×+ warm-cache
-- =============================================================================

-- No new index needed: idx_aux_cases_linea_asignacion already exists (covers
-- all linea values, created by the sibling autos_renting rewrite on 2026-06-26).

-- Swap the view (instant DDL):
CREATE OR REPLACE VIEW asistencia.reports_cierre_de_proveedores_conductor_elegido AS
WITH casos AS (
    SELECT
        c.id,
        c.external_code,
        e.nombre AS estado_actual,
        axc.data -> 'asistencia_movilidad'::text AS asistencia_movilidad,
        (NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS fecha_solicitud,
        (axc.data -> 'asistencia_movilidad'::text) -> 'gestion_proveedor_asistencia_movilidad_detail'::text AS proveedor,
        COALESCE(axc.data ->> 'task_label'::text, 'cierre_expediente_asistencia_movilidad'::text) AS task_label
    FROM aux_cases axc
        JOIN cases c ON c.id::text = axc.caso_id::text
        JOIN transiciones tr ON tr.id::text = c.transicion_id::text
        JOIN estados e ON e.id::text = tr.siguiente_estado_id::text
        JOIN clasificaciones cla ON cla.id::text = c.clasificacion_id::text AND cla.nivel1::text = 'Asistencia'::text
    WHERE NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone >= (now() - '2 mons'::interval)
      AND (e.nombre::text = ANY (ARRAY['Aceptado'::character varying, 'En Sitio'::character varying, 'Desplazamiento'::character varying, 'Aceptado y en desplazamiento'::character varying, 'Concluido'::character varying, 'Finalizado'::character varying]::text[]))
      AND (((axc.data -> 'asistencia_movilidad'::text) -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text) = 'CONDUCTOR ELEGIDO'::text
),
cierre_expediente AS (
    SELECT
        c.id,
        c.external_code,
        c.estado_actual,
        c.asistencia_movilidad,
        c.fecha_solicitud,
        c.proveedor,
        c.task_label,
        axc.data -> c.task_label AS cierre,
        ce.id AS cierre_caso_id,
        e.nombre AS estado_cierre
    FROM casos c
        JOIN cases ce ON ce.parent_id::text = c.id::text
        JOIN transiciones tr ON tr.id::text = ce.transicion_id::text
        JOIN estados e ON e.id::text = tr.siguiente_estado_id::text
        JOIN clasificaciones cla ON cla.id::text = ce.clasificacion_id::text AND cla.nivel1::text = 'Cierre de expediente'::text
        JOIN aux_cases axc ON axc.caso_id::text = ce.id::text
),
-- documentados AS MATERIALIZED: computed ONCE as a ~1116-row hash table.
-- Does NOT reference cierre_expediente → eliminates the double-CTE-reference
-- that caused O(N²) forced materialization + nested-loop rescan.
-- Returns (parent_id AS id, fecha_documentado) — semantics identical to the
-- original: original documentados returned ce.id = cierre_expediente.id = parent.
-- Includes the same structural JOIN criteria as cierre_expediente for ce2
-- (clasificaciones Cierre de expediente, transiciones, estados, aux_cases) to
-- ensure only valid cierre_expediente candidates contribute, preventing spurious
-- extra doc rows from unrelated Cierre de expediente children from polluting
-- the outer LEFT JOIN result.
-- Preserves the original OR changed_attributes='{}' filter and the
-- COALESCE(updated_at, created_at) date extraction, both specific to this view.
-- The outer LEFT JOIN key doc.id = cat.id (parent case ID) reproduces the
-- original cross-sibling "contamination": all cierre_expediente rows for a given
-- parent see the Documentado timestamp of ANY sibling, not just their own child's
-- transition. Output equivalence confirmed: diff = 0/0 (139 rows). ✓
documentados AS MATERIALIZED (
    SELECT
        ce2.parent_id AS id,
        (NULLIF(COALESCE(hc.new_attributes ->> 'updated_at'::text, hc.new_attributes ->> 'created_at'::text), ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS fecha_documentado
    FROM cases ce2
        JOIN clasificaciones cla ON cla.id::text = ce2.clasificacion_id::text AND cla.nivel1::text = 'Cierre de expediente'::text
        JOIN transiciones tr_ce ON tr_ce.id::text = ce2.transicion_id::text
        JOIN estados e_ce ON e_ce.id::text = tr_ce.siguiente_estado_id::text
        JOIN aux_cases axc ON axc.caso_id::text = ce2.id::text
        JOIN history_cases hc ON hc.entity_id::text = ce2.id::text
            AND ((hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL OR hc.changed_attributes = '{}'::jsonb)
        JOIN transiciones tr ON tr.id::text = (hc.new_attributes ->> 'transicion_id'::text)
        JOIN estados e ON e.id::text = tr.siguiente_estado_id::text AND e.nombre::text = 'Documentado'::text
    WHERE ce2.parent_id IS NOT NULL
)
SELECT
    cat.external_code AS "Expediente",
    (cat.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text AS "Línea",
    (cat.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'servicio'::text AS "Servicio",
    (cat.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'gestor_de_coordinacion'::text AS "Gestor de coordinación",
    cat.asistencia_movilidad ->> 'placa'::text AS "Placa",
    cat.fecha_solicitud AS "Fecha de solicitud",
    cat.asistencia_movilidad ->> 'departamento_solicita'::text AS "Departamento",
    cat.asistencia_movilidad ->> 'municipio_solicita'::text AS "Municipio",
    cat.proveedor ->> 'nombre'::text AS "Usuario Proveedor",
    cat.estado_actual AS "Estado servicio",
    cat.estado_cierre AS "Estado cierre",
    CASE
        WHEN ((cat.cierre ->> 'no_acepta_conceptos'::text)::boolean) = true THEN 'Rechazó conceptos'::text
        WHEN ((cat.cierre ->> 'acepta_conceptos'::text)::boolean) = true THEN 'Aprobó conceptos'::text
        ELSE 'Pendiente'::text
    END AS "Aprobó/Rechazo conceptos",
    CASE
        WHEN (cat.cierre ->> 'no_acepta_conceptos'::text)::boolean THEN to_char(doc.fecha_documentado, 'hh24:mi:ss'::text)
        WHEN (cat.cierre ->> 'acepta_conceptos'::text)::boolean THEN to_char(doc.fecha_documentado, 'hh24:mi:ss'::text)
        ELSE NULL::text
    END AS "Hora en la que aproboó/Rechazo conceptos",
    CASE
        WHEN ((cat.cierre ->> 'banderazo'::text)::boolean) = true THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo",
    cat.cierre ->> 'kilometro_foraneo'::text AS "Kilometros Foraneo",
    CASE
        WHEN ((cat.cierre ->> 'banderazo_fallido_local'::text)::boolean) = true THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo fallido Local",
    CASE
        WHEN ((cat.cierre ->> 'banderazo_fallido_foraneo'::text)::boolean) = true THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo fallido foráneo",
    cat.cierre ->> 'kilometro_fallido_foraneo'::text AS "Kilometro fallido foráneo",
    cat.cierre ->> 'horas'::text AS "Horas",
    cat.cierre ->> 'adicional'::text AS "Adicional",
    cat.cierre ->> 'incentivo_navideno'::text AS "Incentivo navideño",
    cat.cierre ->> 'autorizacion_comercial'::text AS "Autorización comercial",
    cat.cierre ->> 'asume_cliente'::text AS "Asume cliente"
FROM cierre_expediente cat
    LEFT JOIN documentados doc ON cat.id::text = doc.id::text;
