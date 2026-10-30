# Migracion de Emails via KACE API

El script `scripts/migrate-emails-via-kace-api.mjs` importa correos historicos hacia KACE usando las APIs publicas de emails.

Usa `POST /emails`, no `POST /emails/send`.

Esto es importante porque:

- `POST /emails` crea registros historicos de email.
- `POST /emails/send` envia correos reales por Channel Hub.

Por defecto el script corre en modo `dry-run`, asi que no crea datos hasta que se indique explicitamente `KACE_DRY_RUN=false` o `--no-dry-run`.

## Uso Basico

```bash
KACE_API_URL="https://staging-api.kace-cloudtest.com" \
KACE_TENANT_ID="tenant-id" \
KACE_AUTH_TOKEN="id-token-value" \
KACE_INPUT_FILE="./legacy-emails.json" \
KACE_DRY_RUN=false \
node scripts/migrate-emails-via-kace-api.mjs
```

Tambien se puede ejecutar con flags:

```bash
node scripts/migrate-emails-via-kace-api.mjs \
  --api-url "https://staging-api.kace-cloudtest.com" \
  --tenant-id "tenant-id" \
  --token "id-token-value" \
  --input "./legacy-emails.json" \
  --no-dry-run
```

## Modo Child Process por Email

Para integraciones que ejecutan el script con `child_process`, usa `--stdin`.

En este modo el script:

- Lee exactamente un objeto JSON desde `stdin`.
- Procesa un solo Email.
- Escribe exactamente un objeto JSON en `stdout`.
- Escribe errores humanos o stack traces en `stderr`.
- No escribe el archivo de resultados batch.
- Usa estado en memoria por defecto para evitar colisiones entre procesos paralelos.
- Solo escribe `KACE_STATE_FILE` si se pasa explicitamente `--state` o la variable `KACE_STATE_FILE`.

Si ejecutas varios procesos en paralelo, no compartas el mismo `--state` entre ellos. Usa estado en memoria o un state file unico por Email.

Ejemplo con `child_process`:

```js
import { spawn } from 'node:child_process';

const child = spawn('node', ['scripts/migrate-emails-via-kace-api.mjs', '--stdin', '--no-dry-run'], {
  env: {
    ...process.env,
    KACE_API_URL: 'https://staging-api.kace-cloudtest.com',
    KACE_TENANT_ID: 'tenant-id',
    KACE_AUTH_TOKEN: 'id-token-value',
  },
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (chunk) => {
  stdout += chunk;
});

child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

child.stdin.end(JSON.stringify(emailRecord));

child.on('close', (code) => {
  const result = JSON.parse(stdout);

  if (code !== 0 || result.status === 'failed') {
    throw new Error(result.error?.message || stderr || 'Email import failed');
  }

  console.log(result.email_id);
});
```

Salida exitosa:

```json
{
  "status": "created",
  "legacy_email_id": "legacy-123",
  "email_id": "email-uuid",
  "message_id": "legacy-provider-message-id",
  "warnings": [],
  "external_body_uploads": []
}
```

Si el Email ya existe y `KACE_SKIP_EXISTING_SEARCH=true`, la salida usa el ID encontrado:

```json
{
  "status": "skipped_existing",
  "legacy_email_id": "legacy-123",
  "email_id": "existing-email-uuid",
  "message_id": "legacy-provider-message-id",
  "warnings": [],
  "external_body_uploads": []
}
```

Salida fallida:

```json
{
  "status": "failed",
  "legacy_email_id": "legacy-123",
  "email_id": null,
  "message_id": "legacy-provider-message-id",
  "warnings": [],
  "external_body_uploads": [],
  "error": {
    "message": "sender_email/sender/from is required."
  }
}
```

El proceso retorna codigo `0` para `created`, `skipped_existing` y `dry_run`. Retorna codigo distinto de `0` cuando el resultado es `failed`.

En modo `dry_run`, el `email_id` de salida es solo el ID preparado localmente; no representa un Email persistido.

## Formato de Entrada

El archivo de entrada puede ser:

- Un JSON array.
- Un archivo JSONL, un objeto JSON por linea.

Ejemplo JSON:

```json
[
  {
    "legacy_email_id": "legacy-123",
    "workspace_id": "workspace-uuid",
    "sender_email": "customer@example.com",
    "to": ["support@example.com"],
    "subject": "Legacy subject",
    "message_id": "legacy-provider-message-id",
    "received_at": "2026-01-01T10:00:00.000Z",
    "body_text": "Plain text body",
    "body_html": "<p>Optional full html body</p>",
    "attachments": [
      {
        "url": "https://example.com/file.pdf",
        "size": 12345,
        "filename": "file.pdf"
      }
    ]
  }
]
```

Campos minimos recomendados:

```json
{
  "legacy_email_id": "legacy-123",
  "workspace_id": "workspace-uuid",
  "sender_email": "customer@example.com",
  "to": ["support@example.com"],
  "subject": "Legacy subject",
  "message_id": "legacy-message-id",
  "received_at": "2026-01-01T10:00:00.000Z",
  "body_text": "Email body"
}
```

## Variables de Entorno

| Variable | Default | Descripcion |
|---|---:|---|
| `KACE_API_URL` | `https://staging-api.kace-cloudtest.com` | URL base de la API KACE. |
| `KACE_TENANT_ID` | requerido en import | Tenant destino. Se envia como `X-Tenant-ID`. |
| `KACE_AUTH_TOKEN` | requerido en import | Token de autorizacion. Se envia como `Authorization`. |
| `KACE_INPUT_FILE` | `./legacy-emails.json` | Archivo fuente JSON o JSONL. |
| `KACE_RESULT_FILE` | `./tmp/kace-email-api-migration-results.json` | Reporte final de migracion. |
| `KACE_STATE_FILE` | `${KACE_RESULT_FILE}.state.json` | Estado persistente para retries e IDs estables. En `--stdin`, solo se usa si se define explicitamente. |
| `KACE_DRY_RUN` | `true` | Si esta en `true`, no llama APIs de escritura. |
| `KACE_CONCURRENCY` | `2` | Cantidad de emails procesados en paralelo. |
| `KACE_MAX_RETRIES` | `3` | Reintentos para errores transitorios. |
| `KACE_RETRY_DELAY_MS` | `500` | Delay base entre reintentos. |
| `KACE_WORKSPACE_ID` | vacio | Workspace por defecto si el registro no trae `workspace_id`. |
| `KACE_FINGERPRINT` | `email-api-migration` | Valor enviado en `X-Client-Fingerprint`. |
| `KACE_MAX_INLINE_HTML_BYTES` | `921600` | Tamano maximo de HTML inline antes de subirlo a S3. |
| `KACE_SKIP_EXISTING_SEARCH` | `true` | Busca emails existentes por `workspace_id` + `message_id` antes de crear. |
| `KACE_IMPORT_ATTACHMENTS` | `false` | Incluye adjuntos si tienen URL descargable. |
| `KACE_FORCE_EXTERNAL_BODIES` | `false` | Fuerza subida externa de body text/html aunque puedan ir inline. |

## Flags Soportados

```text
--input <path>
--results <path>
--state <path>
--api-url <url>
--tenant-id <id>
--token <token>
--fingerprint <value>
--workspace-id <uuid>
--concurrency <n>
--retries <n>
--retry-delay-ms <ms>
--dry-run
--no-dry-run
--stdin
--help
```

## Comportamiento de Importacion

Por cada registro, el script:

1. Normaliza el payload esperado por `POST /emails`.
2. Genera IDs estables para email, body y attachments.
3. Trunca campos que exceden limites conocidos.
4. Busca un email existente con el mismo `workspace_id` y `message_id`, si `KACE_SKIP_EXISTING_SEARCH=true`.
5. Sube bodies grandes a traves de `/upload-s3-files`.
6. Crea el email con `POST /emails`.
7. Usa el `id` devuelto por la API como ID creado definitivo.
8. Escribe resultado y estado en archivos JSON.

`POST /emails` acepta el UUID estable enviado por el script despues de validar colisiones. Esto es necesario porque los bodies externos se suben antes de crear el email bajo el prefijo `email-bodies/{email_id}/`.

## Manejo de Bodies

La API limita `body.body` a 5000 caracteres. Por eso el script siempre manda ahi un preview.

Reglas:

- `body_text` mayor a 5000 caracteres se sube externamente y se referencia como `body.text.s3_url`.
- `body_html` mayor a `KACE_MAX_INLINE_HTML_BYTES` se sube externamente y se referencia como `body.html.s3_url`.
- Los objetos externos deben quedar bajo `email-bodies/{email_id}/`, donde `email_id` es el UUID estable que se envia en `POST /emails`.
- Si no hay texto pero hay HTML, genera texto plano removiendo tags.
- Si el body queda vacio, usa un espacio `" "` para cumplir validacion.
- Con `KACE_FORCE_EXTERNAL_BODIES=true`, fuerza la subida externa de texto y HTML.

## Adjuntos

Los adjuntos se ignoran por defecto.

Para incluirlos:

```bash
KACE_IMPORT_ATTACHMENTS=true
```

Cada adjunto debe tener una URL absoluta que la API pueda descargar y escanear.
La API descarga esa URL, sube una copia durable a S3, escanea el archivo y persiste la URL S3 resultante en `emails_attachments`.

Ejemplo:

```json
{
  "attachments": [
    {
      "url": "https://example.com/file.pdf",
      "size": 12345,
      "filename": "file.pdf"
    }
  ]
}
```

## Deduplicacion

Cuando `KACE_SKIP_EXISTING_SEARCH=true`, antes de crear un email el script llama `POST /emails/search` con:

- `emails.workspace_id = workspace_id`
- `emails.message_id = message_id`

Si encuentra un registro existente, marca el resultado como `skipped_existing`.

## Archivos de Salida

El archivo de resultados contiene:

```json
{
  "generated_at": "2026-06-22T00:00:00.000Z",
  "dry_run": false,
  "input_file": "./legacy-emails.json",
  "summary": {
    "total": 10,
    "created": 8,
    "skipped_existing": 1,
    "dry_run": 0,
    "failed": 1
  },
  "results": []
}
```

El archivo de estado guarda IDs generados y uploads externos para que una re-ejecucion sea estable y pueda reutilizar uploads ya hechos.

## Codigos de Resultado

| Status | Significado |
|---|---|
| `dry_run` | Payload preparado, pero no se llamo la API de creacion. |
| `created` | Email creado correctamente. |
| `skipped_existing` | Ya existia un email con mismo `workspace_id` y `message_id`. |
| `failed` | El registro fallo; el error queda en el reporte. |

## Limitaciones Importantes

- `created_at` y `created_by` son sobrescritos por el controller de la API.
- `account_id` puede enviarse como ID de Channel Hub Account. Si se omite, la API lo resuelve desde los destinatarios (`to`, `cc`, `bcc`) solo cuando exactamente un Channel Hub Account coincide.
- `thread_id` no se puede setear con este endpoint; si viene en el input, se omite y se agrega warning.
- Los adjuntos solo se migran como URLs descargables, no como archivos locales.
- `subject` se trunca a 120 caracteres.
- `sender_email` no puede exceder 120 caracteres.
- `message_id` no puede exceder 255 caracteres.

## Flujo Recomendado

Primero validar sin escribir:

```bash
KACE_INPUT_FILE="./legacy-emails.json" \
KACE_DRY_RUN=true \
node scripts/migrate-emails-via-kace-api.mjs
```

Luego revisar:

```bash
cat ./tmp/kace-email-api-migration-results.json
```

Finalmente importar:

```bash
KACE_API_URL="https://staging-api.kace-cloudtest.com" \
KACE_TENANT_ID="tenant-id" \
KACE_AUTH_TOKEN="id-token-value" \
KACE_INPUT_FILE="./legacy-emails.json" \
KACE_DRY_RUN=false \
node scripts/migrate-emails-via-kace-api.mjs
```
