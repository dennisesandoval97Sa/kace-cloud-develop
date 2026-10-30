import { RelationsGetEntities } from '../../../../src/shared/domain/services/relations/RelationsGetEntities.js';
import { RelationsRepository } from '../../../../src/shared/infrastructure/relations/RelationsRepository.js';
import { RelationsGetByEntityService } from '../../../../src/shared/domain/services/relations/RelationsGetByEntityService.js';
import { KnexAuxDefinitionsRepository } from '../../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { knexConfig } from '../../../knexfile.js';

describe('Relations', () => {
    /**
     * `RelationsGetEntities` dejo de ser un lector de `RELATIONS_LIST` a secas:
     * ahora completa la lista con las tablas auxiliares activas, y para eso
     * recibe un segundo colaborador (`KnexAuxDefinitionsRepository`) al que le
     * pide `search(criteria)`. El test solo pasaba el primero, asi que el
     * campo quedaba `undefined` y `execute` moria con
     * "Cannot read properties of undefined (reading 'search')".
     *
     * Se le da el repositorio de verdad, no un doble: las esperas son sobre las
     * entidades fijas de `RELATIONS_LIST`, y lo que aporte `aux_definitions`
     * solo se suma a la lista.
     */
    const auxDefinitionsRepository = new KnexAuxDefinitionsRepository(knexConfig);

    /**
     * `usuarios` era una entidad raiz de `RELATIONS_LIST` hasta que 96b949b27
     * reestructuro la lista y la dejo en cuatro: cases, clasificaciones,
     * clients y transiciones. `usuarios` sigue ahi, pero como `relation` de
     * `cases`, y `execute` solo devuelve el campo `entity`. La espera no
     * describe un defecto, describe datos que ya no existen.
     *
     * Se comprueba lo que el servicio de verdad hace -- deduplicar las
     * entidades raiz -- con dos de ellas y sin repetidos, en vez de fijar la
     * lista entera, que cambia cada vez que se anade una relacion.
     */
    test('should return all relations as DTOs', async () => {
        const service = new RelationsGetEntities(new RelationsRepository(), auxDefinitionsRepository);
        const results = await service.execute();

        expect(results.length).toBeGreaterThan(0);
        expect(results.includes('cases')).toBe(true);
        expect(results.includes('clasificaciones')).toBe(true);
        expect(new Set(results).size).toBe(results.length);
    });

    test('should return a specific entity', async () => {
        const service = new RelationsGetByEntityService(new RelationsRepository());
        const results = await service.execute('cases');
        const response = results.toJson();
        const test = response.data.items.every((item) => item.entity === 'cases');

        expect(test).toBe(true);
    });
});
