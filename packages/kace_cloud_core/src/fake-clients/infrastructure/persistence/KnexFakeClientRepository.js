import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { Helper, InvalidArgumentError, KnexRepository } from '../../../shared/index.js';
import { FakeClient } from '../../domain/FakeClient.js';

export class KnexFakeClientRepository extends KnexRepository {
    constructor(config) {
        super(config, 'fake_clients');
    }

    /**
     * @param {FakeClient} fakeClient
     * @returns {Promise<void>}
     */
    async save(fakeClient) {
        try {
            return await this.table().insert({
                id: fakeClient.id.value,
                tipo_cliente: fakeClient.tipo_cliente.value,
                tipo_documento: fakeClient.tipo_documento.value,
                documento: fakeClient.documento.value,
                nombres: fakeClient.nombres.value,
                apellido1: fakeClient.apellido1.value,
                apellido2: fakeClient.apellido2.value,
                nombre_empresa: fakeClient.nombre_empresa.value,
                sexo: fakeClient.sexo.value,
                estado_civil: fakeClient.estado_civil.value,
                fecha_nacimiento: fakeClient.fecha_nacimiento.value,
                email: fakeClient.email.value,
                email_alterno: fakeClient.email_alterno.value,
                telefono: fakeClient.telefono.value,
                telefono_alterno: fakeClient.telefono_alterno.value,
                status: fakeClient.status.value,
                padre_id: fakeClient.padre_id.value,
                habeas_data: fakeClient.habeas_data.value,
                created_at: fakeClient.created_at.value,
                created_by: fakeClient.created_by.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Updates a client instance in the repository.
     *
     * @param {FakeClient} fakeClient - The client instance to save.
     * @returns {Promise<void>}
     */
    async update(fakeClient) {
        try {
            const result = await this.table().where({ id: fakeClient.id.value }).update(fakeClient.changedAttributes);
            Helper.logInfo('Updated client', { result });
            if (result === 0) {
                throw new InvalidArgumentError('Client not found');
            }
        } catch (error) {
            Helper.logInfo('Error updating fake clients', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Finds a client by ID.
     *
     * @param {ValueObjectUuid} id - The ID of the client to find.
     * @returns {Promise<FakeClient|null>} The found client or null if not found.
     */
    async find(id) {
        try {
            if (!id?.value) {
                throw new InvalidArgumentError('ID must be provided');
            }
            const result = await this.table().where({ id: id.value }).first();

            return result ? new FakeClient(result) : null;
        } catch (error) {
            Helper.logInfo('Error finding fake clients', error);
            throw new QueryDBError('find');
        }
    }

    async delete(id) {
        try {
            await this.table().where({ id: id.value }).delete();
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('delete');
        }
    }
}
