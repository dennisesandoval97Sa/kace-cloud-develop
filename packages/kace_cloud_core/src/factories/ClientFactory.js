import { chance, Factory, uuidv4 } from './Factory.js';
import { Client, KnexClientRepository } from '../clients/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class ClientFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexClientRepository, Client, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            tipo_cliente: () => chance.pickone(['Natural', 'Comercial']),
            tipo_documento: () => chance.pickone(['CC', 'TI', 'CE']),
            documento: () => chance.integer({ min: 100000, max: 999999 }).toString(),
            nombres: () => chance.first(),
            apellido1: () => chance.string({ length: chance.integer({ min: 3, max: 10 }), alpha: true }),
            apellido2: () => chance.string({ length: chance.integer({ min: 3, max: 10 }), alpha: true }),
            sexo: () => chance.pickone(['Masculino', 'Femenino']),
            estado_civil: () => chance.pickone(['Soltero', 'Casado', 'Divorciado']),
            fecha_nacimiento: () => chance.birthday({ string: true }),
            email: () => chance.email(),
            email_alterno: () => chance.email(),
            telefono: () => chance.string({ length: 10, pool: '0123456789' }),
            telefono_alterno: () => chance.string({ length: 10, pool: '0123456789' }),
            campos_extra1: null,
            campos_extra2: null,
            campos_extra3: null,
            padre_id: null,
            habeas_data: chance.pickone(['Si', 'No']),
            status: chance.pickone([1, 2]),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .afterMaking((client) => {
                Helper.logInfo(`Client made with id: ${client.id.value}`);
            })
            .afterCreating((client) => {
                Helper.logInfo(`Client created with id: ${client.id.value}`);
            });
    }
}
