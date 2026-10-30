-- Baseline DDL captured 2026-06-26
-- Schema: asistencia
-- Source: \sv asistencia.reports_cierre_de_proveedores_autos_renting

CREATE OR REPLACE VIEW asistencia.reports_cierre_de_proveedores_autos_renting AS
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
          WHERE NULLIF((axc.data -> 'asistencia_movilidad'::text) ->> 'fecha_y_hora_de_solicitud'::text, ''::text)::timestamp with time zone >= (now() - '2 mons'::interval) AND (e.nombre::text = ANY (ARRAY['Aceptado'::character varying, 'En Sitio'::character varying, 'Desplazamiento'::character varying, 'Aceptado y en desplazamiento'::character varying, 'Concluido'::character varying, 'Finalizado'::character varying]::text[])) AND ((((axc.data -> 'asistencia_movilidad'::text) -> 'asignacion_asistencia_movilidad'::text) ->> 'linea'::text) = ANY (ARRAY['AUTOS'::text, 'RENTING'::text]))
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
             JOIN clasificaciones cla ON cla.id::text = ce.clasificacion_id::text AND cla.nivel1::text = 'Cierre de expediente'::text
             JOIN transiciones tr ON tr.id::text = ce.transicion_id::text
             JOIN estados e ON e.id::text = tr.siguiente_estado_id::text
             JOIN aux_cases axc ON axc.caso_id::text = ce.id::text
        ), documentados AS (
         SELECT ce.id,
            (NULLIF(hc.new_attributes ->> 'updated_at'::text, ''::text)::timestamp with time zone AT TIME ZONE 'America/Bogota'::text) AS fecha_documentado
           FROM history_cases hc
             JOIN cierre_expediente ce ON ce.cierre_caso_id::text = hc.entity_id::text
             JOIN transiciones tr ON tr.id::text = (hc.new_attributes ->> 'transicion_id'::text)
             JOIN estados e ON e.id::text = tr.siguiente_estado_id::text AND e.nombre::text = 'Documentado'::text
          WHERE (hc.changed_attributes ->> 'transicion_id'::text) IS NOT NULL AND hc.created_at >= (now() - '2 mons'::interval)
        )
 SELECT cat.external_code AS "Expediente",
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
     LEFT JOIN documentados doc ON cat.id::text = doc.id::text;
