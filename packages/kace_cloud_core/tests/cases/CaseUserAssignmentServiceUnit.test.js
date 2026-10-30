import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import CaseUserAssignmentService from '../../src/cases/application/CaseUserAssignmentService.js';
import CasesMother from './domain/CasesMother';
import { Case } from '../../src/cases/domain/Case.js';

describe('CaseUserAssignmentService — assignment_change_type', () => {
    const repository = new KnexCaseRepository(knexConfig);

    function buildService() {
        const service = new CaseUserAssignmentService(repository);
        jest.spyOn(repository, 'update').mockResolvedValue(undefined);
        jest.spyOn(repository, 'saveHistory').mockResolvedValue(undefined);
        jest.spyOn(service, 'updateSlaTimers').mockResolvedValue(undefined);
        return service;
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('applies the provided changeType to the case before persisting', async () => {
        const service = buildService();
        const kase = Case.create(CasesMother.dto());

        await service.execute(kase, uuidv4(), uuidv4(), 'action');

        expect(kase.assignment_change_type.value).toBe('action');
        expect(repository.update).toHaveBeenCalledWith(kase);
    });

    it('defaults to manual when changeType is omitted', async () => {
        const service = buildService();
        const kase = Case.create(CasesMother.dto());

        await service.execute(kase, uuidv4(), uuidv4());

        expect(kase.assignment_change_type.value).toBe('manual');
    });
});
