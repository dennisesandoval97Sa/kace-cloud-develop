import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SchemaRulesSearcher } from '../../../../src/schemas/application/rules/SchemaRulesSearcher.js';
import { Schema } from '../../../../src/schemas/domain/Schema.js';

const sid = '550e8400-e29b-41d4-a716-446655440000';
const now = new Date().toISOString();

const minimalSchemaRow = () => ({
    id: sid,
    name: 'unit-schema',
    is_active: true,
    data_structure: { fld: { type: 'string', required: false } },
    created_at: now,
    created_by: sid,
    updated_at: now,
    updated_by: sid,
    deleted_at: null,
    deleted_by: null,
});

describe('SchemaRulesSearcher', () => {
    let repo;

    beforeEach(() => {
        repo = {
            tableName: 'schemas',
            search: jest.fn(),
            count: jest.fn(),
            getSchemaRules: jest.fn(),
        };
    });

    it('devuelve items vacíos y count cuando search no devuelve filas', async () => {
        repo.search.mockResolvedValue([]);
        repo.count.mockResolvedValue({ count: '0' });

        const sut = new SchemaRulesSearcher(repo);
        const out = await sut.execute({
            filter: [],
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(repo.getSchemaRules).not.toHaveBeenCalled();
        expect(out.toJson().data.items).toEqual([]);
        expect(Number(out.toJson().metadata.count)).toBe(0);
    });

    it('llama getSchemaRules por cada fila y empaqueta el resultado', async () => {
        const row = Schema.create(minimalSchemaRow());
        const resolved = Schema.create({
            ...minimalSchemaRow(),
            name: 'resolved-name',
        });
        repo.search.mockResolvedValue([row]);
        repo.count.mockResolvedValue({ count: '1' });
        repo.getSchemaRules.mockResolvedValue(resolved);

        const sut = new SchemaRulesSearcher(repo);
        const out = await sut.execute({
            filter: [],
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(repo.getSchemaRules).toHaveBeenCalledTimes(1);
        expect(repo.getSchemaRules).toHaveBeenCalledWith({ value: sid });
        expect(out.toJson().data.items.length).toBe(1);
        expect(out.toJson().data.items[0].id).toBe(sid);
        expect(out.toJson().data.items[0].name).toBe('resolved-name');
        expect(out.toJson().data.items[0].data_structure).toEqual({ fld: { type: 'string', required: false } });
    });

    it('omite filas cuando getSchemaRules devuelve null', async () => {
        const row = Schema.create(minimalSchemaRow());
        repo.search.mockResolvedValue([row]);
        repo.count.mockResolvedValue({ count: '1' });
        repo.getSchemaRules.mockResolvedValue(undefined);

        const sut = new SchemaRulesSearcher(repo);
        const out = await sut.execute({
            filter: [],
            relationship: null,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(out.toJson().data.items).toEqual([]);
    });

    it('acepta count en formato count(*)', async () => {
        repo.search.mockResolvedValue([]);
        repo.count.mockResolvedValue({ 'count(*)': '7' });

        const sut = new SchemaRulesSearcher(repo);
        const out = await sut.execute({
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(Number(out.toJson().metadata.count)).toBe(7);
    });
});
