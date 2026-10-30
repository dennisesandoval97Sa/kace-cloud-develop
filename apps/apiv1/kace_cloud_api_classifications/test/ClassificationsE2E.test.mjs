import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexAnsRepository } from '@kace/core/src/ans';
import { KnexFlowRepository } from '@kace/core/src/flow';
import ClassificationMother from '@kace/core/tests/classifications/domain/ClassificationsMother.js';
import AnsMother from '@kace/core/tests/ans/domain/AnsMother';
import FlowsMother from '@kace/core/tests/flows/domain/FlowsMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('ClassificationController test', () => {
    const repository = new KnexClassificationRepository(knexConfig);
    const flowRepository = new KnexFlowRepository(knexConfig);
    const ansRepository = new KnexAnsRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/classifications`
            : 'http://127.0.0.1:60015';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Classification', async () => {
        const { id: flujo_id } = await FlowsMother.createFlow(flowRepository);
        const { id: ansId } = await AnsMother.createAns(ansRepository);
        const payload = ClassificationMother.dto({
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
            default_group_id: '',
        });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Classification', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Classification', async () => {
        const { id: flujo_id } = await FlowsMother.createFlow(flowRepository);
        const { id: ansId } = await AnsMother.createAns(ansRepository);
        const classification = await ClassificationMother.createClassification(repository, {
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
        });
        const dataExpected = {
            id: classification.id.value,
            nivel1: classification.nivel1.value,
            nivel2: classification.nivel2.value,
            nivel3: classification.nivel3.value,
            nivel4: classification.nivel4.value,
            nivel5: classification.nivel5.value,
            nivel6: classification.nivel6.value,
            nivel7: classification.nivel7.value,
            nivel8: classification.nivel8.value,
            nivel9: classification.nivel9.value,
            nivel10: classification.nivel10.value,
            flujo_id: classification.flujo_id.value,
            description:
                'Level 1 -> Level 2 -> Level 3 -> Level 4 -> Level 5 -> Level 6 -> Level 7 -> Level 8 -> Level 9 -> Level 10',
            ans_id: classification.ans_id.value,
            is_active: classification.is_active.value,
            created_at: classification.created_at.value,
            updated_at: null,
            created_by: classification.created_by.value,
            updated_by: null,
            default_group_id: classification.default_group_id.value,
            external_id: classification.external_id.value,
            can_start_sub_cases_flow: true,
        };
        const response = await TestHelper.getRequest(`${baseUrl}/${classification.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Classifications', async () => {
        const { id: flujo_id } = await FlowsMother.createFlow(flowRepository);
        const { id: ansId } = await AnsMother.createAns(ansRepository);
        const classification1 = await ClassificationMother.createClassification(repository, {
            id: uuidv4(),
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
        });
        const classification2 = await ClassificationMother.createClassification(repository, {
            id: uuidv4(),
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
        });

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(classification2.id.value);
        expect(response.data.data.items[1].id).toEqual(classification1.id.value);
    });

    it('should delete a Classification', async () => {
        const { id: flujo_id } = await FlowsMother.createFlow(flowRepository);
        const { id: ansId } = await AnsMother.createAns(ansRepository);
        const classification = await ClassificationMother.createClassification(repository, {
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
        });

        const response = await TestHelper.getRequest(`${baseUrl}/${classification.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Classification', async () => {
        const { id: flujo_id } = await FlowsMother.createFlow(flowRepository);
        const { id: ansId } = await AnsMother.createAns(ansRepository);
        const classification = await ClassificationMother.createClassification(repository, {
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
        });
        const payload = {
            nivel1: 'updated level',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${classification.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });

    it('actionHistory: debe devolver error con id inválido', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/invalid-id/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });
    it('actionHistory: debe devolver objeto vacío para uuid aleatorio', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const randomId = uuidv4();
        const response = await TestHelper.postRequest(`${baseUrl}/${randomId}/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(typeof response.data.data).toBe('object');
    });

    it.only('should fetch Classifications with {value,label} from /list', async () => {
        const { id: flujo_id } = await FlowsMother.createFlow(flowRepository);
        const { id: ansId } = await AnsMother.createAns(ansRepository);

        const c1 = await ClassificationMother.createClassification(repository, {
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
            nivel2: 'A',
        });
        const c2 = await ClassificationMother.createClassification(repository, {
            flujo_id: flujo_id.value,
            ans_id: ansId.value,
            nivel2: 'B',
        });

        const { status, data } = await TestHelper.getRequest(`${baseUrl}/list`);
        expect(status).toBe(200);

        const items = data.data.items;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThanOrEqual(2);

        const SEP = '>';
        const labelOf = (cls) => {
            const vals = [
                cls.nivel1?.value,
                cls.nivel2?.value,
                cls.nivel3?.value,
                cls.nivel4?.value,
                cls.nivel5?.value,
                cls.nivel6?.value,
                cls.nivel7?.value,
                cls.nivel8?.value,
                cls.nivel9?.value,
                cls.nivel10?.value,
            ];
            const partes = [];
            for (const v of vals) {
                const s = typeof v === 'string' ? v.trim() : '';
                if (!s) break;
                partes.push(s);
            }
            return partes.join(SEP);
        };

        expect(items[0].value).toBe(c2.id.value);
        expect(items[1].value).toBe(c1.id.value);

        const allowed = ['value', 'label'];
        const checkItem = (it) => {
            expect(Object.keys(it).every((k) => allowed.includes(k))).toBe(true);
            expect(typeof it.value).toBe('string');
            expect(typeof it.label).toBe('string');
        };

        checkItem(items[0]);
        checkItem(items[1]);

        expect(items[0].label).toBe(labelOf(c2));
        expect(items[1].label).toBe(labelOf(c1));
    });
});
