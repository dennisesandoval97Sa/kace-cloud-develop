import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexAuxiliariesRepository } from '../../src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { checkUniqueFields } from '../../src/shared/domain/services/checkUniqueFields.js';

const TABLE = 'aux_proveedores';

const insertRecord = async (repo, id, data) => {
    await repo.connection(TABLE).insert({
        id,
        data: JSON.stringify(data),
        created_at: new Date().toISOString(),
        created_by: 'test-user',
        updated_at: new Date().toISOString(),
        updated_by: 'test-user',
        deleted_at: null,
        deleted_by: null,
    });
};

describe('checkUniqueFields - Integration', () => {
    const repo = new KnexAuxiliariesRepository(knexConfig);

    beforeEach(async () => {
        const hasTable = await repo.connection.schema.hasTable(TABLE);
        if (!hasTable) {
            await repo.connection.schema.createTable(TABLE, (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });
        }

        await repo.connection(TABLE).delete();
    });

    afterEach(async () => {
        await repo.connection(TABLE).delete();
    });

    it('returns no violations when the table is empty', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
            nombre: { type: 'string' },
        };

        const violations = await checkUniqueFields(
            dataStructure,
            { cedula: '12345', nombre: 'Juan' },
            repo,
            TABLE,
            null
        );

        expect(violations).toHaveLength(0);
    });

    it('returns no violations when unique value does not exist in DB', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
        };

        await insertRecord(repo, uuidv4(), { cedula: '99999' });

        const violations = await checkUniqueFields(dataStructure, { cedula: '12345' }, repo, TABLE, null);

        expect(violations).toHaveLength(0);
    });

    it('returns a violation when a unique field value already exists (create)', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
            nombre: { type: 'string' },
        };

        await insertRecord(repo, uuidv4(), { cedula: '12345', nombre: 'Existente' });

        const violations = await checkUniqueFields(
            dataStructure,
            { cedula: '12345', nombre: 'Nuevo' },
            repo,
            TABLE,
            null
        );

        expect(violations).toHaveLength(1);
        expect(violations[0].path).toBe('cedula');
        expect(violations[0].value).toBe('12345');
    });

    it('returns a violation when updating a record with a unique value that belongs to another record', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
        };

        const idA = uuidv4();
        const idB = uuidv4();
        await insertRecord(repo, idA, { cedula: '1111' });
        await insertRecord(repo, idB, { cedula: '2222' });

        const violations = await checkUniqueFields(dataStructure, { cedula: '1111' }, repo, TABLE, { id: idB });

        expect(violations).toHaveLength(1);
        expect(violations[0].path).toBe('cedula');
        expect(violations[0].value).toBe('1111');
    });

    it('returns no violations when updating a record with its own unique value (self-update)', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
        };

        const id = uuidv4();
        await insertRecord(repo, id, { cedula: '5555' });

        const violations = await checkUniqueFields(dataStructure, { cedula: '5555' }, repo, TABLE, { id });

        expect(violations).toHaveLength(0);
    });

    it('returns multiple violations when several unique fields are duplicated', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
            email: { type: 'string', unique: true },
            nombre: { type: 'string' },
        };

        await insertRecord(repo, uuidv4(), { cedula: '1111', email: 'a@b.com', nombre: 'Existente' });

        const violations = await checkUniqueFields(
            dataStructure,
            { cedula: '1111', email: 'a@b.com', nombre: 'Nuevo' },
            repo,
            TABLE,
            null
        );

        expect(violations).toHaveLength(2);
        expect(violations.map((v) => v.path)).toEqual(expect.arrayContaining(['cedula', 'email']));
    });

    it('skips null and undefined unique field values without querying', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
        };

        await insertRecord(repo, uuidv4(), { cedula: null });

        const violationsNull = await checkUniqueFields(dataStructure, { cedula: null }, repo, TABLE, null);
        const violationsUndefined = await checkUniqueFields(dataStructure, {}, repo, TABLE, null);

        expect(violationsNull).toHaveLength(0);
        expect(violationsUndefined).toHaveLength(0);
    });

    it('skips non-unique fields entirely', async () => {
        const dataStructure = {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
        };

        await insertRecord(repo, uuidv4(), { nombre: 'Repetido', descripcion: 'Texto' });

        const violations = await checkUniqueFields(
            dataStructure,
            { nombre: 'Repetido', descripcion: 'Texto' },
            repo,
            TABLE,
            null
        );

        expect(violations).toHaveLength(0);
    });

    it('checks nested unique fields using dot-notation path', async () => {
        const dataStructure = {
            contacto: {
                type: 'object',
                data_structure: {
                    email: { type: 'string', unique: true },
                },
            },
        };

        await insertRecord(repo, uuidv4(), { contacto: { email: 'duplicado@mail.com' } });

        const violations = await checkUniqueFields(
            dataStructure,
            { contacto: { email: 'duplicado@mail.com' } },
            repo,
            TABLE,
            null
        );

        expect(violations).toHaveLength(1);
        expect(violations[0].path).toBe('contacto.email');
        expect(violations[0].value).toBe('duplicado@mail.com');
    });

    it('returns no violations for nested unique field when value is not duplicated', async () => {
        const dataStructure = {
            contacto: {
                type: 'object',
                data_structure: {
                    email: { type: 'string', unique: true },
                },
            },
        };

        await insertRecord(repo, uuidv4(), { contacto: { email: 'otro@mail.com' } });

        const violations = await checkUniqueFields(
            dataStructure,
            { contacto: { email: 'nuevo@mail.com' } },
            repo,
            TABLE,
            null
        );

        expect(violations).toHaveLength(0);
    });

    it('ignores soft-deleted records when checking uniqueness', async () => {
        const dataStructure = {
            cedula: { type: 'string', unique: true },
        };

        await repo.connection(TABLE).insert({
            id: uuidv4(),
            data: JSON.stringify({ cedula: '7777' }),
            created_at: new Date().toISOString(),
            created_by: 'test-user',
            updated_at: new Date().toISOString(),
            updated_by: 'test-user',
            deleted_at: new Date().toISOString(),
            deleted_by: 'test-user',
        });

        const violations = await checkUniqueFields(dataStructure, { cedula: '7777' }, repo, TABLE, null);

        expect(violations).toHaveLength(0);
    });
});
