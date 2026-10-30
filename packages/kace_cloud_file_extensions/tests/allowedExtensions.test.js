import { describe, expect, test } from '@jest/globals';
import {
    FORMAT_FILES,
    LEGACY_API_EXTENSIONS,
    normalizeExtension,
    getAllAllowedExtensions,
    buildAllowedExtensionsSet,
    buildEffectiveAllowedExtensions,
    isAllowedExtension,
} from '../index.js';

const EXTENSIONS_MISSING_IN_LEGACY_API = [
    '.mp3',
    '.ogg',
    '.m4a',
    '.flac',
    '.mp4',
    '.mpg',
    '.mov',
    '.m4v',
    '.mkv',
    '.wmv',
    '.bmp',
    '.heic',
    '.heif',
    '.md',
    '.log',
];

describe('@kace/file-extensions', () => {
    test('getAllAllowedExtensions includes mp4', () => {
        expect(getAllAllowedExtensions()).toContain('.mp4');
    });

    test('catalog includes extensions previously missing in legacy API', () => {
        const catalog = getAllAllowedExtensions();
        for (const extension of EXTENSIONS_MISSING_IN_LEGACY_API) {
            expect(catalog).toContain(extension);
        }
    });

    test('normalizeExtension adds leading dot', () => {
        expect(normalizeExtension('mp4')).toBe('.mp4');
        expect(normalizeExtension('.MP4')).toBe('.mp4');
    });

    test('buildAllowedExtensionsSet accepts legacy values without dot', () => {
        const set = buildAllowedExtensionsSet(['pptm']);
        expect(set.has('.pptm')).toBe(true);
        expect(set.has('pptm')).toBe(true);
    });

    test('isAllowedExtension accepts legacy catalog entry without dot', () => {
        expect(isAllowedExtension('file.pptm', ['pptm'])).toBe(true);
    });

    test('buildEffectiveAllowedExtensions is superset of legacy API list', () => {
        const effectiveSet = buildAllowedExtensionsSet(buildEffectiveAllowedExtensions());
        for (const extension of LEGACY_API_EXTENSIONS) {
            const normalized = normalizeExtension(extension);
            expect(effectiveSet.has(normalized) || effectiveSet.has(normalized.slice(1))).toBe(true);
        }
    });

    test('FORMAT_FILES keeps presentation legacy entries', () => {
        const presentation = FORMAT_FILES.find((group) => group.name === 'Presentation');
        expect(presentation.value).toEqual(expect.arrayContaining(['pptm', 'ppsx', 'potx', 'potm']));
    });
});
