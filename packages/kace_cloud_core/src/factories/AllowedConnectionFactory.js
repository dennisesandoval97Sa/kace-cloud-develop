import { chance, Factory, uuidv4 } from './Factory.js';
import { AllowedConnection } from '../allowed-conections/domain/AllowedConnection.js';
import { KnexAllowedConnectionsRepository } from '../allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export const AllowedConnectionFactory = new Factory(KnexAllowedConnectionsRepository, AllowedConnection)
    .define({
        id: () => uuidv4(),
        description: () => chance.word({ length: 6 }),
        connection: () => chance.ip(),
        certificate: () => chance.string({ length: 10, alpha: true, numeric: true }),
        is_active: true,
        has_ssl: 1,
        created_at: () => chance.date({ year: 2024 }),
        created_by: () => uuidv4(),
    })
    .state('disabled', { is_active: false })
    .afterMaking((connection) => {
        Helper.logInfo(`AllowedConnection made with id: ${connection.id}`);
    })
    .afterCreating((connection) => {
        Helper.logInfo(`AllowedConnection created with id: ${connection.id}`);
    });
