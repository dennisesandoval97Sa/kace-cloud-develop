-- =============================================================================
-- View: asistencia.reports_tiempos_de_escalamiento
-- Schema: asistencia (tenant-specific — apply per tenant, NOT via Knex migration)
-- Author: perf/MSKT-reports-views-writer-offload
-- Date: 2026-06-28 (rebuilt from live view; supersedes 2026-06-26 draft)
--
-- APPLY ORDER (human checkpoint required):
--   1. No new indexes needed — the existing (case_id, occurred_at, event_name)
--      btree indexes on all event_logs_* partitions are sufficient.
--   2. Run CREATE OR REPLACE VIEW (instant DDL swap).
--
-- BASELINE HISTORY:
--   The 2026-06-26 draft was built on a baseline captured before the view was
--   completely rewritten (different CTE structure: event_logs-based state tracking
--   vs history_cases pre-computed timestamps). The live view deployed between
--   2026-06-26 and 2026-06-28 already uses a different architecture
--   (state_change_at / first_view_at / last_assigned_at from history_cases
--   new_attributes, plus DISTINCT ON + case.reassigned JOIN in final SELECT).
--   This file is rebuilt from the CURRENT live view (\sv confirmed 2026-06-28).
--
-- ROOT CAUSE FIXED:
--   The live view's LEFT JOIN event_logs in the final SELECT used aggregate_id
--   for the join predicate:
--
--     LEFT JOIN event_logs el ON el.aggregate_id::text = thc.caso_id::text
--       AND el.event_name::text = 'case.reassigned'::text
--       AND el.occurred_at >= thc.state_change_at
--       AND el.occurred_at <= thc.fecha_modificacion
--
--   The existing btree index on each partition is (case_id, occurred_at, event_name).
--   Using aggregate_id in the join prevented the planner from using this index
--   with selective case-level filtering. The result was:
--     - event_logs_2026_03: full Seq Scan filtering 1,278,614 rows
--     - event_logs_2026_04/05/06: index scans on event_name only (not case_id)
--     - Join filter applied AFTER the full partition read per outer row
--
--   FIX: change el.aggregate_id -> el.case_id in the LEFT JOIN predicate.
--   VERIFIED: case_id = aggregate_id for 100% of case.reassigned events
--   (505 rows checked, 0 mismatches, 2026-06-28).
--   Result: all partitions now use Index Scan on (case_id, occurred_at, event_name)
--   with the specific caso_id + occurred_at range from the outer row.
--   event_logs_2026_03 (1.28M rows): never executed (pruned by case_id).
--
-- OUTPUT EQUIVALENCE (2026-06-28):
--   Rebuilt from the CURRENT live view — semantically identical by construction.
--   Bidirectional TYPE-MATCHED EXCEPT diff (snapshot vs __new, 26 rows):
--     old_minus_new = 0, new_minus_old = 0. ✓
--   No columns excluded: "Tiempo coordinación global" uses NULL::numeric (not now())
--   when state_change_at_anterior IS NULL. No now()-derived output column exists.
--
-- PERFORMANCE RESULTS (asistencia tenant, 2026-06-28, warm buffer cache):
--   BEFORE (live view with aggregate_id):  1,300 ms
--   AFTER  (__new with case_id):             521 ms   (~2.5× speedup)
--   Plan confirms: no root Seq Scan on cases; event_logs_2026_03 never executed.
--   All event_logs partitions: Index Scan on (case_id, occurred_at, event_name).
--
-- NOW()-DERIVED COLUMNS:
--   None in the output. The view uses (now() - '1 mon') only as a WHERE filter
--   in casos and total_historial_casos CTEs — this affects row inclusion, not values.
-- =============================================================================

-- No new indexes required — existing indexes are sufficient:
--   event_logs_2026_03_case_id_occurred_at_event_name_idx  btree(case_id, occurred_at, event_name)
--   event_logs_2026_04_case_id_occurred_at_event_name_idx  btree(case_id, occurred_at, event_name)
--   event_logs_2026_05_case_id_occurred_at_event_name_idx  btree(case_id, occurred_at, event_name)
--   event_logs_2026_06_case_id_occurred_at_event_name_idx  btree(case_id, occurred_at, event_name)
--   (and analogous indexes on future partitions as they are created)

-- Step 1: Swap the view (instant DDL)
CREATE OR REPLACE VIEW asistencia.reports_tiempos_de_escalamiento AS
 WITH casos AS (
         SELECT DISTINCT ON (c.id) c.id AS caso_id,
            c.reference,
            (c.created_at AT TIME ZONE 'America/Bogota'::text) AS created_at,
            (c.updated_at AT TIME ZONE 'America/Bogota'::text) AS updated_at,
            c.updated_by,
            c.external_code,
            axc.data -> 'asistencia_movilidad'::text AS asistencia_movilidad,
            (NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS fecha_solicitud
           FROM cases c
             JOIN clasificaciones cla ON cla.id::text = c.clasificacion_id::text AND cla.nivel1::text = 'Asistencia'::text
             JOIN aux_cases axc ON axc.caso_id::text = c.id::text
             JOIN history_cases hc ON hc.entity_id::text = c.id::text
             JOIN transiciones tr ON tr.id::text = (hc.new_attributes ->> 'transicion_id'::text) AND ((hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL OR hc.changed_attributes = '{}'::jsonb)
             JOIN estados er ON er.id::text = tr.siguiente_estado_id::text AND er.nombre::text = 'Rechazado'::text
          WHERE c.created_at >= (now() - '1 mon'::interval) AND ((axc.data -> 'asistencia_movilidad'::text) ->> 'creado_desde'::text) = 'PANTALLA_ASISTENCIA'::text
          ORDER BY c.id, (hc.new_attributes ->> 'updated_at'::text)
        ), total_historial_casos AS (
         SELECT row_number() OVER (PARTITION BY hc_1.entity_id ORDER BY hc_1.created_at) AS orden,
            row_number() OVER (PARTITION BY hc_1.entity_id ORDER BY hc_1.created_at DESC) AS orden_f,
            hc_1.entity_id AS caso_id,
            hc_1.new_attributes ->> 'transicion_id'::text AS transicion_id,
            hc_1.created_at,
            NULLIF(COALESCE(hc_1.new_attributes ->> 'updated_at'::text, hc_1.new_attributes ->> 'created_at'::text), ''::text)::timestamp with time zone AS transicion_asig_at,
            NULLIF(hc_1.new_attributes ->> 'state_change_at'::text, ''::text)::timestamp with time zone AS state_change_at,
            NULLIF(hc_1.new_attributes ->> 'first_view_at'::text, ''::text)::timestamp with time zone AS first_view_at,
            NULLIF(hc_1.new_attributes ->> 'last_assigned_at'::text, ''::text)::timestamp with time zone AS last_assigned_at,
            hc_1.changed_attributes,
            hc_1.new_attributes,
            hc_1.original_attributes ->> 'responsable_id'::text AS responsable_id,
            hc_1.new_attributes ->> 'updated_by'::text AS updated_by,
            hc_1.new_attributes ->> 'created_by'::text AS created_by,
                CASE
                    WHEN (hc_1.changed_attributes ->> 'transicion_id'::text) IS NOT NULL THEN 1
                    WHEN hc_1.changed_attributes = '{}'::jsonb THEN 1
                    ELSE 0
                END AS transicion_caso
           FROM casos ca_1
             JOIN history_cases hc_1 ON hc_1.entity_id::text = ca_1.caso_id::text AND hc_1.created_at >= (now() - '1 mon'::interval)
        ), transiciones_casos AS (
         SELECT row_number() OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at) AS orden_t,
            row_number() OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at DESC) AS orden_tf,
            thc_1.caso_id,
            thc_1.transicion_id,
            thc_1.transicion_asig_at,
            thc_1.state_change_at,
            thc_1.last_assigned_at,
            lead(thc_1.first_view_at) OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at) AS first_view_at,
            thc_1.responsable_id,
            thc_1.updated_by,
            thc_1.created_by,
            thc_1.created_at,
            upper(e.nombre::text) AS estado,
            thcf.transicion_asig_at AS fecha_modificacion_final,
            thcf.responsable_id AS responsable_final,
            lead(thc_1.transicion_asig_at) OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at) AS fecha_fin,
            lag(thc_1.state_change_at) OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at) AS state_change_at_anterior,
            lag(upper(e.nombre::text)) OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at) AS estado_anterior
           FROM total_historial_casos thc_1
             JOIN transiciones t ON t.id::text = thc_1.transicion_id
             JOIN estados e ON e.id::text = t.siguiente_estado_id::text
             LEFT JOIN total_historial_casos thcf ON thcf.caso_id::text = thc_1.caso_id::text AND thcf.orden_f = 1
          WHERE thc_1.transicion_caso = 1
        ), historial_casos AS (
         SELECT tc.orden_t,
            tc.caso_id,
            tc.state_change_at,
            tc.state_change_at_anterior,
            tc.last_assigned_at,
            tc.first_view_at,
            tc.transicion_asig_at,
            tc.transicion_id,
                CASE
                    WHEN tc.orden_tf = 1 THEN tc.fecha_modificacion_final
                    ELSE tc.fecha_fin
                END AS fecha_modificacion,
            tc.responsable_id,
            COALESCE(tc.updated_by, tc.created_by) AS updated_by,
            tc.estado
           FROM transiciones_casos tc
          WHERE tc.estado = 'RECHAZADO'::text OR tc.estado_anterior = 'RECHAZADO'::text
        )
 SELECT DISTINCT ON (ca.caso_id, thc.state_change_at) ca.external_code AS "Expediente",
    (ca.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text AS "Línea",
    (ca.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'servicio'::text AS "Servicio",
    (ca.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'gestor_de_coordinacion'::text AS "Gestor de coordinación",
    ca.asistencia_movilidad ->> 'placa'::text AS "Riesgo",
    to_char(ca.fecha_solicitud, 'yyyy-mm-dd hh24:mi:ss'::text) AS "Fecha de solicitud",
    ca.asistencia_movilidad ->> 'departamento_solicita'::text AS "Departamento Solicita",
    ca.asistencia_movilidad ->> 'municipio_solicita'::text AS "Municipio Solicita",
    COALESCE(ca.asistencia_movilidad ->> 'tipo_servicio'::text, 'Sin servicio guardianes'::text) AS "Tipo de Servicio",
    COALESCE(ca.asistencia_movilidad ->> 'servicios_especiales'::text, 'No'::text) AS "Servicios Especiales",
    thc.estado AS "Estado del servicio",
    to_char((thc.state_change_at AT TIME ZONE 'America/Bogota'::text), 'yyyy-mm-dd hh24:mi:ss'::text) AS "Fecha cambio de estado",
    to_char((el.occurred_at AT TIME ZONE 'America/Bogota'::text), 'yyyy-mm-dd hh24:mi:ss'::text) AS "Fecha cambio de asignado",
    COALESCE(um.email, u.email) AS "Usuario que realizó el cambio de estado o asignación",
    COALESCE(ur.email, 'Sin usuario asignado'::character varying) AS "Usuario asignado escalamiento",
        CASE
            WHEN thc.first_view_at IS NULL THEN 'Sin fecha visto'::text
            ELSE to_char((thc.first_view_at AT TIME ZONE 'America/Bogota'::text), 'yyyy-mm-dd hh24:mi:ss'::text)
        END AS "Fecha visto por el usuario asignado",
        CASE
            WHEN thc.state_change_at_anterior IS NOT NULL THEN round(EXTRACT(epoch FROM thc.state_change_at - thc.state_change_at_anterior))
            ELSE NULL::numeric
        END AS "Tiempo coordinación global",
        CASE
            WHEN thc.first_view_at IS NOT NULL AND thc.last_assigned_at IS NOT NULL THEN round(EXTRACT(epoch FROM thc.first_view_at - thc.last_assigned_at))::text
            ELSE 'Sin tiempo real'::text
        END AS "Tiempo coordinación productivo",
    ca.created_at AS "Fecha creación caso"
   FROM casos ca
     JOIN historial_casos thc ON thc.caso_id::text = ca.caso_id::text
     JOIN usuarios u ON u.id::text = thc.updated_by
     -- FIX: use el.case_id instead of el.aggregate_id to enable the existing
     -- (case_id, occurred_at, event_name) btree index on each event_logs partition.
     -- case_id = aggregate_id for 100% of case.reassigned events (505 rows, 0 mismatches).
     -- Before: Seq Scan on event_logs_2026_03 (1,278,614 rows), index scans on event_name only.
     -- After:  Index Scan on (case_id, occurred_at, event_name) per partition;
     --         event_logs_2026_03 never executed (pruned by case_id predicate).
     LEFT JOIN event_logs el ON el.case_id::text = thc.caso_id::text AND el.event_name::text = 'case.reassigned'::text AND el.occurred_at >= thc.state_change_at AND el.occurred_at <= thc.fecha_modificacion
     LEFT JOIN usuarios um ON um.id::text = el.initiated_by_user::text
     LEFT JOIN usuarios ur ON ur.id::text = (el.body ->> 'responsable_id'::text)
  ORDER BY ca.caso_id, thc.state_change_at;
