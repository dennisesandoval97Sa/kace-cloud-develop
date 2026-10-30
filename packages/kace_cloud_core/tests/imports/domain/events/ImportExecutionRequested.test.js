import { v4 as uuidv4 } from 'uuid';
import { ImportExecutionRequested } from '../../../../src/imports/domain/events/ImportExecutionRequested.js';

describe('ImportExecutionRequested domain event', () => {
    const FILE_ID = uuidv4();
    const TENANT_ID = uuidv4();
    const USER_ID = uuidv4();

    it('creates the event with correct EVENT_NAME constant', () => {
        expect(ImportExecutionRequested.EVENT_NAME).toBe('kace.core.import_execution.requested');
    });

    it('creates the event with the correct aggregateId, payload and getters', () => {
        const event = new ImportExecutionRequested({
            fileId: FILE_ID,
            targetTable: 'usuarios',
            actionType: 'CREATE',
            metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        });

        expect(event.aggregateId).toBe(FILE_ID);
        expect(event.fileId).toBe(FILE_ID);
        expect(event.eventName).toBe(ImportExecutionRequested.EVENT_NAME);
        expect(event.targetTable).toBe('usuarios');
        expect(event.actionType).toBe('CREATE');
        expect(event.payload.fileId).toBe(FILE_ID);
        expect(event.payload.targetTable).toBe('usuarios');
        expect(event.payload.actionType).toBe('CREATE');
        expect(event.metadata.tenant_id).toBe(TENANT_ID);
        expect(event.metadata.user_id).toBe(USER_ID);
    });

    it('defaults actionType to CREATE when omitted', () => {
        const event = new ImportExecutionRequested({
            fileId: FILE_ID,
            targetTable: 'aux_clientes',
        });

        expect(event.actionType).toBe('CREATE');
        expect(event.payload.actionType).toBe('CREATE');
    });

    it('reconstructs from primitives via fromPrimitives', () => {
        const event = ImportExecutionRequested.fromPrimitives({
            aggregateId: FILE_ID,
            payload: {
                fileId: FILE_ID,
                targetTable: 'aux_catalog',
                actionType: 'DELETE',
            },
            metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        });

        expect(event.aggregateId).toBe(FILE_ID);
        expect(event.fileId).toBe(FILE_ID);
        expect(event.targetTable).toBe('aux_catalog');
        expect(event.actionType).toBe('DELETE');
        expect(event.metadata.tenant_id).toBe(TENANT_ID);
    });

    it('serializes to JSON properly with toJson', () => {
        const event = new ImportExecutionRequested({
            fileId: FILE_ID,
            targetTable: 'usuarios',
            actionType: 'CREATE',
            metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        });

        const json = event.toJson();
        expect(json.eventName).toBe(ImportExecutionRequested.EVENT_NAME);
        expect(json.aggregateId).toBe(FILE_ID);
        expect(json.payload.targetTable).toBe('usuarios');
        expect(json.metadata.tenant_id).toBe(TENANT_ID);
    });
});
