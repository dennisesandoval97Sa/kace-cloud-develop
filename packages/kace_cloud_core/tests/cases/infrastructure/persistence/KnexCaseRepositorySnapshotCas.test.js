/**
 * Integration tests for the snapshot CAS helpers of KnexCaseRepository.
 *
 * These run against the real PostgreSQL database of the file: the methods under test build their
 * queries through `KnexRepository.table()`, which qualifies the table with the configured schema,
 * and their whole point is to reproduce PostgreSQL's `IS NOT DISTINCT FROM` semantics for null
 * snapshots. Neither behaviour can be exercised on an in-memory engine.
 *
 * `responsable_id` and `transicion_id` are real foreign keys, so every id written to them is backed
 * by a parent row first.
 */
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../../../src/shared/errors/CustomError.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';
import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { knexConfig } from '../../../knexfile.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { ensureParentRow } from '../../../support/ensureParentRow.js';

describe('KnexCaseRepository snapshot CAS and reads', () => {
    const repository = new KnexCaseRepository(knexConfig);

    /** Backs a `usuarios` row so the id can be written to `cases.responsable_id`. */
    const ensureUser = async (id = uuidv4()) => {
        await ensureParentRow(repository.connection, 'usuarios', id);
        return id;
    };

    const ensureClient = async (id = uuidv4()) => {
        await ensureParentRow(repository.connection, 'clients', id);
        return id;
    };

    /** Backs a `transiciones` row so the id can be written to `cases.transicion_id`. */
    const ensureTransition = async (id = uuidv4()) => {
        await ensureParentRow(repository.connection, 'transiciones', id);
        return id;
    };

    const readCase = (id) => repository.connection('cases').where({ id }).first();

    describe('getStaleSnapshotFields', () => {
        it('returns five fields from a single row', async () => {
            const kase = await CasesMother.createCase(repository, {});

            await expect(repository.getStaleSnapshotFields(kase.id.value)).resolves.toEqual({
                transicionId: kase.transicion_id.value,
                responsableId: kase.responsable_id.value,
                clienteId: kase.cliente_id.value,
                clasificacionId: kase.clasificacion_id.value,
                grupoId: kase.grupo_id.value,
            });
        });

        it('returns undefined when the case does not exist', async () => {
            await expect(repository.getStaleSnapshotFields(uuidv4())).resolves.toBeUndefined();
        });

        it('normalizes missing columns to null', async () => {
            const kase = await CasesMother.createCase(repository, {});
            await repository.connection('cases').where({ id: kase.id.value }).update({
                responsable_id: null,
                transicion_id: null,
                cliente_id: null,
                clasificacion_id: null,
                grupo_id: null,
            });

            await expect(repository.getStaleSnapshotFields(kase.id.value)).resolves.toEqual({
                transicionId: null,
                responsableId: null,
                clienteId: null,
                clasificacionId: null,
                grupoId: null,
            });
        });
    });

    describe('updateColumnIfSnapshotMatches — responsable_id', () => {
        it('updates responsable_id when the snapshot still matches', async () => {
            const snapshot = await ensureUser();
            const nextResponsable = await ensureUser();
            const kase = await CasesMother.createCase(repository, { responsable_id: snapshot });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'responsable_id',
                kase.id.value,
                snapshot,
                nextResponsable
            );

            expect(wrote).toBe(true);
            expect((await readCase(kase.id.value)).responsable_id).toBe(nextResponsable);
        });

        it('does not overwrite when the snapshot no longer matches', async () => {
            const staleSnapshot = await ensureUser();
            const currentResponsable = await ensureUser();
            const kase = await CasesMother.createCase(repository, { responsable_id: currentResponsable });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'responsable_id',
                kase.id.value,
                staleSnapshot,
                staleSnapshot
            );

            expect(wrote).toBe(false);
            expect((await readCase(kase.id.value)).responsable_id).toBe(currentResponsable);
        });

        it('matches a null snapshot with a null column', async () => {
            const nextResponsable = await ensureUser();
            const kase = await CasesMother.createCase(repository, {});
            await repository.connection('cases').where({ id: kase.id.value }).update({ responsable_id: null });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'responsable_id',
                kase.id.value,
                null,
                nextResponsable
            );

            expect(wrote).toBe(true);
            expect((await readCase(kase.id.value)).responsable_id).toBe(nextResponsable);
        });

        it('does not update a soft-deleted row', async () => {
            const snapshot = await ensureUser();
            const nextResponsable = await ensureUser();
            const kase = await CasesMother.createCase(repository, { responsable_id: snapshot });
            await repository.connection('cases').where({ id: kase.id.value }).update({ deleted_at: new Date() });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'responsable_id',
                kase.id.value,
                snapshot,
                nextResponsable
            );

            expect(wrote).toBe(false);
            expect((await readCase(kase.id.value)).responsable_id).toBe(snapshot);
        });
    });

    describe('updateColumnIfSnapshotMatches — transicion_id', () => {
        it('updates transicion_id when the snapshot still matches', async () => {
            const snapshot = await ensureTransition();
            const nextTransition = await ensureTransition();
            const kase = await CasesMother.createCase(repository, { transicion_id: snapshot });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'transicion_id',
                kase.id.value,
                snapshot,
                nextTransition
            );

            expect(wrote).toBe(true);
            expect((await readCase(kase.id.value)).transicion_id).toBe(nextTransition);
        });

        it('does not overwrite when the snapshot no longer matches', async () => {
            const staleSnapshot = await ensureTransition();
            const currentTransition = await ensureTransition();
            const kase = await CasesMother.createCase(repository, { transicion_id: currentTransition });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'transicion_id',
                kase.id.value,
                staleSnapshot,
                staleSnapshot
            );

            expect(wrote).toBe(false);
            expect((await readCase(kase.id.value)).transicion_id).toBe(currentTransition);
        });

        it('matches a null snapshot with a null column', async () => {
            const nextTransition = await ensureTransition();
            const kase = await CasesMother.createCase(repository, {});
            await repository.connection('cases').where({ id: kase.id.value }).update({ transicion_id: null });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'transicion_id',
                kase.id.value,
                null,
                nextTransition
            );

            expect(wrote).toBe(true);
            expect((await readCase(kase.id.value)).transicion_id).toBe(nextTransition);
        });
    });

    describe('updateColumnIfSnapshotMatches', () => {
        it('returns false when cliente_id snapshot no longer matches', async () => {
            const staleSnapshot = await ensureClient();
            const currentClient = await ensureClient();
            const kase = await CasesMother.createCase(repository, { cliente_id: currentClient });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'cliente_id',
                kase.id.value,
                staleSnapshot,
                staleSnapshot
            );

            expect(wrote).toBe(false);
            expect((await readCase(kase.id.value)).cliente_id).toBe(currentClient);
        });

        it('updates cliente_id when the snapshot still matches', async () => {
            const snapshot = await ensureClient();
            const nextClient = await ensureClient();
            const kase = await CasesMother.createCase(repository, { cliente_id: snapshot });

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'cliente_id',
                kase.id.value,
                snapshot,
                nextClient
            );

            expect(wrote).toBe(true);
            expect((await readCase(kase.id.value)).cliente_id).toBe(nextClient);
        });
    });

    describe('updateColumnIfSnapshotMatches — clasificacion_id', () => {
        it('updates clasificacion_id when the snapshot still matches', async () => {
            const snapshotCase = await CasesMother.createCase(repository, {});
            const nextCase = await CasesMother.createCase(repository, {});

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'clasificacion_id',
                snapshotCase.id.value,
                snapshotCase.clasificacion_id.value,
                nextCase.clasificacion_id.value
            );

            expect(wrote).toBe(true);
            expect((await readCase(snapshotCase.id.value)).clasificacion_id).toBe(nextCase.clasificacion_id.value);
        });

        it('does not overwrite when the snapshot no longer matches', async () => {
            const current = await CasesMother.createCase(repository, {});
            const other = await CasesMother.createCase(repository, {});

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'clasificacion_id',
                current.id.value,
                other.clasificacion_id.value,
                other.clasificacion_id.value
            );

            expect(wrote).toBe(false);
            expect((await readCase(current.id.value)).clasificacion_id).toBe(current.clasificacion_id.value);
        });
    });

    describe('updateColumnIfSnapshotMatches — grupo_id', () => {
        it('updates grupo_id when the snapshot still matches', async () => {
            const snapshotCase = await CasesMother.createCase(repository, {});
            const nextCase = await CasesMother.createCase(repository, {});

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'grupo_id',
                snapshotCase.id.value,
                snapshotCase.grupo_id.value,
                nextCase.grupo_id.value
            );

            expect(wrote).toBe(true);
            expect((await readCase(snapshotCase.id.value)).grupo_id).toBe(nextCase.grupo_id.value);
        });

        it('does not overwrite when the snapshot no longer matches', async () => {
            const current = await CasesMother.createCase(repository, {});
            const other = await CasesMother.createCase(repository, {});

            const wrote = await repository.updateColumnIfSnapshotMatches(
                'grupo_id',
                current.id.value,
                other.grupo_id.value,
                other.grupo_id.value
            );

            expect(wrote).toBe(false);
            expect((await readCase(current.id.value)).grupo_id).toBe(current.grupo_id.value);
        });
    });

    describe('updateColumnIfSnapshotMatches — allowlist', () => {
        it('throws InvalidArgumentError when the column is not a stale-snapshot field', async () => {
            await expect(
                repository.updateColumnIfSnapshotMatches('prioridad_id', uuidv4(), null, null)
            ).rejects.toBeInstanceOf(InvalidArgumentError);
        });
    });

    describe('touchUpdatedAt', () => {
        const UPDATED_AT = new Date('2026-08-27T12:00:00.000Z');

        it('updates updated_at and updated_by on a live row', async () => {
            const updatedBy = await ensureUser();
            const kase = await CasesMother.createCase(repository, {});

            await repository.touchUpdatedAt(kase.id.value, {
                updated_at: UPDATED_AT,
                updated_by: updatedBy,
            });

            const row = await readCase(kase.id.value);
            expect(new Date(row.updated_at).toISOString()).toBe(UPDATED_AT.toISOString());
            expect(row.updated_by).toBe(updatedBy);
        });

        it('throws 404 when the row is soft-deleted', async () => {
            const updatedBy = await ensureUser();
            const kase = await CasesMother.createCase(repository, {});
            await repository.connection('cases').where({ id: kase.id.value }).update({
                updated_at: null,
                updated_by: null,
                deleted_at: new Date(),
            });

            await expect(
                repository.touchUpdatedAt(kase.id.value, {
                    updated_at: UPDATED_AT,
                    updated_by: updatedBy,
                })
            ).rejects.toMatchObject({
                message: 'The Case you are trying update does not exist',
                statusCode: 404,
            });

            const row = await readCase(kase.id.value);
            expect(row.updated_at).toBeNull();
            expect(row.updated_by).toBeNull();
        });

        it('throws 404 when no live row exists', async () => {
            await expect(
                repository.touchUpdatedAt(uuidv4(), {
                    updated_at: UPDATED_AT,
                    updated_by: await ensureUser(),
                })
            ).rejects.toBeInstanceOf(CustomError);
        });
    });
});
