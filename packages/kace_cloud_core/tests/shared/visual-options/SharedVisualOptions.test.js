import { InvalidArgumentError } from '../../../src/shared/errors/InvalidArgumentError.js';
import { ValueObjectSharedVisualColor } from '../../../src/shared/domain/value-object/ValueObjectSharedVisualColor.js';
import { ValueObjectSharedVisualIcon } from '../../../src/shared/domain/value-object/ValueObjectSharedVisualIcon.js';
import {
    DEFAULT_ANS_VISUAL_COLORS,
    DEFAULT_SHARED_VISUAL_COLOR,
    DEFAULT_SHARED_VISUAL_ICON,
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
    isSharedVisualColorAllowed,
} from '../../../src/shared/visual-options/sharedVisualOptions.js';

describe('Shared visual options allowlists', () => {
    it('exports the frontend-supported visual defaults inside the backend allowlists', () => {
        expect(SHARED_VISUAL_COLOR_ALLOWLIST).toContain(DEFAULT_SHARED_VISUAL_COLOR);
        expect(SHARED_VISUAL_ICON_ALLOWLIST).toContain(DEFAULT_SHARED_VISUAL_ICON);
        expect(SHARED_VISUAL_COLOR_ALLOWLIST).toContain(DEFAULT_ANS_VISUAL_COLORS.initial);
        expect(SHARED_VISUAL_COLOR_ALLOWLIST).toContain(DEFAULT_ANS_VISUAL_COLORS.intermediate);
        expect(SHARED_VISUAL_COLOR_ALLOWLIST).toContain(DEFAULT_ANS_VISUAL_COLORS.final);
    });

    it('accepts allowlisted shared visual values', () => {
        expect(new ValueObjectSharedVisualColor('color', SHARED_VISUAL_COLOR_ALLOWLIST[0]).value).toBe(
            SHARED_VISUAL_COLOR_ALLOWLIST[0]
        );
        expect(new ValueObjectSharedVisualIcon('icon', SHARED_VISUAL_ICON_ALLOWLIST[0]).value).toBe(
            SHARED_VISUAL_ICON_ALLOWLIST[0]
        );
    });

    it('rejects valid-looking but unsupported shared visual values', () => {
        expect(() => new ValueObjectSharedVisualColor('color', '#FFFFFF')).toThrow(
            new InvalidArgumentError('color: Unsupported visual color #FFFFFF')
        );
        expect(() => new ValueObjectSharedVisualIcon('icon', 'check')).toThrow(
            new InvalidArgumentError('icon: Unsupported visual icon check')
        );
    });

    it('accepts allowlisted colors regardless of hex casing', () => {
        const allowed = SHARED_VISUAL_COLOR_ALLOWLIST[0];

        expect(isSharedVisualColorAllowed(allowed.toLowerCase())).toBe(true);
        expect(isSharedVisualColorAllowed(allowed)).toBe(true);
        expect(isSharedVisualColorAllowed('#FFFFFF')).toBe(false);
        expect(isSharedVisualColorAllowed(null)).toBe(false);
    });
});
