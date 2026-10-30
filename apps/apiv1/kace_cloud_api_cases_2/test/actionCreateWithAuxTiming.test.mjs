import { describe, it, expect } from '@jest/globals';
import { PhaseTimer } from '../src/PhaseTimer.mjs';

describe('PhaseTimer', () => {
    it('acumula duración por fase y produce un objeto plano de números', async () => {
        // Arrange
        const timer = new PhaseTimer();

        // Act
        const end = timer.start('config');
        await new Promise((resolve) => setTimeout(resolve, 5));
        end();

        const summary = timer.summary();

        // Assert
        expect(typeof summary.phases.config).toBe('number');
        expect(summary.phases.config).toBeGreaterThanOrEqual(4);
        expect(typeof summary.total).toBe('number');
    });

    it('acumula múltiples intervalos bajo el mismo nombre de fase', async () => {
        const timer = new PhaseTimer();
        const end1 = timer.start('config');
        await new Promise((resolve) => setTimeout(resolve, 5));
        end1();
        const end2 = timer.start('config');
        await new Promise((resolve) => setTimeout(resolve, 5));
        end2();
        const summary = timer.summary();
        expect(summary.phases.config).toBeGreaterThanOrEqual(9);
        expect(summary.total).toBeGreaterThanOrEqual(summary.phases.config);
    });
});
