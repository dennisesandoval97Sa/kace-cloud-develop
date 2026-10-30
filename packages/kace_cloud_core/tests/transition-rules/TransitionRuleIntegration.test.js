import { v4 as uuidv4 } from 'uuid';

import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { TransitionRuleMother } from './domain/TransitionRuleMother.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { KnexTransitionRuleRepository } from '../../src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { TransitionRule } from '../../src/transition-rules/domain/TransitionRule.js';
import { TransitionRuleCounter } from '../../src/transition-rules/domain/TransitionRuleCounter.js';
import { TransitionRuleCreator } from '../../src/transition-rules/application/create/TransitionRuleCreator.js';
import { TransitionRuleUpdater } from '../../src/transition-rules/application/update/TransitionRuleUpdater.js';
import { TransitionRuleDeleter } from '../../src/transition-rules/application/delete/TransitionRuleDeleter.js';
import { TransitionRuleFinder } from '../../src/transition-rules/application/find/TransitionRuleFinder.js';
import { TransitionRuleSearcher } from '../../src/transition-rules/application/search/TransitionRuleSearcher.js';
import { TransitionRuleResponse } from '../../src/transition-rules/application/TransitionRuleResponse.js';
import { TransitionRuleCollectionResponse } from '../../src/transition-rules/application/TransitionRuleCollectionResponse.js';

describe('TransitionRule Integration Tests', () => {
    const repository = new KnexTransitionRuleRepository(knexConfig);
    const currentUser = new User(UsersMother.dto());

    it('creates a new TransitionRule', async () => {
        const dto = TransitionRuleMother.dto();
        const creator = new TransitionRuleCreator(repository);

        await creator.execute(dto);

        const result = await repository.connection('transition_rules').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
        expect(result[0].nombre).toEqual(dto.nombre);
    });

    it('should not create a TransitionRule when dto is null', async () => {
        const creator = new TransitionRuleCreator(repository);

        await expect(creator.execute(null)).rejects.toThrow(Error);
    });

    it('should not create a duplicate TransitionRule with the same id', async () => {
        const dto = TransitionRuleMother.dto();
        const creator = new TransitionRuleCreator(repository);

        await creator.execute(dto);

        await expect(creator.execute(dto)).rejects.toThrow(CustomError);
    });

    it('should not create a TransitionRule with a duplicate nombre', async () => {
        const dto = TransitionRuleMother.dto();
        const creator = new TransitionRuleCreator(repository);

        await creator.execute(dto);

        const duplicateDto = TransitionRuleMother.dto({ nombre: dto.nombre });

        await expect(creator.execute(duplicateDto)).rejects.toThrow(ValidationFailError);
    });

    it('saves conditions as JSON correctly', async () => {
        const dto = TransitionRuleMother.dto();
        const creator = new TransitionRuleCreator(repository);

        await creator.execute(dto);

        const result = await repository.connection('transition_rules').where('id', dto.id).first();
        const savedConditions =
            typeof result.conditions === 'string' ? JSON.parse(result.conditions) : result.conditions;

        expect(savedConditions).toEqual(dto.conditions);
    });

    it('finds an existing TransitionRule by id', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const finder = new TransitionRuleFinder(repository, currentUser);

        const result = await finder.execute(rule.id.value);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(TransitionRuleResponse);
    });

    it('returns null when TransitionRule is not found', async () => {
        const result = await repository.find({ value: uuidv4() });

        expect(result).toBeNull();
    });

    it('updates an existing TransitionRule', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const updater = new TransitionRuleUpdater(repository);

        const updateDto = {
            nombre: 'Nombre actualizado',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        await updater.execute(rule.id.value, updateDto);

        const updated = await repository.find(rule.id);

        expect(updated).toBeInstanceOf(TransitionRule);
        expect(updated.nombre.value).toEqual(updateDto.nombre);
        expect(updated.updated_at.value).toEqual(updateDto.updated_at);
        expect(updated.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('updates conditions in a TransitionRule', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const updater = new TransitionRuleUpdater(repository);

        const newConditions = {
            combinator: 'or',
            rules: [{ field: 'cases.status', operator: '=', value: '2', type: 'manual_input', value_type: 'text' }],
        };

        await updater.execute(rule.id.value, {
            conditions: newConditions,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        });

        const updated = await repository.find(rule.id);

        expect(updated.conditions.value).toEqual(newConditions);
    });

    it('should throw CustomError when updating a non-existent TransitionRule', async () => {
        const updater = new TransitionRuleUpdater(repository);

        await expect(
            updater.execute(uuidv4(), {
                nombre: 'No existe',
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            })
        ).rejects.toThrow(CustomError);
    });

    it('should throw ValidationFailError when updating nombre to an already used nombre', async () => {
        const rule1 = await TransitionRuleMother.create(repository);
        const rule2 = await TransitionRuleMother.create(repository);
        const updater = new TransitionRuleUpdater(repository);

        await expect(
            updater.execute(rule2.id.value, {
                nombre: rule1.nombre.value,
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            })
        ).rejects.toThrow(ValidationFailError);
    });

    it('soft deletes an existing TransitionRule', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const deleter = new TransitionRuleDeleter(repository);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        await deleter.execute(rule.id.value, deleteDto);

        const result = await repository.find(rule.id);

        expect(result).toBeNull();
    });

    it('should throw CustomError when deleting a non-existent TransitionRule', async () => {
        const deleter = new TransitionRuleDeleter(repository);

        await expect(
            deleter.execute(uuidv4(), {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(CustomError);
    });

    it('searches TransitionRules with given criteria', async () => {
        for (let i = 0; i < 5; i++) {
            await TransitionRuleMother.create(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const searcher = new TransitionRuleSearcher(repository);
        const result = await searcher.execute(dtoCriteria);

        expect(result).toBeInstanceOf(TransitionRuleCollectionResponse);
        expect(result.toJson().data.items.length).toBe(5);
    });

    it('should throw QueryDBError when filtering by a non-existent field', async () => {
        await TransitionRuleMother.create(repository);

        const dtoCriteria = {
            filter: [{ field: 'campo_inexistente', operator: 'eq', value: 'x', type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        await expect(new TransitionRuleSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
    });

    it('counts the total number of TransitionRule instances', async () => {
        for (let i = 0; i < 10; i++) {
            await TransitionRuleMother.create(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const counter = new TransitionRuleCounter(repository);
        const result = await counter.execute(dtoCriteria);

        expect(Number(result.count)).toBe(10);
    });

    it('returns zero when no records match the filter', async () => {
        for (let i = 0; i < 5; i++) {
            await TransitionRuleMother.create(repository);
        }

        const dtoCriteria = {
            filter: [{ field: 'status', operator: 'eq', value: '99', type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const counter = new TransitionRuleCounter(repository);
        const result = await counter.execute(dtoCriteria);

        expect(Number(result.count)).toBe(0);
    });

    it('finds a TransitionRule by nombre (case-insensitive)', async () => {
        await TransitionRuleMother.create(repository, { nombre: 'Regla Especial' });

        const result = await repository.findByNombre({ value: 'regla especial' });

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(TransitionRule);
        expect(result.nombre.value).toEqual('Regla Especial');
    });

    it('returns null when findByNombre does not find a match', async () => {
        const result = await repository.findByNombre({ value: 'no existe' });

        expect(result).toBeNull();
    });

    it('does not find a soft-deleted TransitionRule by nombre', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const deleter = new TransitionRuleDeleter(repository);

        await deleter.execute(rule.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.findByNombre({ value: rule.nombre.value.toLowerCase() });

        expect(result).toBeNull();
    });
});
