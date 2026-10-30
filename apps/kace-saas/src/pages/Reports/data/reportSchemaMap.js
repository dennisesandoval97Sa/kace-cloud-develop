/**
 * Mapeo de nombres de reportes a tablas/vistas del schema
 *
 * Este mapeo conecta el valor del reporte seleccionado con la key
 * correspondiente en el objeto schemaFields obtenido de useSchemaFields()
 *
 * IMPORTANTE: Las keys del schema se pueden ver en la consola del navegador:
 * "Schema Fields Data: { action_jobs: [...], actions: [...], ... }"
 *
 * Para agregar un nuevo reporte:
 * 1. Agregar el valor del reporte en REPORTS_OPTIONS (constants.js)
 * 2. Agregar el mapeo aquí: "valor_del_reporte": "key_del_schema"
 * 3. Verificar en la consola que la key existe en el schema
 *
 * Ejemplo de keys comunes:
 * - "cases" → Tabla de casos
 * - "view_case_details" → Vista de detalles de casos
 * - "actions" → Tabla de acciones
 * - "action_jobs" → Tabla de trabajos de acciones
 *
 * @constant {Object}
 */
export const REPORT_TO_SCHEMA_MAP = {
    // Mapeo para el reporte de detalles de casos
    // Ajustar según la key correcta en schemaFields
    reports_case_details: "view_case_details",

    // Agregar más reportes aquí según sea necesario:
    // reports_actions: "actions",
    // reports_agents: "agents",
};
