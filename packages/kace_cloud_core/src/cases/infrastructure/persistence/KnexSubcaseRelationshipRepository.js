import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { SubcasesRelationship } from '../../domain/SubcasesRelationship.js';
import { CaseDataGrid } from '../../domain/CaseDataGrid.js';
import { v4 as uuidV4 } from 'uuid';
import { JsonbWildcardSelectTranslator } from '../../../shared/criteria/JsonbWildcardSelectTranslator.js';
import { JsonExtractSelectTranslator } from '../../../shared/criteria/JsonExtractSelectTranslator.js';

export class KnexSubcaseRelationshipRepository extends KnexRepository {
    constructor(config) {
        super(config, 'rel_cases_subcases');
    }

    /**
     * Saves a new subcases relation in the database.
     * @param {SubcasesRelationship} relation
     * @returns {Promise<void>}
     */
    async save(relation) {
        try {
            await this.table().insert({
                parent_case_id: relation.parent_case_id.value,
                child_case_id: relation.child_case_id.value,
            });
        } catch (error) {
            Helper.logError('Error saving subcase relationship:', error);
            throw new QueryDBError('save');
        }
    }

    async saveHistory({ action, parent_case_id, child_case_id, created_by, created_at }) {
        const row = {
            id: uuidV4(),
            action,
            parent_case_id,
            child_case_id,
            created_by,
            created_at,
        };

        await this.table('history_rel_cases_subcases').insert(row);
    }

    /**
     * Find a subcase relationship by parent and child IDs.
     * @param {ValueObjectUuid} parentId
     * @param {ValueObjectUuid} childId
     * @returns {Promise<SubcasesRelationship | null>}
     */
    async find(parentId, childId) {
        try {
            const result = await this.table()
                .where({
                    parent_case_id: parentId.value,
                    child_case_id: childId.value,
                })
                .first();

            return result ? new SubcasesRelationship(result) : null;
        } catch (error) {
            Helper.logError('Error finding subcase relationship:', error);
            throw new QueryDBError('find');
        }
    }

    async deleteByParentAndChild(parentId, childId) {
        try {
            await this.table().where({ parent_case_id: parentId.value, child_case_id: childId.value }).del();
        } catch (error) {
            Helper.logError('deleteByParentAndChild(rel_cases_sub) error', error);
            throw new QueryDBError('SubCaseRelations.deleteByParentAndChild');
        }
    }

    /**
     * Searches for subcase rows as a case grid based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation (filters, joins from `relationship`, pagination, order).
     * @param {string[]} [extraSelect=[]] - Optional SQL select fragments merged after the fixed grid column list. Used for dynamic columns from joined
     * tables (e.g. `aux_cases.data as aux_cases_data` or `json_extract(aux_cases.data, '$.name') as alias`). Expressions containing `json_extract(` are
     * wrapped with `knex.raw`. PostgreSQL JSON path expressions (`->`, `->>`, `#>>`, `#>`) are also passed through `raw`. Allowed table prefixes are
     * validated in `SubCaseRelationExtraSelectValidator` before this method runs.
     * @returns {Promise<CaseDataGrid[]>} Rows mapped to `CaseDataGrid`; unknown aliases appear on `extras`.
     */
    async search(criteria, extraSelect = []) {
        try {
            const baseFields = this.#addSelectFields();
            const extraMapped =
                extraSelect && extraSelect.length
                    ? extraSelect.map((expr) => {
                          // json_extract primero: viene del contrato publico y es sintaxis de
                          // mysql, asi que hay que convertirla antes de que la vea pg. El
                          // jsonpath extraido es un valor, no un identificador: se liga como
                          // binding en vez de interpolarse en el SQL (politica de SQL crudo).
                          const extracted = JsonExtractSelectTranslator.translate(expr);
                          const extractedSql = typeof extracted === 'string' ? extracted : extracted.sql;
                          const bindings = typeof extracted === 'string' ? [] : extracted.bindings;
                          const translated = JsonbWildcardSelectTranslator.translate(extractedSql);
                          return typeof translated === 'string' && this.#extraSelectExpressionNeedsRaw(translated)
                              ? this.connection.raw(translated, bindings)
                              : translated;
                      })
                    : [];
            const mergedSelect = extraSelect && extraSelect.length ? [...baseFields, ...extraMapped] : baseFields;
            const queryBuilder = this.table('cases')
                .join(this.qualifiedName(), `${this.tableName}.child_case_id`, 'cases.id')
                .select(mergedSelect);

            criteria.convertToKnex(queryBuilder);

            const rows = await this.#addRelationships(queryBuilder);

            return rows.map((row) => new CaseDataGrid(row));
        } catch (error) {
            Helper.logError('Error searching subcase relationships (grid):', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of user group relationships based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `SubcasesRelationship` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(
                this.table()
                    .join(this.qualifiedName('cases'), `${this.tableName}.child_case_id`, 'cases.id')
                    .countDistinct({ count: 'cases.id' })
            );
            const [rows] = await query;

            return rows;
        } catch (error) {
            Helper.logError('Error counting subcases relationships:', error);
            throw new QueryDBError('count');
        }
    }

    async bothExist(parentVO, childVO) {
        try {
            const rows = await this.table('cases').select('id').whereIn('id', [parentVO.value, childVO.value]);

            return rows.length === 2;
        } catch (error) {
            Helper.logError('Error checking existence for two case IDs', error);
            throw new QueryDBError('bothExist');
        }
    }

    /**
     * Devuelve el id del caso padre de un subcaso, o null si el caso no es subcaso.
     *
     * La jerarquía autoritativa es `rel_cases_subcases` —la que escribe
     * `SubCaseRelationCreator` y la que ya consultan `existsOpenChildByParent` y
     * `SubcasesOpenStatusService`—, no `cases.parent_id`. (MSKT-1392 / CORE-2)
     *
     * @param {string} childCaseId
     * @returns {Promise<string|null>}
     */
    async findParentCaseId(childCaseId) {
        try {
            const row = await this.table().where({ child_case_id: childCaseId }).first('parent_case_id');

            return row?.parent_case_id ?? null;
        } catch (error) {
            Helper.logError('Error finding parent case id', error);
            throw new QueryDBError('findParentCaseId');
        }
    }

    /**
     * Clasificaciones distintas de los subcasos VIVOS de un caso padre.
     *
     * Solo cuentan los subcasos abiertos: un subcaso ya cerrado es histórico y no puede
     * bloquear la reclasificación del padre, igual que `existsOpenChildByParent` solo mira
     * los hijos sin `fecha_resolucion`. (MSKT-1392 / CORE-2)
     *
     * @param {string} parentCaseId
     * @returns {Promise<string[]>}
     */
    async findOpenChildClassificationIds(parentCaseId) {
        try {
            const rows = await this.table()
                .join(this.qualifiedName('cases'), `${this.tableName}.child_case_id`, 'cases.id')
                .where(`${this.tableName}.parent_case_id`, parentCaseId)
                .whereNull('cases.fecha_resolucion')
                .whereNull('cases.deleted_at')
                .distinct('cases.clasificacion_id as clasificacion_id');

            return rows.map((row) => row.clasificacion_id).filter(Boolean);
        } catch (error) {
            Helper.logError('Error finding open child classifications', error);
            throw new QueryDBError('findOpenChildClassificationIds');
        }
    }

    async existsOpenChildByParent(parentId) {
        try {
            const row = await this.table()
                .join(this.qualifiedName('cases'), `${this.tableName}.child_case_id`, 'cases.id')
                .where(`${this.tableName}.parent_case_id`, parentId)
                .whereNull('cases.fecha_resolucion')
                .first('cases.id as id');

            return !!row;
        } catch (error) {
            Helper.logError('Error checking open child by parent', error);
            throw new QueryDBError('existsOpenChildByParent');
        }
    }

    #extraSelectExpressionNeedsRaw(expr) {
        if (typeof expr !== 'string') {
            return false;
        }
        if (/\bjson_extract\s*\(/i.test(expr)) {
            return true;
        }
        if (/\bjsonb_path_query_first\s*\(/i.test(expr)) {
            return true;
        }
        if (/->>|->|#>>|#>/.test(expr)) {
            return true;
        }
        return false;
    }

    /**
     *
     * @returns {string[]} list of fields for select
     */
    #addSelectFields() {
        return [
            'cases.id',
            'cases.reference',
            'cases.folio',
            'cases.created_at',
            'cases.created_by',
            'cases.transicion_id',
            'clasificaciones.nivel1',
            'clasificaciones.nivel2',
            'clasificaciones.nivel3',
            'clasificaciones.nivel4',
            'clasificaciones.nivel5',
            'clasificaciones.nivel6',
            'clasificaciones.nivel7',
            'clasificaciones.nivel8',
            'clasificaciones.nivel9',
            'clasificaciones.nivel10',
            'ans.color_ans_inicial',
            'ans.color_ans_intermedio',
            'ans.color_ans_final',
            'estados.nombre as estadoActual',
            'cases.antiguedad',
            'cases.updated_at',
            'cases.ans_posicion',
            'responsable.nombres',
            'responsable.apellido1',
            'responsable.apellido2',
            'responsable.login',
            'responsable.is_active as usuario_inactivo',
            'creador.external_id as creator_external_id',
            'clients.nombres as nombreCliente',
            'clients.apellido1 as primerApellido',
            'clients.apellido2 as segundoApellido',
            'clients.documento',
            'clients.tipo_cliente',
            'clients.nombre_empresa',
            'cases.cambio_estado_comentario_id',
            'cases.caso_clonado_id',
            'cases.fecha_resolucion',
            'cases.antiguedad_dias',
            'cases.antiguedad_horas',
            'cases.antiguedad_minutos',
            'cases.motivo_baja',
            'cases.sla_due_date',
            'cases.sla_state_position',
            'cases.parent_id',
            'cases.is_visible',
        ];
    }

    /**
     *
     * @param {Knex} partialQuery partial query to fetch
     * @returns {KnexQuery} query with joins
     * @private
     * @description This method is used to add relationships to the query
     * @example
     * const query = this.table().select(this.#addSelectFields());
     */
    #addRelationships(partialQuery) {
        return partialQuery
            .join(this.qualifiedName('clients'), 'clients.id', 'cases.cliente_id')
            .join(this.qualifiedName('grupos'), 'grupos.id', 'cases.grupo_id')
            .join(`${this.qualifiedName('usuarios')} as responsable`, 'responsable.id', 'cases.responsable_id')
            .join(this.qualifiedName('transiciones'), 'transiciones.id', 'cases.transicion_id')
            .join(this.qualifiedName('clasificaciones'), 'clasificaciones.id', 'cases.clasificacion_id')
            .leftJoin(this.qualifiedName('ans'), 'ans.id', 'clasificaciones.ans_id')
            .leftJoin(
                `${this.qualifiedName('descripciones_casos')} as descripcion`,
                'descripcion.id',
                'cases.descripcion_caso_id'
            )
            .leftJoin(this.qualifiedName('estados'), 'estados.id', 'transiciones.siguiente_estado_id')
            .leftJoin(`${this.qualifiedName('usuarios')} as creador`, 'creador.id', 'cases.created_by');
    }
}
