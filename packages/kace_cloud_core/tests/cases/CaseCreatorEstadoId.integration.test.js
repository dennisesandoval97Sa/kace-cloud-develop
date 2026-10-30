import { CaseCreator } from '../../src/cases/application/create/CaseCreator.js';
import { CaseCreator2 } from '../../src/cases/application/create/CaseCreator2.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { TransitionFactory } from '../../src/factories/TransitionFactory.js';
import { knexConfig } from '../knexfile.js';
import CasesMother from './domain/CasesMother.js';

/**
 * `CaseCreator`/`CaseCreator2` no fijan `estado_id` en el dto que construyen: dependen
 * silenciosamente de la derivación automática de `KnexCaseRepository.save()` a partir de
 * `transicion_id`. Este test ejercita ambos creators (no la derivación en sí, ya cubierta en
 * `CaseEstadoIdSync.integration.test.js` vía `CasesMother.createCase`, que llama al repositorio
 * directo en vez de pasar por la capa de aplicación).
 */
describe('CaseCreator / CaseCreator2 heredan la derivación de estado_id al crear', () => {
    const repository = new KnexCaseRepository(knexConfig);
    let transicionId;
    let estadoDestinoId;

    beforeEach(async () => {
        const transition = await new TransitionFactory(knexConfig).create({ status: 1 });
        transicionId = transition.id.value;
        estadoDestinoId = transition.siguiente_estado_id.value;
    });

    async function readEstadoId(caseId) {
        const row = await repository.connection('cases').first('estado_id').where({ id: caseId });
        return row.estado_id;
    }

    it('CaseCreator: el caso nace con el estado de su transición sin declararlo explícitamente', async () => {
        const dto = CasesMother.dto({ transicion_id: transicionId });
        await CasesMother.ensureRelations(repository.connection, dto);

        await new CaseCreator(repository, null, null, null, { id: { value: dto.responsable_id } }).execute(dto, {
            skipTransitionValidation: true,
        });

        expect(await readEstadoId(dto.id)).toBe(estadoDestinoId);
    });

    it('CaseCreator2: el caso nace con el estado de su transición sin declararlo explícitamente', async () => {
        const dto = CasesMother.dto({ transicion_id: transicionId });
        await CasesMother.ensureRelations(repository.connection, dto);

        await new CaseCreator2(repository, null, null, null, { id: { value: dto.responsable_id } }).execute(dto, {
            skipTransitionValidation: true,
        });

        expect(await readEstadoId(dto.id)).toBe(estadoDestinoId);
    });
});
