# IP-Independent Session Hash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar la IP del hash de sesión para que los usuarios no sean deslogueados cuando el ISP rota su IP pública, manteniendo defensa anti-hijack con las capas restantes (JWT, session_key cookie, cognito_hash_data).

**Architecture:** Cambiar la fórmula del hash de `email:sourceIp:sub:fingerprint` a `email:sub:fingerprint` en dos puntos (login y verificación). El `verifySessionHash` agrega un self-healing que regenera el `session_id` legacy en el primer request post-deploy, sin forzar re-login.

**Tech Stack:** Node.js ESM, Jest (`node --experimental-vm-modules`), Knex, bcryptjs, AWS Cognito JWT verifier

**Spec:** `docs/superpowers/specs/2026-07-29-session-hash-ip-independent-design.md`

**Branch:** `fix/session-hash-ip-independent`

## Global Constraints

- TDD estricto: test rojo → implementación mínima → verde → commit.
- Sin comentarios en código generado (regla del workspace).
- Conventional commits, sin "Co-Authored-By".
- No migrar BD — el self-healing lo hace en código.
- Mantener `cognito_hash_data`, `session_key` cookie, JWT intactos.
- No agregar dependencias nuevas.

## File Map

| File | Responsibility |
|------|----------------|
| `packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js` | Quitar `:${this.sourceIp}` del template de `hashSessionId` (línea 25) |
| `packages/kace_cloud_core/tests/auth-cognito/CognitoCredentials.test.js` | Crear nuevo: 2 tests verificando hash sin IP e independencia de sourceIp |
| `packages/kace_cloud_api_common/src/controllers/BaseController.js` | Reescribir `verifySessionHash` (líneas 558-575): quitar sourceIp, agregar self-healing, actualizar JSDoc |
| `packages/kace_cloud_api_common/tests/controllers/BaseController.test.js` | Actualizar 5 tests existentes (líneas 137-257) + agregar 6 tests nuevos (bloque 1: 5 + bloque 2: 1 self-healing) |

---

### Task 1: Quitar IP del hash en `CognitoCredentials.js` (TDD)

**Files:**
- Create: `packages/kace_cloud_core/tests/auth-cognito/CognitoCredentials.test.js`
- Modify: `packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js:24-26`

- [ ] **Step 1: Crear el archivo de test**

Crear `packages/kace_cloud_core/tests/auth-cognito/CognitoCredentials.test.js` con:

```js
import jwt from 'jsonwebtoken';
import { CognitoCredentials } from '../../../src/auth-cognito/domain/CognitoCredentials.js';
import { SecurePasswordEncoder } from '../../../src/shared/index.js';

describe('CognitoCredentials.hashSessionId', () => {
    const mockSecret = 'test-secret-for-jwt-signing';
    const email = 'a@b.com';
    const sub = 'user-1';
    const fingerprint = 'fp-xyz';

    function signIdToken({ sub, email }) {
        return jwt.sign({ sub, email }, mockSecret, { expiresIn: '1h' });
    }

    it('computes hash from email, sub, and fingerprint (no IP)', () => {
        const idToken = signIdToken({ sub, email });
        const creds = new CognitoCredentials({
            id_token: idToken,
            sourceIp: '198.51.100.5',
            clientFingerprint: fingerprint,
        });

        const input = `${email}:${sub}:${fingerprint}`;
        expect(SecurePasswordEncoder.verifyPassword(input, creds.hashSessionId)).toBe(true);
    });

    it('produces the same hash regardless of sourceIp value', () => {
        const idToken = signIdToken({ sub, email });
        const credsA = new CognitoCredentials({
            id_token: idToken,
            sourceIp: '1.1.1.1',
            clientFingerprint: fingerprint,
        });
        const credsB = new CognitoCredentials({
            id_token: idToken,
            sourceIp: '2.2.2.2',
            clientFingerprint: fingerprint,
        });

        expect(credsA.hashSessionId).toBe(credsB.hashSessionId);
    });
});
```

- [ ] **Step 2: Verificar que el segundo test falla**

```bash
cd packages/kace_cloud_core && pnpm exec jest tests/auth-cognito/CognitoCredentials.test.js -t "produces the same hash regardless"
```

Expected: FAIL — el hash actual incluye sourceIp, así que dos IPs distintas producen hashes distintos.

- [ ] **Step 3: Modificar `CognitoCredentials.js`**

Archivo: `packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js`

Cambiar las líneas 24-26:

Antes:
```js
        this.hashSessionId = this.#generateSessionFingerprint(
            `${this.decodeToken.email}:${this.sourceIp}:${this.decodeToken?.sub}:${this.clientFingerprint}`
        );
```

Después:
```js
        this.hashSessionId = this.#generateSessionFingerprint(
            `${this.decodeToken.email}:${this.decodeToken?.sub}:${this.clientFingerprint}`
        );
```

- [ ] **Step 4: Verificar que los 2 tests pasan**

```bash
cd packages/kace_cloud_core && pnpm exec jest tests/auth-cognito/CognitoCredentials.test.js
```

Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js packages/kace_cloud_core/tests/auth-cognito/CognitoCredentials.test.js
git commit -m "fix(session): drop sourceIp from hashSessionId in CognitoCredentials"
```

---

### Task 2: Tests de `verifySessionHash` actualizados y nuevos (TDD, fase roja)

**Files:**
- Modify: `packages/kace_cloud_api_common/tests/controllers/BaseController.test.js:1-8` (agregar import de `UserLoginFinder`)
- Modify: `packages/kace_cloud_api_common/tests/controllers/BaseController.test.js:137-257`

Este task **solo escribe tests**. La implementación viene en Task 3.

- [ ] **Step 1: Agregar import de `UserLoginFinder` y `SecurePasswordEncoder`**

Archivo: `packages/kace_cloud_api_common/tests/controllers/BaseController.test.js`

Cambiar la línea 5:

Antes:
```js
import { KnexUsersRepository } from '@kace/core/src/users/index.js';
```

Después:
```js
import { KnexUsersRepository, UserLoginFinder } from '@kace/core/src/users/index.js';
```

Cambiar la línea 7 (imports desde `@kace/core/src/shared`):

Antes:
```js
import { CustomError, PasswordEncoder, StatusEnum } from '@kace/core/src/shared/index.js';
```

Después:
```js
import { CustomError, PasswordEncoder, SecurePasswordEncoder, StatusEnum } from '@kace/core/src/shared/index.js';
```

Nota: `PasswordEncoder` se mantiene en el import porque sigue usándose en la línea 112 (setUp de sesión en el test "should resolve the user from the token sub claim" — se reemplazará con `SecurePasswordEncoder` en una iteración posterior si se requiere, pero no es bloqueante para este fix).

- [ ] **Step 2: Reemplazar el bloque `describe('verifySessionHash tests', ...)` (líneas 137-257)**

Archivo: `packages/kace_cloud_api_common/tests/controllers/BaseController.test.js`

Reemplazar el contenido del describe block entero (líneas 137-257) con:

```js
    describe('verifySessionHash tests', () => {
        const mockEmail = 'test@example.com';
        const mockSub = 'user123';
        const mockFingerprint = 'fp-stable-abc-123';

        function makeEvent({ fingerprint = mockFingerprint, sourceIp = '192.168.1.1', host = 'example.com' } = {}) {
            return {
                httpMethod: 'GET',
                resource: '/',
                headers: {
                    Authorization: tokenExample,
                    'X-Client-Fingerprint': fingerprint,
                    Host: host,
                },
                requestContext: {
                    identity: {
                        sourceIp,
                    },
                },
            };
        }

        it('validates when stored hash matches new formula (no IP)', async () => {
            const validHash = SecurePasswordEncoder.createHash(
                `${mockEmail}:${mockSub}:${mockFingerprint}`
            );

            const controller = new BaseController(makeEvent(), production);
            await expect(controller.verifySessionHash(validHash, { email: mockEmail, sub: mockSub }))
                .resolves.not.toThrow();
        });

        it('does NOT reject when sourceIp changes (the bug fix)', async () => {
            const validHash = SecurePasswordEncoder.createHash(
                `${mockEmail}:${mockSub}:${mockFingerprint}`
            );

            const controller = new BaseController(makeEvent({ sourceIp: '203.0.113.99' }), production);
            await expect(controller.verifySessionHash(validHash, { email: mockEmail, sub: mockSub }))
                .resolves.not.toThrow();
        });

        it('still rejects when fingerprint changes', async () => {
            const validHash = SecurePasswordEncoder.createHash(
                `${mockEmail}:${mockSub}:${mockFingerprint}`
            );

            const controller = new BaseController(makeEvent({ fingerprint: 'attacker-fp' }), production);
            await expect(controller.verifySessionHash(validHash, { email: mockEmail, sub: mockSub }))
                .rejects.toThrow(CustomError);
        });

        it('still rejects when email changes', async () => {
            const validHash = SecurePasswordEncoder.createHash(
                `${mockEmail}:${mockSub}:${mockFingerprint}`
            );

            const controller = new BaseController(makeEvent(), production);
            await expect(controller.verifySessionHash(validHash, { email: 'other@example.com', sub: mockSub }))
                .rejects.toThrow(CustomError);
        });

        it('still rejects when sub changes', async () => {
            const validHash = SecurePasswordEncoder.createHash(
                `${mockEmail}:${mockSub}:${mockFingerprint}`
            );

            const controller = new BaseController(makeEvent(), production);
            await expect(controller.verifySessionHash(validHash, { email: mockEmail, sub: 'other-user' }))
                .rejects.toThrow(CustomError);
        });

        it('self-heals: regenerates session_id when stored hash uses legacy formula (with IP)', async () => {
            const event = makeEvent({ sourceIp: '203.0.113.99' });
            const controller = new BaseController(event, production);
            const claims = controller.getTokenClaims();

            const legacyHash = SecurePasswordEncoder.createHash(
                `${claims.email}:${claims.sub}:192.168.1.1:${mockFingerprint}`
            );

            await repository.connection('usuarios')
                .where({ login: claims.sub })
                .update({ session_id: legacyHash });

            const userInstance = await new UserLoginFinder(repository).execute(claims.sub);
            userInstance.session_id = legacyHash;
            controller.user = userInstance;

            await controller.verifySessionHash(legacyHash, claims);

            const updated = await repository.connection('usuarios')
                .where({ login: claims.sub })
                .first();

            expect(SecurePasswordEncoder.verifyPassword(
                `${claims.email}:${claims.sub}:${mockFingerprint}`,
                updated.session_id
            )).toBe(true);
        });
    });
```

- [ ] **Step 3: Verificar que la mayoría de los tests fallan**

```bash
cd packages/kace_cloud_api_common && pnpm exec jest tests/controllers/BaseController.test.js -t "verifySessionHash tests"
```

Expected: Los tests fallan porque la implementación actual todavía usa sourceIp. El test "still rejects when fingerprint changes" podría pasar o fallar dependiendo de la lógica actual; el resto deben fallar.

Si el runner no encuentra el test, verificar que `CustomError` está importado en el archivo (debería estarlo, ver línea 7).

- [ ] **Step 4: Commit (snapshot de los tests rojos)**

```bash
git add packages/kace_cloud_api_common/tests/controllers/BaseController.test.js
git commit -m "test(session): update verifySessionHash tests to IP-independent formula"
```

---

### Task 3: Implementar `verifySessionHash` con self-healing

**Files:**
- Modify: `packages/kace_cloud_api_common/src/controllers/BaseController.js:553-575`

- [ ] **Step 1: Actualizar el JSDoc del método (líneas 553-557)**

Archivo: `packages/kace_cloud_api_common/src/controllers/BaseController.js`

Antes:
```js
    /**
     * Validates the session context (IP, user-agent, etc.)
     * @param expectedHash
     * @param {Object} claims - Claims del token JWT
     */
    async verifySessionHash(expectedHash, claims) {
```

Después:
```js
    /**
     * Validates the session context (client identity: email, sub, fingerprint).
     * On mismatch, regenerates the session_id with the current formula — this
     * is the one-time self-heal for sessions created before the IP was removed
     * from the hash. The previous filters (cognito_hash_data + session_key
     * cookie) guarantee only the legitimate client reaches this point.
     * @param expectedHash
     * @param {Object} claims - Claims del token JWT
     */
    async verifySessionHash(expectedHash, claims) {
```

- [ ] **Step 2: Reescribir el cuerpo del método (líneas 558-575)**

Archivo: `packages/kace_cloud_api_common/src/controllers/BaseController.js`

Antes:
```js
    async verifySessionHash(expectedHash, claims) {
        this.#assertClientFingerprintHeader();

        const sourceIp = this.#event.requestContext?.identity?.sourceIp || 'unknown';
        const clientFingerprint =
            this.#event.headers['x-client-fingerprint'] ?? this.#event.headers['X-Client-Fingerprint'];
        const rawSessionString = `${claims.email}:${sourceIp}:${claims.sub}:${clientFingerprint}`;
        const isValidSession = SecurePasswordEncoder.verifyPassword(rawSessionString, expectedHash);

        if (!isValidSession) {
            Helper.logInfo('Invalid session context detected', {
                expectedHash,
                sourceIp,
                clientFingerprint,
            });
            throw new CustomError('Session verification failed', 401);
        }
    }
```

Después:
```js
    async verifySessionHash(expectedHash, claims) {
        this.#assertClientFingerprintHeader();

        const clientFingerprint =
            this.#event.headers['x-client-fingerprint'] ?? this.#event.headers['X-Client-Fingerprint'];
        const rawSessionString = `${claims.email}:${claims.sub}:${clientFingerprint}`;
        const isValidSession = SecurePasswordEncoder.verifyPassword(rawSessionString, expectedHash);

        if (isValidSession) {
            return;
        }

        if (expectedHash !== null && expectedHash !== undefined) {
            Helper.logInfo('Session hash mismatch, regenerating (one-time post-migration)', {
                sub: claims.sub,
            });
        }

        const newHash = SecurePasswordEncoder.createHash(rawSessionString);
        await this.#userRepository.connection('usuarios')
            .where({ id: this.user.id.value })
            .update({
                session_id: newHash,
                updated_at: new Date(),
                updated_by: this.user.id.value,
            });
        this.user.session_id = newHash;
    }
```

- [ ] **Step 3: Verificar que los 6 tests del bloque `verifySessionHash tests` pasan**

```bash
cd packages/kace_cloud_api_common && pnpm exec jest tests/controllers/BaseController.test.js -t "verifySessionHash tests"
```

Expected: 6 tests passing.

- [ ] **Step 4: Commit**

```bash
git add packages/kace_cloud_api_common/src/controllers/BaseController.js
git commit -m "fix(session): drop sourceIp from verifySessionHash and add self-healing"
```

---

### Task 4: Verificación de no-regresión

**Files:** ninguno (solo lectura)

- [ ] **Step 1: Correr la suite completa del BaseController**

```bash
cd packages/kace_cloud_api_common && pnpm exec jest tests/controllers/BaseController.test.js
```

Expected: todos los tests pasan. Si alguno falla, **NO arreglar el test para que pase** — el test es la especificación. Volver a Task 3 y revisar la implementación.

- [ ] **Step 2: Correr la suite completa de `kace_cloud_api_common`**

```bash
cd packages/kace_cloud_api_common && pnpm exec jest
```

Expected: todos los tests pasan.

- [ ] **Step 3: Correr la suite de `kace_cloud_core` (incluyendo los nuevos de CognitoCredentials)**

```bash
cd packages/kace_cloud_core && pnpm exec jest
```

Expected: todos los tests pasan.

- [ ] **Step 4: Verificar que los archivos de producción no tienen errores de import**

```bash
cd packages/kace_cloud_api_common && pnpm exec tsc --noEmit
cd packages/kace_cloud_core && pnpm exec tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 5: Commit final si hubo ajustes menores**

Si en los pasos anteriores hubo que ajustar el código de producción (no los tests), commitear con:

```bash
git add packages/kace_cloud_api_common/src/controllers/BaseController.js packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js
git commit -m "fix(session): adjust after no-regression run"
```

Si no hubo cambios, saltar este paso.

---

## Notas operacionales

### Verificación manual post-deploy

1. En los logs de CloudWatch, buscar el mensaje:
   ```
   Session hash mismatch, regenerating (one-time post-migration)
   ```
2. Debería aparecer una vez por usuario existente en las primeras horas post-deploy.
3. Después de ~24h (dependiendo del tráfico), el log debería desaparecer.
4. Una vez desaparecido, todos los `session_id` en la BD están en formato nuevo.

### Cómo revertir si algo sale mal

`git revert` de los 3 commits de implementación (no el de docs). Las sesiones nuevas generadas con la fórmula vieja durante el período de despliegue coexistirán con las regeneradas — bcrypt no las confunde porque el orden y número de campos es distinto. Rollback limpia: basta con revertir.

### Lo que NO hacer

- ❌ No correr un script SQL para limpiar `session_id` — el self-healing lo hace.
- ❌ No forzar re-login de usuarios — el self-healing es transparente.
- ❌ No agregar `X-Client-Fingerprint` al `cognito_hash_data` — ya está.
- ❌ No tocar la rotación de `session_key` — sigue intacta.
- ❌ No cambiar el frontend — el `X-Client-Fingerprint` ya se envía.
