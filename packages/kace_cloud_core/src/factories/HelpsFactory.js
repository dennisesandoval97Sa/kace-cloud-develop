import { chance, Factory, uuidv4 } from './Factory.js';
import { Helps, KnexHelpsRepository } from '../helps/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export const HelpsFactory = new Factory(KnexHelpsRepository, Helps)
    .define({
        id: () => uuidv4(),
        titulo: chance.word({ length: 5 }),
        descripcion: 'Example test description',
        color: chance.color({ format: 'hex' }),
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: uuidv4(),
    })
    .state('disabled', { is_active: false })
    .afterMaking((helps) => {
        Helper.logInfo(`Help made with id: ${helps.id.value}`);
    })
    .afterCreating((helps) => {
        Helper.logInfo(`Help created with id: ${helps.id.value}`);
    });
