-- Tenant view: boards_cierres_de_expediente
-- Manual, per-tenant (prefijo boards_*). NO se aplica vía migraciones Knex.
-- Fix 2026-06-24: se eliminaron los casts ::text de las llaves de join (todas son
-- character varying) para habilitar índices nativos, y se añade un índice de expresión
-- para el filtro usuario_proveedor. Ver docs/performance/loadtest-2026-06-24-frontend-selenium.md
--
-- Aplicar el índice PRIMERO (CONCURRENTLY, fuera de transacción), luego la vista.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aux_cases_usuario_proveedor
  ON asistencia.aux_cases
  (((data -> 'asistencia_movilidad' -> 'gestion_proveedor_asistencia_movilidad_detail') ->> 'id_usuario_proveedor'))
  WHERE (data -> 'asistencia_movilidad' -> 'gestion_proveedor_asistencia_movilidad_detail' ->> 'id_usuario_proveedor') IS NOT NULL;

CREATE OR REPLACE VIEW asistencia.boards_cierres_de_expediente AS
 WITH cierres_de_expediente AS (
   SELECT c_1.id AS id_caso,
          c_1.parent_id,
          e_1.nombre AS estado,
          (ac_1.data -> 'cierre_expediente_asistencia_movilidad') ->> 'resultado_fallo' AS fallo
     FROM asistencia.cases c_1
       JOIN asistencia.aux_cases ac_1       ON ac_1.caso_id = c_1.id
       JOIN asistencia.transiciones t_1     ON t_1.id       = c_1.transicion_id
       JOIN asistencia.estados e_1          ON e_1.id       = t_1.siguiente_estado_id
       JOIN asistencia.clasificaciones c2_1 ON c2_1.id      = c_1.clasificacion_id
    WHERE c2_1.nivel1 = 'Cierre de expediente'
 )
 SELECT c.id,
        c2.id_caso AS id_subcaso,
        c.external_code AS expediente,
        ((ac.data -> 'asistencia_movilidad') ->> 'fecha_y_hora_de_solicitud')::timestamp without time zone AS fecha_solicitud,
        (ac.data -> 'asistencia_movilidad') ->> 'placa' AS placa,
        (ac.data -> 'asistencia_movilidad') ->> 'nombre_solicitante' AS solicitante,
        (ac.data -> 'asistencia_movilidad') ->> 'nombre_asegurado' AS asegurado,
        (ac.data -> 'asistencia_movilidad') ->> 'telefono_1' AS telefono,
        ((ac.data -> 'asistencia_movilidad') -> 'asignacion_asistencia_movilidad') ->> 'servicio' AS servicio,
        c2.estado AS estado_sub_caso,
        c2.fallo,
        e.nombre AS estado_caso,
        ((ac.data -> 'asistencia_movilidad') -> 'gestion_proveedor_asistencia_movilidad_detail') ->> 'id_usuario_proveedor' AS usuario_proveedor
   FROM asistencia.cases c
     JOIN asistencia.aux_cases ac        ON ac.caso_id   = c.id
     JOIN cierres_de_expediente c2       ON c2.parent_id = c.id
     JOIN asistencia.clients cl          ON cl.id        = c.cliente_id
     JOIN asistencia.transiciones t      ON t.id         = c.transicion_id
     JOIN asistencia.estados e           ON e.id         = t.siguiente_estado_id
  WHERE c.fecha_resolucion IS NULL;
