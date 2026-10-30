export const viewCasesDetails = (tablenameCasos, tablenameClientes, tablenameAuxCases, serviceName) => {
    const isUT = serviceName === 'ut';

    const extraFields = isUT
        ? `,
    (${tablenameAuxCases}.data -> 'form_212b8fae-30e4-4f89-b18a-84f594f2d1ec') ->> 'respuesta' AS respuesta,
    (${tablenameAuxCases}.data -> 'form_212b8fae-30e4-4f89-b18a-84f594f2d1ec') ->> 'causal' AS causal`
        : '';

    return `
CREATE VIEW view_case_details AS
SELECT
    ${tablenameCasos}.id,
    ${tablenameCasos}.reference,
    ${tablenameCasos}.created_at,
    ${tablenameCasos}.created_by,
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
    estados.nombre as estadoActual,
    ${tablenameCasos}.antiguedad,
    ${tablenameCasos}.updated_at,
    ${tablenameCasos}.ans_posicion,
    responsable.nombres,
    responsable.apellido1,
    responsable.apellido2,
    responsable.login,
    responsable.is_active as usuario_inactivo,
    creador.external_id as creator_external_id,
    ${tablenameClientes}.nombres as nombreCliente,
    ${tablenameClientes}.apellido1 as primerApellido,
    ${tablenameClientes}.apellido2 as segundoApellido,
    ${tablenameClientes}.documento,
    ${tablenameClientes}.tipo_cliente,
    ${tablenameClientes}.nombre_empresa,
    ${tablenameCasos}.cambio_estado_comentario_id,
    ${tablenameCasos}.caso_clonado_id,
    ${tablenameCasos}.fecha_resolucion,
    ${tablenameCasos}.antiguedad_dias,
    ${tablenameCasos}.antiguedad_horas,
    ${tablenameCasos}.antiguedad_minutos,
    ${tablenameCasos}.motivo_baja${extraFields}
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
LEFT JOIN ${tablenameAuxCases} ON ${tablenameAuxCases}.caso_id = ${tablenameCasos}.id;
`;
};
