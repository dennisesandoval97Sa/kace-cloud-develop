import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseFindAllActiveService } from '../../src/cases/domain/services/CaseFindAllActiveService.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';

// Minimal required UUID values used as FK placeholders in every row
const FIXED_CLIENTE_ID = uuidv4();
const FIXED_TRANSICION_ID = uuidv4();
const FIXED_RESPONSABLE_ID = uuidv4();
const FIXED_CLASIFICACION_ID = uuidv4();
const FIXED_DESCRIPCION_CASO_ID = uuidv4();
const FIXED_GRUPO_ID = uuidv4();
const FIXED_CREATED_BY = uuidv4();

/**
 * Returns a minimal row that satisfies the Case entity constructor.
 * Case requires non-nullable UUIDs: id, cliente_id, transicion_id,
 * responsable_id, clasificacion_id, descripcion_caso_id, grupo_id.
 * AggregateRoot requires created_at and created_by.
 */
function caseRow(id, overrides = {}) {
    return {
        id,
        cliente_id: FIXED_CLIENTE_ID,
        transicion_id: FIXED_TRANSICION_ID,
        responsable_id: FIXED_RESPONSABLE_ID,
        clasificacion_id: FIXED_CLASIFICACION_ID,
        descripcion_caso_id: FIXED_DESCRIPCION_CASO_ID,
        grupo_id: FIXED_GRUPO_ID,
        created_at: new Date().toISOString(),
        created_by: FIXED_CREATED_BY,
        fecha_resolucion: null,
        state_change_at: null,
        ...overrides,
    };
}

// `cases` exists in the real migrated schema (see tests/knexfile.js — every test file gets
// its own cloned postgres database); FK-constrained columns (cliente_id, transicion_id,
// responsable_id, clasificacion_id, descripcion_caso_id, grupo_id) need real parent rows,
// seeded once for the FIXED_* ids reused by every caseRow() below.
describe('CaseFindAllActiveService.execute with restrictToIds', () => {
    let knex;
    let repo;
    let service;

    beforeAll(() => {
        knex = knexConfig;
        repo = new KnexCaseRepository(knex);
        service = new CaseFindAllActiveService(repo);
    });

    // Las filas padre se crean en cada test, no una sola vez: el reset por test
    // devuelve la base al estado de la plantilla antes de cada `it`, asi que un
    // fixture creado en `beforeAll` no sobrevive al primero. Por el mismo motivo
    // ya no hace falta vaciar `cases` aqui: el reset lo hace.
    beforeEach(async () => {
        await knex('clients').insert({ id: FIXED_CLIENTE_ID });
        await knex('usuarios').insert({ id: FIXED_RESPONSABLE_ID });
        await knex('clasificaciones').insert({ id: FIXED_CLASIFICACION_ID });
        await knex('descripciones_casos').insert({ id: FIXED_DESCRIPCION_CASO_ID });
        await knex('grupos').insert({ id: FIXED_GRUPO_ID });
        await knex('transiciones').insert({ id: FIXED_TRANSICION_ID, is_visible: true });
    });

    it('returns empty array immediately when restrictToIds is empty', async () => {
        // Arrange
        await knex('cases').insert(caseRow(uuidv4()));

        // Act
        const result = await service.execute({ 'cases.fecha_resolucion': null }, { restrictToIds: [] });

        // Assert
        expect(result).toEqual([]);
    });

    it('restricts query when restrictToIds is provided', async () => {
        // Arrange
        const id1 = uuidv4();
        const id2 = uuidv4();
        const id3 = uuidv4();
        await knex('cases').insert([caseRow(id1), caseRow(id2), caseRow(id3)]);

        // Act
        const result = await service.execute({ 'cases.fecha_resolucion': null }, { restrictToIds: [id1, id3] });

        // Assert
        expect(result.map((c) => c.id.value).sort()).toEqual([id1, id3].sort());
    });

    it('behaves identically to today when restrictToIds is absent', async () => {
        // Arrange
        await knex('cases').insert([caseRow(uuidv4()), caseRow(uuidv4())]);

        // Act
        const result = await service.execute({ 'cases.fecha_resolucion': null });

        // Assert
        expect(result).toHaveLength(2);
    });
});

describe('CaseFindAllActiveService.executeOrderedIds', () => {
    it('delegates to repository.findOrderedIdsMatchingCondition', async () => {
        const repo = { findOrderedIdsMatchingCondition: jest.fn().mockResolvedValue(['a', 'b']) };
        const service = new CaseFindAllActiveService(repo);

        const result = await service.executeOrderedIds(
            { 'cases.fecha_resolucion': null },
            { restrictToIds: ['a', 'b', 'c'], limit: 2 }
        );

        expect(result).toEqual(['a', 'b']);
        expect(repo.findOrderedIdsMatchingCondition).toHaveBeenCalledWith(
            { 'cases.fecha_resolucion': null },
            { restrictToIds: ['a', 'b', 'c'], limit: 2 }
        );
    });

    it('returns [] for an empty restrictToIds without hitting the repository', async () => {
        const repo = { findOrderedIdsMatchingCondition: jest.fn() };
        const service = new CaseFindAllActiveService(repo);

        const result = await service.executeOrderedIds({ 'cases.fecha_resolucion': null }, { restrictToIds: [] });

        expect(result).toEqual([]);
        expect(repo.findOrderedIdsMatchingCondition).not.toHaveBeenCalled();
    });
});
