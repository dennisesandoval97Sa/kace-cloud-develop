# Alinear extensiones de upload entre frontend y API

**Fecha:** 2026-07-18  
**Rama:** `fix/align-upload-extensions-with-frontend` (desde `origin/release/1.23.x`)  
**Estado:** Aprobado para implementación

## Resumen

La API rechaza uploads de archivos `.mp4` (y otras extensiones) al generar presigned URLs porque `S3CreatePresignedUrl` valida contra una lista estática desactualizada. El frontend usa `FORMAT_FILES` como catálogo maestro. Este diseño introduce el paquete compartido `@kace/file-extensions` como única fuente de verdad, consumido por frontend y backend, con garantías explícitas de retrocompatibilidad.

## Problema

**Error observado:**

```
InvalidFileExtensionError: File "case/.../file_example_MP4_480_1_5MG.mp4" has an invalid extension ".mp4"
```

**Causa raíz:** dos listas de extensiones mantenidas por separado:

| Ubicación | Archivo | Incluye `.mp4` |
|-----------|---------|----------------|
| Frontend | `apps/kace-saas/src/utils/filesExtensions.js` | Sí |
| API | `packages/kace_cloud_core/src/shared/infrastructure/aws/S3CreatePresignedUrl.js` | No |

**Extensiones en frontend ausentes en API (18):**

- Audio: `.mp3`, `.ogg`, `.m4a`, `.flac`
- Video: `.mp4`, `.mpg`, `.mov`, `.m4v`, `.mkv`, `.wmv`
- Imágenes: `.bmp`, `.heic`, `.heif`
- Documentos: `.md`, `.log`

## Objetivos

1. Eliminar drift entre frontend y API con una fuente de verdad compartida.
2. Resolver el bug de `.mp4` y el resto de extensiones desalineadas.
3. Mantener retrocompatibilidad total con uploads, configs de tenant e imports existentes.
4. Aplicar TDD, DDD, SOLID y código mínimo necesario.

## Solución elegida

**Enfoque 3:** paquete monorepo `@kace/file-extensions` consumido por frontend (`kace-saas`) y backend (`@kace/core`).

### Arquitectura

```
@kace/file-extensions (formatFiles.js + helpers)
        │
        ├──► apps/kace-saas/src/utils/filesExtensions.js (re-export shim)
        │         └── consumidores existentes sin cambio de import
        │
        └──► S3CreatePresignedUrl
                  └── ALLOWED = LEGACY_API_EXTENSIONS ∪ getAllAllowedExtensions()
```

## Paquete `@kace/file-extensions`

### Ubicación

```
packages/kace_cloud_file_extensions/
├── package.json
├── index.js
├── src/
│   ├── formatFiles.js
│   └── allowedExtensions.js
└── tests/
    └── allowedExtensions.test.js
```

### `package.json`

- `name`: `@kace/file-extensions`
- `version`: `1.23.6` (alineada con monorepo)
- `type`: `module`
- `main`: `index.js`
- `dependencies`: ninguna
- `scripts.tests`: Jest (mismo patrón que `@kace/schemabuilder`)

### Exports públicos

| Export | Descripción |
|--------|-------------|
| `FORMAT_FILES` | Catálogo estructurado por categoría (contenido actual de `filesExtensions.js`) |
| `getAllAllowedExtensions()` | Lista plana deduplicada de todas las extensiones del catálogo |
| `normalizeExtension(ext)` | Normaliza a forma con punto inicial (`.mp4`) |
| `isAllowedExtension(fileName, catalog)` | Valida extensión extraída del filename contra catálogo |
| `buildAllowedExtensionsSet(extensions)` | Construye `Set` con formas normalizadas y legacy sin punto |

### Contenido de `FORMAT_FILES`

Se mueve verbatim desde `apps/kace-saas/src/utils/filesExtensions.js`, incluyendo entradas legacy de Presentation sin punto (`pptm`, `ppsx`, `potx`, `potm`) para paridad exacta con el frontend actual.

## Retrocompatibilidad

### Frontend

`apps/kace-saas/src/utils/filesExtensions.js` pasa a ser un shim:

```javascript
export { FORMAT_FILES, getAllAllowedExtensions } from "@kace/file-extensions";
```

**Sin cambios** en import paths de:

- `apps/kace-saas/src/utils/fileValidations.js`
- `apps/kace-saas/src/components/core/Attachment/utils/fileValidations.js`
- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/FilesSelect.jsx`

### API — unión superset

`S3CreatePresignedUrl` define `LEGACY_API_EXTENSIONS` como snapshot del array `ALLOWED_EXTENSIONS` actual antes del cambio. La lista efectiva es:

```
ALLOWED_EXTENSIONS = unique( LEGACY_API_EXTENSIONS ∪ getAllAllowedExtensions() )
```

**Garantía:** toda extensión que la API aceptaba antes del fix sigue aceptándose.

### Configuraciones de tenant

No se migran datos en BD. `CaseAttachmentCreator`, `HelpsAttachmentsCreator` y `TemplateAttachmentCreator` siguen validando contra `allowed_file_extensions` del DTO/config del tenant sin cambios.

### Extensiones legacy sin punto

`isAllowedExtension` y `buildAllowedExtensionsSet` aceptan ambas formas al comparar:

- `.pptm` (extraída del filename)
- `pptm` (valor legacy en catálogo o config)

Fuera de scope: migración masiva en BD de `pptm` → `.pptm`.

## Cambios por componente

### Nuevo: `packages/kace_cloud_file_extensions`

- Contiene `FORMAT_FILES` y helpers puros.
- Tests unitarios con Jest.

### `@kace/core`

- Agregar `"@kace/file-extensions": "workspace:*"` en `dependencies`.
- `S3CreatePresignedUrl.js`: eliminar array inline; importar helpers del paquete compartido.
- Mantener `#getFileExtension` y `#validateFileExtensions` sin cambio de firma pública.
- `InvalidFileExtensionError` sin cambios.

### `apps/kace-saas`

- Agregar `"@kace/file-extensions": "workspace:*"` en `dependencies`.
- Shim en `filesExtensions.js`.
- `vite.config.js`: agregar `"@kace/file-extensions"` a `test.server.deps.inline`.

### Sin cambios

- `apps/onescript_plugin_kace`
- Seeds y migraciones de BD
- APIs distintas a upload presigned URL
- Lógica de `CaseAttachmentCreator`

## Estrategia TDD

### Fase 1 — Paquete compartido (Red → Green)

1. Test: `getAllAllowedExtensions()` incluye `.mp4`.
2. Test: catálogo incluye las 18 extensiones previamente ausentes en API.
3. Test: `LEGACY_API_EXTENSIONS.every(ext => set.has(normalize(ext)))` es true.
4. Test: `isAllowedExtension('file.pptm', ['pptm'])` retorna true.
5. Test: `normalizeExtension('mp4')` retorna `'.mp4'`.
6. Implementar `formatFiles.js`, `allowedExtensions.js`, `index.js`.

### Fase 2 — API (Red → Green)

1. Test en `S3CreatePresignedUrl.test.js`: `'should accept MP4 video files'` falla antes del cambio.
2. Tests parametrizados para extensiones nuevas clave: `.mp4`, `.mov`, `.mp3`, `.bmp`, `.md`.
3. Conectar `S3CreatePresignedUrl` al paquete compartido.
4. Verificar tests existentes de extensiones válidas/inválidas siguen pasando.

### Fase 3 — Frontend (Green)

1. Reemplazar shim en `filesExtensions.js`.
2. Ejecutar tests de `fileValidations` en kace-saas si existen.

### Refactor

- Eliminar array duplicado de `S3CreatePresignedUrl.js`.
- Sin refactor adicional de los dos `fileValidations.js` duplicados (fuera de scope).

## Verificación

```bash
pnpm --filter @kace/file-extensions tests
pnpm --filter @kace/core tests -- S3CreatePresignedUrl
pnpm --filter kace-sass test -- fileValidations
```

### Criterios de aceptación

- [ ] Upload de `.mp4` genera presigned URL sin `InvalidFileExtensionError`.
- [ ] Todas las extensiones de `FORMAT_FILES` son aceptadas por `S3CreatePresignedUrl`.
- [ ] Todas las extensiones del array legacy de API siguen siendo aceptadas.
- [ ] General Setup muestra las mismas opciones de extensión que antes.
- [ ] Imports `@/utils/filesExtensions` siguen funcionando sin cambios en consumidores.
- [ ] Tests unitarios nuevos y existentes pasan.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Vite no resuelve workspace package en tests | `deps.inline` en `vite.config.js` |
| Lambda no empaqueta el módulo | Dependencia transitiva vía `@kace/core` (patrón `@kace/schemabuilder`) |
| Regresión en uploads existentes | Unión superset con `LEGACY_API_EXTENSIONS` |
| Configs con extensiones sin punto | Normalización dual en helpers compartidos |
| Incremento de bundle frontend | Paquete ~2KB, sin dependencias, tree-shakeable |

## Fuera de scope

- Migración de `pptm` → `.pptm` en BD
- Unificación de los dos archivos `fileValidations.js` del frontend
- Cambios en validación por tenant config (`CaseAttachmentCreator`)
- Ampliar tipos MIME en `EXTENSION_TO_MIME` del frontend (solo extensiones, no MIME)

## Referencias

- Bug: `InvalidFileExtensionError` en `QAUploadS3FilesStack-uploads3fileslambda`
- Frontend catálogo actual: `apps/kace-saas/src/utils/filesExtensions.js`
- API validación: `packages/kace_cloud_core/src/shared/infrastructure/aws/S3CreatePresignedUrl.js`
- Tests API: `packages/kace_cloud_core/tests/shared/infrastructure/S3CreatePresignedUrl.test.js`
