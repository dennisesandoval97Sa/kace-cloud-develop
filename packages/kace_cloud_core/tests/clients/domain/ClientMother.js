import { v4 as uuidv4 } from 'uuid';
import { Client } from '../../../src/clients';
import { ensureParentRows } from '../../support/ensureParentRow.js';

/**
 * Documento distinto en cada llamada. `IsUniqueIdentification` rechaza dos
 * clientes con el mismo par tipo+documento, y `dto()` y `dtoComercial()`
 * compartian el literal fijo `CC:123456` aleatorizando solo el `id`: el segundo
 * cliente de un mismo archivo reventaba con 'Client with document CC:123456
 * already exists'. Ningun test afirma nada sobre el valor del documento.
 *
 * @returns {string} doce digitos, dentro del varchar(45) de `clients.documento`.
 */
const documentoUnico = () => String(Math.floor(Math.random() * 1e12)).padStart(12, '0');

export default class ClientMother {
    /**
     * `clients.padre_id` es una FK reflexiva contra `clients`; `dtoComercial`
     * inventa el padre con `uuidv4()` sin crear esa fila.
     *
     * Se garantiza SIEMPRE: `ensureParentRow` es idempotente y la columna sale de
     * pg_constraint.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [{ table: 'clients', id: dto.padre_id }]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Client` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Client` entity.
     */
    static dto(padre_id = null, override = {}) {
        return {
            id: uuidv4(),
            tipo_cliente: 'Natural',
            tipo_documento: 'CC',
            documento: documentoUnico(),
            nombres: 'Charles',
            apellido1: 'Perry',
            apellido2: 'Robinson',
            nombre_empresa: null,
            sexo: 'Masculino',
            estado_civil: 'Soltero',
            fecha_nacimiento: '1979-05-07T00:00:00.000Z',
            email: 'charles.robinson@konecta.com',
            email_alterno: 'charlesprobinson@konecta.com',
            telefono: '4806680938',
            telefono_alterno: '0987654321',
            campos_extra1: '',
            campos_extra2: '',
            campos_extra3: '',
            padre_id,
            habeas_data: 'Si',
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...override,
        };
    }

    static dtoComercial(parentId = null) {
        if (!parentId) {
            parentId = uuidv4();
        }
        return {
            id: uuidv4(),
            tipo_cliente: 'Comercial',
            tipo_documento: 'CC',
            documento: documentoUnico(),
            nombre_empresa: 'Empresa',
            nombres: null,
            apellido1: null,
            apellido2: null,
            sexo: null,
            estado_civil: null,
            fecha_nacimiento: null,
            email: 'charles.robinson@sinmaail.com',
            email_alterno: null,
            telefono: null,
            telefono_alterno: null,
            campos_extra1: '',
            campos_extra2: '',
            campos_extra3: '',
            padre_id: parentId,
            habeas_data: 'Si',
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates an `Client` instance and saves it to the repository.
     *
     * @param {KnexClientRepository} repository - The repository to save the `Client` instance.
     * @param padre_id
     * @returns {Client} The created `Client` instance.
     */
    static async createClient(repository, padre_id = null, override = {}) {
        const clientDto = ClientMother.dto(padre_id, override);
        const client = Client.create(clientDto);
        await ClientMother.ensureRelations(repository.connection, clientDto);
        await repository.save(client);
        return client;
    }

    static getValidClient() {
        return Client.create(ClientMother.dto());
    }
}
