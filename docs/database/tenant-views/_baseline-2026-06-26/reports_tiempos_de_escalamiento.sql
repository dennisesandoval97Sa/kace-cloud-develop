-- Baseline DDL captured 2026-06-26
-- Schema: asistencia
-- Source: \sv asistencia.reports_tiempos_de_escalamiento

CREATE OR REPLACE VIEW asistencia.reports_tiempos_de_escalamiento AS
 WITH casos AS (
         SELECT DISTINCT ON (c.id) c.id,
            c.reference,
            (c.created_at AT TIME ZONE 'America/Bogota'::text) AS created_at,
            (c.updated_at AT TIME ZONE 'America/Bogota'::text) AS updated_at,
            c.updated_by,
            c.external_code,
            axc.data -> 'asistencia_movilidad'::text AS asistencia_movilidad,
            (NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS fecha_solicitud,
            hc.new_attributes ->> 'updated_at'::text AS updated_at_rechazado
           FROM cases c
             JOIN clasificaciones cla ON cla.id::text = c.clasificacion_id::text AND cla.nivel1::text = 'Asistencia'::text
             JOIN aux_cases axc ON axc.caso_id::text = c.id::text
             JOIN history_cases hc ON hc.entity_id::text = c.id::text
             JOIN transiciones tr ON tr.id::text = (hc.new_attributes ->> 'transicion_id'::text) AND ((hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL OR hc.changed_attributes = '{}'::jsonb)
             JOIN estados er ON er.id::text = tr.siguiente_estado_id::text AND er.nombre::text = 'Rechazado'::text
          WHERE c.created_at >= (now() - '2 mons'::interval) AND ((axc.data -> 'asistencia_movilidad'::text) ->> 'creado_desde'::text) = 'PANTALLA_ASISTENCIA'::text
          ORDER BY c.id, (hc.new_attributes ->> 'updated_at'::text)
        ), view_casos AS (
         SELECT el.aggregate_id AS caso_id,
            el.initiated_by_user AS responsable_id,
            (el.occurred_at AT TIME ZONE 'America/Bogota'::text) AS view_at,
            el.body ->> 'transicion_id'::text AS transicion_id,
            (el.body -> 'state'::text) ->> 'nombre'::text AS estado
           FROM casos c
             JOIN event_logs el ON el.aggregate_id::text = c.id::text
          WHERE el.event_name::text = 'case.viewed'::text
        ), state_changed_casos AS (
         SELECT (el.occurred_at AT TIME ZONE 'America/Bogota'::text) AS state_changed_at,
            el.initiated_by_user AS responsable_id,
            el.aggregate_id AS caso_id,
            el.body ->> 'transicion_id'::text AS transicion_id,
            (el.old_data -> 'state'::text) ->> 'nombre'::text AS estado_anterior
           FROM event_logs el
          WHERE (el.aggregate_id::text IN ( SELECT view_casos.caso_id
                   FROM view_casos)) AND el.event_name::text = 'case.state_changed'::text
        ), total_historial_casos AS (
         SELECT row_number() OVER (PARTITION BY hc.entity_id ORDER BY hc.created_at) AS orden,
            row_number() OVER (PARTITION BY hc.entity_id ORDER BY hc.created_at DESC) AS orden_f,
            hc.entity_id AS caso_id,
            hc.new_attributes ->> 'transicion_id'::text AS transicion_id,
            (NULLIF(COALESCE(hc.new_attributes ->> 'updated_at'::text, hc.new_attributes ->> 'created_at'::text), ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS transicion_asig_at,
            hc.new_attributes ->> 'responsable_id'::text AS responsable_id,
            hc.new_attributes ->> 'updated_by'::text AS updated_by,
            hc.new_attributes ->> 'created_by'::text AS created_by,
            ca_1.id AS case_created_at,
                CASE
                    WHEN (hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL THEN 1
                    WHEN (hc.changed_attributes ->> 'responsable_id'::text) IS NOT NULL THEN 1
                    WHEN hc.changed_attributes = '{}'::jsonb THEN 1
                    ELSE 0
                END AS transicion_caso
           FROM casos ca_1
             JOIN history_cases hc ON hc.entity_id::text = ca_1.id::text
          WHERE (hc.new_attributes ->> 'updated_at'::text) >= ca_1.updated_at_rechazado
        ), transiciones_casos AS (
         SELECT row_number() OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at) AS orden_t,
            row_number() OVER (PARTITION BY thc_1.caso_id ORDER BY thc_1.transicion_asig_at DESC) AS orden_tf,
            thc_1.caso_id,
            thc_1.transicion_id,
            thc_1.transicion_asig_at,
            thc_1.responsable_id,
            thc_1.updated_by,
            thc_1.created_by,
            thc_1.case_created_at,
            thca.transicion_asig_at AS fecha_modificacion_anterior,
            thcf.transicion_asig_at AS fecha_modificacion_final,
            thcf.responsable_id AS responsable_final
           FROM total_historial_casos thc_1
             LEFT JOIN total_historial_casos thca ON thca.caso_id::text = thc_1.caso_id::text AND thca.orden = (thc_1.orden - 1)
             LEFT JOIN total_historial_casos thcf ON thcf.caso_id::text = thc_1.caso_id::text AND thcf.orden_f = 1
          WHERE thc_1.transicion_caso = 1
        ), historial_casos AS (
         SELECT tc.orden_t,
            tc.caso_id,
            tc.transicion_id,
            tc.transicion_asig_at AS updated_at,
                CASE
                    WHEN tc.orden_tf = 1 THEN tc.fecha_modificacion_final
                    ELSE tc.transicion_asig_at
                END AS fecha_modificacion,
                CASE
                    WHEN tc.orden_tf = 1 THEN tc.responsable_final
                    ELSE tc.responsable_id
                END AS responsable_id,
            COALESCE(tc.updated_by, tc.created_by) AS updated_by,
            e.nombre AS estado,
            ea.nombre AS estado_anterior,
            lead(tc.responsable_id) OVER (PARTITION BY tc.caso_id ORDER BY tc.transicion_asig_at) AS siguiente_responsable_id
           FROM transiciones_casos tc
             JOIN transiciones t ON t.id::text = tc.transicion_id
             JOIN estados ea ON ea.id::text = t.estado_actual_id::text
             JOIN estados e ON e.id::text = t.siguiente_estado_id::text
        ), historial_casos_views AS (
         SELECT hcn.caso_id,
            hcn.updated_at,
            hcn.updated_by,
            hcn.fecha_modificacion,
            hcn.estado,
            COALESCE(scc.estado_anterior, hcn.estado_anterior::text) AS estado_anterior,
            hcn.responsable_id,
            hcn.siguiente_responsable_id,
            vc.view_at AS fecha_visto,
            vc.estado AS estado_visto,
            scc.responsable_id AS gestor_id,
            scc.state_changed_at AS fecha_modificacion_sig
           FROM historial_casos hcn
             LEFT JOIN view_casos vc ON vc.caso_id::text = hcn.caso_id::text AND vc.transicion_id = hcn.transicion_id AND vc.responsable_id::text = hcn.responsable_id
             LEFT JOIN state_changed_casos scc ON scc.caso_id::text = hcn.caso_id::text AND scc.transicion_id = hcn.transicion_id AND scc.state_changed_at <= hcn.updated_at
        )
 SELECT ca.external_code AS "Expediente",
    (ca.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text AS "Línea",
    (ca.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'servicio'::text AS "Servicio",
    (ca.asistencia_movilidad -> 'asignacion_asistencia_movilidad'::text) ->> 'gestor_de_coordinacion'::text AS "Gestor de coordinación",
    ca.asistencia_movilidad ->> 'placa'::text AS "Riesgo",
    ca.fecha_solicitud AS "Fecha de solicitud",
    ca.asistencia_movilidad ->> 'departamento_solicita'::text AS "Departamento Solicita",
    ca.asistencia_movilidad ->> 'municipio_solicita'::text AS "Municipio Solicita",
    COALESCE(ca.asistencia_movilidad ->> 'tipo_servicio'::text, 'Sin servicio guardianes'::text) AS "Tipo de Servicio",
    COALESCE(ca.asistencia_movilidad ->> 'servicios_especiales'::text, 'No'::text) AS "Servicios Especiales",
    thc.estado AS "Estado del servicio",
    thc.updated_at AS "Fecha cambio de estado",
    thc.fecha_modificacion AS "Fecha cambio de asignado",
    um.email AS "Usuario que realizó el cambio de estado o asignación",
    COALESCE(us.email, 'Sin usuario asignado'::character varying) AS "Usuario asignado escalamiento",
        CASE
            WHEN thc.fecha_visto IS NULL THEN 'Sin fecha visto'::text
            ELSE to_char(thc.fecha_visto, 'yyyy-mm-dd hh24:mi:ss'::text)
        END AS "Fecha visto por el usuario asignado",
        CASE
            WHEN thc.fecha_modificacion_sig IS NOT NULL THEN round(EXTRACT(epoch FROM thc.fecha_modificacion_sig - thc.fecha_modificacion))
            ELSE round(EXTRACT(epoch FROM (now() AT TIME ZONE 'America/Bogota'::text) - thc.fecha_modificacion))
        END AS "Tiempo coordinación global",
        CASE
            WHEN thc.fecha_visto IS NOT NULL AND thc.fecha_modificacion IS NOT NULL THEN round(EXTRACT(epoch FROM thc.fecha_visto - thc.fecha_modificacion))
            ELSE NULL::numeric
        END AS "Tiempo coordinación productivo",
    ca.created_at AS "Fecha creación caso"
   FROM casos ca
     JOIN historial_casos_views thc ON thc.caso_id::text = ca.id::text
     JOIN usuarios u ON u.id::text = thc.responsable_id
     JOIN usuarios um ON um.id::text = thc.updated_by
     LEFT JOIN usuarios us ON us.id::text = thc.siguiente_responsable_id;
