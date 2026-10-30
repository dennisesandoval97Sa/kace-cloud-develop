import { v4 as uuidv4 } from 'uuid';
import { Policy } from '../../../src/policies/domain/Policy';
import Chance from 'chance';
import TestHelper from '../../TestHelper.js';

export class PoliciesMother {
    static dto() {
        return {
            id: uuidv4(),
            title: 'Test',
            provider: 'API',
            effect: 'ALLOW',
            operations: ['read', 'update'],
            actions: ['all'],
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }

    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            title: TestHelper.generateSafeValue(() =>
                chance.string({ lenth: 10, pool: 'abcdefghijklmnopqrstuvwxyz', alpha: true })
            ),
            provider: 'API',
            effect: 'ALLOW',
            operations: ['read', 'update'],
            actions: ['all'],
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }

    static async createPolicy(repository) {
        const policy = Policy.create(PoliciesMother.dto());
        await repository.save(policy);
        return policy;
    }

    static async createRandomPolicy(repository) {
        const policy = Policy.create(PoliciesMother.randomDto());
        await repository.save(policy);
        return policy;
    }
}
