# kace_cloud_perf — Runbook F1-R (Baseline de carga lectura)

## Descripción general

Este paquete implementa el framework de carga F1-R para los microservicios apiv1 de KACE Cloud. Contiene los escenarios k6, las herramientas de anonimización de datos, el pool de tokens de autenticación, el orquestador de runs y los reportes de resultados.

El diseño completo del plan de pruebas está en:
`docs/superpowers/specs/2026-05-05-load-testing-apiv1-baseline-design.md`

---

## Prerrequisitos

- **k6 v0.50+** instalado y disponible en el PATH
- **Node.js 22+**
- **pnpm** (cualquier versión compatible con el workspace)
- **Acceso al entorno `kace-cloudperf`** provisionado por sysadmins — ver plantilla de solicitud en [`docs/sysadmin-request-template.md`](docs/sysadmin-request-template.md)

---

## Setup (una vez por entorno)

Ejecutar en orden desde la raíz del paquete (`packages/kace_cloud_perf`):

```bash
pnpm install
cp .env.perf.example .env.perf  # rellenar con valores recibidos de sysadmins
```

Provisionar los usuarios de prueba en el Cognito perf (genera `auth/test-users.local.json` con N usuarios sintéticos, los crea en el User Pool y les setea password permanente):

```bash
bash auth/bootstrap-users.sh                  # 10 usuarios por defecto
bash auth/bootstrap-users.sh --count 20       # más usuarios si hace falta
bash auth/bootstrap-users.sh --regenerate     # rotar passwords (sobreescribe el JSON)
```

El script carga automáticamente `./.env.perf` con auto-export. Si tus credenciales viven en otra ruta: `ENV_FILE=/path/to/env bash auth/bootstrap-users.sh`.

Requisitos del runner del script: `aws-cli v2`, `jq`, `openssl` y credenciales AWS con permisos `cognito-idp:AdminCreateUser` y `cognito-idp:AdminSetUserPassword` sobre el User Pool perf. Es idempotente: si un usuario ya existe en Cognito, solo le actualiza el password.

El archivo `auth/test-users.local.json` queda con permisos `600` y está cubierto por `.gitignore` — **no commitearlo**.

Registrar los usuarios en la base de datos de la app (POST `/auth-cognito` una vez por cada usuario — sin esto Cognito autentica pero la API responde 403/404 porque no hay row en `usuarios`):

```bash
pnpm run users:register
```

Es idempotente: si un usuario ya está registrado el endpoint devuelve 4xx que el script trata como "ya existe" y continúa. Ejecutar después de cada `users:bootstrap` o cada vez que `tokens:generate` genere usuarios nuevos no vistos antes por la API.

Anonimización de datos de producción (requiere `data/manifests/pii-fields.json` aprobado por DBA + legal antes de ejecutar):

```bash
pnpm run anonymize:extract              # genera dump de prod (requiere acceso VPN + RDS prod)
pnpm run anonymize:run < dump.sql > anonymized.sql   # aplica reglas de anonimización en streaming
pnpm run anonymize:load anonymized.sql.gz            # carga snapshot anonimizado al RDS perf
```

Extracción del pool de IDs reales del seed:

```bash
pnpm run data:extract-ids   # genera data/data-pool/*.local.json con IDs reales del entorno perf
```

Generación inicial del pool de tokens (válidos 1 hora):

```bash
pnpm run tokens:generate    # genera auth/tokens.local.json con 50 tokens de los usuarios test
```

---

## Ejecutar el baseline F1-R

```bash
pnpm run baseline:run runner/catalog/phase1-read.json
```

El output se escribe en `docs/perf/baselines/<YYYY-MM-DD>-f1-read/` con la estructura:

```
<YYYY-MM-DD>-f1-read/
├── metadata.json
└── raw/
    └── *.json
```

Generar los reportes sobre el directorio de output:

```bash
node reporter/summarize.mjs <output-dir>      # → summary.md
node reporter/render-html.mjs <output-dir>    # → summary.html
```

Commitear `summary.md`, `summary.html` y actualizar `docs/perf/baselines/INDEX.md`.

---

## Ajustar la carga (RPS, duración, warm-up)

El perfil por defecto es **50 RPS sostenido × 10 min** con warm-up de **30s @ 10 RPS** (definido en `scenarios/_shared/thresholds.js`). Se puede overridear vía variables de entorno sin tocar código:

| Variable | Default | Descripción |
|---|---|---|
| `PERF_RPS` | `50` | RPS del escenario principal |
| `PERF_DURATION` | `10m` | Duración del escenario principal (formato k6: `30s`, `5m`, `1h`...) |
| `PERF_WARMUP_RPS` | `10` | RPS durante el warm-up |
| `PERF_WARMUP` | `30s` | Duración del warm-up |

**Permanente** (todas las runs): añade la variable a `.env.perf`:

```bash
echo "PERF_RPS=100" >> .env.perf
pnpm run baseline:run runner/catalog/phase1-read.json
```

**Puntual** (un solo run, sin tocar `.env.perf`):

```bash
PERF_RPS=100 pnpm run baseline:run runner/catalog/phase1-read.json
```

**Un solo escenario k6 manual** (útil para iterar sobre un endpoint específico):

```bash
k6 run -e PERF_RPS=100 -e PERF_DURATION=2m \
       -e PERF_API_BASE_URL="$PERF_API_BASE_URL" \
       -e PERF_API_KEY="$PERF_API_KEY" \
       -e PERF_TENANT_ID="$PERF_TENANT_ID" \
       scenarios/cases/search.js
```

El runner escribe el perfil real usado en `metadata.json` de cada baseline (campos `loadProfile.rps`, `loadProfile.duration`, etc.), así que comparativas posteriores con `compare.mjs` saben si dos baselines son comparables.

**Implicaciones de subir RPS:**

- A 100 RPS k6 prealoca 100 VUs y permite hasta 400 (`Math.max(RATE * 4, 200)`). Si las respuestas son lentas el VU pool se expande hasta el max.
- El cognito authorizer Lambda recibe ~100 invocaciones/seg × 5 escenarios secuenciales = pico de 100/seg sostenido. Cuidado con throttling de Cognito (límite por defecto `RATELimitedExceededException` ~120 RPS por user pool).
- A 100 RPS × 5 escenarios × 10 min = ~300k requests por baseline. Confirma con sysadmins que el entorno aguanta antes de programar la run.
- Los thresholds en `thresholds.js` (`p95<2000`) se aplican igual; si subes RPS y los endpoints se degradan, los tests caen como `THRESHOLD_BREACH`. Eso es información válida del baseline, no un bug.

---

## Refrescar tokens caducados (entre runs largas)

```bash
pnpm run tokens:refresh
```

---

## Troubleshooting

**401 masivos**
Tokens expirados. Correr `pnpm run tokens:refresh`. Si persiste, regenerar el pool completo con `pnpm run tokens:generate`.

**403 / 404 con auth válido (token Cognito funciona)**
Probablemente los usuarios test no están registrados en la tabla `usuarios` del tenant. Síntoma: las latencias son consistentes (~200ms, indica DB lookup) pero todas las requests fallan. Fix:

```bash
pnpm run users:register
```

Si persiste, verificar con sysadmins que `PERF_TENANT_ID` en `.env.perf` corresponde al tenant provisionado y que los users tienen los roles correctos.

**`connection refused` a RDS**
Confirmar con sysadmins que la IP actual está en la allowlist del security group. Algunos entornos requieren conectarse primero a la VPN corporativa.

**k6 no instalado** (`spawn k6 ENOENT`)
```bash
brew install k6                                                                  # macOS
sudo apt-get install -y k6                                                       # Debian/Ubuntu
sudo dnf install -y https://dl.k6.io/rpm/repo.rpm && sudo dnf install -y k6      # Amazon Linux 2023 / RHEL / Fedora
```

Si ninguno de los gestores aplica (ej. EC2 sin acceso a repos), instalar el binario estático:

```bash
curl -L https://github.com/grafana/k6/releases/latest/download/k6-v0.50.0-linux-amd64.tar.gz | tar xz
sudo mv k6-v0.50.0-linux-amd64/k6 /usr/local/bin/
k6 version  # verifica que está en PATH
```

Referencia completa: https://grafana.com/docs/k6/latest/set-up/install-k6/

**`pnpm lint` falla con error de ajv**
Es un issue pre-existente del workspace, no específico de este paquete. `pnpm test` sigue siendo el gate de calidad mientras se resuelve.

**`anonymize.mjs` rechaza la ejecución**
Falta la aprobación en `data/manifests/pii-fields.json`. El campo `approvedBy.approvedAt` debe tener un valor no nulo. Esperar review de DBA + legal antes de ejecutar contra datos de producción.

---

## Tests

```bash
pnpm test
```

Suite actual: 7 archivos, 26 tests — cubre transformers, anonymize, token-pool-generator, refresh-tokens, extract-ids, run-baseline y summarize.

---

## Checklist de reproducibilidad

El criterio de salida F1-R es que otro miembro del equipo puede ejecutar este runbook y reproducir el baseline sin asistencia.

- [ ] `.env.perf` configurado con valores recibidos de sysadmins.
- [ ] `data/manifests/pii-fields.json` aprobado por DBA + legal (`approvedBy.approvedAt` no es null).
- [ ] Snapshot anonimizado cargado en RDS perf (verificable con `psql` listando tablas y conteos no-cero).
- [ ] `auth/tokens.local.json` y `auth/test-users.local.json` existen y no están commiteados.
- [ ] `data/data-pool/cases.local.json` no vacío.
- [ ] `pnpm test` pasa con 26 tests.
- [ ] `pnpm run baseline:run runner/catalog/phase1-read.json` completa sin resultados `FAILED`.
- [ ] `summary.md` y `summary.html` generados y commiteados en `docs/perf/baselines/<date>-f1-read/`.
- [ ] `docs/perf/baselines/INDEX.md` actualizado con la nueva entrada del run.

---

## Estructura del paquete

```
packages/kace_cloud_perf/
├── auth/
│   ├── bootstrap-users.sh         # crea users en Cognito y genera test-users.local.json
│   ├── token-pool-generator.mjs   # genera el pool de tokens Cognito (uno por user)
│   └── refresh-tokens.mjs         # refresca tokens caducados en el pool
├── data/
│   ├── anonymizer/                # extract.sh, anonymize.mjs, load.sh, transformers.mjs
│   ├── data-pool/extract-ids.mjs  # extrae IDs reales del entorno perf
│   └── manifests/pii-fields.json  # definición aprobada de campos PII
├── scenarios/
│   ├── cases/                     # escenarios k6: search, view-list, view-by-id, available-states
│   └── _shared/                   # data-pool.js, http.js, thresholds.js
├── runner/
│   ├── run-baseline.mjs           # orquestador de ejecución del baseline
│   └── catalog/phase1-read.json   # catálogo de escenarios F1-R
└── reporter/
    ├── summarize.mjs              # genera summary.md desde el output del run
    └── render-html.mjs            # genera summary.html
```

---

## Próximos pasos (post F1-R)

Los siguientes hitos están detallados en el spec `docs/superpowers/specs/2026-05-05-load-testing-apiv1-baseline-design.md`:

- **F2-R** — Baseline de lectura con carga sostenida (soak test, 60 min).
- **F3-R** — Stress test de lectura: incremento gradual hasta encontrar el punto de quiebre.
- **F4-W** — Baseline de escritura: creación y actualización de casos bajo carga.
- **F5-W** — Stress test de escritura con contención en base de datos.
- **F6-W** — Test de escritura concurrente con múltiples tenants.

---

---

## F2-R — Baseline de los 15 servicios top (lectura)

Especificación: `docs/superpowers/specs/2026-05-07-load-testing-f2-read-design.md`. Plan: `docs/superpowers/plans/2026-05-07-load-testing-f2-read.md`.

### Setup F2-R (una vez)

```bash
# 1. Importar endpoints desde Postman (genera runner/endpoints/<service>.json)
pnpm run endpoints:import

# 2. Generar escenarios k6 desde los catalogs (genera scenarios/<service>/*.js)
pnpm run scenarios:generate

# 3. Extender pool de IDs (auto-discovery via information_schema)
pnpm run data:extract-ids -- --introspect

# 4. Refrescar tokens
pnpm run tokens:refresh

# 5. Verificar tests
pnpm test
```

### Ejecución de F2-R (4 sub-catálogos secuenciales)

```bash
# Sesión 1 — cases (~75-110 min)
pnpm run baseline:run runner/catalog/phase2-read-cases.json

# Sesión 2 — users-config (~60-90 min)
pnpm run baseline:run runner/catalog/phase2-read-users-config.json

# Sesión 3 — classification (~120-180 min, el más largo)
pnpm run baseline:run runner/catalog/phase2-read-classification.json

# Sesión 4 — aggregates (~60-90 min)
pnpm run baseline:run runner/catalog/phase2-read-aggregates.json
```

Cada sub-catálogo:
- Hace pre-flight check (1 request por escenario). Aborta con reporte si hay 403/404.
- Aplica two-tier: si un escenario satura (errRate>5% o p95>4s), re-corre a 10 RPS.
- Skip de escenarios ya completados (resume natural tras Ctrl+C).

### Consolidación

```bash
# Reconstruir metadata.json desde los 4 sub-catálogos
node runner/rebuild-metadata.mjs ../../docs/perf/baselines/<date>-f2-read runner/catalog/phase2-read.json

# Generar reportes
node reporter/summarize.mjs ../../docs/perf/baselines/<date>-f2-read
node reporter/render-html.mjs ../../docs/perf/baselines/<date>-f2-read

# Comparar con F1-R cases (sanity check del framework)
pnpm run compare:f1-vs-f2 ../../docs/perf/baselines/<date>-f2-read
```

### Troubleshooting F2-R

**Pre-flight aborta con `GAPS_FOUND`**
Hay endpoints que devuelven 403/404 con los users perftest. Coordinar con sysadmins:
- 403: revisar roles/permisos del user
- 404: revisar path en `runner/endpoints/<service>.json`

**Pre-flight aborta con `ENV_ERROR`**
5xx sostenidos del entorno perf. Reportar a sysadmins, no es problema del baseline.

**Compare F1-R vs F2-R muestra drift > 20%**
PARAR. No publicar baseline. Diagnóstico: ¿cambió algo en el framework? ¿en el entorno? ¿en el código del servicio?

**Postman data quality issues conocidos**
- `aux-definitions` paths usan `/schema/{id}` (Postman copy-paste bug from schemas folder) — métricas serán mislabeled
- `group-view-by-id-delete` apunta a `/groupstest/{id}/delete` (typo); ya removido del catalog
- `case-count-by-responsable` tiene `{responableId}` (typo "responable") preservado verbatim
- `auxiliaries-search` usa `{entidad}` placeholder no sustituible — removido del catalog
- 9 endpoints `view-by-id-delete` confirmados como soft-delete via Deleter use cases — removidos por seguridad

---

## Convenciones del repo aplicables

- Indentación: 4 espacios.
- Comillas: simples (`'`).
- Punto y coma: requeridos.
- Archivos de test en `test/`.
- Nombres de archivo: `kebab-case.mjs`.
- Sin barrel files (`index.ts` que re-exporta): importar directo desde el módulo específico.
- Sin `console.log` en código de producción (`no-console: error`).

Ver `CLAUDE.md` en la raíz del monorepo para contexto adicional sobre convenciones y arquitectura.
