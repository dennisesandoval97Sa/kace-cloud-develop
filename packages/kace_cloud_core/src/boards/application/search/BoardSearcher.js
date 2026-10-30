import { BoardCollectionResponse } from '@kace/core/src/boards/application/BoardCollectionResponse';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { Counter, Criteria, ValidationFailError } from '@kace/core/src/shared';

/**
 * Pseudo-campos que el listado envia para filtrar por las columnas JSON de acceso.
 * No son columnas reales: se extraen del filtro y se traducen a una condicion `?|`
 * en el repositorio, igual que `grupos_ids` en UserSearcher.
 *
 * Contrato soportado: primer nivel del filtro, `type: 'AND'` y `operator: 'in'`. El nombre
 * se acepta tanto simple (`access_users_ids`) como cualificado con la tabla
 * (`boards.access_users_ids`), porque el listado cualifica el resto de sus campos. Cualquier
 * otra forma se rechaza con 400 en lugar de dejar que el pseudo-campo llegue al Criteria como
 * columna inexistente (500) o de aplicarse como AND cuando se pidio OR, o como `in` cuando se
 * pidio otro operador (resultado incorrecto sin aviso).
 */
const ACCESS_FILTER_FIELDS = Object.freeze({
    access_users_ids: 'userIds',
    access_groups_ids: 'groupIds',
});

/**
 * Unico operador que el pseudo-campo sabe traducir: `applyAccessFilters` genera un
 * "cualquiera de" (`?|` de jsonb), asi que cualquier otro operador se aplicaria como este
 * sin aviso — incluido su contrario, `notIn`.
 */
const ACCESS_FILTER_OPERATOR = 'in';

const accessKeyOf = (field) =>
    ACCESS_FILTER_FIELDS[
        String(field ?? '')
            .split('.')
            .pop()
    ] ?? null;

const parseIdList = (value) =>
    value
        ?.toString()
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean) ?? [];

export class BoardSearcher {
    /** @type {KnexBoardsRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;
    /**
     * @param {KnexBoardsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Busca Board según los criterios dados y retorna una colección estándar.
     *
     * El recorte por acceso lo pone el servidor a partir de `actor`, no el payload: los
     * pseudo-campos que envia el cliente son un filtro de UI y solo pueden estrechar el
     * conjunto autorizado. Por eso el actor es obligatorio: omitirlo devolveria el tenant
     * completo, asi que se rechaza en vez de recortar por omision.
     *
     * @param {Object} dtoCriteria - Criterios de búsqueda (filter, relationship, limit, offset, order)
     * @param {{userId: string, groupId?: string, isBoardAdmin?: boolean}} actor - Acceso
     *   efectivo del llamante. `isBoardAdmin` releva del recorte (ver BoardAccessPolicy).
     * @returns {Promise<BoardCollectionResponse>}
     * @throws {ValidationFailError} si el llamante no viene identificado
     */
    async execute(dtoCriteria, actor) {
        if (!actor?.userId) {
            throw new ValidationFailError('BoardSearcher requires an identified actor.', 'actor');
        }

        const rawFilters = dtoCriteria.filter || [];
        this.#assertNoTopLevelOr(rawFilters);
        const { access, cleanFilters } = this.#extractAccessFilters(rawFilters);

        // `null` es la llave maestra relevando del recorte, no la ausencia de datos.
        const actorScope = actor.isBoardAdmin ? null : { userId: actor.userId, groupId: actor.groupId };

        const criteria = new Criteria(
            cleanFilters,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            this.#repository.tableName
        );
        const rows = await this.#repository.search(criteria, { access, actorScope });

        const boardsWithAccessNames = await this.#addAccessNames(rows);

        const count =
            access || actorScope
                ? await this.#repository.countBoards(cleanFilters, dtoCriteria.relationship, { access, actorScope })
                : await this.#counter.execute({
                      filter: cleanFilters,
                      relationship: dtoCriteria.relationship,
                  });

        const countResult = count.count || count['count(*)'];

        return new BoardCollectionResponse(boardsWithAccessNames, countResult);
    }

    /**
     * Rechaza cualquier OR de primer nivel.
     *
     * `Criteria` traduce un filtro suelto con `type: 'OR'` a `orWhere`, y un grupo
     * `groupType: 'OR'` que no sea el primero, tambien; los dos sin parentesis. El repositorio
     * encadena despues `deleted_at IS NULL` y el recorte por acceso como AND, y en SQL el AND
     * liga mas fuerte, asi que `A OR (B AND recorte)` deja fuera del recorte —y de la guarda de
     * borrado— todo lo que cumpla `A`: con un `ilike '%'` basta para listar el tenant entero.
     *
     * El listado solo manda AND. Un OR legitimo cabe dentro de un grupo `groupType: 'AND'`, que
     * si se agrupa entre parentesis y queda contenido dentro del recorte.
     *
     * @param {Array} rawFilters
     * @throws {ValidationFailError} si un filtro o un grupo de primer nivel pide OR
     */
    #assertNoTopLevelOr(rawFilters) {
        rawFilters.forEach((filter) => {
            const isOr =
                String(filter?.type ?? 'AND').toUpperCase() === 'OR' ||
                String(filter?.groupType ?? 'AND').toUpperCase() === 'OR';

            if (!isOr) return;

            throw new ValidationFailError(
                'Top-level OR filters are not supported on boards.search.',
                filter?.field ?? 'filter'
            );
        });
    }

    /**
     * Separa los pseudo-campos de acceso del resto de filtros.
     *
     * Recorre tambien los grupos anidados, no para soportarlos sino para detectarlos: un
     * pseudo-campo dentro de un grupo se traduciria a una columna inexistente y reventaria
     * la consulta. Lo mismo con cualquier `type` que no sea AND —se aplicaria como AND porque
     * `applyAccessFilters` siempre encadena `where`— y con cualquier `operator` distinto de
     * `in`, que se aplicaria como `in`. Las tres formas se rechazan con 400.
     *
     * El caso concreto `type: 'OR'` ya lo corta antes `assertNoTopLevelOr`, por ser un agujero
     * de acceso y no solo un filtro mal aplicado; la comprobacion de aqui se queda porque
     * sigue cubriendo el resto de valores.
     *
     * @param {Array} rawFilters
     * @returns {{access: {userIds: string[], groupIds: string[]}|null, cleanFilters: Array}}
     * @throws {ValidationFailError} si un pseudo-campo llega anidado, con un type que no sea
     *   AND o con un operador que no sea `in`
     */
    #extractAccessFilters(rawFilters) {
        const access = {};
        const cleanFilters = [];

        this.#assertNoNestedAccessFilters(rawFilters);

        rawFilters.forEach((filter) => {
            const accessKey = accessKeyOf(filter?.field);
            if (!accessKey) {
                cleanFilters.push(filter);
                return;
            }

            if (String(filter.type ?? 'AND').toUpperCase() !== 'AND') {
                throw new ValidationFailError(`Filter "${filter.field}" only supports type "AND".`, filter.field);
            }

            if (String(filter.operator ?? ACCESS_FILTER_OPERATOR) !== ACCESS_FILTER_OPERATOR) {
                throw new ValidationFailError(
                    `Filter "${filter.field}" only supports operator "${ACCESS_FILTER_OPERATOR}".`,
                    filter.field
                );
            }

            const ids = parseIdList(filter.value);
            if (ids.length) {
                access[accessKey] = [...(access[accessKey] ?? []), ...ids];
            }
        });

        return {
            access: Object.keys(access).length ? access : null,
            cleanFilters,
        };
    }

    /**
     * Rechaza los pseudo-campos de acceso que lleguen dentro de un grupo de filtros.
     * @param {Array} filters
     */
    #assertNoNestedAccessFilters(filters) {
        filters.forEach((filter) => {
            if (!Array.isArray(filter?.filters)) return;

            filter.filters.forEach((nested) => {
                if (accessKeyOf(nested?.field)) {
                    throw new ValidationFailError(
                        `Filter "${nested.field}" is not supported inside a filter group.`,
                        nested.field
                    );
                }
            });

            this.#assertNoNestedAccessFilters(filter.filters);
        });
    }

    /**
     * Resuelve los nombres de los usuarios y grupos con acceso a los tableros de la pagina.
     * Dos consultas batch por pagina, independientemente del numero de tableros.
     * @param {Board[]} boards
     * @returns {Promise<Board[]>}
     */
    async #addAccessNames(boards) {
        if (!boards.length) return boards;

        const userIds = new Set();
        const groupIds = new Set();

        boards.forEach((board) => {
            (board.access_users.value ?? []).forEach((id) => id && userIds.add(id));
            (board.access_groups.value ?? []).forEach((id) => id && groupIds.add(id));
            // El creador entra en el mismo batch: no anade consultas y tiene acceso siempre.
            if (board.created_by?.value) userIds.add(board.created_by.value);
        });

        const [users, groups] = await Promise.all([
            this.#repository.findUsersByIds([...userIds]),
            this.#repository.findGroupsByIds([...groupIds]),
        ]);

        const usersById = new Map(users.map((user) => [user.id, user]));
        const groupsById = new Map(groups.map((group) => [group.id, group]));

        boards.forEach((board) => {
            /*
             * Un id sin correspondencia (usuario o grupo borrado) se descarta en lugar de
             * pintarse como hueco: el tablero conserva el id, pero la columna solo muestra
             * lo que existe hoy.
             */
            const granted = (board.access_users.value ?? []).map((id) => usersById.get(id)).filter(Boolean);
            const creator = usersById.get(board.created_by?.value);

            /*
             * El creador va primero y marcado; la etiqueta visible la compone el front, para
             * no meter texto traducible en core. Si ademas figura en access_users, no se repite.
             */
            board.access_users_data = creator
                ? [{ ...creator, is_creator: true }, ...granted.filter((user) => user.id !== creator.id)]
                : granted;
            board.access_groups_data = (board.access_groups.value ?? [])
                .map((id) => groupsById.get(id))
                .filter(Boolean);
        });

        return boards;
    }
}
