import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { Helps } from '../../src/helps/index.js';
import HelpsMother from './domain/HelpsMother.js';

describe('Help visual allowlist validation', () => {
    it('creates a help with an allowlisted color', () => {
        const help = Helps.create(HelpsMother.dto());

        expect(help.color.value).toBe(HelpsMother.dto().color);
    });

    it('rejects manipulated color values on create', () => {
        expect(() => Helps.create({ ...HelpsMother.dto(), color: '#FFFFFF' })).toThrow(
            new InvalidArgumentError('color: Unsupported visual color #FFFFFF')
        );
    });

    it('rejects manipulated color values on update', () => {
        const help = Helps.create(HelpsMother.dto());

        expect(() => help.update({ color: '#FFFFFF' })).toThrow(
            new InvalidArgumentError('color: Unsupported visual color #FFFFFF')
        );
    });

    it('allows clearing the color to null on update', () => {
        const help = Helps.create(HelpsMother.dto());

        expect(() => help.update({ color: null })).not.toThrow();
        expect(help.color.value ?? null).toBeNull();
    });
});
