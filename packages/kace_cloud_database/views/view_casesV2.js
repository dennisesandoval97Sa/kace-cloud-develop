export const viewCasesV2 = (tablenameCasos, tablenameClientes) => `
CREATE VIEW view_casos AS  
SELECT 
    ${tablenameCasos}.id,
    ${tablenameCasos}.ans_posicion,
    ${tablenameCasos}.antiguedad,
    ${tablenameCasos}.antiguedad_dias,
    ${tablenameCasos}.antiguedad_horas,
    ${tablenameCasos}.antiguedad_minutos,
    ${tablenameCasos}.cambio_estado_comentario_id,
    ${tablenameCasos}.caso_clonado_id,
    ${tablenameCasos}.created_at,
    ${tablenameCasos}.fecha_resolucion,
    ${tablenameCasos}.motivo_baja,
    ${tablenameCasos}.reference,
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
    estados.nombre AS estado_actual,    
    usuarios.nombres,
    usuarios.apellido1,
    usuarios.apellido2,
    usuarios.login,
    usuarios.is_active AS usuario_inactivo,
    ${tablenameClientes}.nombres AS nombre_cliente,
    ${tablenameClientes}.apellido1 AS primer_apellido,
    ${tablenameClientes}.apellido2 AS segundo_apellido,
    ${tablenameClientes}.documento   
FROM ${tablenameCasos} 
JOIN ${tablenameClientes} ON ${tablenameClientes}.id = ${tablenameCasos}.cliente_id 
JOIN grupos ON grupos.id = ${tablenameCasos}.grupo_id 
JOIN usuarios ON usuarios.id = ${tablenameCasos}.responsable_id 
JOIN transiciones ON transiciones.id = ${tablenameCasos}.transicion_id 
JOIN clasificaciones ON clasificaciones.id = ${tablenameCasos}.clasificacion_id 
LEFT JOIN ans ON ans.id = clasificaciones.ans_id 
LEFT JOIN descripciones_casos ON descripciones_casos.id = ${tablenameCasos}.descripcion_caso_id 
LEFT JOIN estados ON estados.id = transiciones.siguiente_estado_id;
`;
