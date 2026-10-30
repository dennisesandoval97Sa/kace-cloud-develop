# Alinear extensiones de upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el paquete `@kace/file-extensions` como fuente única de verdad del catálogo de extensiones y conectarlo al frontend (shim) y a `S3CreatePresignedUrl` (unión superset legacy + catálogo) para resolver el rechazo de `.mp4` y evitar drift futuro.

**Architecture:** `FORMAT_FILES` vive en `packages/kace_cloud_file_extensions`. Helpers puros normalizan y construyen el set efectivo. `@kace/core` importa `buildEffectiveAllowedExtensions()`. `kace-saas` re-exporta vía shim en `@/utils/filesExtensions` sin cambiar consumidores.

**Tech Stack:** Node 22 ESM, Jest (vm-modules), pnpm workspaces, Vite/Vitest (kace-saas), `@aws-sdk/s3-request-presigner`

**Spec:** `docs/superpowers/specs/2026-07-18-align-upload-extensions-design.md`

**Branch:** `fix/align-upload-extensions-with-frontend`

## Global Constraints

- Versión del paquete nuevo: `1.23.6` (alineada con monorepo).
- `"type": "module"` en `@kace/file-extensions`.
- Cero dependencias de runtime en `@kace/file-extensions`.
- Sin comentarios en código generado (regla del workspace).
- TDD: test rojo → implementación mínima → verde → commit.
- Retrocompatibilidad: `LEGACY_API_EXTENSIONS ∪ getAllAllowedExtensions()` — nunca quitar extensiones del snapshot legacy.
- No migrar BD, no tocar `CaseAttachmentCreator`, no unificar los dos `fileValidations.js`.
- Mantener entradas legacy sin punto en Presentation: `pptm`, `ppsx`, `potx`, `potm`.

## File Map

| File | Responsibility |
|------|----------------|
| `packages/kace_cloud_file_extensions/package.json` | Definición del paquete workspace |
| `packages/kace_cloud_file_extensions/jest.config.js` | Config Jest ESM (copiar patrón schemabuilder) |
| `packages/kace_cloud_file_extensions/index.js` | Barrel export público |
| `packages/kace_cloud_file_extensions/src/formatFiles.js` | `FORMAT_FILES` catálogo |
| `packages/kace_cloud_file_extensions/src/legacyApiExtensions.js` | Snapshot inmutable del array API actual |
| `packages/kace_cloud_file_extensions/src/allowedExtensions.js` | Helpers puros de normalización y unión |
| `packages/kace_cloud_file_extensions/tests/allowedExtensions.test.js` | Tests del paquete |
| `packages/kace_cloud_core/package.json` | Agregar dep `@kace/file-extensions` |
| `packages/kace_cloud_core/src/shared/infrastructure/aws/S3CreatePresignedUrl.js` | Consumir set efectivo del paquete |
| `packages/kace_cloud_core/tests/shared/infrastructure/S3CreatePresignedUrl.test.js` | Tests MP4 + extensiones nuevas |
| `apps/kace-saas/package.json` | Agregar dep `@kace/file-extensions` |
| `apps/kace-saas/src/utils/filesExtensions.js` | Shim re-export |
| `apps/kace-saas/vite.config.js` | `deps.inline` para Vitest |

---

### Task 1: Scaffold del paquete `@kace/file-extensions`

**Files:**
- Create: `packages/kace_cloud_file_extensions/package.json`
- Create: `packages/kace_cloud_file_extensions/jest.config.js`
- Create: `packages/kace_cloud_file_extensions/index.js`
- Create: `packages/kace_cloud_file_extensions/src/formatFiles.js`
- Create: `packages/kace_cloud_file_extensions/src/legacyApiExtensions.js`
- Create: `packages/kace_cloud_file_extensions/src/allowedExtensions.js`

**Interfaces:**
- Produces: `FORMAT_FILES`, `LEGACY_API_EXTENSIONS`, `normalizeExtension(ext)`, `getFileExtensionFromName(fileName)`, `getAllAllowedExtensions()`, `buildAllowedExtensionsSet(extensions)`, `buildEffectiveAllowedExtensions()`, `isAllowedExtension(fileName, catalog)`

- [ ] **Step 1: Crear `package.json`**

```json
{
    "name": "@kace/file-extensions",
    "version": "1.23.6",
    "description": "Shared allowed file extensions catalog for Kace Cloud",
    "type": "module",
    "main": "index.js",
    "scripts": {
        "tests": "node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit --bail --maxWorkers=100%",
        "format": "prettier --write .",
        "format:check": "prettier --check ."
    },
    "license": "ISC",
    "devDependencies": {
        "@jest/globals": "^29.7.0",
        "@kace/prettier_config": "workspace:*",
        "@types/jest": "^29.5.12",
        "jest": "^29.7.0",
        "prettier": "3.3.3"
    }
}
```

- [ ] **Step 2: Crear `jest.config.js`**

```javascript
import { config } from 'dotenv';

config({ path: '../../.env' });

export const testEnvironment = 'node';
export const moduleFileExtensions = ['js', 'json', 'node'];
export const transform = {};
export const coverageDirectory = 'coverage';
export const coverageReporters = ['lcov', 'text'];
export const coveragePathIgnorePatterns = ['/node_modules/', '/tests/'];
export const testTimeout = 120000;
```

- [ ] **Step 3: Crear `src/formatFiles.js`** (mover contenido actual de `apps/kace-saas/src/utils/filesExtensions.js`)

```javascript
export const FORMAT_FILES = [
    {
        name: 'Audio',
        value: ['.aac', '.mid', '.midi', '.oga', '.wav', '.weba', '.mp3', '.ogg', '.m4a', '.flac'],
    },
    {
        name: 'Video',
        value: [
            '.avi',
            '.mpeg',
            '.mpg',
            '.ogv',
            '.swf',
            '.webm',
            '.3gp',
            '.3g2',
            '.mp4',
            '.mov',
            '.m4v',
            '.mkv',
            '.wmv',
        ],
    },
    {
        name: 'Images',
        value: ['.gif', '.jpeg', '.jpg', '.png', '.svg', '.tif', '.tiff', '.ico', '.webp', '.bmp', '.heic', '.heif'],
    },
    {
        name: 'Documents',
        value: [
            '.abw',
            '.doc',
            '.docx',
            '.docm',
            '.dotx',
            '.xlsx',
            '.xls',
            '.epub',
            '.pdf',
            '.rtf',
            '.odt',
            '.odp',
            '.ods',
            '.xhtml',
            '.xml',
            '.xul',
            '.html',
            '.htm',
            '.ics',
            '.txt',
            '.md',
            '.log',
        ],
    },
    {
        name: 'Csv',
        value: ['.csv'],
    },
    {
        name: 'Presentation',
        value: ['.ppt', '.pptx', 'pptm', 'ppsx', 'potx', 'potm'],
    },
    {
        name: 'Compressed',
        value: ['.arc', '.zip', '.rar', '.bz', '.bz2', '.7z', '.tar'],
    },
    {
        name: 'Programming',
        value: ['.csh', '.css', '.js', '.json'],
    },
    {
        name: 'Fonts',
        value: ['.ttf', '.woff', '.woff2'],
    },
];
```

- [ ] **Step 4: Crear `src/legacyApiExtensions.js`** (snapshot exacto del array actual en `S3CreatePresignedUrl.js`)

```javascript
export const LEGACY_API_EXTENSIONS = [
    '.aac',
    '.mid',
    '.midi',
    '.oga',
    '.wav',
    '.weba',
    '.avi',
    '.mpeg',
    '.ogv',
    '.swf',
    '.webm',
    '.3gp',
    '.3g2',
    '.gif',
    '.jpeg',
    '.jpg',
    '.svg',
    '.tif',
    '.tiff',
    '.ico',
    '.webp',
    '.png',
    '.abw',
    '.doc',
    '.docx',
    '.docm',
    '.dotx',
    '.xlsx',
    '.xls',
    '.epub',
    '.pdf',
    '.rtf',
    '.odt',
    '.odp',
    '.ods',
    '.xhtml',
    '.xml',
    '.xul',
    '.html',
    '.htm',
    '.ics',
    '.txt',
    '.csv',
    '.ppt',
    '.pptx',
    'pptm',
    'ppsx',
    'potx',
    'potm',
    '.arc',
    '.zip',
    '.rar',
    '.bz',
    '.bz2',
    '.7z',
    '.tar',
    '.csh',
    '.css',
    '.js',
    '.json',
    '.ttf',
    '.woff',
    '.woff2',
];
```

- [ ] **Step 5: Crear `src/allowedExtensions.js`**

```javascript
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
```

- [ ] **Step 6: Crear `index.js`**

```javascript
export { FORMAT_FILES } from './src/formatFiles.js';
export { LEGACY_API_EXTENSIONS } from './src/legacyApiExtensions.js';
export {
    normalizeExtension,
    getFileExtensionFromName,
    getAllAllowedExtensions,
    buildAllowedExtensionsSet,
    buildEffectiveAllowedExtensions,
    isAllowedExtension,
} from './src/allowedExtensions.js';
```

- [ ] **Step 7: Instalar dependencias workspace**

Run: `pnpm install`
Expected: `@kace/file-extensions` resuelto en workspace sin errores

- [ ] **Step 8: Commit**

```bash
git add packages/kace_cloud_file_extensions/
git commit -m "feat(file-extensions): add shared allowed extensions package scaffold"
```

---

### Task 2: Tests del paquete compartido (TDD)

**Files:**
- Create: `packages/kace_cloud_file_extensions/tests/allowedExtensions.test.js`

**Interfaces:**
- Consumes: exports de `@kace/file-extensions` (import relativo `../index.js`)

- [ ] **Step 1: Escribir tests**

```javascript
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
```

- [ ] **Step 2: Ejecutar tests (deben pasar tras Task 1)**

Run: `pnpm --filter @kace/file-extensions tests`
Expected: PASS (7 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_file_extensions/tests/allowedExtensions.test.js
git commit -m "test(file-extensions): cover catalog, legacy superset and normalization"
```

---

### Task 3: Integrar paquete en `@kace/core` / `S3CreatePresignedUrl`

**Files:**
- Modify: `packages/kace_cloud_core/package.json`
- Modify: `packages/kace_cloud_core/tests/shared/infrastructure/S3CreatePresignedUrl.test.js`
- Modify: `packages/kace_cloud_core/src/shared/infrastructure/aws/S3CreatePresignedUrl.js`

**Interfaces:**
- Consumes: `buildEffectiveAllowedExtensions()` from `@kace/file-extensions`
- Produces: `S3CreatePresignedUrl.ALLOWED_EXTENSIONS` apunta al array efectivo del paquete

- [ ] **Step 1: Agregar dependencia en `packages/kace_cloud_core/package.json`**

En `"dependencies"` agregar:

```json
"@kace/file-extensions": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 2: Escribir tests que fallan (Red)**

Agregar al final del bloque `describe('Extensiones válidas', ...)` en `S3CreatePresignedUrl.test.js`:

```javascript
        test('should accept MP4 video files', () => {
            const command = { input: { Key: 'video.mp4' } };
            expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
        });

        test.each(['.mov', '.mp3', '.bmp', '.md', '.heic'])(
            'should accept %s files from shared catalog',
            (extension) => {
                const command = { input: { Key: `file${extension}` } };
                expect(() => new S3CreatePresignedUrl(mockS3Client, command)).not.toThrow();
            },
        );
```

- [ ] **Step 3: Ejecutar tests (Red)**

Run: `pnpm --filter @kace/core tests -- S3CreatePresignedUrl`
Expected: FAIL en tests MP4 / mov / mp3 / bmp / md / heic

- [ ] **Step 4: Modificar `S3CreatePresignedUrl.js`**

Reemplazar el array estático inline por import del paquete:

```javascript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildEffectiveAllowedExtensions } from '@kace/file-extensions';
import { InvalidFileExtensionError } from './errors/InvalidFileExtensionError.js';

export class S3CreatePresignedUrl {
    #s3Client;
    #command;

    static ALLOWED_EXTENSIONS = buildEffectiveAllowedExtensions();

    constructor(s3Client, command) {
        this.#s3Client = s3Client;
        this.#validateFileExtensions(command);
        this.#command = command;
    }

    #validateFileExtensions(command) {
        if (!command || !command.input || !command.input.Key) {
            return;
        }

        const fileName = command.input.Key;
        const extension = this.#getFileExtension(fileName);

        if (!S3CreatePresignedUrl.ALLOWED_EXTENSIONS.includes(extension)) {
            throw new InvalidFileExtensionError(fileName, extension, S3CreatePresignedUrl.ALLOWED_EXTENSIONS);
        }
    }

    #getFileExtension(fileName) {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return fileName.substring(lastDotIndex).toLowerCase();
    }

    async execute(expires = '3600') {
        const uploadUrl = await getSignedUrl(this.#s3Client, this.#command, { expiresIn: expires });

        return {
            uploadUrl,
        };
    }
}
```

Nota: `#validateFileExtensions` usa `.includes(extension)` donde `extension` siempre lleva punto. `buildEffectiveAllowedExtensions()` ya retorna solo formas normalizadas con punto (ver Task 1 Step 5).

- [ ] **Step 5: Ejecutar tests (Green)**

Run: `pnpm --filter @kace/core tests -- S3CreatePresignedUrl`
Expected: PASS (todos los tests del archivo, incluidos existentes de `.exe` rechazado)

- [ ] **Step 6: Commit**

```bash
git add packages/kace_cloud_core/package.json packages/kace_cloud_core/src/shared/infrastructure/aws/S3CreatePresignedUrl.js packages/kace_cloud_core/tests/shared/infrastructure/S3CreatePresignedUrl.test.js packages/kace_cloud_file_extensions/src/allowedExtensions.js
git commit -m "fix(core): align S3 presigned URL extensions with shared catalog"
```

---

### Task 4: Integrar shim en frontend `kace-saas`

**Files:**
- Modify: `apps/kace-saas/package.json`
- Modify: `apps/kace-saas/src/utils/filesExtensions.js`
- Modify: `apps/kace-saas/vite.config.js`

**Interfaces:**
- Consumes: `@kace/file-extensions` exports `FORMAT_FILES`, `getAllAllowedExtensions`
- Produces: shim compatible con imports existentes `@/utils/filesExtensions`

- [ ] **Step 1: Agregar dependencia en `apps/kace-saas/package.json`**

En `"dependencies"`:

```json
"@kace/file-extensions": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 2: Reemplazar `apps/kace-saas/src/utils/filesExtensions.js`**

```javascript
export { FORMAT_FILES, getAllAllowedExtensions } from '@kace/file-extensions';
```

- [ ] **Step 3: Actualizar `apps/kace-saas/vite.config.js`**

En `test.server.deps.inline`, cambiar:

```javascript
inline: ['@kace/plugins'],
```

por:

```javascript
inline: ['@kace/plugins', '@kace/file-extensions'],
```

- [ ] **Step 4: Verificar build/test frontend**

Run: `pnpm --filter kace-sass test -- --run 2>&1 | head -50`
Expected: vitest arranca sin error de resolución de `@kace/file-extensions`

Run: `pnpm --filter kace-sass build`
Expected: build exitoso

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/package.json apps/kace-saas/src/utils/filesExtensions.js apps/kace-saas/vite.config.js
git commit -m "refactor(saas): consume shared file extensions catalog via shim"
```

---

### Task 5: Verificación final y criterios de aceptación

**Files:** ninguno (solo comandos)

- [ ] **Step 1: Tests paquete compartido**

Run: `pnpm --filter @kace/file-extensions tests`
Expected: PASS

- [ ] **Step 2: Tests API presigned URL**

Run: `pnpm --filter @kace/core tests -- S3CreatePresignedUrl`
Expected: PASS

- [ ] **Step 3: Smoke manual opcional**

Subir archivo `.mp4` en QA contra endpoint upload presigned URL.
Expected: sin `InvalidFileExtensionError`

- [ ] **Step 4: Checklist spec**

- [ ] Upload `.mp4` sin error
- [ ] Extensiones `FORMAT_FILES` aceptadas por `S3CreatePresignedUrl`
- [ ] Extensiones legacy API siguen aceptadas
- [ ] General Setup conserva mismas opciones
- [ ] Imports `@/utils/filesExtensions` intactos

---

## Self-Review (plan vs spec)

| Requisito spec | Task |
|----------------|------|
| Paquete `@kace/file-extensions` | Task 1 |
| Exports públicos completos | Task 1 Step 5-6 |
| `LEGACY_API_EXTENSIONS` snapshot | Task 1 Step 4 |
| Unión superset | Task 1 + Task 3 |
| TDD paquete | Task 2 |
| TDD S3CreatePresignedUrl | Task 3 |
| Shim frontend retrocompatible | Task 4 |
| Vite deps.inline | Task 4 Step 3 |
| Sin tocar CaseAttachmentCreator | Global Constraints |
| Normalización dual pptm | Task 1 + Task 2 tests |
| Verificación comandos spec | Task 5 |

Sin placeholders TBD detectados.

## Commit Strategy (rama completa)

1. `feat(file-extensions): add shared allowed extensions package scaffold`
2. `test(file-extensions): cover catalog, legacy superset and normalization`
3. `fix(core): align S3 presigned URL extensions with shared catalog`
4. `refactor(saas): consume shared file extensions catalog via shim`
