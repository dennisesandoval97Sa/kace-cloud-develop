import { describe, it, expect } from '@jest/globals';
import { Behaviors } from '@kace/core/src/global-config/domain/settings/Behaviors.js';

/**
 * Validates the gating predicate used in actionCreateWithAux to decide whether the
 * synchronous fake-case and parent-relation side-effects run.
 *
 * The controller reads the flag via:
 *   const behaviorConfig = config.settings.behaviors.getConfig('agente', 'casos');
 *   const asyncEnabled = behaviorConfig?.async_case_post_processing === true;
 *
 * These tests exercise that exact accessor against the real Behaviors domain aggregate
 * (no mocks), covering default-false, explicit-true and missing-key paths.
 */
const isAsyncEnabled = (behaviors) => {
    const casos = behaviors.getConfig('agente', 'casos');
    return casos?.async_case_post_processing === true;
};

describe('async_case_post_processing gating predicate', () => {
    it('defaults to false (blocks run) when the key is missing from tenant config', () => {
        // Arrange: tenant config without the casos block at all
        const behaviors = new Behaviors({ application: {} });

        // Act
        const asyncEnabled = isAsyncEnabled(behaviors);

        // Assert: default false → synchronous side-effects still execute
        expect(asyncEnabled).toBe(false);
    });

    it('defaults to false when casos exists but omits the key', () => {
        // Arrange
        const behaviors = new Behaviors({
            application: { agente: { casos: { order_type: 'asc' } } },
        });

        // Act
        const asyncEnabled = isAsyncEnabled(behaviors);

        // Assert
        expect(asyncEnabled).toBe(false);
    });

    it('returns true (blocks skipped) only when explicitly enabled', () => {
        // Arrange
        const behaviors = new Behaviors({
            application: { agente: { casos: { async_case_post_processing: true } } },
        });

        // Act
        const asyncEnabled = isAsyncEnabled(behaviors);

        // Assert
        expect(asyncEnabled).toBe(true);
    });

    it('is false for any truthy non-true value (strict === true guard)', () => {
        // Arrange
        const behaviors = new Behaviors({
            application: { agente: { casos: { async_case_post_processing: 'true' } } },
        });

        // Act
        const asyncEnabled = isAsyncEnabled(behaviors);

        // Assert: only boolean true enables async; avoids accidental skips
        expect(asyncEnabled).toBe(false);
    });
});
