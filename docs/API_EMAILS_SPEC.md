# API de Emails — Especificación de consumo

**Versión:** 1.0  
**Estado:** En desarrollo — disponible próximamente  
**Base URL (cloudtest):** `https://correos-api.kace-cloudtest.com`

---

## Autenticación y headers requeridos

Todos los endpoints requieren los siguientes headers:

| Header | Valor | Obligatorio |
|---|---|---|
| `Authorization` | JWT `id_token` de Cognito | Sí |
| `X-Tenant-Id` | ID del tenant | Sí |
| `Content-Type` | `application/json` (solo en POST) | Sí en POST |

---

## Endpoints

---

### 1. Detalle de un correo

```
GET https://correos-api.kace-cloudtest.com/emails/{id}
```

Devuelve la información completa del correo: datos del mensaje, interacción asociada y casos ligados a esa interacción.

#### Path parameters

| Parámetro | Tipo | Descripción |
|---|---|---|
| `id` | UUID | ID del email en kace |

#### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "channel_hub_message_id": "3C51hjoRGcn6Ohv2CY1abZIUfoe",
    "thread_id": "thread-abc-xyz",
    "subject": "Asunto del correo",
    "sender": "brayan@hotmail.com",
    "to": [
      { "name": "Destinatario", "email": "dest@konecta.com" }
    ],
    "cc": [
      { "name": "Copia", "email": "cc@gmail.com" }
    ],
    "bcc": [],
    "received_at": "2026-05-22T10:00:00.000Z",
    "workspace_id": "uuid-workspace",
    "body": {
      "id": "uuid-body",
      "body": "Texto plano del correo",
      "body_html": "<p>HTML del correo</p>"
    },
    "attachments": [
      {
        "id": "uuid-attachment",
        "url": "https://s3.amazonaws.com/bucket/archivo.pdf",
        "filename": "archivo.pdf",
        "size": 204800
      }
    ],
    "interaction": {
      "id": "uuid-interaction",
      "workspace_id": "uuid-workspace",
      "is_closed": false,
      "in_review": true,
      "priority": "media",
      "created_at": "2026-05-22T09:00:00.000Z"
    },
    "casos": [
      {
        "id": "uuid-caso",
        "external_code": "CASO-0042",
        "reference": "REF-001",
        "created_at": "2026-05-22T09:05:00.000Z"
      }
    ]
  }
}
```

#### Errores posibles

| Código | Motivo |
|---|---|
| `400` | ID inválido |
| `403` | Sin permisos |
| `404` | Email no encontrado |
| `500` | Error interno |

---

### 2. Descargar correo en ZIP

```
GET https://correos-api.kace-cloudtest.com/emails/{id}/download
```

Genera y devuelve una URL presignada de S3 para descargar el correo como archivo ZIP. La URL expira a los **5 minutos**.

El ZIP contiene:
- `metadata.json` — asunto, remitente, destinatarios, fecha
- `body.html` — cuerpo HTML del correo

> Los archivos adjuntos del correo **no se incluyen** dentro del ZIP. Para descargarlos usar las URLs del campo `attachments` del endpoint de detalle.

#### Path parameters

| Parámetro | Tipo | Descripción |
|---|---|---|
| `id` | UUID | ID del email en kace |

#### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "download_url": "https://s3.amazonaws.com/bucket/email-downloads/uuid-email/1716379200.zip?X-Amz-Algorithm=..."
  }
}
```

#### Errores posibles

| Código | Motivo |
|---|---|
| `400` | ID inválido |
| `403` | Sin permisos |
| `404` | Email no encontrado |
| `500` | Error interno |

---

### 3. Enviar un correo

```
POST https://correos-api.kace-cloudtest.com/emails/send
```

Envía un correo nuevo a través de Channel Hub. Una vez enviado, el correo queda registrado en kace y se devuelve su ID para futuras consultas.

#### Body

```json
{
  "caso_id":          "uuid-del-caso",
  "interaction_id":   "uuid-de-la-interaccion",
  "from":             "brayan@hotmail.com",
  "to":               ["dest@konecta.com"],
  "cc":               ["cc@gmail.com"],
  "bcc":              ["bcc@konecta.com"],
  "subject":          "Asunto del correo",
  "message_to_send":  "<p>Cuerpo HTML del mensaje</p>",
  "attachments":      [
    "https://scielo.conicyt.cl/pdf/rchnut/v44n2/art06.pdf",
    "https://example.com/imagen.png"
  ]
}
```

#### Campos del body

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `caso_id` | UUID | Sí | ID del caso asociado |
| `interaction_id` | UUID | Sí | ID de la interacción asociada |
| `from` | string (email) | Sí | Dirección remitente — debe existir como cuenta en Channel Hub |
| `to` | string[] | Sí | Lista de destinatarios |
| `cc` | string[] | No | Copia |
| `bcc` | string[] | No | Copia oculta |
| `subject` | string | Sí | Asunto del correo |
| `message_to_send` | string (HTML) | Sí | Cuerpo del correo en HTML |
| `attachments` | string[] | No | URLs públicas de los archivos a adjuntar |

#### Respuesta exitosa `201 Created`

```json
{
  "data": {
    "id": "uuid-del-email-registrado-en-kace"
  }
}
```

Con este `id` se puede consultar el correo enviado usando `GET /emails/{id}`.

#### Errores posibles

| Código | Motivo |
|---|---|
| `400` | Validación fallida (campo obligatorio faltante o formato inválido) |
| `403` | Sin permisos |
| `422` | El `from` no tiene cuenta activa en Channel Hub |
| `502` | Channel Hub rechazó el envío |
| `500` | Error interno |

---

### 4. Responder un correo (reply)

```
POST https://correos-api.kace-cloudtest.com/emails/reply
```

Responde a un correo existente formando un hilo. Una vez enviado, el reply queda registrado en kace y se devuelve su ID.

#### Body

```json
{
  "caso_id":               "uuid-del-caso",
  "interaction_id":        "uuid-de-la-interaccion",
  "from":                  "brayan@hotmail.com",
  "in_reply_to":           "3C51hjoRGcn6Ohv2CY1abZIUfoe",
  "reply_message_to_send": "<p>Hola, esto es una respuesta formando un hilo.</p>",
  "is_reply_all":          true,
  "attachments":           [
    "https://example.com/imagen.jpg"
  ]
}
```

#### Campos del body

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `caso_id` | UUID | Sí | ID del caso asociado |
| `interaction_id` | UUID | Sí | ID de la interacción asociada |
| `from` | string (email) | Sí | Dirección remitente — debe existir como cuenta en Channel Hub |
| `in_reply_to` | string | Sí | `channel_hub_message_id` del correo al que se responde — viene del campo `channel_hub_message_id` de `GET /emails/{id}`, **no** es el campo `id` (UUID de kace) |
| `reply_message_to_send` | string (HTML) | Sí | Cuerpo del reply en HTML |
| `is_reply_all` | boolean | Sí | `true` para responder a todos, `false` para responder solo al remitente |
| `attachments` | string[] | No | URLs públicas de archivos a adjuntar |

#### Respuesta exitosa `201 Created`

```json
{
  "data": {
    "id": "uuid-del-reply-registrado-en-kace"
  }
}
```

Con este `id` se puede consultar el reply usando `GET /emails/{id}`.

#### Errores posibles

| Código | Motivo |
|---|---|
| `400` | Validación fallida |
| `403` | Sin permisos |
| `422` | El `from` no tiene cuenta activa en Channel Hub |
| `502` | Channel Hub rechazó el envío |
| `500` | Error interno |

---

## Flujo típico de uso

```
1. Abrir un correo entrante
   → GET https://correos-api.kace-cloudtest.com/emails/{id}
   → Obtener: body_html, attachments[], interaction.id, casos[].id, casos[].external_code

2. Descargar el correo como ZIP
   → GET https://correos-api.kace-cloudtest.com/emails/{id}/download
   → Obtener: download_url (válida 5 min) → hacer redirect o fetch directo a esa URL

3. Responder el correo
   → POST https://correos-api.kace-cloudtest.com/emails/reply
     body.in_reply_to      = channel_hub_message_id del correo original (campo del GET)
     body.interaction_id   = interaction.id del GET
     body.caso_id          = casos[0].id del GET
   → Obtener: id del reply guardado en kace

4. Consultar el reply enviado
   → GET https://correos-api.kace-cloudtest.com/emails/{reply_id}
```

---

## Notas importantes

- El `from` en send y reply debe corresponder a una cuenta registrada en Channel Hub. Si no existe, la API responde `422`.
- `message_to_send` y `reply_message_to_send` aceptan HTML. Se recomienda enviar HTML para mantener el formato al mostrarlo.
- `in_reply_to` en el reply es el campo `channel_hub_message_id` que devuelve `GET /emails/{id}` — **no** es el campo `id` (UUID interno de kace).
- Las URLs en `attachments` deben ser públicamente accesibles al momento del envío, ya que Channel Hub las descarga directamente.
- La URL `download_url` del endpoint de descarga expira a los 5 minutos. Si expira, volver a llamar el endpoint para obtener una nueva.
