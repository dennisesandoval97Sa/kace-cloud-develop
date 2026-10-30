# KACE Cloud

Plataforma SaaS empresarial de gestión de casos/tickets construida como monorepo con arquitectura serverless en AWS.

## Descripción General

KACE Cloud es una solución integral para la gestión de casos que incluye:
- **95 microservicios** desplegados como AWS Lambda
- **Frontend React** moderno con TanStack Query
- **7 paquetes compartidos** con lógica de negocio reutilizable
- **Motor de workflows** para automatización de procesos

## Stack Tecnológico

| Capa                | Tecnología                                       |
|---------------------|--------------------------------------------------|
| **Frontend**        | React 18.3, TanStack Query, Vite 6, Tailwind CSS |
| **Backend**         | Node.js 22+, AWS Lambda, API Gateway             |
| **Base de datos**   | PostgreSQL + Knex.js                             |
| **Autenticación**   | AWS Cognito + JWT                                |
| **Infraestructura** | AWS CDK 2.x (TypeScript)                         |
| **Mensajería**      | RabbitMQ                                         |
| **Almacenamiento**  | AWS S3                                           |
| **CI/CD**           | Bitbucket Pipelines                              |
| **Monorepo**        | pnpm workspaces                                  |

## Estructura del Proyecto

```
kace_cloud_main/
├── apps/
│   ├── kace-saas/                    # Frontend React SPA
│   └── apiv1/                        # 95 microservicios Lambda
│       ├── kace_cloud_api_cases/
│       ├── kace_cloud_api_clients/
│       ├── kace_cloud_api_users/
│       └── ... (92 servicios más)
├── packages/
│   ├── kace_cloud_core/              # Lógica de negocio (DDD)
│   ├── kace_cloud_database/          # Migraciones PostgreSQL
│   ├── kace_cloud_api_common/        # Utilidades HTTP compartidas
│   ├── kace_cloud_aws_infra/         # CDK base stack
│   ├── kace_cloud_schemas_builder/   # Validación dinámica Joi
│   ├── kace_cloud_eslint/            # Configuración ESLint
│   └── kace_cloud_prettier_config_shared/
├── docs/                             # Documentación
├── utils.sh                          # Script de despliegue
└── pnpm-workspace.yaml               # Configuración monorepo
```

## Requisitos Previos

- **Node.js** >= 22.16.0
- **pnpm** >= 10.11.0
- **AWS CLI** configurado con credenciales
- **AWS CDK** >= 2.185.0
- **PostgreSQL** >= 14
- **Git**

## Instalación Rápida

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd kace_cloud_main
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con las credenciales necesarias
```

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Configurar base de datos

```bash
cd packages/kace_cloud_database
pnpm run migrate
```

### 5. Desplegar infraestructura base

```bash
cd packages/kace_cloud_aws_infra
pnpm run cdk:deploy
```

### 6. Desplegar microservicios

```bash
# Desde la raíz del proyecto
pnpm deploy
```

### 7. Iniciar frontend en desarrollo

```bash
cd apps/kace-saas
pnpm run dev
```

## Documentación

| Documento                                      | Descripción                           |
|------------------------------------------------|---------------------------------------|
| [Arquitectura](docs/ARCHITECTURE.md)           | Diseño del sistema y patrones         |
| [Contribución](docs/CONTRIBUTING.md)           | Guía para contribuidores              |
| [Despliegue](docs/DEPLOYMENT.md)               | Guía completa de despliegue           |
| [Paquetes](docs/packages/README.md)            | Documentación de paquetes compartidos |
| [Frontend](docs/frontend/README.md)            | Documentación del frontend            |
| [Microservicios](docs/microservices/README.md) | Documentación de APIs                 |
| [Base de datos](docs/database/README.md)       | Esquema y migraciones                 |

## Scripts Principales

```bash
# Instalar todas las dependencias
pnpm install

# Desplegar todos los servicios (producción)
pnpm deploy

# Ejecutar tests
pnpm test

# Linting
pnpm run eslint-check

# Formatear código
pnpm run format
```

## Desarrollo Local

### Frontend

```bash
cd apps/kace-saas
pnpm run dev          # Servidor de desarrollo
pnpm run build        # Build de producción
pnpm run test         # Ejecutar tests
```

### Microservicio individual

```bash
cd apps/apiv1/kace_cloud_api_cases
pnpm run api          # SAM Local (requiere Docker)
pnpm run test         # Tests unitarios
pnpm run cdk:synth    # Sintetizar CloudFormation
pnpm run cdk:deploy   # Desplegar a AWS
```

## Arquitectura de Alto Nivel

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   API Gateway    │────▶│  AWS Lambda     │
│   (React SPA)   │     │   + Cognito      │     │  (95 services)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │    RabbitMQ      │◀─────────────┤
                        │   (Adapters)     │              │
                        └──────────────────┘              │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│      S3         │◀────│   @kace/core     │────▶│   PostgreSQL    │
│   (Storage)     │     │  (Domain Logic)  │     │   (Database)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Módulos Principales

### Gestión de Casos
- Creación, actualización y cierre de casos
- Transiciones de estado con workflows
- Clasificaciones y prioridades
- ANS (Acuerdos de Nivel de Servicio)

### Usuarios y Grupos
- Gestión de usuarios y roles
- Asignación de casos por grupos
- Permisos granulares

### Workflows y Automatización
- Motor de workflows REST
- Acciones programadas
- Integraciones via RabbitMQ

### Comunicaciones
- Notificaciones a usuarios y clientes
- Integración con correo electrónico
- Templates personalizables

## Contacto

Para dudas o problemas:
- **Roberto Garcia**: roberto.garcia@konecta-group.com
- **Jordi Natividad**: jnatividad@konecta.com

También puedes abrir un issue en este repositorio describiendo el problema.

## Licencia

Propiedad de Konecta Group. Todos los derechos reservados.
