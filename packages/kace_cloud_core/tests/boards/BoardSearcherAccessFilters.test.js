import { v4 as uuidv4 } from 'uuid';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import { BoardSearcher } from '../../src/boards/application/search/BoardSearcher.js';
import { QueryDBError, ValidationFailError } from '../../src/shared/index.js';
import BoardsMother from './domain/BoardsMother.js';
import { knexConfig } from '../knexfile.js';

/**
 * Filtrado del listado de tableros por los pseudo-campos `access_users_ids` y
 * `access_groups_ids`, y resolucion de nombres para las columnas de la tabla.
 *
 * El caso critico es el multivalor: el operador generico `jsonArrayValue` del Criteria
 * compartido serializa el array con `join(',')` y genera `array['a,b']`, con lo que
 * seleccionar dos usuarios no devolvia nada. Por eso el repositorio construye la
 * condicion `?|` con un placeholder por id.
 */
describe('BoardSearcher - filtros por usuarios y grupos con acceso', () => {
    const repository = new KnexBoardsRepository(knexConfig);
    const searcher = new BoardSearcher(repository);

    const userAnaId = uuidv4();
    const userLuisId = uuidv4();
    const userSinTableroId = uuidv4();
    const groupOpsId = uuidv4();
    const groupTiId = uuidv4();

    const searchCriteria = (filter = []) => ({
        filter,
        relationship: null,
        limit: 50,
        offset: 0,
        order: null,
    });

    // Por defecto un creador que no existe en `usuarios`, para que no aparezca en la columna
    // salvo en los casos que lo prueban expresamente.
    const createBoard = (name, { access_users = [], access_groups = [], created_by = uuidv4() }) =>
        BoardsMother.createWithSpecificData(repository, {
            ...BoardsMother.dtoAuxiliary({ filters: { items: [] }, columns: [] }),
            id: uuidv4(),
            name,
            access_users,
            access_groups,
            created_by,
        });

    const namesOf = (items) => items.map((item) => item.name).sort();

    /*
     * Los casos que prueban el filtro de la UI, no el recorte del servidor, buscan con la
     * llave maestra: deja el conjunto sin recortar, que es lo que antes conseguian omitiendo
     * el actor. Omitirlo ya no vale — `execute` exige llamante identificado.
     */
    const adminActor = { userId: uuidv4(), isBoardAdmin: true };
    const searchAsAdmin = (dtoCriteria) => searcher.execute(dtoCriteria, adminActor);

    // `tests/support/perFileDatabase.js` clona la plantilla en un `beforeAll` y resetea la
    // base en su propio `beforeEach`, que corre antes que este por venir de
    // `setupFilesAfterEnv`. Aqui solo hay que sembrar.
    beforeEach(async () => {
        await repository.table('usuarios').insert([
            { id: userAnaId, nombres: 'Ana', apellido1: 'Perez', apellido2: 'Gomez' },
            { id: userLuisId, nombres: 'Luis', apellido1: 'Galvan', apellido2: null },
            { id: userSinTableroId, nombres: 'Sin', apellido1: 'Tablero', apellido2: null },
        ]);

        await repository.table('grupos').insert([
            { id: groupOpsId, nombre: 'Operaciones' },
            { id: groupTiId, nombre: 'TI' },
        ]);
    });

    it('devuelve todos los tableros cuando no hay filtro de acceso', async () => {
        await createBoard('solo-ana', { access_users: [userAnaId] });
        await createBoard('solo-luis', { access_users: [userLuisId] });

        const response = await searchAsAdmin(searchCriteria());
        const { data, metadata } = response.toJson();

        expect(namesOf(data.items)).toEqual(['solo-ana', 'solo-luis']);
        expect(Number(metadata.count)).toBe(2);
    });

    it('filtra por un unico usuario con acceso', async () => {
        await createBoard('solo-ana', { access_users: [userAnaId] });
        await createBoard('solo-luis', { access_users: [userLuisId] });

        const response = await searchAsAdmin(
            searchCriteria([{ field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId }])
        );
        const { data, metadata } = response.toJson();

        expect(namesOf(data.items)).toEqual(['solo-ana']);
        expect(Number(metadata.count)).toBe(1);
    });

    it('filtra por varios usuarios devolviendo los tableros de cualquiera de ellos', async () => {
        await createBoard('solo-ana', { access_users: [userAnaId] });
        await createBoard('solo-luis', { access_users: [userLuisId] });
        await createBoard('ajeno', { access_users: [userSinTableroId] });

        const response = await searchAsAdmin(
            searchCriteria([
                {
                    field: 'access_users_ids',
                    operator: 'in',
                    type: 'AND',
                    value: `${userAnaId},${userLuisId}`,
                },
            ])
        );
        const { data, metadata } = response.toJson();

        expect(namesOf(data.items)).toEqual(['solo-ana', 'solo-luis']);
        expect(Number(metadata.count)).toBe(2);
    });

    it('filtra por varios grupos con acceso', async () => {
        await createBoard('de-ops', { access_groups: [groupOpsId] });
        await createBoard('de-ti', { access_groups: [groupTiId] });
        await createBoard('de-nadie', { access_groups: [uuidv4()] });

        const response = await searchAsAdmin(
            searchCriteria([
                {
                    field: 'access_groups_ids',
                    operator: 'in',
                    type: 'AND',
                    value: `${groupOpsId},${groupTiId}`,
                },
            ])
        );

        expect(namesOf(response.toJson().data.items)).toEqual(['de-ops', 'de-ti']);
    });

    it('combina el filtro de usuarios y el de grupos con AND', async () => {
        await createBoard('ana-y-ops', { access_users: [userAnaId], access_groups: [groupOpsId] });
        await createBoard('ana-sin-grupo', { access_users: [userAnaId], access_groups: [] });
        await createBoard('ops-sin-usuario', { access_users: [], access_groups: [groupOpsId] });

        const response = await searchAsAdmin(
            searchCriteria([
                { field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId },
                { field: 'access_groups_ids', operator: 'in', type: 'AND', value: groupOpsId },
            ])
        );
        const { data, metadata } = response.toJson();

        expect(namesOf(data.items)).toEqual(['ana-y-ops']);
        expect(Number(metadata.count)).toBe(1);
    });

    it('convive con los filtros normales sobre columnas reales', async () => {
        await createBoard('tablero-visible', { access_users: [userAnaId] });
        const oculto = await createBoard('tablero-oculto', { access_users: [userAnaId] });
        await repository.table('boards').where({ id: oculto.id.value }).update({ is_active: false });

        // Forma exacta que envia el listado: campo cualificado con la vista y el booleano
        // serializado como texto por el filtro de tipo switch.
        const response = await searchAsAdmin(
            searchCriteria([
                { field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId },
                { field: 'boards.is_active', operator: 'eq', type: 'AND', value: 'true' },
                { field: 'boards.deleted_at', operator: 'null', type: 'AND', value: 'null' },
            ])
        );

        expect(namesOf(response.toJson().data.items)).toEqual(['tablero-visible']);
    });

    it('filtra por nombre con ilike junto al filtro de acceso', async () => {
        await createBoard('Tablero de soporte', { access_users: [userAnaId] });
        await createBoard('Tablero de ventas', { access_users: [userAnaId] });

        const response = await searchAsAdmin(
            searchCriteria([
                { field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId },
                { field: 'boards.name', operator: 'ilike', type: 'AND', value: '%soporte%' },
            ])
        );

        expect(namesOf(response.toJson().data.items)).toEqual(['Tablero de soporte']);
    });

    it('resuelve los nombres de usuarios y grupos con acceso para pintarlos en la tabla', async () => {
        await createBoard('con-accesos', {
            access_users: [userAnaId, userLuisId],
            access_groups: [groupOpsId],
        });

        const [board] = (await searchAsAdmin(searchCriteria())).toJson().data.items;

        expect(board.access_users_data).toEqual([
            { id: userAnaId, nombre: 'Ana Perez Gomez' },
            { id: userLuisId, nombre: 'Luis Galvan' },
        ]);
        expect(board.access_groups_data).toEqual([{ id: groupOpsId, nombre: 'Operaciones' }]);
    });

    it('descarta los ids de usuarios o grupos que ya no existen', async () => {
        await createBoard('con-borrados', {
            access_users: [userAnaId, uuidv4()],
            access_groups: [uuidv4()],
        });

        const [board] = (await searchAsAdmin(searchCriteria())).toJson().data.items;

        expect(board.access_users_data).toEqual([{ id: userAnaId, nombre: 'Ana Perez Gomez' }]);
        expect(board.access_groups_data).toEqual([]);
    });

    it('devuelve listas vacias cuando el tablero no tiene accesos configurados', async () => {
        await createBoard('sin-accesos', { access_users: [], access_groups: [] });

        const [board] = (await searchAsAdmin(searchCriteria())).toJson().data.items;

        expect(board.access_users_data).toEqual([]);
        expect(board.access_groups_data).toEqual([]);
    });

    it('no cuenta los tableros borrados cuando hay filtro de acceso', async () => {
        await createBoard('vivo', { access_users: [userAnaId] });
        const borrado = await createBoard('borrado', { access_users: [userAnaId] });
        await repository
            .table('boards')
            .where({ id: borrado.id.value })
            .update({ deleted_at: new Date().toISOString() });

        const response = await searchAsAdmin(
            searchCriteria([{ field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId }])
        );
        const { data, metadata } = response.toJson();

        // El conteo con acceso pasa por countBoards; sin la guarda de borrado logico
        // devolvia 2 contra 1 fila y la paginacion mostraba una pagina vacia.
        expect(namesOf(data.items)).toEqual(['vivo']);
        expect(Number(metadata.count)).toBe(1);
    });

    it('pone al creador el primero en la columna de usuarios con acceso', async () => {
        await createBoard('de-ana', { access_users: [userLuisId], created_by: userAnaId });

        const [board] = (await searchAsAdmin(searchCriteria())).toJson().data.items;

        expect(board.access_users_data).toEqual([
            { id: userAnaId, nombre: 'Ana Perez Gomez', is_creator: true },
            { id: userLuisId, nombre: 'Luis Galvan' },
        ]);
    });

    it('no repite al creador cuando ademas figura en access_users', async () => {
        await createBoard('ana-dos-veces', { access_users: [userAnaId, userLuisId], created_by: userAnaId });

        const [board] = (await searchAsAdmin(searchCriteria())).toJson().data.items;

        expect(board.access_users_data).toEqual([
            { id: userAnaId, nombre: 'Ana Perez Gomez', is_creator: true },
            { id: userLuisId, nombre: 'Luis Galvan' },
        ]);
    });

    it('filtrar por un usuario devuelve tambien los tableros que ha creado', async () => {
        await createBoard('creado-por-ana', { access_users: [], created_by: userAnaId });
        await createBoard('concedido-a-ana', { access_users: [userAnaId] });
        await createBoard('ajeno', { access_users: [userLuisId], created_by: userLuisId });

        const response = await searchAsAdmin(
            searchCriteria([{ field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId }])
        );
        const { data, metadata } = response.toJson();

        expect(namesOf(data.items)).toEqual(['concedido-a-ana', 'creado-por-ana']);
        expect(Number(metadata.count)).toBe(2);
    });

    it('el OR del creador no ensancha el filtro de grupos ni el de borrado', async () => {
        await createBoard('ana-crea-y-ops', { access_groups: [groupOpsId], created_by: userAnaId });
        await createBoard('ana-crea-sin-grupo', { access_groups: [], created_by: userAnaId });

        const response = await searchAsAdmin(
            searchCriteria([
                { field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId },
                { field: 'access_groups_ids', operator: 'in', type: 'AND', value: groupOpsId },
            ])
        );

        expect(namesOf(response.toJson().data.items)).toEqual(['ana-crea-y-ops']);
    });

    describe('formas del pseudo-campo que el SearchSchema acepta', () => {
        it('reconoce el pseudo-campo cualificado con la tabla', async () => {
            await createBoard('solo-ana', { access_users: [userAnaId] });
            await createBoard('solo-luis', { access_users: [userLuisId] });

            // Sin normalizar el nombre, `boards.access_users_ids` llegaba al Criteria como
            // columna real inexistente y la consulta reventaba con un 500.
            const response = await searchAsAdmin(
                searchCriteria([{ field: 'boards.access_users_ids', operator: 'in', type: 'AND', value: userAnaId }])
            );

            expect(namesOf(response.toJson().data.items)).toEqual(['solo-ana']);
        });

        it('rechaza el pseudo-campo con type OR en vez de aplicarlo como AND', async () => {
            await createBoard('solo-ana', { access_users: [userAnaId] });

            // `applyAccessFilters` siempre encadena `where`, asi que un OR se aplicaba como
            // AND y devolvia menos filas de las pedidas sin ningun aviso.
            await expect(
                searchAsAdmin(
                    searchCriteria([{ field: 'access_users_ids', operator: 'in', type: 'OR', value: userAnaId }])
                )
            ).rejects.toBeInstanceOf(ValidationFailError);
        });

        it('rechaza el pseudo-campo anidado en un grupo de filtros', async () => {
            await createBoard('solo-ana', { access_users: [userAnaId] });

            await expect(
                searchAsAdmin(
                    searchCriteria([
                        {
                            groupType: 'AND',
                            filters: [{ field: 'access_users_ids', operator: 'in', type: 'AND', value: userAnaId }],
                        },
                    ])
                )
            ).rejects.toBeInstanceOf(ValidationFailError);
        });

        // `notIn` es el caso grave: el pseudo-campo solo sabe generar un "cualquiera de", asi
        // que se aplicaba como `in` y devolvia exactamente lo contrario de lo pedido.
        it.each(['notIn', 'eq', 'like'])('rechaza el pseudo-campo con el operador %s', async (operator) => {
            await createBoard('solo-ana', { access_users: [userAnaId] });

            await expect(
                searchAsAdmin(searchCriteria([{ field: 'access_users_ids', operator, type: 'AND', value: userAnaId }]))
            ).rejects.toBeInstanceOf(ValidationFailError);
        });
    });

    describe('recorte por el acceso efectivo del llamante', () => {
        it('recorta el listado aunque el payload no traiga pseudo-campos', async () => {
            await createBoard('de-ana', { access_users: [userAnaId] });
            await createBoard('creado-por-ana', { access_users: [], created_by: userAnaId });
            await createBoard('del-grupo-ops', { access_groups: [groupOpsId] });
            await createBoard('ajeno', { access_users: [userSinTableroId] });

            const response = await searcher.execute(searchCriteria(), {
                userId: userAnaId,
                groupId: groupOpsId,
            });
            const { data, metadata } = response.toJson();

            expect(namesOf(data.items)).toEqual(['creado-por-ana', 'de-ana', 'del-grupo-ops']);
            expect(Number(metadata.count)).toBe(3);
        });

        it('el pseudo-campo del payload no puede ampliar el conjunto autorizado', async () => {
            await createBoard('de-ana', { access_users: [userAnaId] });
            await createBoard('ajeno', { access_users: [userSinTableroId] });

            // El cliente pide expresamente los tableros de un tercero: el recorte del
            // servidor tiene que seguir mandando.
            const response = await searcher.execute(
                searchCriteria([{ field: 'access_users_ids', operator: 'in', type: 'AND', value: userSinTableroId }]),
                { userId: userAnaId, groupId: null }
            );
            const { data, metadata } = response.toJson();

            expect(data.items).toEqual([]);
            expect(Number(metadata.count)).toBe(0);
        });

        it('la llave maestra administrativa ve todos los tableros del tenant', async () => {
            await createBoard('de-ana', { access_users: [userAnaId] });
            await createBoard('ajeno', { access_users: [userSinTableroId] });

            const response = await searcher.execute(searchCriteria(), {
                userId: userAnaId,
                groupId: null,
                isBoardAdmin: true,
            });
            const { data, metadata } = response.toJson();

            expect(namesOf(data.items)).toEqual(['ajeno', 'de-ana']);
            expect(Number(metadata.count)).toBe(2);
        });

        it('un tablero huerfano solo lo ve la llave maestra', async () => {
            // Creador dado de baja (no existe en `usuarios`) y listas de acceso vacias.
            await createBoard('huerfano', { access_users: [], access_groups: [] });

            const sinLlave = await searcher.execute(searchCriteria(), {
                userId: userAnaId,
                groupId: groupOpsId,
            });
            const conLlave = await searcher.execute(searchCriteria(), {
                userId: userAnaId,
                groupId: groupOpsId,
                isBoardAdmin: true,
            });

            expect(sinLlave.toJson().data.items).toEqual([]);
            expect(namesOf(conLlave.toJson().data.items)).toEqual(['huerfano']);
        });
    });

    /*
     * El recorte se encadena al mismo nivel booleano que los filtros del cliente, y en SQL el
     * AND liga mas fuerte que el OR: un OR de primer nivel partia la condicion en dos y la
     * primera rama salia sin recortar y sin la guarda de borrado. Con `ilike '%'` en esa rama,
     * cualquiera con BoardsRead listaba el tenant entero — nombre, criterio, columnas y la
     * lista de quien tiene acceso — mandando el payload a mano.
     */
    describe('OR de primer nivel', () => {
        const anaActor = { userId: userAnaId, groupId: groupOpsId };

        const sembrarAjenoYBorrado = async () => {
            await createBoard('de-ana', { access_users: [userAnaId] });
            await createBoard('ajeno', { access_users: [userSinTableroId] });
            const borrado = await createBoard('borrado-ajeno', { access_users: [userSinTableroId] });
            await repository
                .table('boards')
                .where({ id: borrado.id.value })
                .update({ deleted_at: new Date().toISOString() });
        };

        it('rechaza un filtro suelto con type OR', async () => {
            await sembrarAjenoYBorrado();

            await expect(
                searcher.execute(
                    searchCriteria([
                        { field: 'boards.name', operator: 'ilike', type: 'AND', value: '' },
                        { field: 'boards.name', operator: 'ilike', type: 'OR', value: 'zzz' },
                    ]),
                    anaActor
                )
            ).rejects.toBeInstanceOf(ValidationFailError);
        });

        it('rechaza un grupo con groupType OR', async () => {
            await sembrarAjenoYBorrado();

            // Segunda forma del mismo agujero: el Criteria resuelve un grupo OR que no sea el
            // primero con `orWhere` y tampoco lo parentiza.
            await expect(
                searcher.execute(
                    searchCriteria([
                        { field: 'boards.name', operator: 'ilike', type: 'AND', value: '' },
                        {
                            groupType: 'OR',
                            filters: [{ field: 'boards.name', operator: 'ilike', type: 'AND', value: '' }],
                        },
                    ]),
                    anaActor
                )
            ).rejects.toBeInstanceOf(ValidationFailError);
        });

        it('acepta el OR dentro de un grupo AND y lo mantiene dentro del recorte', async () => {
            await sembrarAjenoYBorrado();

            // El grupo AND si se parentiza, asi que el OR de dentro solo elige entre los
            // tableros que el recorte ya autorizo: no es una prohibicion del OR, es contenerlo.
            const response = await searcher.execute(
                searchCriteria([
                    {
                        groupType: 'AND',
                        filters: [
                            { field: 'boards.name', operator: 'ilike', type: 'AND', value: 'de-ana' },
                            { field: 'boards.name', operator: 'ilike', type: 'OR', value: 'ajeno' },
                        ],
                    },
                ]),
                anaActor
            );
            const { data, metadata } = response.toJson();

            expect(namesOf(data.items)).toEqual(['de-ana']);
            expect(Number(metadata.count)).toBe(1);
        });
    });

    /*
     * El recorte no puede desactivarse omitiendo un argumento: sin actor identificado la
     * consulta devolveria el tenant completo, asi que las dos entradas fallan cerrado en vez
     * de recortar por omision.
     */
    describe('llamante sin identificar', () => {
        it.each([
            ['sin actor', undefined],
            ['con un actor vacio', {}],
            ['con actor sin userId', { groupId: groupOpsId }],
        ])('BoardSearcher.execute rechaza la busqueda %s', async (_caso, actor) => {
            await createBoard('de-ana', { access_users: [userAnaId] });

            await expect(searcher.execute(searchCriteria(), actor)).rejects.toBeInstanceOf(ValidationFailError);
        });

        it('searchAvailableBoards rechaza la consulta sin userId', async () => {
            await createBoard('de-ana', { access_users: [userAnaId] });

            await expect(repository.searchAvailableBoards({ groupId: groupOpsId })).rejects.toBeInstanceOf(
                QueryDBError
            );
        });
    });
});
