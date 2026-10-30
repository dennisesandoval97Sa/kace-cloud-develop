import { CustomError, Helper, InvalidArgumentError, KnexRepository } from '../../../shared/index.js';
import { Geolocation } from '../../domain/Geolocation.js';
import Creator from '../../../shared/domain/aggregates/Creator.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

/**
 * Class representing the repository for Geolocation using Knex.
 */
export class KnexGeolocationRepository extends KnexRepository {
    /**
     * Creates an instance of KnexGeolocationRepository.
     * @param {Object} config
     */
    constructor(config, readerConfig = null) {
        super(config, 'geolocation', readerConfig);
    }

    /**
     * Saves a Geolocation object to the database.
     * @param {Geolocation} geolocation
     * @returns {Promise<void>}
     * @throws {CustomError}
     */
    async save(geolocation) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: geolocation.id.value,
                user_id: geolocation.user_id.value,
                action_type: geolocation.action_type.value,
                latitud: geolocation.latitud.value,
                longitud: geolocation.longitud.value,
                ip4_address: geolocation.ip4_address.value,
                metadata: geolocation.metadata.value,
                created_at: geolocation.created_at.value,
                created_by: geolocation.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving the geolocation', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Updates a Geolocation object in the database.
     * @param {Geolocation} geolocation
     * @returns {Promise<void>}
     * @throws {InvalidArgumentError}
     * @throws {InvalidArgumentError}
     */
    async update(geolocation) {
        try {
            if (!geolocation || !geolocation.id) {
                throw new InvalidArgumentError('Geolocation must have an ID');
            }

            DbRequestContext.markWrite();
            const result = await this.table().where({ id: geolocation.id.value }).update(geolocation.changedAttributes);

            if (result === 0) {
                throw new InvalidArgumentError('Geolocation not found');
            }
        } catch (error) {
            Helper.logError('Error saving the geolocation', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Finds a Geolocation object by its ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<Geolocation|null>}
     * @throws {InvalidArgumentError}
     */
    async find(id) {
        try {
            const idValue = id?.value;

            if (!idValue) {
                throw new InvalidArgumentError('ID is required');
            }

            const geolocation = await this.read.table('geolocation').where({ id: idValue }).first();

            return geolocation ? new Geolocation(geolocation) : null;
        } catch (error) {
            Helper.logError('Error saving the geolocation', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds all Geolocation objects.
     * @returns {Promise<Geolocation[]>}
     */
    async findAll() {
        try {
            return this.read
                .table('geolocation')
                .select()
                .whereNull('deleted_at')
                .then((geolocations) => geolocations.map((geolocation) => new Geolocation(geolocation)));
        } catch (error) {
            Helper.logError('Error finding geolocation', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Search on the provided criteria.
     *
     * @param {Criteria} criteria
     * @returns {Promise<GlobalConfigurations[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('geolocation').select(`${this.tableName}.*`);

            queryBuilder
                .select(
                    `${this.tableName}.id as id`,
                    'usuarios.id as userId',
                    'usuarios.nombres',
                    'usuarios.apellido1',
                    'usuarios.apellido2'
                )
                .whereNull(`${this.tableName}.deleted_by`)
                .leftJoin(this.qualifiedName('usuarios'), `${this.tableName}.user_id`, 'usuarios.id');
            criteria.convertToKnex(queryBuilder);

            const rows = await queryBuilder;
            return rows.map(
                (geolocation) =>
                    new Geolocation(
                        {
                            ...geolocation,
                            id: geolocation.id,
                        },
                        new Creator({ ...geolocation, id: geolocation.user_id })
                    )
            );
        } catch (error) {
            Helper.logInfo(`Error searching geolocation: ${error}`);
            throw new QueryDBError('search');
        }
    }
}
