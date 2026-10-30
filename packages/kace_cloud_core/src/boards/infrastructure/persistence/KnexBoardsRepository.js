import { Board } from '@kace/core/src/boards/domain/Board';
import { Criteria, Helper, KnexRepository, QueryDBError } from '@kace/core/src/shared';

export class KnexBoardsRepository extends KnexRepository {
    constructor(config) {
        super(config, 'boards');
    }

    /**
     * Save an instance of boards in the database.
     * @param {Board} board
     * @returns {Promise<void>}
     */
    async save(board) {
        try {
            await this.table().insert({
                id: board.id.value,
                name: board.name.value,
                description: board.description.value,
                primary_entity: board.primary_entity.value,
                criteria: JSON.stringify(board.criteria.value),
                page_size: board.page_size.value,
                display_order: board.display_order.value,
                is_active: board.is_active.value,
                icon_class: board.icon_class.value,
                onescript_form_id: board.onescript_form_id.value,
                filter_onescript_id: board.filter_onescript_id.value,
                relations: JSON.stringify(board.relations.value),
                columns: JSON.stringify(board.columns.value),
                havings: JSON.stringify(board.havings.value),
                access_groups: JSON.stringify(board.access_groups.value),
                access_users: JSON.stringify(board.access_users.value),
                options: JSON.stringify(board.options.value),
                can_view_record: board.can_view_record.value,
                can_create_record: board.can_create_record.value,
                can_edit_record: board.can_edit_record.value,
                can_admin_bulk_actions: board.can_admin_bulk_actions.value,
                can_agent_bulk_actions: board.can_agent_bulk_actions.value,
                can_admin_delete_record: board.can_admin_delete_record.value,
                can_agent_delete_record: board.can_agent_delete_record.value,
                created_at: board.created_at.value,
                created_by: board.created_by.value,
                updated_at: board.updated_at.value,
                updated_by: board.updated_by.value,
                deleted_at: board.deleted_at.value,
                deleted_by: board.deleted_by.value,
                orders: JSON.stringify(board.orders.value),
                quick_ans_filter: JSON.stringify(board.quick_ans_filter.value),
            });
        } catch (error) {
            Helper.logError('Error saving boards', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Aplica los filtros por columnas JSON de acceso (`access_users` / `access_groups`)
     * sobre una query ya construida.
     *
     * Se resuelve aqui y no via el operador generico `jsonArrayValue` del Criteria porque
     * ese operador serializa el array con `join(',')` y genera `array['a,b']`, un unico
     * elemento, con lo que cualquier seleccion multiple deja de coincidir.
     *
     * @param {import('knex').Knex.QueryBuilder} query
     * @param {{userIds?: string[], groupIds?: string[]}|null} access
     */
    #applyAccessFilters(query, access) {
        if (!access) return;

        const table = this.tableName;

        // Un placeholder por id: `?` no expande arrays a una lista de literales en el cliente pg.
        const anyOf = (column, ids) => [
            `??::jsonb \\?| array[${ids.map(() => '?').join(',')}]`,
            [`${table}.${column}`, ...ids],
        ];

        if (access.userIds?.length) {
            /*
             * El creador siempre accede a su tablero (ver ControllerBoardResources), asi que
             * el filtro por usuario tiene que alcanzarlo. El OR va agrupado a proposito: suelto
             * se combinaria con el filtro de grupos y con `deleted_at`, y anularia el recorte.
             */
            const [sql, bindings] = anyOf('access_users', access.userIds);
            query.where(function () {
                this.whereRaw(sql, bindings).orWhereIn(`${table}.created_by`, access.userIds);
            });
        }

        if (access.groupIds?.length) {
            const [sql, bindings] = anyOf('access_groups', access.groupIds);
            query.whereRaw(sql, bindings);
        }
    }

    /**
     * Recorta la query a los tableros a los que el actor tiene acceso: creador, acceso
     * explicito por usuario o acceso por su grupo activo.
     *
     * Es la traduccion a SQL de BoardAccessPolicy.canAccess y la unica definicion de la
     * regla en esta capa: la consumen searchAvailableBoards y el recorte del listado, para
     * que las tres rutas no puedan divergir. Va agrupada en su propia cláusula porque las
     * tres condiciones son un OR entre si, y suelto se combinaria con `deleted_at` y con
     * los filtros pedidos, anulando el recorte.
     *
     * @param {import('knex').Knex.QueryBuilder} query
     * @param {{userId: string, groupId?: string}|null} actorScope - `null` significa que el
     *   llamante releva del recorte por llave maestra, no que falte el actor: los puntos de
     *   entrada (BoardSearcher.execute y searchAvailableBoards) rechazan al llamante sin
     *   identificar antes de llegar aqui.
     */
    #applyActorAccessScope(query, actorScope) {
        if (!actorScope?.userId) return;

        const table = this.tableName;
        const { userId, groupId } = actorScope;

        query.andWhere(function () {
            this.where(`${table}.created_by`, userId).orWhereRaw(`${table}.access_users::jsonb @> ?::jsonb`, [
                JSON.stringify([userId]),
            ]);

            if (groupId) {
                this.orWhereRaw(`${table}.access_groups::jsonb @> ?::jsonb`, [JSON.stringify([groupId])]);
            }
        });
    }

    /**
     * Searches for Board instances according to the given criteria.
     *
     * `actorScope` es el recorte que impone el servidor a partir del token; `access` son los
     * pseudo-campos que pide el cliente. Se aplican los dos, de modo que el filtro de UI solo
     * puede estrechar el conjunto autorizado, nunca ampliarlo.
     *
     * INVARIANTE: los filtros del cliente tienen que llegar como una conjuncion de primer
     * nivel. Se encadenan aqui al mismo nivel que `deleted_at IS NULL` y que el recorte, asi
     * que un OR suelto los anularia por precedencia (`A OR (B AND recorte)`). Lo garantiza
     * BoardSearcher, que rechaza con 400 cualquier OR de primer nivel; un OR dentro de un
     * grupo `groupType: 'AND'` si es seguro porque el Criteria lo parentiza.
     *
     * @param {Object} criteria
     * @param {{access?: {userIds?: string[], groupIds?: string[]}|null, actorScope?: {userId: string, groupId?: string}|null}} [scope]
     * @returns {Promise<Board[]>}
     */
    async search(criteria, { access = null, actorScope = null } = {}) {
        try {
            const query = criteria.convertToKnex(this.table().select('*'));
            query.whereNull(`${this.tableName}.deleted_at`);
            this.#applyActorAccessScope(query, actorScope);
            this.#applyAccessFilters(query, access);
            Helper.logDebug('query:', query.toString());

            const rows = await query;

            return rows.map((row) => Board.create(row));
        } catch (error) {
            Helper.logError('Error searching board', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Delega en el `count` de KnexRepository para que la guarda de borrado logico viva en un
     * unico sitio: el override que habia aqui la omitia, y el conteo incluia tableros borrados
     * salvo que el cliente mandase el filtro `deleted_at` por su cuenta.
     *
     * Rige la misma invariante que en `search`: `count` encadena las condiciones al mismo
     * nivel, asi que un OR de primer nivel tambien desharia aqui el recorte y el total.
     *
     * @param {Array} rawFilters
     * @param {*} relationship
     * @param {{access?: {userIds?: string[], groupIds?: string[]}|null, actorScope?: {userId: string, groupId?: string}|null}} [scope]
     * @returns {Promise<Object>}
     */
    async countBoards(rawFilters, relationship, { access = null, actorScope = null } = {}) {
        try {
            const criteria = new Criteria(rawFilters, relationship, 0, 0, undefined, this.tableName);

            return await this.count(criteria, (query) => {
                this.#applyActorAccessScope(query, actorScope);
                this.#applyAccessFilters(query, access);
            });
        } catch (error) {
            Helper.logError('Error counting boards by access', error);
            throw new QueryDBError('countBoards');
        }
    }

    async findUsersByIds(ids = []) {
        if (!ids.length) return [];

        try {
            const rows = await this.table('usuarios')
                .select('id', 'nombres', 'apellido1', 'apellido2')
                .whereIn('id', ids)
                .whereNull('deleted_at');

            return rows.map((row) => ({
                id: row.id,
                nombre: [row.nombres, row.apellido1, row.apellido2].filter(Boolean).join(' ').trim(),
            }));
        } catch (error) {
            Helper.logError('Error fetching users for boards access', error);
            throw new QueryDBError('findUsersByIds');
        }
    }

    async findGroupsByIds(ids = []) {
        if (!ids.length) return [];

        try {
            const rows = await this.table('grupos').select('id', 'nombre').whereIn('id', ids).whereNull('deleted_at');

            return rows.map((row) => ({ id: row.id, nombre: row.nombre }));
        } catch (error) {
            Helper.logError('Error fetching groups for boards access', error);
            throw new QueryDBError('findGroupsByIds');
        }
    }

    /**
     * Tableros que el actor puede abrir, en el orden configurado. Siempre recorta: la llave
     * maestra no releva aqui (ver el criterio en BoardAccessPolicy).
     *
     * @param {{userId: string, groupId?: string}} actor
     * @returns {Promise<Board[]>}
     * @throws {QueryDBError} si el llamante no viene identificado
     */
    async searchAvailableBoards({ userId, groupId }) {
        // Falla cerrado: sin userId el recorte no se aplicaria y la consulta devolveria el
        // tenant completo. La guarda va fuera del try para no perder el motivo real.
        if (!userId) {
            throw new QueryDBError('searchAvailableBoards', 'userId is required');
        }

        try {
            const table = this.tableName;

            const query = this.table(table)
                .select('*')
                .whereNull(`${table}.deleted_at`)
                // Los tableros sin orden asignado van al final; created_at desc desempata.
                // El CASE hace explicito el NULLS LAST en lugar de depender del default del motor.
                .orderByRaw('case when ?? is null then 1 else 0 end asc, ?? asc, ?? desc', [
                    `${table}.display_order`,
                    `${table}.display_order`,
                    `${table}.created_at`,
                ]);

            this.#applyActorAccessScope(query, { userId, groupId });

            Helper.logDebug('searchAvailableBoards SQL:', query.toString());

            const rows = await query;
            return rows.map((row) => Board.create(row));
        } catch (error) {
            Helper.logError('Error searching available boards', error);
            throw new QueryDBError('searchAvailableBoards');
        }
    }

    /**
     * Finds an `board` instance by its name.
     * @param {ValueObjectString} name - The name of the `board` to find.
     * @returns {Promise<Board|null>} A promise that resolves to the `board` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `board`.
     */
    async findByName(name) {
        try {
            const result = await this.table().select('*').where({ name: name?.value }).whereNull('deleted_at').first();

            return result ? new Board(result) : null;
        } catch (error) {
            Helper.logError('Error finding Board by name', error);
            throw new QueryDBError('find', 'findByName failed');
        }
    }

    /**
     * Finds an `Boards` instance by its ID.
     * @param {ValueObjectUuid} id - The ID of the `Boards` to find.
     * @returns {Promise<Board|null>} A promise that resolves to the `Boards` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `Boards`.
     */
    async find(id) {
        try {
            const result = await this.table().select('*').where({ id: id.value }).first();
            return result ? new Board(result) : null;
        } catch (error) {
            Helper.logError('Error finding Board', error);
            throw new QueryDBError('find');
        }
    }

    async findExistingIds(ids = [], tableName) {
        if (!ids.length) return [];

        const rows = await this.table(tableName).select('id').whereIn('id', ids).whereNull('deleted_at');

        return rows.map((r) => r.id);
    }

    async update(board) {
        try {
            await this.table()
                .update({
                    name: board.name.value,
                    description: board.description.value,
                    primary_entity: board.primary_entity.value,
                    criteria: JSON.stringify(board.criteria.value),
                    page_size: board.page_size.value,
                    display_order: board.display_order.value,
                    is_active: board.is_active.value,
                    icon_class: board.icon_class.value,
                    onescript_form_id: board.onescript_form_id.value,
                    filter_onescript_id: board.filter_onescript_id.value,
                    relations: JSON.stringify(board.relations.value),
                    columns: JSON.stringify(board.columns.value),
                    havings: JSON.stringify(board.havings.value),
                    access_groups: JSON.stringify(board.access_groups.value),
                    access_users: JSON.stringify(board.access_users.value),
                    options: JSON.stringify(board.options.value),
                    can_view_record: board.can_view_record.value,
                    can_create_record: board.can_create_record.value,
                    can_edit_record: board.can_edit_record.value,
                    can_admin_bulk_actions: board.can_admin_bulk_actions.value,
                    can_agent_bulk_actions: board.can_agent_bulk_actions.value,
                    can_admin_delete_record: board.can_admin_delete_record.value,
                    can_agent_delete_record: board.can_agent_delete_record.value,
                    updated_at: board.updated_at.value,
                    updated_by: board.updated_by.value,
                    deleted_at: board.deleted_at.value,
                    deleted_by: board.deleted_by.value,
                    orders: JSON.stringify(board.orders.value),
                    quick_ans_filter: JSON.stringify(board.quick_ans_filter.value),
                })
                .where({ id: board.id.value })
                .whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error updating boards', error);
            throw new QueryDBError('update');
        }
    }
}
