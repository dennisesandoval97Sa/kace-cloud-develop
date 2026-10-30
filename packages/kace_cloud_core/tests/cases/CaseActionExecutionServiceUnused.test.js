import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { CaseCreator } from '../../src/cases/application/create/CaseCreator.js';
import { InMemoryEventBus } from '../../src/shared/infrastructure/events/InMemoryEventBus.js';
import { EventPublisher } from '../../src/shared/application/events/EventPublisher.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import CasesMother from './domain/CasesMother.js';

describe('CaseCreator y el servicio de acciones', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    it('no invoca actionExecutionService al publicar CaseCreated: las acciones las corre el event_processor', async () => {
        const calls = [];
        const actionExecutionServiceSpy = {
            execute: async (...args) => {
                calls.push(args);
            },
        };

        // #publishDomainEvents hace `if (!this.#eventPublisher) return;`, asi que con un
        // eventPublisher real y en marcha, este test SI entra al bloque donde antes de
        // f221ef838 se invocaba actionExecutionService al construir CaseCreated. Sin esto,
        // la aserción de abajo sería trivial: pasaria aunque alguien reintrodujera la llamada
        // ahi mismo.
        const eventBus = new InMemoryEventBus();
        const publishedEvents = [];
        eventBus.subscribe('*', async (event) => {
            publishedEvents.push(event);
        });
        const eventPublisher = new EventPublisher(eventBus);
        const tenant = { id: { value: 'tenant-123' } };

        const dto = CasesMother.dto();
        await CasesMother.ensureRelations(repository.connection, dto, {});

        await new CaseCreator(repository, actionExecutionServiceSpy, eventPublisher, tenant, currentUser).execute(dto);

        // Confirma que el camino de publicacion realmente corrio (y no se salio temprano).
        expect(publishedEvents).toHaveLength(1);
        expect(publishedEvents[0].eventName).toBe('kace.core.case.created');

        // Desde f221ef838 CaseCreator publica CaseCreated y quien ejecuta las acciones es el
        // event_processor. Quien pase este servicio y de por hecho que se ejecutan, se
        // equivoca: le paso a 11 tests de CaseActionsIntegration.
        expect(calls).toEqual([]);
    });
});
