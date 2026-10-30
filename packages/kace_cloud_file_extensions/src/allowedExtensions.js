import { FORMAT_FILES } from './formatFiles.js';
import { LEGACY_API_EXTENSIONS } from './legacyApiExtensions.js';

export function normalizeExtension(extension) {
    if (!extension || typeof extension !== 'string') {
        return '';
    }

    const trimmed = extension.trim().toLowerCase();
    if (trimmed.length === 0) {
        return '';
    }

    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

export function getFileExtensionFromName(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return '';
    }

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return '';
    }

    return fileName.substring(lastDotIndex).toLowerCase();
}

export function getAllAllowedExtensions() {
    const extensions = FORMAT_FILES.flatMap((group) => group.value);
    return [...new Set(extensions)];
}

export function buildAllowedExtensionsSet(extensions) {
    const set = new Set();

    for (const extension of extensions) {
        const normalized = normalizeExtension(extension);
        if (normalized) {
            set.add(normalized);
        }

        const withoutDot = normalized.startsWith('.') ? normalized.slice(1) : normalized;
        if (withoutDot) {
            set.add(withoutDot);
        }
    }

    return set;
}

export function buildEffectiveAllowedExtensions() {
    const merged = [...LEGACY_API_EXTENSIONS, ...getAllAllowedExtensions()];
    const set = buildAllowedExtensionsSet(merged);
    return [...new Set([...set].map((entry) => normalizeExtension(entry)).filter(Boolean))];
}

export function isAllowedExtension(fileName, catalog) {
    const extension = getFileExtensionFromName(fileName);
    if (!extension) {
        return false;
    }

    const allowedSet = buildAllowedExtensionsSet(catalog);
    const withoutDot = extension.startsWith('.') ? extension.slice(1) : extension;

    return allowedSet.has(extension) || allowedSet.has(withoutDot);
}
