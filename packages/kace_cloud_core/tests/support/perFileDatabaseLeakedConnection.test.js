import { describe, expect, test } from '@jest/globals';
import { knexConfig } from '../knexfile.js';

/**
 * Este archivo existe para ejercitar el afterAll de `perFileDatabase.js` en el
 * unico escenario que lo tumbaba: una conexion del pool compartido retenida
 * cuando llega el teardown.
 *
 * `tarn.destroy()` espera SIN LIMITE a que se liberen los recursos en uso, asi
 * que `closeTestConnection()` no puede terminar por si solo y el hook agotaba
 * los 120 segundos de `testTimeout`. Asi se puso roja
 * `tests/grupos/GroupsIntegration.test.js` en la baseline del 13-08-2026, con
 * sus 41 tests en verde: el rojo lo puso la limpieza, no una asercion.
 *
 * Lo que verifica el archivo no cabe en un `expect`: si el endurecimiento del
 * hook se revierte, esta suite tarda mas de dos minutos y termina en rojo por
 * timeout; con el, cierra en segundos. La comprobacion es que la suite pase.
 */
describe('teardown con una conexion retenida', () => {
    test('deja una conexion fuera del pool a proposito', async () => {
        const retenida = await knexConfig.client.acquireConnection();

        // A proposito no se devuelve al pool: el afterAll de perFileDatabase.js
        // tiene que terminar el backend desde el servidor para poder cerrar.
        expect(retenida).toBeDefined();

        const { rows } = await knexConfig.raw('select 1 as ok');

        expect(rows[0].ok).toBe(1);
    });
});
