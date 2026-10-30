import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';

describe('DbRequestContext — request/job-scoped write flag', () => {
    it('hasWritten() is false at the start of a run', async () => {
        await DbRequestContext.run(async () => {
            expect(DbRequestContext.hasWritten()).toBe(false);
        });
    });

    it('markWrite() flips hasWritten() within the same run', async () => {
        await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            expect(DbRequestContext.hasWritten()).toBe(true);
        });
    });

    it('flag does NOT leak across separate runs (per-job reset)', async () => {
        await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
        });
        await DbRequestContext.run(async () => {
            expect(DbRequestContext.hasWritten()).toBe(false);
        });
    });

    it('hasWritten() is false (fail-open to writer) outside any run', () => {
        expect(DbRequestContext.hasWritten()).toBe(false);
    });

    it('runForJob isolates the flag per job', async () => {
        await DbRequestContext.runForJob(async () => {
            DbRequestContext.markWrite();
            expect(DbRequestContext.hasWritten()).toBe(true);
        });
        await DbRequestContext.runForJob(async () => {
            expect(DbRequestContext.hasWritten()).toBe(false);
        });
    });

    it('concurrent runs do not bleed the write flag', async () => {
        let innerSaw;
        await Promise.all([
            DbRequestContext.run(async () => {
                DbRequestContext.markWrite();
                await new Promise((resolve) => setTimeout(resolve, 10));
                expect(DbRequestContext.hasWritten()).toBe(true);
            }),
            DbRequestContext.run(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
                innerSaw = DbRequestContext.hasWritten();
            }),
        ]);
        expect(innerSaw).toBe(false);
    });
});
