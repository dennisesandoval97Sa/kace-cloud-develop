export const viewCasesDetailsV5 = (tablenameCasos, tablenameClientes, tablenameAuxCases, serviceName) => {
    const isUT = serviceName === 'ut';
    const isAsistencia = serviceName === 'SURAASISTENCIA';

    const extraFields = isUT
        ? `,
    (${tablenameAuxCases}.data -> 'form_212b8fae-30e4-4f89-b18a-84f594f2d1ec') ->> 'respuesta' AS respuesta,
    (${tablenameAuxCases}.data -> 'form_212b8fae-30e4-4f89-b18a-84f594f2d1ec') ->> 'causal' AS causal`
        : '';

    const extraFieldsAsistencia = isAsistencia
        ? `,
    ${tablenameAuxCases}.data AS datos,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'placa' AS placa,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'fecha_y_hora_de_cita' AS fecha_cita,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'fecha_y_hora_de_solicitud' AS fecha_de_solicitud,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'departamento_solicita' AS departamento,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'municipio_solicita' AS municipio,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'proveedor' AS proveedor,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'servicio' AS servicio,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'clase' AS clase,
    (${tablenameAuxCases}.data -> 'asistencia_movilidad') ->> 'gestor_de_coordinacion' AS gestor,
    roles.descripcion AS rol_responsable,
    ${tablenameAuxCases}.id AS aux_cases_id`
        : '';

    const extraJoinsAsistencia = isAsistencia
        ? `
LEFT JOIN roles ON roles.id = responsable.rol_id`
        : '';

    return `
CREATE VIEW view_case_details AS
SELECT
    ${tablenameCasos}.id,
    ${tablenameCasos}.ans_posicion,
    ${tablenameCasos}.antiguedad,
    ${tablenameCasos}.antiguedad_dias,
    ${tablenameCasos}.antiguedad_horas,
    ${tablenameCasos}.antiguedad_minutos,
    ${tablenameCasos}.cambio_estado_comentario_id,
    ${tablenameCasos}.caso_clonado_id,
    ${tablenameCasos}.cliente_id,
    ${tablenameCasos}.created_at,
    ${tablenameCasos}.created_by,
    ${tablenameCasos}.deleted_at,
    ${tablenameCasos}.fecha_resolucion,
    ${tablenameCasos}.motivo_baja,
    ${tablenameCasos}.parent_id,
    ${tablenameCasos}.reference,
    ${tablenameCasos}.responsable_id,
    ${tablenameCasos}.sla_due_date as fecha_vencimiento,
    ${tablenameCasos}.updated_at,
    clasificaciones.nivel1,
    clasificaciones.nivel2,
    clasificaciones.nivel3,
    clasificaciones.nivel4,
    clasificaciones.nivel5,
    clasificaciones.nivel6,
    clasificaciones.nivel7,
    clasificaciones.nivel8,
    clasificaciones.nivel9,
    clasificaciones.nivel10,
    ans.color_ans_inicial,
    ans.color_ans_intermedio,
    ans.color_ans_final,
    estados.nombre as estado_actual,    
    responsable.nombres,
    responsable.apellido1,
    responsable.apellido2,
    responsable.login,
    responsable.is_active as usuario_inactivo,
    creador.external_id as creator_external_id,
    ${tablenameClientes}.nombres as nombre_cliente,
    ${tablenameClientes}.apellido1 as primer_apellido,
    ${tablenameClientes}.apellido2 as segundo_apellido,
    ${tablenameClientes}.documento,
    ${tablenameClientes}.tipo_cliente,
    ${tablenameClientes}.nombre_empresa    
    ${extraFields}
    ${extraFieldsAsistencia}
FROM ${tablenameCasos}
JOIN ${tablenameClientes} ON ${tablenameClientes}.id = ${tablenameCasos}.cliente_id
JOIN grupos ON grupos.id = ${tablenameCasos}.grupo_id
JOIN usuarios AS responsable ON responsable.id = ${tablenameCasos}.responsable_id
JOIN transiciones ON transiciones.id = ${tablenameCasos}.transicion_id
JOIN clasificaciones ON clasificaciones.id = ${tablenameCasos}.clasificacion_id
LEFT JOIN ans ON ans.id = clasificaciones.ans_id
LEFT JOIN descripciones_casos AS descripcion ON descripcion.id = ${tablenameCasos}.descripcion_caso_id
LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id
LEFT JOIN usuarios AS creador ON creador.id = ${tablenameCasos}.created_by
LEFT JOIN ${tablenameAuxCases} ON ${tablenameAuxCases}.caso_id = ${tablenameCasos}.id
${extraJoinsAsistencia};
`;
};
