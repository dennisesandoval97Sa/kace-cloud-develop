import { RelationsRepository } from '../../../../src/shared/infrastructure/relations/RelationsRepository.js';

describe('RelationsRepository', () => {
  let repo;

  beforeAll(() => {
    repo = new RelationsRepository();
  });

  test('findAll should return all Relations aggregates', async () => {
    const all = await repo.findAll();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0].entity.value).toBeDefined();
    expect(all[0].relation.value).toBeDefined();
  });

  test('findByEntity should filter correctly', async () => {
    const usersRels = await repo.findByEntity('users');
    expect(usersRels.every(r => r.entity.value === 'users')).toBe(true);
  });

});
