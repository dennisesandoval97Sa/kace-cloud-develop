-- Baseline DDL captured 2026-06-26
-- Schema: asistencia
-- Source: \sv asistencia.reports_cierre_de_proveedores_conductor_elegido

CREATE OR REPLACE VIEW asistencia.reports_cierre_de_proveedores_conductor_elegido AS
 WITH casos AS (
         SELECT c.id,
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
          WHERE NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone >= (now() - '2 mons'::interval) AND (e.nombre::text = ANY (ARRAY['Aceptado'::character varying, 'En Sitio'::character varying, 'Desplazamiento'::character varying, 'Aceptado y en desplazamiento'::character varying, 'Concluido'::character varying, 'Finalizado'::character varying]::text[])) AND (((axc.data -> 'asistencia_movilidad'::text) -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text) = 'CONDUCTOR ELEGIDO'::text
        ), cierre_expediente AS (
         SELECT c.id,
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
        ), documentados AS (
         SELECT ce.id,
            (NULLIF(COALESCE(hc.new_attributes ->> 'updated_at'::text, hc.new_attributes ->> 'created_at'::text), ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS fecha_documentado
           FROM cierre_expediente ce
             JOIN history_cases hc ON hc.entity_id::text = ce.cierre_caso_id::text AND ((hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL OR hc.changed_attributes = '{}'::jsonb)
             JOIN transiciones tr ON tr.id::text = (hc.new_attributes ->> 'transicion_id'::text)
             JOIN estados e ON e.id::text = tr.siguiente_estado_id::text AND e.nombre::text = 'Documentado'::text
        )
 SELECT cat.external_code AS "Expediente",
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
