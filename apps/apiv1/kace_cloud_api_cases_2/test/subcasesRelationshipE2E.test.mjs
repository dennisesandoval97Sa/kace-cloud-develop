import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('SubcaseRelations E2E', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases`
            : 'http://127.0.0.1:60008';

    const caseFactory = new CaseFactory(knexConfig);
    const caseRepository = new KnexCaseRepository(knexConfig);

    const createCase = async () => {
        const aggregate = await caseFactory.create();
        return aggregate.id.value;
    };

    const createRelation = async (parentId, childId) => {
        return TestHelper.postRequest(`${baseUrl}/${parentId}/sub-cases`, {
            child_case_id: childId,
        });
    };

    const deleteRelation = async (parentId, childId) => {
        return TestHelper.postRequest(`${baseUrl}/${parentId}/sub-cases/delete`, {
            child_case_id: childId,
        });
    };

    const auxRelationship = () => [
        {
            table: 'aux_cases',
            condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
            type: 'left',
        },
    ];

    const upsertAuxCaseData = async (caseId, dataObj) => {
        const row = await caseRepository.connection('aux_cases').where({ caso_id: caseId }).first();
        const data = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
        if (row) {
            await caseRepository.connection('aux_cases').where({ caso_id: caseId }).update({ data });
        } else {
            await caseRepository.connection('aux_cases').insert({
                id: uuidv4(),
                caso_id: caseId,
                data,
            });
        }
    };

    afterAll(async () => {
        try {
            await caseRepository.connection.destroy();
        } catch (e) {
            Helper.logError('subcasesRelationshipE2E afterAll connection.destroy', e);
        }
    });

    it('POST /:id/sub-cases — crea relación caso-subcaso', async () => {
        const parentId = await createCase();
        const childA = await createCase();
        const childB = await createCase();
        const r1 = await createRelation(parentId, childA);
        const r2 = await createRelation(parentId, childB);
        expect(r1.status).toBe(201);
        expect(r2.status).toBe(201);
    });

    it('POST /:id/sub-cases — 400 si child_case_id no es UUID', async () => {
        const parentId = await createCase();
        const res = await createRelation(parentId, 'not-a-uuid');
        expect(res.status).toBe(400);
    });

    it('POST /:id/sub-cases — 400 si parent === child', async () => {
        const parentId = await createCase();
        const res = await createRelation(parentId, parentId);
        expect(res.status).toBe(400);
    });

    it('POST /:id/sub-cases/search — retorna los hijos de un padre', async () => {
        const parentId = await createCase();
        const childA = await createCase();
        const childB = await createCase();
        expect((await createRelation(parentId, childA)).status).toBe(201);
        expect((await createRelation(parentId, childB)).status).toBe(201);

        const payload = {
            limit: 10,
            offset: 0,
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${parentId}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        expect(list.data?.data?.items).toBeDefined();
        expect(Array.isArray(list.data.data.items)).toBe(true);

        const ids = new Set(list.data.data.items.map((i) => i.id));
        expect(ids.has(childA)).toBe(true);
        expect(ids.has(childB)).toBe(true);
    });

    it('POST /:id/sub-cases/delete — borra relación existente', async () => {
        const parentId = await createCase();
        const childA = await createCase();
        expect((await createRelation(parentId, childA)).status).toBe(201);
        const del = await deleteRelation(parentId, childA);
        expect(del.status).toBe(200);
    });

    it('POST /:id/sub-cases/search — con relationship y select trae aux_cases_data', async () => {
        const p = await createCase();
        const c = await createCase();
        const rel = await createRelation(p, c);
        expect(rel.status).toBe(201);

        await caseRepository.connection('aux_cases').insert({
            id: uuidv4(),
            caso_id: c,
            data: JSON.stringify({ e2e_aux_marker: true }),
        });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: [
                {
                    table: 'aux_cases',
                    condition: { column: 'aux_cases.caso_id', refColumn: 'cases.id' },
                    type: 'left',
                },
            ],
            select: ['aux_cases.data as aux_cases_data'],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        expect(list.data?.data?.items).toBeDefined();
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_cases_data).toBeDefined();
        const raw = item.aux_cases_data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        expect(parsed.e2e_aux_marker).toBe(true);
    });

    it('POST /:id/sub-cases/search — relationship y select con ruta JSON anidada (PostgreSQL)', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        await upsertAuxCaseData(c, {
            profile: {
                contact: {
                    name: 'nested_contact_name',
                },
            },
        });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->'profile'->'contact'->>'name' as aux_cases_data`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_cases_data).toBe('nested_contact_name');
    });

    it('POST /:id/sub-cases/search — relationship y varios campos desde aux_cases.data (PostgreSQL)', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        await upsertAuxCaseData(c, {
            name: 'aux_first_name',
            lastname: 'aux_last_name',
        });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->>'name' as aux_cases_name`, `aux_cases.data->>'lastname' as aux_cases_lastname`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_cases_name).toBe('aux_first_name');
        expect(item.aux_cases_lastname).toBe('aux_last_name');
    });

    it('POST /:id/sub-cases/search — aux_cases.data.genre como array de strings (PostgreSQL)', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        const genreValues = ['female', 'male', 'non_binary'];
        await upsertAuxCaseData(c, { genre: genreValues });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->'genre' as aux_cases_genre`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        const raw = item.aux_cases_genre;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        expect(parsed).toEqual(genreValues);
    });

    it('POST /:id/sub-cases/search — aux_cases.data.genre como array de objetos (PostgreSQL)', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        const genreObjects = [
            { label: 'female', code: '01' },
            { label: 'male', code: '02' },
        ];
        await upsertAuxCaseData(c, { genre: genreObjects });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [
                `aux_cases.data->'genre' as aux_cases_genre`,
                `aux_cases.data->'genre'->0->>'code' as aux_cases_genre_first_code`,
            ],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        const rawGenre = item.aux_cases_genre;
        const parsedGenre = typeof rawGenre === 'string' ? JSON.parse(rawGenre) : rawGenre;
        expect(parsedGenre).toEqual(genreObjects);
        expect(item.aux_cases_genre_first_code).toBe('01');
    });

    it('POST /:id/sub-cases/search — relationship sin select no incluye aux_cases_data', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        await upsertAuxCaseData(c, { k: 'v' });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_cases_data).toBeUndefined();
    });

    it('POST /:id/sub-cases/search — wildcard select extrae campo sin importar key de primer nivel', async () => {
        const p = await createCase();
        const c1 = await createCase();
        const c2 = await createCase();
        expect((await createRelation(p, c1)).status).toBe(201);
        expect((await createRelation(p, c2)).status).toBe(201);

        await upsertAuxCaseData(c1, { persona: { nombre: 'John' } });
        await upsertAuxCaseData(c2, { nivel_caso: { nombre: 'Alto' } });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->'*'->>'nombre' as aux_nombre`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);

        const item1 = list.data.data.items.find((i) => i.id === c1);
        expect(item1).toBeDefined();
        expect(item1.aux_nombre).toBe('John');

        const item2 = list.data.data.items.find((i) => i.id === c2);
        expect(item2).toBeDefined();
        expect(item2.aux_nombre).toBe('Alto');
    });

    it('POST /:id/sub-cases/search — wildcard + indice de array extrae elemento correcto', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        await upsertAuxCaseData(c, { info: { items: [{ code: 'A1' }, { code: 'B2' }] } });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->'*'->'items'->0->>'code' as aux_code`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_code).toBe('A1');
    });

    it('POST /:id/sub-cases/search — wildcard + indice directo retorna elemento jsonb', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        await upsertAuxCaseData(c, { info: { tags: ['urgent', 'low'] } });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->'*'->'tags'->0 as aux_tag`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_tag).toBe('urgent');
    });

    it('POST /:id/sub-cases/search — wildcard con key inexistente retorna null', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        await upsertAuxCaseData(c, { persona: { nombre: 'John' } });

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            relationship: auxRelationship(),
            select: [`aux_cases.data->'*'->>'no_existe' as aux_no_existe`],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(200);
        const item = list.data.data.items.find((i) => i.id === c);
        expect(item).toBeDefined();
        expect(item.aux_no_existe).toBeNull();
    });

    it('POST /:id/sub-cases/search — 400 si select referencia tabla ajena al relationship', async () => {
        const p = await createCase();
        const c = await createCase();
        expect((await createRelation(p, c)).status).toBe(201);

        const payload = {
            filter: [],
            limit: 10,
            offset: 0,
            select: ['aux_cases.data as aux_cases_data'],
        };

        const list = await TestHelper.postRequest(`${baseUrl}/${p}/sub-cases/search`, payload);
        expect(list.status).toBe(400);
    });
});
