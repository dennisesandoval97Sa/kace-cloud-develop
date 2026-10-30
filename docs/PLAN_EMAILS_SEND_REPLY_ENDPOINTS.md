# Plan: Nuevos endpoints de emails (send, reply, detail, download)

**Fecha:** 2026-05-22  
**Autor:** Brayan Granada  
**Estado:** En planificación

---

## Contexto

Se van a agregar 4 endpoints a `apps/apiv1/kace_cloud_api_emails` para permitir consultar el detalle enriquecido de un correo, descargarlo en ZIP, enviarlo y responderlo. Los envíos/replies pasan por Channel Hub a través del motor de workflows genérico (`WorkflowExecutor`), igual que el resto de integraciones Channel Hub existentes en la plataforma.

---

## Convenciones del plan

- Todos los campos en **snake_case**.
- El campo del caso se llama **`caso_id`** (alineado con la tabla pivote `interaction_casos` que ya usa esa convención).
- El campo de la interacción se llama **`interaction_id`**.
- Los endpoints de send/reply son **síncronos**: esperan la respuesta de Channel Hub antes de persistir y responder.
- Los flow IDs de Channel Hub para send y reply **no existen aún** — hay que crearlos en `restflowConfig` (DB) y registrarlos en `Behaviors.js`.

---

## Cambios globales necesarios antes de implementar los endpoints

### 1. Registrar nuevos flow IDs en `Behaviors.js`

**Archivo:** `packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js`

Agregar dos entradas dentro del objeto `channel_hub` (línea ~69):

```diff
 channel_hub: {
     create_rules_channel_hub_flow_id: '',
     account_channel_hub_flow_id: '',
+    send_email_channel_hub_flow_id: '',
+    reply_email_channel_hub_flow_id: '',
 },
```

### 2. Crear los flows de Channel Hub como seeds

Los flows se crean vía **seeds**, no migrations (mismo patrón que `seeds/20260324180100_channel_hub_rest_flow.js`, que es el flow de "crear conexión" en Channel Hub).

**Archivos a crear:**

```
packages/kace_cloud_database/seeds/2026XXXX_channel_hub_send_email_flow.js
packages/kace_cloud_database/seeds/2026XXXX_channel_hub_reply_email_flow.js
```

Cada seed inserta filas en tres tablas:

| Tabla | Contenido |
|---|---|
| `ws_rest_endpoints` | Definición HTTP de cada step (auth Cognito + POST a CH). El endpoint de auth (`06cf3374-f17b-4109-8d37-b16584f91a73`) ya existe y se puede reutilizar referenciándolo en `authorization_id`. |
| `ws_rest_flows` | El flow con su `id` (UUID), `external_code` (`channelhub-send-email` / `channelhub-reply-email`), y `json_diagram_properties` |
| `ws_rest_workflow_steps` | El orden de ejecución (auth → envío) |

**Configuración clave del step de envío para que devuelva el `messageId`:**

```js
{
    type: 'consumption',
    url: 'https://api.konecta.cloud/one-channel-hub/.../email/send', // confirmar URL con CH
    method: 'POST',
    headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
    body: JSON.stringify({ body: { /* campos del payload */ } }),
    is_dynamic_body: true,
    authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73', // reuso del auth existente
    filter_input: JSON.stringify({ filter_input: ['messageId', 'threadId'] }), // ← nombres exactos según CH
    context_position: 'channel_hub.send_response', // .reply_response para el reply
    // ...
}
```

`filter_input` define qué campos se retienen de la respuesta de CH; `context_position` define dónde quedan guardados en el contexto del workflow, listos para ser leídos por el use case tras `workflowExecutor.execute(...)`.

**✅ Confirmado con Channel Hub:**

| Dato | Valor |
|---|---|
| URL send | `https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email` (POST) |
| URL reply | `https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/reply` (POST) |
| Campo messageId en respuesta | `messageId` (ambos, send y reply) |
| Campo threadId en respuesta | `threadId` (solo reply — el send no lo devuelve) |
| Flow ID send | `2924b016-fcd3-46c5-8777-22eee73f538c` (seed `20260525100000_channel_hub_send_email_flow.js`) |
| Flow ID reply | `8475ae26-eb15-4d63-a269-526ea78b3891` (seed `20260525100001_channel_hub_reply_email_flow.js`) |

**Después de crear los seeds**, sus IDs (UUID) van también en `Behaviors.js` (ver paso 1) y en la tabla de configuración (`restflowConfig` por tenant) bajo el path:

```
settings.behaviors.configurations.application.agente.channel_hub.send_email_channel_hub_flow_id  = "2924b016-fcd3-46c5-8777-22eee73f538c"
settings.behaviors.configurations.application.agente.channel_hub.reply_email_channel_hub_flow_id = "8475ae26-eb15-4d63-a269-526ea78b3891"
```

### 3. Sobre la tabla `emails` — NO requiere migración

La columna `message_id` (varchar 36) **ya existe** en la tabla `emails` desde la migración `20251216141200_table_emails.js`. Hoy se usa para inbound (mensajes entrantes desde CH); también se aprovechará para outbound (send/reply).

Igualmente, el campo `thread_id` que está añadiendo otro desarrollador llegará en su propia migración — no es responsabilidad de este plan crearlo.

**⚠️ Importante: constraint único existente.** La migración `20260514121000_channel_hub_inbound_email_issue_02_idempotency.js` añadió un constraint único `(workspace_id, message_id)`. Para outbound esto está bien (cada send/reply tendrá su propio `messageId` único que devuelve CH), pero si CH no devuelve `messageId` en algún caso, debemos persistir `NULL` (Postgres trata múltiples `NULL` como distintos, así que no colisionan).

**Sobre el nombre del campo:**
- En la **DB** la columna sigue llamándose `message_id` (no la renombramos).
- En el **API response** del GET la exponemos como `channel_hub_message_id` para claridad al frontend.
- El mapping ocurre en el use case / controller.

---

## Endpoint 1: GET /emails/:id (enriquecido)

### Cambio respecto al comportamiento actual

El `actionRead` actual devuelve solo datos del email (subject, body, attachments). Ahora debe devolver también la interacción asociada y los casos ligados a esa interacción.

### Respuesta esperada

```json
{
  "data": {
    "id": "uuid-email",
    "channel_hub_message_id": "3C51hjoRGcn6Ohv2CY1abZIUfoe",
    "thread_id": "thread-abc-xyz",
    "subject": "Asunto del correo",
    "sender": "brayan@hotmail.com",
    "to": [{ "name": "Dest", "email": "dest@konecta.com" }],
    "cc": [],
    "bcc": [],
    "received_at": "2026-05-22T10:00:00Z",
    "workspace_id": "uuid-workspace",
    "body": {
      "id": "uuid-body",
      "body": "Texto plano",
      "body_html": "<p>HTML del correo</p>"
    },
    "attachments": [
      { "id": "uuid-att", "url": "https://...", "filename": "doc.pdf", "size": 12345 }
    ],
    "interaction": {
      "id": "uuid-interaction",
      "workspace_id": "uuid-workspace",
      "is_closed": false,
      "in_review": true,
      "priority": "media",
      "created_at": "2026-05-22T09:00:00Z"
    },
    "casos": [
      {
        "id": "uuid-caso",
        "external_code": "CASO-0042",
        "reference": "...",
        "created_at": "2026-05-22T09:05:00Z"
      }
    ]
  }
}
```

### Lógica interna

1. Buscar email por `id` (ya existe en `EmailFinder`)
2. Buscar interacción vía `KnexInteractionRepository.findByEmailId(emailId)` (ya existe)
3. Con el `interaction_id` resultante, consultar la tabla pivote `interaction_casos` para obtener los `caso_id`s
4. Buscar cada caso por su ID y extraer `id`, `external_code`, `reference`, `created_at`
5. Componer y devolver la respuesta

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `packages/kace_cloud_core/src/emails/application/find/EmailDetailFinder.js` | Crear — nuevo use case que compone las 3 consultas |
| `apps/apiv1/kace_cloud_api_emails/src/controller.mjs` — `actionRead` | Modificar — reemplazar `EmailFinder` por `EmailDetailFinder` |

---

## Endpoint 2: GET /emails/:id/download

### Descripción

Devuelve una URL presignada de S3 (TTL: 5 minutos) apuntando a un ZIP generado en tiempo real.

El ZIP contiene:
- `metadata.json` — subject, from, to, cc, bcc, received_at, channel_hub_message_id
- `body.html` — el cuerpo HTML del correo

**No incluye los archivos adjuntos binarios** (los adjuntos ya tienen URL propia en la respuesta del endpoint de detalle).

### Respuesta esperada

```json
{
  "data": {
    "download_url": "https://s3.amazonaws.com/bucket/email-downloads/uuid-email/1716379200.zip?X-Amz-..."
  }
}
```

### Lógica interna

1. Leer el email + body de la DB
2. Generar en memoria el ZIP:
   - `metadata.json` con los campos básicos
   - `body.html` con el contenido HTML
3. Subir el ZIP a S3 en la ruta `email-downloads/{email_id}/{timestamp}.zip`
4. Generar URL presignada con TTL de 5 minutos usando el `S3AttachmentStorage` existente
5. Devolver la URL

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `packages/kace_cloud_core/src/emails/application/download/EmailZipGenerator.js` | Crear — use case que genera ZIP y devuelve presigned URL |
| `apps/apiv1/kace_cloud_api_emails/src/ControllerDownload.mjs` | Crear — controller con solo `actionRead` |
| `apps/apiv1/kace_cloud_api_emails/src/handler.mjs` | Modificar — agregar routing para `/emails/{id}/download` |
| `apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts` | Modificar — agregar recurso CDK para `/emails/{id}/download` |

---

## Endpoint 3: POST /emails/send

### Body del request

```json
{
  "caso_id":        "uuid-del-caso",
  "interaction_id": "uuid-de-la-interaccion",
  "from":           "brayan@hotmail.com",
  "to":             ["dest@konecta.com"],
  "cc":             ["cc@gmail.com"],
  "bcc":            ["bcc@konecta.com"],
  "subject":        "Asunto del correo",
  "message_to_send":  "<p>Cuerpo HTML del mensaje</p>",
  "attachments":      ["https://example.com/doc.pdf"]
}
```

Campos obligatorios: `caso_id`, `interaction_id`, `from`, `to`, `subject`, `message_to_send`.

### Respuesta esperada

```json
{
  "data": {
    "id": "uuid-del-email-guardado-en-kace"
  }
}
```

### Payload que se envía a Channel Hub

```json
{
  "connectionId": "<channel_hub_connection_id de channel_hub_accounts>",
  "from":         "brayan@hotmail.com",
  "to":           ["dest@konecta.com"],
  "cc":           ["cc@gmail.com"],
  "bcc":          ["bcc@konecta.com"],
  "subject":      "Asunto del correo",
  "html":         "<p>Cuerpo HTML del mensaje</p>",
  "attachments":  ["https://example.com/doc.pdf"]
}
```

### Lógica interna

1. Validar campos obligatorios
2. Buscar en `channel_hub_accounts` el registro donde `email = from` → obtener `channel_hub_connection_id`
   - Si no existe → responder `422 Unprocessable Entity` con mensaje claro
3. Obtener `workspace_id` de la interacción usando `interaction_id`
4. Obtener `account_id` del registro de `channel_hub_accounts` encontrado en paso 2
5. Construir payload para Channel Hub usando `ChannelHubEmailPayloadBuilder`
6. Ejecutar:
   ```js
   workflowExecutor.execute({
     flow_id: restflowConfig.settings.behaviors.configurations
               .application.agente.channel_hub.send_email_channel_hub_flow_id,
     initial_context: { channel_hub: payload }
   })
   ```
7. Leer respuesta del workflow:
   ```js
   const sendResp = response.toJson()?.data?.context?.channel_hub?.send_response;
   const channelHubMessageId = sendResp?.messageId; // confirmado — CH devuelve "messageId"
   // El send NO devuelve threadId (solo el reply lo devuelve)
   ```
   - Si hay error en la respuesta de Channel Hub → responder `502 Bad Gateway` con detalle
8. Persistir en kace:
   - `emails`: `workspace_id` (de paso 3), `sender = from`, `to`, `cc`, `bcc`, `subject`, `account_id` (de paso 4), `message_id = channelHubMessageId` (columna existente), `thread_id = threadId` (columna que añade otro dev), `received_at = now()`
   - `emails_body`: `email_id`, `body_html = message_to_send`
   - `emails_attachments`: una fila por cada URL en `attachments`
9. Devolver `{ data: { id: email.id } }`

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `packages/kace_cloud_core/src/emails/application/send/EmailSender.js` | Crear — use case principal |
| `packages/kace_cloud_core/src/emails/infrastructure/mappers/ChannelHubEmailPayloadBuilder.js` | Crear — mapper DTO → payload Channel Hub |
| `apps/apiv1/kace_cloud_api_emails/src/ControllerSend.mjs` | Crear — controller con `actionCreate` |
| `apps/apiv1/kace_cloud_api_emails/src/handler.mjs` | Modificar — agregar routing para `/emails/send` |
| `apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts` | Modificar — agregar recurso CDK para `/emails/send` |
| `packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js` | Modificar — agregar `send_email_channel_hub_flow_id` |

---

## Endpoint 4: POST /emails/reply

### Body del request

```json
{
  "caso_id":               "uuid-del-caso",
  "interaction_id":        "uuid-de-la-interaccion",
  "from":                  "brayan@hotmail.com",
  "in_reply_to":           "3C51hjoRGcn6Ohv2CY1abZIUfoe",
  "reply_message_to_send": "<p>Hola, esto es una respuesta formando un hilo.</p>",
  "is_reply_all":          true,
  "attachments":           ["https://example.com/image.jpg"]
}
```

Campos obligatorios: `caso_id`, `interaction_id`, `from`, `in_reply_to`, `reply_message_to_send`, `is_reply_all`.

### Respuesta esperada

```json
{
  "data": {
    "id": "uuid-del-email-guardado-en-kace"
  }
}
```

### Payload que se envía a Channel Hub

```json
{
  "connectionId":        "<channel_hub_connection_id de channel_hub_accounts>",
  "from":                "brayan@hotmail.com",
  "response_message_id": "3C51hjoRGcn6Ohv2CY1abZIUfoe",
  "replyMessage":        "<p>Hola, esto es una respuesta formando un hilo.</p>",
  "is_reply_all":        true,
  "attachments":         ["https://example.com/image.jpg"]
}
```

> `response_message_id` aquí es el campo que espera Channel Hub en su API — es el mismo valor que llega en `in_reply_to` del request de nuestra API.
```

### Lógica interna

1. Validar campos obligatorios
2. Buscar en `channel_hub_accounts` donde `email = from` → obtener `channel_hub_connection_id`
   - Si no existe → responder `422 Unprocessable Entity`
3. Obtener `workspace_id` de la interacción usando `interaction_id`
4. Obtener `account_id` del registro de `channel_hub_accounts`
5. Construir payload para Channel Hub (usando el mismo `ChannelHubEmailPayloadBuilder` del endpoint de send, rama reply)
6. Ejecutar:
   ```js
   workflowExecutor.execute({
     flow_id: restflowConfig.settings.behaviors.configurations
               .application.agente.channel_hub.reply_email_channel_hub_flow_id,
     initial_context: { channel_hub: payload }
   })
   ```
7. Leer respuesta del workflow:
   ```js
   const replyResp = response.toJson()?.data?.context?.channel_hub?.reply_response;
   const channelHubMessageId = replyResp?.messageId; // confirmado — CH devuelve "messageId"
   const threadId = replyResp?.threadId;             // confirmado — solo el reply devuelve "threadId"
   ```
   - Si hay error → `502 Bad Gateway`
8. Persistir en kace (igual que send):
   - `emails`: `workspace_id`, `sender = from`, `subject = null` (es un reply, no tiene subject propio), `account_id`, `message_id = channelHubMessageId`, `thread_id = threadId`, `received_at = now()`
   - `emails_body`: `body_html = reply_message_to_send`
   - `emails_attachments`: una fila por URL
9. Devolver `{ data: { id: email.id } }`

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `packages/kace_cloud_core/src/emails/application/reply/EmailReplier.js` | Crear — use case principal |
| `packages/kace_cloud_core/src/emails/infrastructure/mappers/ChannelHubEmailPayloadBuilder.js` | Modificar — agregar método para payload de reply |
| `apps/apiv1/kace_cloud_api_emails/src/ControllerReply.mjs` | Crear — controller con `actionCreate` |
| `apps/apiv1/kace_cloud_api_emails/src/handler.mjs` | Modificar — agregar routing para `/emails/reply` |
| `apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts` | Modificar — agregar recurso CDK para `/emails/reply` |
| `packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js` | Modificar — agregar `reply_email_channel_hub_flow_id` |

---

## Resumen: todos los archivos del proyecto

### Crear (nuevos)

```
packages/kace_cloud_core/src/emails/application/find/EmailDetailFinder.js
packages/kace_cloud_core/src/emails/application/send/EmailSender.js
packages/kace_cloud_core/src/emails/application/reply/EmailReplier.js
packages/kace_cloud_core/src/emails/application/download/EmailZipGenerator.js
packages/kace_cloud_core/src/emails/infrastructure/mappers/ChannelHubEmailPayloadBuilder.js

apps/apiv1/kace_cloud_api_emails/src/ControllerSend.mjs
apps/apiv1/kace_cloud_api_emails/src/ControllerReply.mjs
apps/apiv1/kace_cloud_api_emails/src/ControllerDownload.mjs

packages/kace_cloud_database/seeds/2026XXXX_channel_hub_send_email_flow.js
packages/kace_cloud_database/seeds/2026XXXX_channel_hub_reply_email_flow.js
```

### Modificar (existentes)

```
packages/kace_cloud_core/src/global-config/domain/settings/Behaviors.js
  → agregar send_email_channel_hub_flow_id y reply_email_channel_hub_flow_id en channel_hub

apps/apiv1/kace_cloud_api_emails/src/controller.mjs
  → actionRead ahora usa EmailDetailFinder en lugar de EmailFinder

apps/apiv1/kace_cloud_api_emails/src/handler.mjs
  → agregar routing por event.resource para /send, /reply, /{id}/download

apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts
  → agregar 3 nuevos recursos CDK (send, reply, {id}/download)
```

### Configuración en DB (por tenant)

```
global_configurations → settings.behaviors.configurations.application.agente.channel_hub
  → send_email_channel_hub_flow_id:  "2924b016-fcd3-46c5-8777-22eee73f538c"
  → reply_email_channel_hub_flow_id: "8475ae26-eb15-4d63-a269-526ea78b3891"
```

> Estos UUIDs son los `id` de las filas `ws_rest_flows` insertadas por `20260525100000_channel_hub_send_email_flow.js` y `20260525100001_channel_hub_reply_email_flow.js`.

---

## Orden de implementación sugerido

1. ~~**Confirmar con el equipo de Channel Hub**~~ ✅ Confirmado — ver tabla de datos arriba.
2. ~~**Seeds de los flows**~~ ✅ Creados: `20260525100000_channel_hub_send_email_flow.js` y `20260525100001_channel_hub_reply_email_flow.js`.
3. **`Behaviors.js`** — agregar las dos entradas `send_email_channel_hub_flow_id` y `reply_email_channel_hub_flow_id`.
4. **Configuración en DB por tenant** — poblar los flow IDs en `global_configurations` bajo `settings.behaviors.configurations.application.agente.channel_hub`.
5. **`ChannelHubEmailPayloadBuilder.js`** — mapper compartido por send y reply.
6. **`EmailSender.js`** + **`ControllerSend.mjs`** — endpoint más representativo, validar el patrón con `workflowExecutor` y la lectura de `channel_hub.send_response.messageId`.
7. **`EmailReplier.js`** + **`ControllerReply.mjs`** — casi idéntico a send, reutiliza el builder.
8. **`EmailDetailFinder.js`** + ajuste de `actionRead` — enriquecer el GET existente, exponer `channel_hub_message_id` y `thread_id` desde la columna DB `message_id` / `thread_id`.
9. **`EmailZipGenerator.js`** + **`ControllerDownload.mjs`** — el más independiente, puede hacerse último.
10. **`handler.mjs`** + **`emails-stack.ts`** — wiring final, habilitar rutas y CDK.

---

## Notas de implementación

### Cómo obtener el `workspace_id` desde la interacción

```js
const interaction = await interactionRepository.findById(interaction_id);
const workspace_id = interaction.workspace_id.value;
```

### Cómo obtener el `connectionId` desde `channel_hub_accounts`

```js
const account = await channelHubAccountRepository.findByEmail(from);
if (!account) throw new CustomError('No Channel Hub account found for this from address', 422);
const connectionId = account.channel_hub_connection_id.value;
```

### Patrón de llamada a WorkflowExecutor (igual que ChannelHubAccountRegistrar)

```js
const initial_context = {
  channel_hub: {
    connectionId,
    from,
    ...restOfPayload
  }
};

const response = await this.#workflowExecutor.execute({ flow_id, initial_context });

// El nombre del subobjeto (send_response, reply_response) coincide con el
// context_position que se definió en el step del flow al crear el seed.
const sendResponse = response.toJson()?.data?.context?.channel_hub?.send_response;

const channelHubMessageId = sendResponse?.messageId; // confirmar nombre exacto con CH
const threadId            = sendResponse?.threadId;  // confirmar nombre exacto con CH

if (!channelHubMessageId) {
    throw new CustomError('Channel Hub did not return a messageId', 502);
}
```

### Campos de `emails` al persistir un correo enviado

| Campo | Valor |
|---|---|
| `id` | UUID nuevo |
| `workspace_id` | de la interacción |
| `sender` | `from` del request |
| `to` | array del request |
| `cc` | array del request (puede ser vacío) |
| `bcc` | array del request (puede ser vacío) |
| `subject` | del request (null en reply) |
| `account_id` | ID del registro en `channel_hub_accounts` |
| `message_id` | `channelHubMessageId` leído del send_response/reply_response de CH (columna DB se llama `message_id`; se expone como `channel_hub_message_id` en el API) |
| `thread_id` | `threadId` leído del send_response/reply_response de CH (columna añadida por otro dev) |
| `received_at` | `now()` (momento del envío) |
| `created_at` | `now()` |
| `created_by` | `user.id` |
