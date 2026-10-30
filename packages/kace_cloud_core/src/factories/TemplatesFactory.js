import { chance, Factory, uuidv4 } from './Factory.js';
import { Template } from '../templates/domain/Template.js';
import { KnexTemplatesRepository } from '../templates/infrastructure/persistence/KnexTemplatesRepository.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export const TemplateFactory = new Factory(KnexTemplatesRepository, Template)
    .define({
        id: () => uuidv4(),
        descripcion: () => chance.sentence({ words: 4 }),
        ruta: chance.url(),
        tipo: 1,
        destinatario: '{{cliente.email}}',
        copia: null,
        copia_oculta: null,
        asunto: 'Asunto de prueba',
        cuerpo: 'Cuerpo de prueba',
        incluye_adjuntos: () => chance.bool(),
        enviar_adjuntos_del_caso: () => chance.bool(),
        status: () => chance.pickone([1, 2]),
        created_at: new Date().toISOString(),
        created_by: uuidv4(),
    })
    .afterMaking((template) => {
        Helper.logInfo(`Template made with id: ${template.id.value}`);
    })
    .afterCreating((template) => {
        Helper.logInfo(`Template created with id: ${template.id.value}`);
    });
