import { describe, it, expect } from '@jest/globals';
import { TableSyncPlan } from '../../src/domain/table-sync-plan.js';

const buildArgs = (overrides = {}) => ({
    table: { name: 'clientes' },
    sourceSchema: 'asistencia',
    targetSchema: 'staging_asistencia',
    sourceColumns: ['id', 'nombre', 'email'],
    targetColumns: ['id', 'nombre', 'email'],
    primaryKey: ['id'],
    ...overrides,
});

describe('TableSyncPlan', () => {
    it('should keep every column when both sides match', () => {
        const plan = TableSyncPlan.build(buildArgs());

        expect(plan.columns).toEqual(['id', 'nombre', 'email']);
        expect(plan.ignoredColumns).toEqual([]);
        expect(plan.primaryKey).toEqual(['id']);
        expect(plan.sourceSchema).toBe('asistencia');
        expect(plan.targetSchema).toBe('staging_asistencia');
        expect(plan.where).toBeUndefined();
    });

    it('should ignore source columns missing in the target', () => {
        const plan = TableSyncPlan.build(
            buildArgs({ sourceColumns: ['id', 'nombre', 'foto_url'], targetColumns: ['id', 'nombre'] })
        );

        expect(plan.columns).toEqual(['id', 'nombre']);
        expect(plan.ignoredColumns).toEqual(['foto_url']);
    });

    it('should ignore target columns missing in the source', () => {
        const plan = TableSyncPlan.build(
            buildArgs({ sourceColumns: ['id', 'nombre'], targetColumns: ['id', 'nombre', 'extra_local'] })
        );

        expect(plan.columns).toEqual(['id', 'nombre']);
        expect(plan.ignoredColumns).toEqual([]);
    });

    it('should expose updatable columns excluding the primary key', () => {
        const plan = TableSyncPlan.build(buildArgs());

        expect(plan.updatableColumns).toEqual(['nombre', 'email']);
    });

    it('should support composite primary keys', () => {
        const plan = TableSyncPlan.build(
            buildArgs({
                sourceColumns: ['caso_id', 'usuario_id', 'rol'],
                targetColumns: ['caso_id', 'usuario_id', 'rol'],
                primaryKey: ['caso_id', 'usuario_id'],
            })
        );

        expect(plan.primaryKey).toEqual(['caso_id', 'usuario_id']);
        expect(plan.updatableColumns).toEqual(['rol']);
    });

    it('should default the target table name to the source table name', () => {
        const plan = TableSyncPlan.build(buildArgs());

        expect(plan.sourceTable).toBe('clientes');
        expect(plan.targetTable).toBe('clientes');
    });

    it('should honour an explicit targetName', () => {
        const plan = TableSyncPlan.build(
            buildArgs({ table: { name: 'auditoria', targetName: 'auditoria_prod', where: 'activo = true' } })
        );

        expect(plan.targetTable).toBe('auditoria_prod');
        expect(plan.where).toBe('activo = true');
    });

    it('should reject a table with no primary key', () => {
        expect(() => TableSyncPlan.build(buildArgs({ primaryKey: [] }))).toThrow(
            'Table "clientes" has no primary key; cannot upsert'
        );
    });

    it('should reject when a primary key column is missing in the target', () => {
        expect(() => TableSyncPlan.build(buildArgs({ targetColumns: ['nombre', 'email'] }))).toThrow(
            'Primary key column "id" does not exist in target table "staging_asistencia"."clientes"'
        );
    });

    it('should reject when a primary key column is missing in the source', () => {
        expect(() =>
            TableSyncPlan.build(
                buildArgs({
                    sourceColumns: ['id', 'nombre'],
                    targetColumns: ['id', 'nombre', 'ghost_pk'],
                    primaryKey: ['id', 'ghost_pk'],
                })
            )
        ).toThrow('Primary key column "ghost_pk" does not exist in source table "asistencia"."clientes"');
    });
});
