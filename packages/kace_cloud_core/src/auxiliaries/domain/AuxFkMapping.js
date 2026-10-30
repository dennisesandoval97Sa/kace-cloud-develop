/**
 * Mismo conocimiento que `AuxiliaryColumnFieldHelper.SPECIALIZED_COLUMN_FIELDS` en
 * `src/shared/criteria/AuxiliaryColumnFieldHelper.js`. `tests/shared/criteria/AuxiliaryColumnFieldHelper.test.js`
 * verifica que ambos mapas coincidan en las tablas que comparten.
 *
 * `aux_users` y `aux_groups` se quitaron de aqui: ninguna migracion crea esas tablas, y la unica
 * via que si podria crearlas en runtime -AuxDefinitionCreator.createMainTable- solo agrega id,
 * data y columnas de auditoria, nunca `usuario_id`/`grupo_id`. Son la misma especie que las
 * entradas `cita_id`/`documento_id` que e3b198767 ya retiro de #KNOWN_DATA_FK_FIELDS en
 * KnexAuxiliariesRepository por el mismo motivo.
 */
export const AUX_SPECIALIZED_FK = {
    aux_cases: { fkColumn: 'caso_id', mainTable: 'cases' },
    aux_clients: { fkColumn: 'cliente_id', mainTable: 'clients' },
};
