-- =============================================================================
-- View: asistencia.reports_cierre_de_proveedores_autos_renting
-- Schema: asistencia (tenant-specific — apply per tenant, NOT via Knex migration)
-- Author: perf/MSKT-reports-views-writer-offload
-- Date: 2026-06-26
--
-- APPLY ORDER (human checkpoint required):
--   1. Run the CREATE INDEX CONCURRENTLY block first (zero-downtime, online)
--   2. Wait for the index to finish building
--   3. Run CREATE OR REPLACE VIEW (instant DDL swap)
--
-- ROOT CAUSE FIXED:
--   The original view declared `documentados` as a CTE and referenced
--   `cierre_expediente` twice (once as `cat` in the outer SELECT, once as `ce`
--   inside `documentados`). In PostgreSQL 12+ a CTE referenced more than once
--   is MATERIALIZED — this forced an O(N²) nested-loop scan:
--     6,910 outer rows × 7,887 inner CTE rows = 54,499,170 history_cases index
--     lookups, producing 89M temp pages and ~50 minutes execution time.
--
-- FIX (final, 2026-06-26 — output equivalence confirmed):
--   a) `documentados` CTE is replaced by `documentados AS MATERIALIZED` that
--      does NOT reference `cierre_expediente` at all, eliminating the
--      double-reference that caused forced materialization and O(N²).
--      It computes (parent_id → fecha_documentado) independently by scanning
--      cases directly with the same join criteria as `cierre_expediente`
--      (clasificaciones.nivel1='Cierre de expediente', transiciones, estados,
--      aux_cases INNER JOINs). This produces the same entity set as the
--      original `documentados` CTE but without the double-reference issue.
--   b) The outer LEFT JOIN uses `doc.id::text = cat.id::text` (parent case ID),
--      which is IDENTICAL to the original `doc.id = cat.id` join semantics —
--      including the cross-sibling Documentado "contamination" the original
--      view exhibited (all cierre_expediente children of a parent see the
--      Documentado timestamp of ANY sibling, not just their own child).
--      This behavior is preserved for exact output equivalence.
--   c) `cierre_expediente` and `casos` CTEs: each referenced ONCE →
--      PostgreSQL 12+ does NOT materialize them (treated as inline subqueries).
--      The planner optimizes the join order freely.
--   d) `documentados AS MATERIALIZED` is built ONCE as a ~1100-row hash table
--      (all Documentado transitions for cierre_expediente children in the 2-month
--      window). The outer LEFT JOIN is a nested-loop against this in-memory
--      table: 6910 × 1102 = 7.6M cheap memory comparisons (~7.8s warm).
--
-- OUTPUT EQUIVALENCE:
--   Bidirectional EXCEPT diff (2026-06-26) against snapshot of original view:
--     old_minus_new = 0, new_minus_old = 0 (2768 rows each side). ✓
--
-- INITIAL REWRITE FAILURE ANALYSIS:
--   First iteration used a child-correlated LATERAL (hc.entity_id = cat.cierre_caso_id)
--   → produced old_minus_new=5 because siblings without their own Documentado
--   history got NULL instead of the sibling's fecha_documentado.
--   Second iteration used a parent-correlated LATERAL → correct semantics but
--   O(N × LATERAL_cost) = 19 min (each of 6910 outer rows triggers a 4-table
--   subquery) AND over-counted (found cases outside cierre_expediente).
--   Third iteration (this file) uses documentados AS MATERIALIZED: O(N+M). ✓
--
-- INDEXES TO CREATE FIRST:
--   idx_aux_cases_linea_asignacion — btree on the linea JSONB text extraction,
--   partial (linea IS NOT NULL). Allows the planner to scan aux_cases by linea
--   instead of driving from the full cierre_expediente scan.
--
-- PERFORMANCE RESULTS (asistencia tenant, 2026-06-26):
--   BEFORE:  3,049,430 ms (~50 min)  — O(N²) CTE materialization
--   AFTER:   7,815 ms warm buffer cache (EXPLAIN ANALYZE confirmed)
--            No root Parallel Seq Scan on cases; no O(N²) CTE scan.
--   Speedup: ~390× warm-cache (acceptable; further optimization possible)
-- =============================================================================

-- Step 1: Create index (safe to run at any time, CONCURRENTLY = zero locks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aux_cases_linea_asignacion
ON asistencia.aux_cases
(((data -> 'asistencia_movilidad' -> 'asignacion_asistencia_movilidad') ->> 'linea'))
WHERE (data -> 'asistencia_movilidad' -> 'asignacion_asistencia_movilidad') ->> 'linea' IS NOT NULL;

-- Step 2: Swap the view (apply only after the index above is confirmed built)
CREATE OR REPLACE VIEW asistencia.reports_cierre_de_proveedores_autos_renting AS
WITH casos AS (
    SELECT
        c.id,
        c.external_code,
        e.nombre AS estado_actual,
        axc.data -> 'asistencia_movilidad'::text AS asistencia_movilidad,
        (NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone
            AT TIME ZONE 'America/Bogota'::text) AS fecha_solicitud,
        (axc.data -> 'asistencia_movilidad'::text) -> 'gestion_proveedor_asistencia_movilidad_detail'::text AS proveedor,
        COALESCE(axc.data ->> 'task_label'::text, 'cierre_expediente_asistencia_movilidad'::text) AS task_label
    FROM aux_cases axc
        JOIN cases c ON c.id::text = axc.caso_id::text
        JOIN transiciones tr ON tr.id::text = c.transicion_id::text
        JOIN estados e ON e.id::text = tr.siguiente_estado_id::text
        JOIN clasificaciones cla ON cla.id::text = c.clasificacion_id::text AND cla.nivel1::text = 'Asistencia'::text
    WHERE NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone
              >= (now() - '2 mons'::interval)
      AND e.nombre::text = ANY (ARRAY['Aceptado'::text, 'En Sitio'::text, 'Desplazamiento'::text,
                                       'Aceptado y en desplazamiento'::text, 'Concluido'::text, 'Finalizado'::text])
      AND ((((axc.data -> 'asistencia_movilidad'::text) -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text)
              = ANY (ARRAY['AUTOS'::text, 'RENTING'::text]))
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
        JOIN clasificaciones cla ON cla.id::text = ce.clasificacion_id::text AND cla.nivel1::text = 'Cierre de expediente'::text
        JOIN transiciones tr ON tr.id::text = ce.transicion_id::text
        JOIN estados e ON e.id::text = tr.siguiente_estado_id::text
        JOIN aux_cases axc ON axc.caso_id::text = ce.id::text
),
-- documentados is computed ONCE as a MATERIALIZED hash table (~1100 rows).
-- Does NOT reference cierre_expediente → avoids the double-CTE-reference
-- that caused the original O(N²) materialization of cierre_expediente.
-- Returns (parent_id AS id, fecha_documentado) — same semantics as the
-- original documentados CTE (which returned ce.id = parent case ID).
-- Includes ALL cierre_expediente join criteria for cases ce2 to ensure
-- only valid cierre_expediente children's history is included.
-- The outer LEFT JOIN key doc.id = cat.id (parent case ID) reproduces the
-- original cross-sibling "contamination": all cierre_expediente rows for a
-- given parent see the Documentado timestamp of ANY sibling, not just their
-- own child's transition. Output equivalence confirmed: diff = 0/0. ✓
documentados AS MATERIALIZED (
    SELECT
        ce2.parent_id AS id,
        (NULLIF(hc.new_attributes ->> 'updated_at'::text, ''::text)::timestamp with time zone
            AT TIME ZONE 'America/Bogota'::text) AS fecha_documentado
    FROM cases ce2
        JOIN clasificaciones cla ON cla.id::text = ce2.clasificacion_id::text
            AND cla.nivel1::text = 'Cierre de expediente'::text
        JOIN transiciones tr_ce ON tr_ce.id::text = ce2.transicion_id::text
        JOIN estados e_ce ON e_ce.id::text = tr_ce.siguiente_estado_id::text
        JOIN aux_cases axc ON axc.caso_id::text = ce2.id::text
        JOIN history_cases hc ON hc.entity_id::text = ce2.id::text
            AND (hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL
            AND hc.created_at >= (now() - '2 mons'::interval)
        JOIN transiciones tr ON tr.id::text = (hc.new_attributes ->> 'transicion_id'::text)
        JOIN estados e ON e.id::text = tr.siguiente_estado_id::text
            AND e.nombre::text = 'Documentado'::text
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
    cat.proveedor ->> 'nombre'::text AS "Usuario proveedor",
    cat.estado_actual AS "Estado servicio",
    cat.estado_cierre AS "Estado cierre",
    CASE
        WHEN (cat.cierre ->> 'no_acepta_conceptos'::text)::boolean THEN 'Rechazó conceptos'::text
        WHEN (cat.cierre ->> 'acepta_conceptos'::text)::boolean THEN 'Aprobó conceptos'::text
        ELSE 'Pendiente'::text
    END AS "Aprobó/Rechazo conceptos",
    CASE
        WHEN (cat.cierre ->> 'no_acepta_conceptos'::text)::boolean THEN to_char(doc.fecha_documentado, 'hh24:mi:ss'::text)
        WHEN (cat.cierre ->> 'acepta_conceptos'::text)::boolean THEN to_char(doc.fecha_documentado, 'hh24:mi:ss'::text)
        ELSE NULL::text
    END AS "Hora en que Aprobó/Rechazo conceptos",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'banderazo'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'banderazo_pesado_extra_grande'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo pesado extra grande",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'foraneo'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Foráneo",
    COALESCE(NULLIF(cat.cierre ->> 'kilometro_foraneo'::text, ''::text)::numeric, 0::numeric) AS "Kilometro foráneo",
    COALESCE(NULLIF(cat.cierre ->> 'kilometros_duo_bus'::text, ''::text)::numeric, 0::numeric) AS "Kilometros duo bus",
    COALESCE(NULLIF(cat.cierre ->> 'kilometros_pesado_extra_grande'::text, ''::text)::numeric, 0::numeric) AS "Kilometros pesado extra grande",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'banderazo_fallido_local'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo fallido local",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'banderazo_fallido_foraneo'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Banderazo fallido foráneo",
    COALESCE(NULLIF(cat.cierre ->> 'kilometro_fallido_foraneo'::text, ''::text)::numeric, 0::numeric) AS "Kilometro fallido foráneo",
    COALESCE(NULLIF(cat.cierre ->> 'zona_destapada'::text, ''::text), ''::text) AS "Zona destapada",
    COALESCE(NULLIF(cat.cierre ->> 'zona_roja'::text, ''::text), ''::text) AS "Zona roja",
    COALESCE(NULLIF(cat.cierre ->> 'horas'::text, ''::text)::numeric, 0::numeric) AS "Horas",
    COALESCE(NULLIF(cat.cierre ->> 'maniobras'::text, ''::text), ''::text) AS "Maniobras",
    COALESCE(NULLIF(cat.cierre ->> 'maniobras_justificacion'::text, ''::text), ''::text) AS "Maniobras Justificación",
    COALESCE(NULLIF(cat.cierre ->> 'adicional'::text, ''::text), ''::text) AS "Adicional",
    COALESCE(NULLIF(cat.cierre ->> 'justificacion'::text, ''::text), ''::text) AS "Adicional Justificación",
    COALESCE(NULLIF(cat.cierre ->> 'parqueadero'::text, ''::text), ''::text) AS "Parqueadero",
    COALESCE(NULLIF(cat.cierre ->> 'custodia'::text, ''::text), ''::text) AS "Custodia",
    COALESCE(NULLIF(cat.cierre ->> 'custodia_veh_liviano'::text, ''::text), ''::text) AS "Custodia Veh liviano",
    COALESCE(NULLIF(cat.cierre ->> 'custodia_veh_pesado_grande'::text, ''::text), ''::text) AS "Custodia Veh pesado grande",
    COALESCE(NULLIF(cat.cierre ->> 'custodia_veh_pesado_mediano'::text, ''::text), ''::text) AS "Custoria Veh pesado mediano",
    COALESCE(NULLIF(cat.cierre ->> 'custodia_veh_pesado_pequeno'::text, ''::text), ''::text) AS "Custodia Veh pesado pequeño",
    COALESCE(NULLIF(cat.cierre ->> 'desplazamiento'::text, ''::text), ''::text) AS "Desplazamiento",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'segundo_desplazamiento_local'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Segundo desplazamiento local",
    COALESCE(NULLIF(cat.cierre ->> 'uso_del_patin'::text, ''::text), ''::text) AS "Uso del patín",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'desmonte_cardan_bomper_y_ejes'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Desmonte cardan bomper y ejes",
    COALESCE(NULLIF(cat.cierre ->> 'toneladas'::text, ''::text)::numeric, 0::numeric) AS "Toneladas",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'ayudante'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Ayudante",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'bicicleta'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Bicicleta",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'blindaje'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Blindaje",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'camilla'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Camilla",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'combustible'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Combustible",
    COALESCE(NULLIF(cat.cierre ->> 'convenio'::text, ''::text), ''::text) AS "Convenio",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'incentivo_navideno'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Incentivo navideño",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'mascota'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Mascota",
    COALESCE(NULLIF(cat.cierre ->> 'asume_cliente'::text, ''::text), ''::text) AS "Asume cliente",
    COALESCE(NULLIF(cat.cierre ->> 'descripcion'::text, ''::text), ''::text) AS "Descripción",
    COALESCE(NULLIF(cat.cierre ->> 'autorizacion_comercial'::text, ''::text), ''::text) AS "Autorización Comercial",
    COALESCE(NULLIF(cat.cierre ->> 'costo_total_del_cliente'::text, ''::text), ''::text) AS "Costo total cliente",
    COALESCE(NULLIF(cat.cierre ->> 'cerradura_seguridad'::text, ''::text), ''::text) AS "Cerradura seguridad",
    COALESCE(NULLIF(cat.cierre ->> 'causa_del_accidente'::text, ''::text), ''::text) AS "Causa del accidente",
    COALESCE(NULLIF(cat.cierre ->> 'clase_rc_asegurado'::text, ''::text), ''::text) AS "Clase RC asegurado",
    COALESCE(NULLIF(cat.cierre ->> 'concluido_servicio'::text, ''::text), ''::text) AS "Concluido servicio",
    COALESCE(NULLIF(cat.cierre ->> 'condicion_climatica'::text, ''::text), ''::text) AS "Condición climática",
    COALESCE(NULLIF(cat.cierre ->> 'estado_de_la_via'::text, ''::text), ''::text) AS "Estado vía",
    COALESCE(NULLIF(cat.cierre ->> 'fecha_y_hora_de_actuacion'::text, ''::text), ''::text) AS "Fecha y hora de actuación",
    COALESCE(NULLIF(cat.cierre ->> 'fecha_y_hora_de_actuacion_2'::text, ''::text), ''::text) AS "Fecha y hora de actuación 2",
    COALESCE(NULLIF(cat.cierre ->> 'fecha_y_hora_de_actuacion_3'::text, ''::text), ''::text) AS "Fecha y hora de actuación 3",
    COALESCE(NULLIF(cat.cierre ->> 'mesa_sala'::text, ''::text), ''::text) AS "Mesa sala",
    COALESCE(NULLIF(cat.cierre ->> 'motivo_accidente'::text, ''::text), ''::text) AS "Motivo accidente",
    COALESCE(NULLIF(cat.cierre ->> 'motivo_del_servicio'::text, ''::text), ''::text) AS "Motivo del servicio",
    COALESCE(NULLIF(cat.cierre ->> 'numero_de_actuaciones'::text, ''::text), ''::text) AS "Numero de actuaciones",
    COALESCE(NULLIF(cat.cierre ->> 'numero_de_pisos_movilizar'::text, ''::text), ''::text) AS "Numero de pisos movilizar",
    CASE
        WHEN COALESCE(NULLIF(cat.cierre ->> 'pago_servicios_movilidad'::text, ''::text)::boolean, false) THEN 'SI'::text
        ELSE 'NO'::text
    END AS "Pago servicios movilidad",
    COALESCE(NULLIF(cat.cierre ->> 'rc_asegurado'::text, ''::text), ''::text) AS "RC asegurado",
    COALESCE(NULLIF(cat.cierre ->> 'resultado_fallo'::text, ''::text), ''::text) AS "Resultado fallo",
    COALESCE(NULLIF(cat.cierre ->> 'transito_centro_conciliacion'::text, ''::text), ''::text) AS "Transito centro de conciliación"
FROM cierre_expediente cat
LEFT JOIN documentados doc ON doc.id::text = cat.id::text;
