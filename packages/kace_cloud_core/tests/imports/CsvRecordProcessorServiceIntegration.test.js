import { knexConfig } from '../knexfile.js';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import { CsvRecordProcessorService } from '../../src/imports/domain/services/CsvRecordProcessorService.js';
import { UserCreator } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { S3FileImport } from '../../src/imports/application/import/S3FileImport.js';
import { KnexAuxiliariesRepository } from '../../src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { buildAuxJsonFromCsv } from '../../src/shared/domain/utilities/processAuxiliaryData.js';
import { v4 as uuidv4 } from 'uuid';
import { ensureParentRows } from '../support/ensureParentRow.js';

describe('CsvRecordProcessorService (usuarios) - integración', () => {
    const repository = new KnexS3ImportFiles(knexConfig);
    const service = new S3FileImport(repository);
    const usersRepo = new KnexUsersRepository(knexConfig);
    const auxiliariesRepo = new KnexAuxiliariesRepository(knexConfig);

    beforeEach(async () => {
        const hasAuxTable = await auxiliariesRepo.connection.schema.hasTable('aux_proveedores');
        if (!hasAuxTable) {
            await auxiliariesRepo.connection.schema.dropTableIfExists('aux_proveedores');
            await auxiliariesRepo.connection.schema.createTable('aux_proveedores', (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });

            await auxiliariesRepo.connection.schema.dropTableIfExists('history_aux_proveedores');
            await auxiliariesRepo.connection.schema.createTable('history_aux_proveedores', (table) => {
                table.string('id', 36).primary();
                table.string('entity_id', 36);
                table.jsonb('changed_attributes');
                table.jsonb('new_attributes');
                table.jsonb('original_attributes');
                table.timestamp('created_at');
                table.string('created_by', 36);
            });
        }

        await auxiliariesRepo.connection('aux_proveedores').delete();
        await auxiliariesRepo.connection('history_aux_proveedores').delete();
    });

    afterEach(async () => {
        await auxiliariesRepo.connection('aux_proveedores').delete();
        await auxiliariesRepo.connection('history_aux_proveedores').delete();
    });

    it('actualiza usuario, crea relaciones de grupos y marca import como completed', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);
        const userResult = await usersRepo.connection('usuarios').select('*').where('id', userDto.id);
        expect(userResult.length).toBe(1);

        const validDto = {
            id: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
            file_path: 'folder/test.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 10,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'usuarios',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        expect(!!raw).toBe(true);
        expect(raw.target_table).toBe('usuarios');

        const fileRecord = new S3ImportFile({ ...raw });

        const records = [
            {
                id: userDto.id,
                nombres: 'Después',
                apellido1: 'NuevoApellido',
                telefono: ' 3000000000',
                grupos: 'g1,g2,g1',
            },
        ];

        // Los grupos del CSV se escriben tal cual en `rel_usuarios_grupos`, que
        // referencia a `grupos`: son codigos inventados en este `it`.
        await ensureParentRows(usersRepo.connection, [
            { table: 'grupos', id: 'g1' },
            { table: 'grupos', id: 'g2' },
        ]);

        await CsvRecordProcessorService.execute(records, fileRecord, repository, (v) => v, usersRepo, auxiliariesRepo);

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');
        expect(importRow.processed_records).toBe(1);
        expect(importRow.total_records).toBe(1);

        const user = await usersRepo.connection('usuarios').where({ id: userDto.id }).first();
        expect(user.nombres).toBe('Después');
        expect(user.apellido1).toBe('NuevoApellido');
        expect(user.telefono).toBe('3000000000');
        expect(user.updated_by).toBe(userDto.id);
        expect(user.updated_at).toBeTruthy();

        const rels = await repository
            .connection('rel_usuarios_grupos')
            .where({ usuario_id: userDto.id })
            .orderBy('grupo_id', 'asc');
        expect(rels).toHaveLength(2);
        expect(rels.map((r) => r.grupo_id)).toEqual(['g1', 'g2']);
    });

    it('normaliza external_id/telefono/movil/codigos_externos con toOptionalString cuando están presentes', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/test-optional-string.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'usuarios',
        };
        await service.execute(validDto);
        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        const records = [
            {
                id: userDto.id,
                nombres: 'Actualizado',
                // external_id present but `undefined`: toOptionalString(undefined) === undefined,
                // so the field is left untouched (userUpdater treats it as "no change").
                external_id: undefined,
                // telefono trims to an empty string -> toOptionalString returns null.
                telefono: '   ',
                // movil is NaN (not the string "NaN" — a real JS NaN number), which
                // toOptionalString maps to `undefined` via the `typeof v === 'number'` branch.
                movil: NaN,
                codigos_externos: 'codeA',
            },
        ];

        await CsvRecordProcessorService.execute(records, fileRecord, repository, (v) => v, usersRepo, auxiliariesRepo);

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');

        const user = await usersRepo.connection('usuarios').where({ id: userDto.id }).first();
        expect(user.nombres).toBe('Actualizado');
        expect(user.telefono).toBeNull();
        // movil resolved to `undefined` (the NaN branch), which the updater treats as "no
        // change" — it stays at UsersMother's original value, not null.
        expect(user.movil).toBe('0987654321');
    });

    it('reemplaza las relaciones de grupo por una lista vacía cuando grupos es explícitamente null', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        await ensureParentRows(usersRepo.connection, [{ table: 'grupos', id: 'g-null-test' }]);
        await usersRepo.connection('rel_usuarios_grupos').insert({ usuario_id: userDto.id, grupo_id: 'g-null-test' });

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/test-null-groups.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'usuarios',
        };
        await service.execute(validDto);
        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        const records = [{ id: userDto.id, nombres: 'Sin Grupos', grupos: null }];

        await CsvRecordProcessorService.execute(records, fileRecord, repository, (v) => v, usersRepo, auxiliariesRepo);

        const rels = await usersRepo.connection('rel_usuarios_grupos').where({ usuario_id: userDto.id });
        expect(rels).toHaveLength(0);
    });

    // BUG (documented, not fixed — task forbids touching src/): the final "completed" branch
    // compares `totalRecordsInserted` (records handled in THIS call, i.e. only the resumed
    // slice after `processed_records`) against `records.length` (the FULL original list length),
    // not against `recordsToProcess.length`. When resuming with an offset and the remaining
    // slice finishes with zero errors, totalRecordsInserted < records.length, so none of the
    // three status branches (`rejected`/`incompleted`/`completed`) match: the function returns
    // `undefined` and — since the initial `updateImport` call never touches `status` either —
    // the import row is silently left in its previous status forever (not "completed").
    it('BUG: un lote reanudado que termina sin errores no marca el import como completed', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/test-offset-completed-bug.csv',
            status: 'processing',
            upload_attempts: 0,
            total_records: 2,
            processed_records: 1,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'usuarios',
        };
        await service.execute(validDto);
        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        // Two rows in the CSV; processed_records=1 means only the second (index 1) is replayed,
        // and it succeeds.
        const records = [
            { id: userDto.id, nombres: 'Fila ya procesada' },
            { id: userDto.id, nombres: 'Fila reanudada, sin errores' },
        ];

        const result = await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo
        );

        expect(result).toBeUndefined();
        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('processing');
        expect(importRow.processed_records).toBe(1);
    });

    it('inserta registros en tabla auxiliar y marca import como completed', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const validDto = {
            id: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
            file_path: 'folder/aux_proveedores.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 2,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        expect(!!raw).toBe(true);
        expect(raw.target_table).toBe('aux_proveedores');

        const fileRecord = new S3ImportFile({ ...raw });

        const csvPlano = [
            {
                id: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
                nombre: 'pepito',
                cedula: '5555',
                'contactos::nombre': 'juan',
                'contactos::telefono': '123',
                'contactos::direccion': 'calle 123',
            },
            {
                id: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
                nombre: 'pepito',
                cedula: '5555',
                'contactos::nombre': 'pablo',
                'contactos::telefono': '456',
                'contactos::direccion': 'calle 456',
            },
            {
                id: 'a57ed068-e85a-42ac-b4bd-a6dd46283074',
                nombre: 'pablito',
                cedula: '7777',
            },
        ];

        const records = buildAuxJsonFromCsv(csvPlano);

        expect(records).toHaveLength(2);
        expect(records[0].id).toBe('a57ed068-e85a-42ac-b4bd-a6dd46283073');
        expect(records[0].contactos).toHaveLength(2);
        expect(records[1].id).toBe('a57ed068-e85a-42ac-b4bd-a6dd46283074');
        expect(records[1].contactos).toBeUndefined();

        await CsvRecordProcessorService.execute(records, fileRecord, repository, (v) => v, usersRepo, auxiliariesRepo);

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();

        expect(importRow.status).toBe('completed');
        expect(importRow.processed_records).toBe(2);
        expect(importRow.total_records).toBe(2);

        const auxRows = await auxiliariesRepo.connection('aux_proveedores').orderBy('id', 'asc');

        expect(auxRows).toHaveLength(2);

        const first = auxRows[0];
        expect(first.data.nombre).toBe('pepito');
        expect(first.data.cedula).toBe('5555');
        expect(Array.isArray(first.data.contactos)).toBe(true);
        expect(first.data.contactos).toHaveLength(2);
        expect(first.data.contactos[0]).toMatchObject({
            nombre: 'juan',
            telefono: '123',
            direccion: 'calle 123',
        });
        expect(first.data.contactos[1]).toMatchObject({
            nombre: 'pablo',
            telefono: '456',
            direccion: 'calle 456',
        });

        const second = auxRows[1];
        expect(second.data.nombre).toBe('pablito');
        expect(second.data.cedula).toBe('7777');

        const historyRows = await auxiliariesRepo.connection('history_aux_proveedores').select('*');

        expect(historyRows.length).toBe(2);
        expect(new Set(historyRows.map((h) => h.entity_id))).toEqual(new Set([first.id, second.id]));
    });

    it('elimina usuario y marca import como completed', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/test_delete.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'usuarios',
            action_type: 'DELETE',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        expect(!!raw).toBe(true);

        const fileRecord = new S3ImportFile({ ...raw });

        const records = [
            {
                id: userDto.id,
            },
        ];

        await CsvRecordProcessorService.execute(records, fileRecord, repository, (v) => v, usersRepo, auxiliariesRepo);

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');

        expect(importRow.processed_records).toBe(1);
        expect(importRow.total_records).toBe(1);

        const deletedUser = await usersRepo.connection('usuarios').where({ id: userDto.id }).first();
        expect(deletedUser.deleted_at).toBeTruthy();
        expect(deletedUser.deleted_by).toBe(userDto.id);
    });

    it('reimportar la baja de un usuario ya eliminado marca el import como completed y conserva la baja original', async () => {
        const userDto = UsersMother.dto();
        await new UserCreator(usersRepo).execute(userDto);
        const originalDeletion = { deleted_at: new Date('2030-01-01T00:00:00.000Z'), deleted_by: uuidv4() };
        await usersRepo.connection('usuarios').where({ id: userDto.id }).update(originalDeletion);

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/test_delete_again.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'usuarios',
            action_type: 'DELETE',
        };
        await service.execute(validDto);
        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        await CsvRecordProcessorService.execute(
            [{ id: userDto.id }],
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');
        expect(importRow.processed_records).toBe(1);
        expect(importRow.error_details).toBeNull();

        const user = await usersRepo.connection('usuarios').where({ id: userDto.id }).first();
        expect(new Date(user.deleted_at).toISOString()).toBe('2030-01-01T00:00:00.000Z');
        expect(user.deleted_by).toBe(originalDeletion.deleted_by);
    });

    it('elimina registros en tabla auxiliar y marca import como completed', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_delete.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
            action_type: 'DELETE',
        };

        const auxId = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert({
            id: auxId,
            data: JSON.stringify({ nombre: 'pepito' }),
            created_at: new Date().toISOString(),
            created_by: userDto.id,
            updated_at: new Date().toISOString(),
            updated_by: userDto.id,
            deleted_at: null,
            deleted_by: null,
        });

        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        expect(!!raw).toBe(true);

        const fileRecord = new S3ImportFile({ ...raw });

        const records = [
            {
                id: auxId,
            },
        ];

        await CsvRecordProcessorService.execute(records, fileRecord, repository, (v) => v, usersRepo, auxiliariesRepo);

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');

        expect(importRow.processed_records).toBe(1);
        expect(importRow.total_records).toBe(1);

        const deletedAux = await auxiliariesRepo.connection('aux_proveedores').where({ id: auxId }).first();
        expect(deletedAux.deleted_at).toBeTruthy();
        expect(deletedAux.deleted_by).toBe(userDto.id);
    });

    it('rechaza fila con campo único duplicado y marca import como incompleted', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const dataStructure = {
            cedula: { type: 'string', required: false, unique: true },
            nombre: { type: 'string', required: false },
        };

        const existingId = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert({
            id: existingId,
            data: JSON.stringify({ cedula: '9999', nombre: 'existente' }),
            created_at: new Date().toISOString(),
            created_by: userDto.id,
            updated_at: new Date().toISOString(),
            updated_by: userDto.id,
            deleted_at: null,
            deleted_by: null,
        });

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_unique.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 2,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        const records = [
            { id: uuidv4(), cedula: '1111', nombre: 'nuevo sin conflicto' },
            { id: uuidv4(), cedula: '9999', nombre: 'duplicado' },
        ];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            dataStructure
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('incompleted');
        expect(importRow.processed_records).toBe(1);
        expect(importRow.error_details).toMatch(/9999|cedula|unique|duplica/i);
    });

    it('rechaza actualización de campo único con valor ya existente en otro registro', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const dataStructure = {
            cedula: { type: 'string', required: false, unique: true },
            nombre: { type: 'string', required: false },
        };

        const idA = uuidv4();
        const idB = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert([
            {
                id: idA,
                data: JSON.stringify({ cedula: '1111', nombre: 'primero' }),
                created_at: new Date().toISOString(),
                created_by: userDto.id,
                updated_at: new Date().toISOString(),
                updated_by: userDto.id,
                deleted_at: null,
                deleted_by: null,
            },
            {
                id: idB,
                data: JSON.stringify({ cedula: '2222', nombre: 'segundo' }),
                created_at: new Date().toISOString(),
                created_by: userDto.id,
                updated_at: new Date().toISOString(),
                updated_by: userDto.id,
                deleted_at: null,
                deleted_by: null,
            },
        ]);

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_update_unique.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        // Intentar actualizar idB con la cédula de idA
        const records = [{ id: idB, cedula: '1111', nombre: 'segundo actualizado' }];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            dataStructure
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('incompleted');
        expect(importRow.processed_records).toBe(0);
        expect(importRow.error_details).toMatch(/1111|cedula|unique|duplica/i);

        // El registro original no debe haberse modificado
        const unchanged = await auxiliariesRepo.connection('aux_proveedores').where({ id: idB }).first();
        expect(unchanged.data.cedula).toBe('2222');
    });

    it('actualiza auxiliar reemplazando arrays cuando shouldOverrideArray es true', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const existingId = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert({
            id: existingId,
            data: JSON.stringify({ nombre: 'pepito', contactos: [{ nombre: 'juan', telefono: '123' }] }),
            created_at: new Date().toISOString(),
            created_by: userDto.id,
            updated_at: new Date().toISOString(),
            updated_by: userDto.id,
            deleted_at: null,
            deleted_by: null,
        });

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_override.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
            should_override_array: true,
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        const records = [{ id: existingId, nombre: 'pepito', contactos: [{ nombre: 'pablo', telefono: '456' }] }];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            null,
            true
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');

        const auxRow = await auxiliariesRepo.connection('aux_proveedores').where({ id: existingId }).first();
        expect(Array.isArray(auxRow.data.contactos)).toBe(true);
        expect(auxRow.data.contactos).toHaveLength(1);
        expect(auxRow.data.contactos[0]).toMatchObject({ nombre: 'pablo', telefono: '456' });
    });

    it('actualiza auxiliar fusionando arrays cuando shouldOverrideArray es false (default)', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const existingId = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert({
            id: existingId,
            data: JSON.stringify({ nombre: 'pepito', contactos: [{ nombre: 'juan', telefono: '123' }] }),
            created_at: new Date().toISOString(),
            created_by: userDto.id,
            updated_at: new Date().toISOString(),
            updated_by: userDto.id,
            deleted_at: null,
            deleted_by: null,
        });

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_merge.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 1,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
            should_override_array: false,
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        const records = [{ id: existingId, nombre: 'pepito', contactos: [{ nombre: 'pablo', telefono: '456' }] }];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            null,
            false
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');

        const auxRow = await auxiliariesRepo.connection('aux_proveedores').where({ id: existingId }).first();
        expect(Array.isArray(auxRow.data.contactos)).toBe(true);
        expect(auxRow.data.contactos).toHaveLength(2);
        expect(auxRow.data.contactos).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ nombre: 'juan', telefono: '123' }),
                expect.objectContaining({ nombre: 'pablo', telefono: '456' }),
            ])
        );
    });

    it('incluye número de fila en error_details cuando falla la inserción de un registro', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const dataStructure = {
            cedula: { type: 'string', required: false, unique: true },
            nombre: { type: 'string', required: false },
        };

        const existingId = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert({
            id: existingId,
            data: JSON.stringify({ cedula: '8888', nombre: 'existente' }),
            created_at: new Date().toISOString(),
            created_by: userDto.id,
            updated_at: new Date().toISOString(),
            updated_by: userDto.id,
            deleted_at: null,
            deleted_by: null,
        });

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_rownumber.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 3,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        // Fila 2 (index 0): OK
        // Fila 3 (index 1): OK
        // Fila 4 (index 2): falla por cédula duplicada con existingId
        const records = [
            { id: uuidv4(), cedula: '1111', nombre: 'primero' },
            { id: uuidv4(), cedula: '2222', nombre: 'segundo' },
            { id: uuidv4(), cedula: '8888', nombre: 'duplicado' },
        ];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            dataStructure
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('incompleted');
        expect(importRow.processed_records).toBe(2);
        expect(importRow.error_details).toMatch(/fila 4/i);
    });

    it('incluye número de fila correcto cuando processed_records tiene offset', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const dataStructure = {
            cedula: { type: 'string', required: false, unique: true },
            nombre: { type: 'string', required: false },
        };

        const existingId = uuidv4();
        await auxiliariesRepo.connection('aux_proveedores').insert({
            id: existingId,
            data: JSON.stringify({ cedula: '7777', nombre: 'existente' }),
            created_at: new Date().toISOString(),
            created_by: userDto.id,
            updated_at: new Date().toISOString(),
            updated_by: userDto.id,
            deleted_at: null,
            deleted_by: null,
        });

        // processed_records = 2 simula reanudación: ya se procesaron filas 2 y 3
        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_offset.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 3,
            processed_records: 2,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        // Solo se procesa el índice 2 (fila 4 real). Falla por cédula duplicada.
        const records = [
            { id: uuidv4(), cedula: '1111', nombre: 'ya procesado' },
            { id: uuidv4(), cedula: '2222', nombre: 'ya procesado' },
            { id: uuidv4(), cedula: '7777', nombre: 'duplicado en fila 4' },
        ];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            dataStructure
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('incompleted');
        expect(importRow.error_details).toMatch(/fila 4/i);
    });

    it('permite crear registros con valores únicos distintos usando dataStructure', async () => {
        const userDto = UsersMother.dto();
        const userCreator = new UserCreator(usersRepo);
        await userCreator.execute(userDto);

        const dataStructure = {
            cedula: { type: 'string', required: false, unique: true },
            nombre: { type: 'string', required: false },
        };

        const validDto = {
            id: uuidv4(),
            file_path: 'folder/aux_proveedores_unique_ok.csv',
            status: 'pending',
            upload_attempts: 0,
            total_records: 2,
            processed_records: 0,
            last_updated_at: new Date(),
            created_at: new Date(),
            created_by: userDto.id,
            error_details: null,
            target_table: 'aux_proveedores',
        };
        await service.execute(validDto);

        const raw = await repository.connection('s3_import_files').where({ id: validDto.id }).first();
        const fileRecord = new S3ImportFile({ ...raw });

        const records = [
            { id: uuidv4(), cedula: '1111', nombre: 'primero' },
            { id: uuidv4(), cedula: '2222', nombre: 'segundo' },
        ];

        await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            repository,
            (v) => v,
            usersRepo,
            auxiliariesRepo,
            dataStructure
        );

        const importRow = await repository.connection('s3_import_files').where({ id: fileRecord.id.value }).first();
        expect(importRow.status).toBe('completed');
        expect(importRow.processed_records).toBe(2);
    });
});
