import { jest } from '@jest/globals';
import { InteractionSearcher } from '../../src/interactions/application/search/InteractionSearcher.js';
import { AssociateInteractionToCaso } from '../../src/interactions/application/associateInteractionToCaso/AssociateInteractionToCaso.js';
import { LinkedInteractionCasesFinder } from '../../src/interactions/application/linked-cases/LinkedInteractionCasesFinder.js';

const ID = {
    user: '11111111-1111-4111-8111-111111111111',
    group: '22222222-2222-4222-8222-222222222222',
    interaction: '33333333-3333-4333-8333-333333333333',
    case: '44444444-4444-4444-8444-444444444444',
};

const scope = { userId: ID.user, activeGroupId: ID.group };

describe('Agent Interaction active-group scope', () => {
    it('uses the same server scope for search rows and count even when the payload filters another workspace', async () => {
        const repository = {
            tableName: 'interactions',
            searchForActiveGroup: jest.fn().mockResolvedValue([]),
            countForActiveGroup: jest.fn().mockResolvedValue({ 'count(*)': 0 }),
        };
        const criteria = {
            filter: [{ field: 'workspace_id', operator: 'eq', value: 'payload-workspace', type: 'AND' }],
            relationships: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        const result = await new InteractionSearcher(repository).execute(criteria, scope);

        expect(result.toJson()).toMatchObject({ data: { items: [] }, metadata: { count: 0 } });
        expect(repository.searchForActiveGroup).toHaveBeenCalledWith(expect.anything(), null, scope);
        expect(repository.countForActiveGroup).toHaveBeenCalledWith(expect.anything(), scope);
    });

    it('hides an out-of-scope association target with a generic 404 and performs no pivot writes', async () => {
        const associateRepository = {
            exists: jest.fn(),
            save: jest.fn(),
        };
        const casesRepository = { find: jest.fn().mockResolvedValue({ id: ID.case }) };
        const interactionRepository = {
            withTransaction: (transactionHandler) => transactionHandler('trx'),
            findByIdForActiveGroup: jest.fn().mockResolvedValue(null),
        };
        const useCase = new AssociateInteractionToCaso(associateRepository, casesRepository, interactionRepository);

        await expect(
            useCase.execute({ interaction_id: ID.interaction, caso_id: ID.case }, scope)
        ).rejects.toMatchObject({ statusCode: 404, message: 'Interaction not found' });
        expect(interactionRepository.findByIdForActiveGroup).toHaveBeenCalledWith(ID.interaction, scope, {
            trx: 'trx',
            forUpdate: true,
        });
        expect(associateRepository.exists).not.toHaveBeenCalled();
        expect(associateRepository.save).not.toHaveBeenCalled();
    });

    it('authorizes and saves an Agent association in the same writer transaction', async () => {
        const associateRepository = {
            exists: jest.fn().mockResolvedValue(false),
            save: jest.fn().mockResolvedValue(undefined),
        };
        const casesRepository = { find: jest.fn().mockResolvedValue({ id: ID.case }) };
        const interactionRepository = {
            withTransaction: (transactionHandler) => transactionHandler('trx'),
            findByIdForActiveGroup: jest.fn().mockResolvedValue({ id: ID.interaction }),
        };
        const dto = { interaction_id: ID.interaction, caso_id: ID.case };

        await new AssociateInteractionToCaso(associateRepository, casesRepository, interactionRepository).execute(
            dto,
            scope
        );

        expect(associateRepository.exists).toHaveBeenCalledWith(ID.interaction, ID.case, { trx: 'trx' });
        expect(associateRepository.save).toHaveBeenCalledWith(dto, { trx: 'trx' });
    });

    it('hides out-of-scope linked-case reads before querying the pivot', async () => {
        const associateRepository = { findByInteractionId: jest.fn() };
        const casesRepository = { findSummaryByIds: jest.fn() };
        const interactionRepository = { findByIdForActiveGroup: jest.fn().mockResolvedValue(null) };

        const finder = new LinkedInteractionCasesFinder(associateRepository, casesRepository, interactionRepository);

        await expect(finder.execute(ID.interaction, scope)).rejects.toMatchObject({
            statusCode: 404,
            message: 'Interaction not found',
        });
        expect(associateRepository.findByInteractionId).not.toHaveBeenCalled();
        expect(casesRepository.findSummaryByIds).not.toHaveBeenCalled();
    });
});
