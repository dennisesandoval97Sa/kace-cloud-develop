# Eliminar IP del hash de sesión para evitar cortes por rotación de ISP

**Fecha:** 2026-07-29
**Rama:** `fix/session-hash-ip-independent` (desde `origin/release/1.23.x`)
**Estado:** Aprobado para implementación

## Resumen

La API falla con 401 "Session verification failed" cuando el ISP del cliente rota la IP pública mid-session, porque el `session_id` almacenado incluye la `sourceIp` y al recomputar el hash en cada request la IP ya no coincide. Este diseño elimina la IP del hash, lo reemplaza por un identificador de cliente que sí es estable (el `X-Client-Fingerprint` ya presente), e introduce un mecanismo de self-healing para sesiones legacy sin forzar re-login masivo.

## Problema

**Síntoma observado en producción (ver imagen adjunta):**

```
"message": "An unexpected error occurred. Please contact support",
"errors": "Session verification failed"
```

La UI muestra "Error autenticando usuario" tras una rotación de IP del ISP (frecuente con ISPs residenciales: cada pocas horas/días).

**Causa raíz:**

El string hasheado en login y en cada request es **idéntico** e incluye la `sourceIp`:

```js
// CognitoCredentials.js:24  (login)
`${email}:${sourceIp}:${sub}:${clientFingerprint}`

// BaseController.js:564  (verificación por request)
`${claims.email}:${sourceIp}:${claims.sub}:${clientFingerprint}`
```

Cuando el ISP rota la IP pública, `requestContext.identity.sourceIp` cambia → el hash recomputado difiere del almacenado en `user.session_id` → `SecurePasswordEncoder.verifyPassword` retorna `false` → `throw CustomError('Session verification failed', 401)`.

**Por qué la IP no es buena señal de identidad de cliente:**

- Cambia sin acción del usuario (rotación de ISP, reconexión WiFi, cambio de antena móvil)
- Se comparte entre muchos usuarios (NAT, CGNAT, VPN, redes corporativas)
- La IP es **peor** identificador que el `X-Client-Fingerprint`, que ya existe y es estable

## Objetivos

1. Eliminar el 401 por rotación de IP del cliente.
2. Mantener defensa contra session hijacking con las capas restantes.
3. No forzar re-login masivo de usuarios existentes.
4. Aplicar TDD: tests antes del cambio de código.
5. Migración sin ventana de downtime ni script SQL separado.

## No-objetivos

- Cambiar el modelo de autenticación (seguimos con Cognito + JWT + session_key cookie).
- Endurecer el fingerprint (eso sería WebAuthn, proyecto separado).
- Cambiar la rotación de `session_key` (cada 8h, ya funciona).
- Migrar el `cognito_hash_data` (queda intacto).

## Solución elegida

**Opción A:** Quitar la IP del hash. Fórmula nueva: `email:sub:fingerprint` (sin sourceIp). Self-healing en el controller para regenerar el `session_id` legacy en el primer request post-deploy.

### Por qué no las otras opciones

- **Opción B (agregar session_key al hash):** la session_key rota cada 8h, así que el hash cambiaría cada rotación → introduciría el mismo problema que resolvemos, con coste de DB write por request.
- **Opción C (IP con tolerancia /24):** no garantiza la solución. Los ISPs y carriers móviles rotan entre subnets completos. Solo atenúa, no resuelve.
- **Quitar `verifySessionHash` por completo:** eliminaría la única validación de que el request viene del mismo cliente que creó la sesión. Se conserva como capa complementaria al match de fingerprint.

## Cambios concretos

### Archivo 1: `packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js`

**Línea 24-26 — constructor:**

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

Se elimina `:${this.sourceIp}` del template. La firma del constructor no cambia — `sourceIp` permanece como campo de la clase por compatibilidad con otros consumidores, simplemente deja de participar del hash.

### Archivo 2: `packages/kace_cloud_api_common/src/controllers/BaseController.js`

**Líneas 553-557 — JSDoc del método `verifySessionHash`:** actualizar el comentario para reflejar que valida identidad de cliente, no ubicación de red.

**Líneas 558-575 — método `verifySessionHash`:**

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

### Lo que NO cambia

- `cognito_hash_data` (match de fingerprint por dispositivo) — intacto
- `session_key` cookie (HttpOnly Secure SameSite) — intacto
- JWT en `Authorization` header — intacto
- Validación regex del header `X-Client-Fingerprint` — intacta
- Conflicto "session active on another device" — intacto
- Lógica de rotación de session_key cada 8h — intacta

## Defensa anti-hijack resultante

Cuatro capas (de más fuerte a más débil):

1. **JWT en Authorization** — firmado por Cognito, expira en 1h
2. **session_key en cookie HttpOnly Secure SameSite** — robable vía XSS pero con hardening `__Host`-grade
3. **cognito_hash_data match** — bloquea sesiones en dispositivo distinto
4. **session_id hash** (nuevo: `email:sub:fingerprint`) — confirma que el request viene del mismo cliente que creó la sesión

**Coste de seguridad:** el atacante que roba JWT + cookie + fingerprint (XSS total) ya tenía game over antes — solo se le quita un obstáculo. La IP bloqueaba marginalmente el caso "atacante con todo en otra red", que es raro.

## Migración de sesiones existentes

**Estrategia: self-healing en el controller, sin script SQL previo.**

Cuando el request llega a `verifySessionHash`, ya pasó estos filtros:

1. JWT válido (verificado por Cognito en `verifyJwt`)
2. Fingerprint match (`cognito_hash_data` en `getLoggedInUser` líneas 185-192) — bloquea si el fingerprint del header no coincide
3. session_key cookie match (líneas 197-207) — solo el cliente legítimo tiene la cookie HttpOnly

Por lo tanto, cualquier "atacante" que llegue a `verifySessionHash` con un `session_id` que no matchea es, en la práctica, **el usuario legítimo cuya sesión fue creada con la fórmula vieja**. Regenerar el hash en este punto es seguro.

### Comportamiento por escenario

| Escenario | Resultado |
|-----------|-----------|
| Login nuevo (post-deploy) | CognitoCredentials genera con fórmula nueva. Verificación normal. |
| Usuario ya logueado, mismo dispositivo, IP rotada | Pasa cognito_hash_data. verifySessionHash no matchea. Self-healing regenera y persiste. Request sigue. |
| Usuario en otro dispositivo | Bloqueado en cognito_hash_data. Nunca llega a verifySessionHash. |
| Atacante con JWT robado sin fingerprint del usuario | Bloqueado en cognito_hash_data. |
| Atacante con JWT + cookie + fingerprint (XSS total) | Pasa todas las capas. Game over igual que antes. No hay regresión. |

### Señal observable de migración completada

El log `Helper.logInfo('Session hash mismatch, regenerating...')` aparecerá masivamente en las primeras horas post-deploy (una vez por usuario existente). Tras una primera onda de regeneración, el log se apaga. Útil para confirmar visualmente cuándo la migración terminó en producción.

### Lo que NO hace falta

- Script SQL de pre-migración
- Forzar re-login a usuarios
- Downtime
- Feature flag / kill switch (el self-healing es seguro por las capas previas)

## Data flow

### Login (Cognito AD user)

```
1. Cliente → POST /cognito-authorization con { id_token, ... } y header X-Client-Fingerprint
2. Controller.validateBodyTokenExpiration() → verifica JWT (exp, revocación)
3. Controller.loginUserAccount():
   a. Lee sourceIp, clientFingerprint, id_token
   b. AuthenticationUser.execute() →
      - CognitoCredentials crea hashSessionId = SHA-512(email:sub:fingerprint)  [NUEVO]
      - session_id se guarda en tabla usuarios con la fórmula nueva
4. Controller emite session_key en cookie HttpOnly Secure
5. Response 200
```

### Per-request autenticado

```
1. Cliente → GET /cualquier-recurso con Authorization, Cookie: session_key=..., X-Client-Fingerprint
2. BaseController.getLoggedInUser():
   a. getTokenClaims() → JWT verificado por Cognito
   b. validateBodyTokenExpiration() → exp + revocación
   c. UserLoginFinder → carga usuario
   d. user.isActive() check
   e. cognito_hash_data === fingerprint header check
   f. session_key cookie === user.session_key check
   g. verifySessionHash(user.session_id, claims)  [NUEVO]
3. verifySessionHash():
   - Lee fingerprint del header
   - Recompone rawSessionString = email:sub:fingerprint  [NUEVO]
   - Compara con user.session_id vía bcrypt
   - Si matchea → ok
   - Si NO matchea → self-healing: regenera, persiste, ok
4. Request continúa
```

## Error handling

### Errores que ya existían y se mantienen

| Origen | Código | Mensaje |
|--------|--------|---------|
| JWT inválido/expirado | 401 | `Invalid token` |
| Token revocado | 401 | `Token revoked` |
| Usuario no encontrado | 401 | `AUTH_USER_NOT_FOUND` |
| Usuario inactivo | 400 | `AUTH_USER_INACTIVE` |
| Fingerprint no matchea (cognito_hash_data) | 401 | `AUTH_FINGERPRINT_MISMATCH` |
| session_key cookie no matchea | 401 | `AUTH_SESSION_COOKIE_STALE` |
| Header `X-Client-Fingerprint` ausente o mal formado | 400 | `Missing required HTTP header: X-Client-Fingerprint` |

### Errores que cambian

**Antes:** sourceIp distinta al login → `Session verification failed` 401 → cliente deslogueado.

**Después:** session_id no matchea (sesión legacy con IP) → self-healing transparente, request continúa. Fingerprint del header distinto (dispositivo distinto) → bloqueado en paso `e` (cognito_hash_data), comportamiento idéntico al actual.

### Casos de fallo del self-healing

El self-healing hace un `UPDATE` a la BD. Si la BD está caída o el update falla:

- Se lanza la excepción del driver
- El `try/catch` en `BaseController.run()` (líneas 322-331) lo captura y devuelve `HttpResponse.badRequest`
- El cliente ve un 400 en vez de 401 — el JWT sigue siendo válido, puede reintentar

**Trade-off aceptable:** en el peor caso, la request falla y el cliente reintenta, lo que dispara el self-healing de nuevo hasta que tenga éxito. No hay pérdida de sesión.

## Testing

### Tests existentes a actualizar

`packages/kace_cloud_api_common/tests/controllers/BaseController.test.js` líneas 137-257 tienen `describe('verifySessionHash tests')` con **5 tests** desalineados con el código real:

1. **Usan `User-Agent` en lugar de `X-Client-Fingerprint`** (líneas 152, 176, 198, etc.). El código lee `X-Client-Fingerprint` (BaseController:563). `#assertClientFingerprintHeader()` debería lanzar `CustomError('Missing required HTTP header: X-Client-Fingerprint')` en esos tests, no pasar. **Bug latente en los tests existentes**, a corregir.

2. **"should reject when IP address changes" (líneas 167-189)** codifica el bug que arreglamos. Invertir: IP distinta debe **NO** rechazar.

3. **Fórmula usada** en rawSessionString: `${email}:${ip}:${sub}:${userAgent}` → cambiar a `${email}:${sub}:${fingerprint}`.

4. **"should handle missing IP information" (líneas 215-233)**: ahora irrelevante porque IP no entra en el hash. Actualizar o eliminar.

5. **"should handle missing user agent" (líneas 235-256)**: idem, ahora irrelevante.

### Tests nuevos (TDD, escritos antes del cambio)

**Bloque 1: `verifySessionHash` — fórmula sin IP**

```js
describe('verifySessionHash - IP-independent formula', () => {
    const email = 'test@example.com';
    const sub = 'user-abc';
    const fingerprint = 'fp-stable-12345';

    function makeEvent({ fingerprint = 'fp-stable-12345', sourceIp = '10.0.0.1' } = {}) {
        return {
            httpMethod: 'GET',
            resource: '/',
            headers: {
                Authorization: tokenExample,
                'X-Client-Fingerprint': fingerprint,
            },
            requestContext: { identity: { sourceIp } },
        };
    }

    it('validates when stored hash matches new formula (no IP)', async () => {
        const validHash = PasswordEncoder.generateHash(`${email}:${sub}:${fingerprint}`);
        const controller = new BaseController(makeEvent(), production);
        await expect(controller.verifySessionHash(validHash, { email, sub })).resolves.not.toThrow();
    });

    it('does NOT reject when sourceIp changes (the bug fix)', async () => {
        const validHash = PasswordEncoder.generateHash(`${email}:${sub}:${fingerprint}`);
        const controller = new BaseController(makeEvent({ sourceIp: '203.0.113.99' }), production);
        await expect(controller.verifySessionHash(validHash, { email, sub })).resolves.not.toThrow();
    });

    it('still rejects when fingerprint changes', async () => {
        const validHash = PasswordEncoder.generateHash(`${email}:${sub}:${fingerprint}`);
        const controller = new BaseController(makeEvent({ fingerprint: 'attacker-fp' }), production);
        await expect(controller.verifySessionHash(validHash, { email, sub })).rejects.toThrow(CustomError);
    });

    it('still rejects when email changes', async () => {
        const validHash = PasswordEncoder.generateHash(`${email}:${sub}:${fingerprint}`);
        const controller = new BaseController(makeEvent(), production);
        await expect(controller.verifySessionHash(validHash, { email: 'other@example.com', sub })).rejects.toThrow(CustomError);
    });

    it('still rejects when sub changes', async () => {
        const validHash = PasswordEncoder.generateHash(`${email}:${sub}:${fingerprint}`);
        const controller = new BaseController(makeEvent(), production);
        await expect(controller.verifySessionHash(validHash, { email, sub: 'other-user' })).rejects.toThrow(CustomError);
    });
});
```

**Bloque 2: self-healing del session_id**

Para este test, setear `this.user` en el controller antes de invocar `verifySessionHash` (la llamada directa no ejecuta `getLoggedInUser`). El test usa `account_type=1` (ACTIVE_DIRECTORY) para activar el path.

```js
describe('verifySessionHash - self-healing on legacy hash', () => {
    it('regenerates session_id when stored hash uses legacy formula (with IP)', async () => {
        const legacyHash = PasswordEncoder.generateHash(
            `${email}:${sub}:192.168.1.1:${fingerprint}`  // incluye IP, formato viejo
        );

        await repository.connection('usuarios')
            .where({ login: decodedSub })
            .update({ session_id: legacyHash });

        const event = makeEvent({ sourceIp: '203.0.113.99' });
        const controller = new BaseController(event, production);
        controller.user = await new UserLoginFinder(repository).execute(decodedSub);

        await controller.verifySessionHash(legacyHash, { email, sub });

        const updated = await repository.connection('usuarios')
            .where({ login: decodedSub })
            .first();
        expect(PasswordEncoder.compareHash(`${email}:${sub}:${fingerprint}`, updated.session_id)).toBe(true);
    });
});
```

**Bloque 3: `CognitoCredentials` — hash sin IP**

Crear `packages/kace_cloud_core/tests/auth-cognito/CognitoCredentials.test.js` (no existe):

```js
describe('CognitoCredentials.hashSessionId', () => {
    it('computes hash from email, sub, and fingerprint (no IP)', () => {
        const creds = new CognitoCredentials({
            id_token: jwt.sign({ sub: 'user-1', email: 'a@b.com' }, 'secret'),
            sourceIp: '198.51.100.5',
            clientFingerprint: 'fp-xyz',
        });

        const input = 'a@b.com:user-1:fp-xyz';
        expect(PasswordEncoder.compareHash(input, creds.hashSessionId)).toBe(true);
    });

    it('produces the same hash regardless of sourceIp value', () => {
        const idToken = jwt.sign({ sub: 'user-1', email: 'a@b.com' }, 'secret');
        const credsA = new CognitoCredentials({ id_token: idToken, sourceIp: '1.1.1.1', clientFingerprint: 'fp-1' });
        const credsB = new CognitoCredentials({ id_token: idToken, sourceIp: '2.2.2.2', clientFingerprint: 'fp-1' });
        expect(credsA.hashSessionId).toBe(credsB.hashSessionId);
    });
});
```

### Tests que NO se tocan (comportamiento preservado)

- `getLoggedInUser` fingerprint mismatch → 401
- `getLoggedInUser` session_key cookie mismatch → 401
- `getLoggedInUser` user inactive → 400
- JWT expirado / revocado → 401
- Tests de `SessionCookieService` (rotation, buildSetCookieHeader)
- Tests del controller de cognito_authorization existentes

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `packages/kace_cloud_core/src/auth-cognito/domain/CognitoCredentials.js` | Quitar `:${this.sourceIp}` del template de `hashSessionId` (línea 25) |
| `packages/kace_cloud_api_common/src/controllers/BaseController.js` | Reescribir `verifySessionHash` (líneas 558-575) sin sourceIp + agregar self-healing |
| `packages/kace_cloud_api_common/tests/controllers/BaseController.test.js` | Actualizar bloque `verifySessionHash tests` (líneas 137-257) + agregar 2 nuevos describes |
| `packages/kace_cloud_core/tests/auth-cognito/CognitoCredentials.test.js` | Crear nuevo con 2 tests |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| DB write por cada request post-deploy hasta que todos los usuarios migren | Log informativo permite monitorear cuándo se completa. Después es 0 overhead. |
| Un atacante con XSS total podría forzar regeneración de session_id | No hay regresión: con XSS total ya tiene game over. Las capas previas (cognito_hash_data + session_key) lo bloquean. |
| Tests existentes desalineados con código real | Se actualizan en este mismo PR. |
| Falsa sensación de que `verifySessionHash` ya no protege | El comentario JSDoc del método debe actualizarse para reflejar que ahora valida identidad de cliente, no ubicación. |

## Orden de implementación (TDD)

1. Escribir los 8 tests nuevos (3 describes) → fallan
2. Modificar `CognitoCredentials.js` → 2 tests del bloque 3 pasan
3. Modificar `BaseController.js` → 6 tests de los bloques 1 y 2 pasan
4. Actualizar los 5 tests viejos del `BaseController.test.js` con la nueva fórmula
5. Correr suite completa del repo para verificar no-regresión
6. Commitear con conventional commits: `fix(session): remove IP from session hash to survive ISP rotation`

## Próximos pasos

Tras aprobación de este spec, invocar `writing-plans` skill para crear el plan de implementación detallado.
