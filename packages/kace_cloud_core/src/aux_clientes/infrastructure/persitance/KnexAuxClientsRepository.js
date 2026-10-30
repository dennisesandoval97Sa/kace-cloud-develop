import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository';
import { AuxClients } from '../../domain/AuxClients';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexAuxClientsRepository extends KnexRepository {
    constructor(config) {
        super(config, 'aux_clients');
    }

    async save(dto) {
        try {
            const [insertedRecord] = await this.table()
                .insert({
                    id: dto.id.value,
                    cliente_id: dto.cliente_id.value,
                    data: dto.data.value,
                    created_at: dto.created_at.value,
                    created_by: dto.created_by.value,
                })
                .returning('*');

            return new AuxClients(insertedRecord);
        } catch (error) {
            Helper.logError('Error saving aux clients', error);
            throw new QueryDBError('save');
        }
    }

    async find(id) {
        try {
            const auxClient = await this.table().select('*').where({ id: id.value }).first();
            return auxClient ? new AuxClients(auxClient) : null;
        } catch (error) {
            Helper.logError('Error finding aux clients', error);
            throw new QueryDBError('find');
        }
    }

    async findByClient(clientId) {
        try {
            const auxClient = await this.table()
                .select('*')
                .where({ cliente_id: clientId.value })
                .whereNull('deleted_at')
                .first();
            return auxClient ? new AuxClients(auxClient) : null;
        } catch (error) {
            Helper.logError('Error saving aux clients', error);
            throw new QueryDBError('find');
        }
    }

    async search(criteria) {
        try {
            let initialQuery = this.table().select(`${this.tableName}.*`);

            const relations = {};
            if (criteria.relationship && criteria.relationship.length > 0) {
                criteria.relationship.forEach((relation) => {
                    initialQuery.select(
                        this.connection.raw(
                            `row_to_json(${relation.toPrimitives().table.value}.*) as ${relation.toPrimitives().table.value}`
                        )
                    );
                    relations[relation.toPrimitives().table.value] = true;
                });
            }

            const query = criteria.convertToKnex(initialQuery);
            query.whereNull(`${this.tableName}.deleted_at`);
            const rows = await query;

            return rows.map((row) => {
                const rels = {};
                for (const relName of Object.keys(relations)) {
                    rels[relName] = row[relName];
                }
                return AuxClients.create({
                    ...row,
                    relations: rels,
                });
            });
        } catch (error) {
            Helper.logError('Error searching schemas', error);
            throw new QueryDBError('search');
        }
    }
}
