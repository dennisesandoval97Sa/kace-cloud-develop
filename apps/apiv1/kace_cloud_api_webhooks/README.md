# @kace/api-webhooks

Microservicio Lambda que expone endpoints HTTP para recibir webhooks entrantes desde sistemas externos hacia KACE Cloud. Forma parte del monorepo bajo `apps/apiv1/`.

## Tabla de contenido

- [Descripción](#descripción)
- [Arquitectura](#arquitectura)
- [Endpoints](#endpoints)
- [Autenticación (API Key)](#autenticación-api-key)
- [Cómo obtener el API Key](#cómo-obtener-el-api-key)
- [Throttling y cuotas](#throttling-y-cuotas)
- [Variables de entorno](#variables-de-entorno)
- [Desarrollo local](#desarrollo-local)
- [Pruebas](#pruebas)
- [Despliegue](#despliegue)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Pendientes (TODO)](#pendientes-todo)

## Descripción

Este servicio recibe eventos webhook desde proveedores externos (por ejemplo, Channel Hub) y los enruta hacia la lógica de negocio en `@kace/core`. A diferencia del resto de microservicios de `apps/apiv1/`, los endpoints **no se autentican vía Cognito** sino mediante **API Keys de API Gateway** asociadas a un Usage Plan.

Características principales:

- API Gateway + Lambda (Node.js 22+).
- Sin autenticación Cognito (`enableAuth = false`).
- Protegido con `apiKeyRequired: true` por método.
- Validación de payloads con Joi.
- Multi-tenant: cada invocación pasa por `withTenantContext` de `@kace/api-common`.

## Arquitectura

```
External Provider
        │
        ▼
API Gateway (REST)
  └── /webhooks/channel-hub  [POST, x-api-key requerido]
        │
        ▼
Lambda Handler (handler.mjs)
  └── withTenantContext()  →  Controller (controller.mjs)
                                  └── Joi validation (schemas.mjs)
                                  └── @kace/core use cases  (TODO)
```

El stack CDK (`lib/webhooks-stack.ts`) extiende `KApiStack` y crea:

- `LambdaRestApi` con base path `webhooks`.
- Recurso `/channel-hub` con método `POST` que requiere API Key.
- `ApiKey` lógico `ChannelHubApiKey` con nombre `${appsServiceName}-webhooks-channel-hub`.
- `UsagePlan` `WebhooksUsagePlan` que asocia la API Key al stage desplegado.
- Asociación a WAF (heredada de `KApiStack`).
- Permisos a DynamoDB para resolución de tenant.

## Endpoints

Base path: `/webhooks`

| Método | Ruta            | API Key | Descripción                                     |
| ------ | --------------- | ------- | ----------------------------------------------- |
| POST   | `/channel-hub`  | Sí      | Recepción de eventos del integrador Channel Hub |

> Channel Hub registration callback: new or updated Channel Hub email accounts must use
> `${tenant.apiUrl()}/webhooks/channel-hub` as `redirectionMessageWebhook`. The old
> `/interactions/webhook` endpoint is legacy compatibility only and should remain in place
> until production logs and Channel Hub account configuration confirm no active traffic depends on it.

### Ejemplo de request

```bash
curl -X POST "https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/webhooks/channel-hub" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY_VALUE>" \
  -d '{
    "messageId": "provider-message-id",
    "origin": "customer@example.com",
    "connectionId": "conn_support",
    "tag": "ATENCION CLIENTES",
    "destination": {
      "to": "",
      "cc": "",
      "bcc": "support@example.com"
    },
    "content": {
      "text": "https://channel-hub-cdn.example.com/messages/provider-message-id.txt"
    }
  }'
```

Para un correo recibido únicamente por copia oculta, Channel Hub envía `to` y `cc` como cadenas vacías y
ubica en `bcc` la dirección inferida del buzón receptor. Al menos uno de los campos `to`, `cc` o `bcc` debe
contener un destinatario válido. En ese caso KACE copia el destinatario inferido de `bcc` a `to` para el
enrutamiento y la persistencia, y conserva también el valor original en `bcc`.

### Respuestas

- `200 OK` – Webhook recibido y validado.
- `400 Bad Request` – Falla de validación Joi.
- `403 Forbidden` – API Key faltante o inválida (manejado por API Gateway).
- `404 Not Found` – Recurso webhook desconocido.
- `429 Too Many Requests` – Excede el throttling o quota del Usage Plan.
- `500 Internal Server Error` – Error no controlado.

Las validaciones semánticas que Channel Hub necesita interpretar exponen `code` y `message` también en el
nivel superior de la respuesta, además del sobre estructurado de errores de KACE:

| HTTP | `code` | Descripción |
| ---- | ------ | ----------- |
| 400 | `SUBJECT_FORBIDDEN_WORD` | El asunto contiene una palabra prohibida, incluido el aviso automático de Gmail con `delay`. |
| 400 | `SUBJECT_TOO_LONG` | El asunto excede 500 caracteres; el mensaje incluye la longitud recibida. |
| 400 | `RECIPIENT_INVALID` | La dirección de destino no es SMTP válida. |
| 400 | `SENDER_INVALID` | El remitente no es SMTP válido o corresponde a una dirección X.500/`IMCEAEX`. |
| 400 | `BODY_TOO_LARGE` | El cuerpo excede 10.485.760 bytes; el mensaje incluye el tamaño recibido. |
| 422 | `ATTACHMENT_ENCRYPTED` | El antivirus no puede inspeccionar un PDF cifrado; el mensaje incluye el nombre del archivo. |

## Autenticación (API Key)

Cada endpoint protegido exige el header HTTP:

```
x-api-key: <valor-de-la-key>
```

La validación la realiza API Gateway antes de invocar la Lambda; si falta o es inválida, la Lambda **no se ejecuta**.

> El stack define explícitamente `this.config.enableAuth = false`. La seguridad recae **únicamente** en la API Key + Usage Plan + WAF.

## Cómo obtener el API Key

El valor de la key lo genera AWS al desplegar el stack y **no se imprime en outputs ni se almacena en el código**. Hay dos formas de obtenerla:

### 1. AWS Console

API Gateway → **API Keys** → busca `<appsServiceName>-webhooks-channel-hub` → botón **Show** en la columna *API key*.

### 2. AWS CLI (recomendado)

```bash
# En una sola línea (devuelve directamente el valor)
aws apigateway get-api-keys \
  --name-query "<appsServiceName>-webhooks-channel-hub" \
  --include-values \
  --query "items[0].value" \
  --output text
```

O en dos pasos:

```bash
KEY_ID=$(aws apigateway get-api-keys \
  --name-query "<appsServiceName>-webhooks-channel-hub" \
  --query "items[0].id" --output text)

aws apigateway get-api-key \
  --api-key "$KEY_ID" \
  --include-value \
  --query "value" \
  --output text
```

Reemplaza `<appsServiceName>` por el valor real inyectado en `kProps.appsServiceName` para el entorno (development / staging / production).

### Rotación

Para rotar la key:

1. Crear una nueva `ApiKey` en el stack (o regenerarla manualmente en consola).
2. Asociarla al mismo Usage Plan.
3. Distribuir el nuevo valor al proveedor externo.
4. Eliminar la key anterior.

## Throttling y cuotas

Definidos en `WebhooksUsagePlan` (`lib/webhooks-stack.ts`):

| Límite       | Valor          |
| ------------ | -------------- |
| Rate limit   | 50 req/seg     |
| Burst limit  | 100 req        |
| Quota diaria | 100.000 req/día |

Si se excede, API Gateway responde `429 Too Many Requests`.

## Variables de entorno

Carga desde `../../../.env` en el repo root (`bin/webhooks.ts`):

| Variable               | Descripción                          |
| ---------------------- | ------------------------------------ |
| `CDK_DEFAULT_ACCOUNT`  | Cuenta AWS objetivo del despliegue.  |
| `CDK_DEFAULT_REGION`   | Región AWS objetivo del despliegue.  |

El resto de variables propias de `KApiStack` (nombre del servicio, tags, etc.) se obtienen vía `KApiStack.KProps()`.

## Desarrollo local

Requisitos: Docker corriendo y la red `kace_cloud_main_global-network` disponible.

```bash
cd apps/apiv1/kace_cloud_api_webhooks
pnpm install
pnpm run api          # SAM Local en puerto 60099
```

Esto sintetiza el template CDK y arranca SAM Local apuntando a `cdk.out/DEVELOPMENTWebhooksStack.template.json`.

> En modo local **no se aplica la validación de API Key** (es un check de API Gateway, no de la Lambda). Para simular el flujo completo con auth se necesita un despliegue real en AWS.

## Pruebas

```bash
pnpm test                      # Jest con --experimental-vm-modules
```

Sigue el patrón AAA (Arrange / Act / Assert) y la cobertura mínima del monorepo (90% funciones, líneas y statements).

## Despliegue

```bash
# Sintetizar
pnpm run cdk:synth

# Desplegar
pnpm run cdk:deploy

# Limpiar artefactos
pnpm run cdk:clean
```

O como parte del despliegue completo desde la raíz del monorepo:

```bash
pnpm deploy
```

## Estructura del proyecto

```
apps/apiv1/kace_cloud_api_webhooks/
├── bin/
│   └── webhooks.ts          # CDK app entry point
├── lib/
│   └── webhooks-stack.ts    # Stack CDK (API Gateway + Lambda + ApiKey + UsagePlan)
├── src/
│   ├── handler.mjs          # Lambda handler con withTenantContext
│   ├── controller.mjs       # Routing por this.#event.resource
│   └── schemas.mjs          # Joi schemas de validación
├── cdk.json
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Pendientes (TODO)

Identificados en el código actual:

- `controller.mjs:41` – Implementar la lógica de negocio para `channel-hub` delegando en use cases de `@kace/core`.
- `controller.mjs:49-64` – Método `#handleOneJourney` declarado pero no enrutado y referencia `oneJourneySchema` que no existe en `schemas.mjs`. O se completa el endpoint correspondiente o se elimina.
- `schemas.mjs:3-5` – Definir el contrato Joi de `channelHubSchema`. Hoy permite cualquier propiedad (`allowUnknown: true`) y no exige campos.
- Considerar añadir `CfnOutput` con el `keyId` de la API Key para facilitar la recuperación post-deploy vía CLI sin búsquedas por nombre.
