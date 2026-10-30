import { v4 as uuid } from 'uuid';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { GlobalConfigurationsMother } from './domain/GlobalConfigurationsMother.js';

describe('KnexGlobalConfigurationRepository.findByIds', () => {
    const knex = knexConfig;
    const repo = new KnexGlobalConfigurationRepository(knex);

    beforeEach(async () => {
        await knex.raw('TRUNCATE TABLE global_configurations CASCADE');
    });

    it('returns non-deleted configurations matching ids', async () => {
        const a = uuid(),
            b = uuid();
        const cfgA = await GlobalConfigurationsMother.createConfiguration(repo, { id: a, description: 'Config Alpha' });
        const cfgB = await GlobalConfigurationsMother.createConfiguration(repo, { id: b, description: 'Config Beta' });
        const result = await repo.findByIds([cfgA.id.value, cfgB.id.value]);
        expect(result.map((c) => c.id.value).sort()).toEqual([a, b].sort());
    });

    it('returns [] when ids is empty', async () => {
        expect(await repo.findByIds([])).toEqual([]);
    });

    it('excludes soft-deleted configurations', async () => {
        const a = uuid(),
            b = uuid();
        await GlobalConfigurationsMother.createConfiguration(repo, { id: a, description: 'Config Alpha' });
        const cfgB = await GlobalConfigurationsMother.createConfiguration(repo, { id: b, description: 'Config Beta' });
        await knex('global_configurations').where({ id: cfgB.id.value }).update({ deleted_at: new Date() });
        const result = await repo.findByIds([a, b]);
        expect(result.map((c) => c.id.value)).toEqual([a]);
    });
});
