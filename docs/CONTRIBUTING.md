# Guía de Contribución

Esta guía describe las convenciones y procesos para contribuir al proyecto KACE Cloud.

## Tabla de Contenidos

1. [Configuración del Entorno](#configuración-del-entorno)
2. [Flujo de Trabajo Git](#flujo-de-trabajo-git)
3. [Convenciones de Código](#convenciones-de-código)
4. [Reglas de Arquitectura Obligatorias](#reglas-de-arquitectura-obligatorias)
5. [Estructura de Commits](#estructura-de-commits)
6. [Pull Requests](#pull-requests)
7. [Testing](#testing)
8. [Documentación](#documentación)

## Configuración del Entorno

### Requisitos

```bash
# Versiones mínimas requeridas
node --version  # >= 22.16.0
pnpm --version  # >= 10.11.0
```

### Instalación

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd kace_cloud_main

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales de desarrollo

# 4. Configurar base de datos local
cd packages/kace_cloud_database
pnpm run migrate

# 5. Verificar instalación
pnpm test
```

### IDE Recomendado

**Visual Studio Code** con las siguientes extensiones:
- ESLint
- Prettier
- GitLens
- AWS Toolkit
- Thunder Client (para probar APIs)

Configuración recomendada (`.vscode/settings.json`):

```json
{
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "eslint.workingDirectories": [
        { "pattern": "apps/*/" },
        { "pattern": "packages/*/" }
    ]
}
```

## Flujo de Trabajo Git

### Ramas

```
master          # Producción (protegida)
  │
  └── develop   # Desarrollo principal
        │
        ├── feature/nombre-feature    # Nuevas funcionalidades
        ├── bugfix/nombre-bug         # Corrección de bugs
        ├── hotfix/nombre-hotfix      # Fixes urgentes a producción
        └── release/vX.Y.Z            # Preparación de releases
```

### Crear una Nueva Rama

```bash
# Actualizar develop
git checkout develop
git pull origin develop

# Crear rama de feature
git checkout -b feature/mi-nueva-funcionalidad

# Crear rama de bugfix
git checkout -b bugfix/correccion-error-login
```

### Mantener la Rama Actualizada

```bash
# Traer cambios de develop
git fetch origin
git rebase origin/develop

# Resolver conflictos si existen
git add .
git rebase --continue
```

## Convenciones de Código

### JavaScript/TypeScript

**ESLint** (`@kace/eslint-config`):

```javascript
// Correcto
const getUserById = async (userId) => {
    const user = await userRepository.find(userId);
    return user;
};

// Incorrecto
const get_user_by_id = async (user_id) => {  // snake_case
    console.log("Fetching user");  // console.log no permitido
    var user = await userRepository.find(user_id);  // var no permitido
    return user
};  // falta punto y coma
```

**Prettier** (`@kace/prettier_config`):

```javascript
{
    trailingComma: "es5",
    tabWidth: 4,
    semi: true,
    singleQuote: true,
    printWidth: 120,
}
```

### Nombrado

| Tipo        | Convención             | Ejemplo                               |
|-------------|------------------------|---------------------------------------|
| Variables   | camelCase              | `userId`, `caseData`                  |
| Constantes  | UPPER_SNAKE_CASE       | `MAX_RETRIES`, `API_URL`              |
| Funciones   | camelCase              | `createCase()`, `findUser()`          |
| Clases      | PascalCase             | `CaseCreator`, `UserRepository`       |
| Archivos    | kebab-case o camelCase | `case-creator.js`, `userService.mjs`  |
| Directorios | kebab-case             | `value-objects`, `use-cases`          |

### Estructura de Archivos

**Microservicio**:

```
kace_cloud_api_example/
├── bin/
│   └── example.ts           # Entry point CDK
├── lib/
│   └── example-stack.ts     # Stack definition
├── src/
│   ├── handler.mjs          # Lambda handler
│   ├── controller.mjs       # Business logic routing
│   └── schemas.mjs          # Joi validation schemas
├── test/
│   └── example.test.js      # Tests
├── package.json
├── cdk.json
└── tsconfig.json
```

**Componente React**:

```
ComponentName/
├── index.jsx                # Exportación principal
├── ComponentName.jsx        # Componente
├── ComponentName.test.jsx   # Tests
└── styles.css               # Estilos (si aplica)
```

## Reglas de Arquitectura Obligatorias

Estas reglas no son preferencias de estilo: un PR que las incumpla no se aprueba. Cada una incluye el motivo, porque conocerlo evita reintroducir el problema por otra vía.

### Solo métodos HTTP `GET` y `POST`

El área de Seguridad Informática únicamente autoriza `GET` y `POST`. `PUT`, `PATCH` y `DELETE` están **prohibidos**: en las rutas de API Gateway, en la configuración de CORS y en los clientes del frontend.

Las escrituras se modelan como `POST` sobre un subrecurso, que es lo que el repositorio ya hace (`POST /{id}/register`, y `POST /{id}/delete` remapeado a `GET` dentro del handler). `allowMethods` en `KApiStack` y `Access-Control-Allow-Methods` en `Response` deben permanecer limitados a `GET, POST, OPTIONS`.

### Un controlador por endpoint

Cada endpoint personalizado tiene **su propio archivo de controlador**, que extiende `BaseController` e implementa los métodos `action*` estándar. El `handler.mjs` se limita a elegir la clase, reescribir `event.resource` y terminar **siempre** en `controller.run()`:

```javascript
// apps/apiv1/kace_cloud_api_users/src/handler.mjs — patrón de referencia
if (event.resource === '/bulk-update' && event.httpMethod === 'POST') {
    controller = new ControllerBulkUpdate({ ...event, resource: '/' }, knexConfig);
} else {
    controller = new Controller(event, knexConfig);
}
const response = await controller.run();   // punto de salida único
```

Nunca se invocan métodos `runXxx()` ad-hoc desde el handler. `run()` es el único lugar donde se encadenan la autenticación, el enrutado a `action*`, `destroyDbConnection()` y `#attachSessionCookieIfNeeded()` (rotación de la `session_key` de las cuentas Active Directory). Un endpoint que lo esquiva pierde todo eso en silencio, hoy y con cualquier cosa que se añada a `run()` mañana.

Los permisos se deciden **por ruta, nunca por `httpMethod`**. Un `action*` que bifurca hacia otro caso de uso según un dato del cuerpo de la petición —aplicación distinta, política HTTP distinta o mapeo de errores distinto— es la señal de que falta un controlador.

### La lógica de dominio y los manejadores de eventos viven en `@kace/core`

Los manejadores de eventos de dominio van en `packages/kace_cloud_core/src/<bounded-context>/application/event-handlers/`, con el patrón de nombre `<Verbo>On<Evento>`: `ExecuteActionsOnCaseCreated`, `ExecuteWSRestFlowOnExecutionRequested`, `ProcessJobOnActionJobCreated`.

Reciben las dependencias **ya construidas** por constructor posicional y exponen `handle(domainEvent)` con **un solo** argumento; la resolución de dependencias por tenant se queda en la closure de `handlerFactories` del microservicio. Un `handle(context, event)` que recibe `userRepository` u otro contexto de infraestructura del Lambda indica que el manejador está mal ubicado.

### Los repositorios extienden `KnexRepository`

Todo repositorio Knex extiende `KnexRepository`. La clase base concentra la resolución del schema del tenant (`table()`, `qualifiedName()`, `trxTable()`), la separación lectura-escritura con read-after-write (`this.read`, `get reader`, `get writer` sobre `DbRequestContext`), `destroyConnection()`, `startTransaction()` y `count()`. Una clase de persistencia suelta esquiva en silencio cualquier mejora futura de la base.

```javascript
export class KnexThingRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'things', readerConfig);
    }
}
```

Hay que pasar los **objetos de configuración** del tenant, nunca una instancia de Knex ya construida: `#resolveReaderConnection()` colapsa el reader sobre el writer cuando el writer llega prebuilt, y todas las lecturas acaban en el primario sin que nada falle. Las lecturas van por `this.read.table(...)` y las escrituras por `this.table(...)`. Tener que componer a mano un nombre de tabla con schema es la señal de que no se está extendiendo la clase base.

### PostgreSQL es el único motor: SQLite está deprecado

SQLite está deprecado y en proceso de retirada. No se añaden ramas `client === 'sqlite3'` en migraciones ni en repositorios, ni pruebas nuevas ancladas a `knexLib({ client: 'sqlite3', connection: ':memory:' })`.

El motivo no es solo la limpieza: una prueba que corre sobre SQLite **no ejercita la rama que se ejecuta en producción**, así que la cobertura resultante da falsa confianza. Las migraciones usan `table.jsonb(...)` directamente y las pruebas de persistencia corren contra el PostgreSQL de integración (`packages/kace_cloud_core/tests/knexfile.js`).

## Estructura de Commits

### Formato

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Tipos de Commit

| Tipo       | Descripción                     |
|------------|---------------------------------|
| `feat`     | Nueva funcionalidad             |
| `fix`      | Corrección de bug               |
| `docs`     | Documentación                   |
| `style`    | Formateo, sin cambios de código |
| `refactor` | Refactorización                 |
| `test`     | Añadir o modificar tests        |
| `chore`    | Mantenimiento, dependencias     |
| `perf`     | Mejoras de rendimiento          |

### Ejemplos

```bash
# Feature
git commit -m "feat(cases): add case priority field"

# Bug fix
git commit -m "fix(auth): resolve token expiration issue"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Refactoring
git commit -m "refactor(core): extract validation logic to separate service"

# Con cuerpo
git commit -m "feat(workflows): implement conditional step execution

- Add conditional operator support (eq, neq, gt, lt)
- Implement branching logic for workflow steps
- Add unit tests for conditional evaluation

Closes #123"
```

## Pull Requests

### Antes de Crear un PR

```bash
# 1. Ejecutar linting
pnpm run eslint-check

# 2. Formatear código
pnpm run format

# 3. Ejecutar tests
pnpm test

# 4. Verificar build
pnpm run build
```

### Plantilla de PR

```markdown
## Descripción

[Descripción clara del cambio]

## Tipo de Cambio

- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Breaking change
- [ ] Documentación

## Cambios Realizados

- Cambio 1
- Cambio 2
- Cambio 3

## Testing

- [ ] Tests unitarios añadidos/actualizados
- [ ] Tests de integración pasando
- [ ] Probado manualmente en ambiente local

## Checklist

- [ ] Mi código sigue las convenciones del proyecto
- [ ] He actualizado la documentación si es necesario
- [ ] No hay errores de linting
- [ ] Todos los tests pasan

## Checklist de Arquitectura

- [ ] Solo uso métodos HTTP `GET` y `POST`
- [ ] Cada endpoint nuevo tiene su propio controlador y el handler termina en `controller.run()`
- [ ] Los manejadores de eventos están en `@kace/core` con la firma `handle(domainEvent)`
- [ ] Los repositorios nuevos extienden `KnexRepository` y reciben configs, no instancias de Knex
- [ ] No he añadido ramas ni pruebas para SQLite

## Screenshots (si aplica)

[Capturas de pantalla]

## Notas Adicionales

[Cualquier información adicional]
```

### Proceso de Review

1. **Crear PR** contra `develop`
2. **Asignar reviewers** (mínimo 1)
3. **CI/CD** ejecuta tests automáticamente
4. **Code review** por parte del equipo
5. **Resolver comentarios** si los hay
6. **Merge** cuando esté aprobado

## Testing

### Estructura de Tests

```javascript
// test/example.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExampleService } from '../src/ExampleService.js';

describe('ExampleService', () => {
    let service;

    beforeEach(() => {
        service = new ExampleService();
    });

    afterEach(() => {
        // Cleanup
    });

    describe('methodName', () => {
        it('should do something when condition is met', async () => {
            // Arrange
            const input = { /* ... */ };

            // Act
            const result = await service.methodName(input);

            // Assert
            expect(result).toBeDefined();
            expect(result.status).toBe('success');
        });

        it('should throw error when input is invalid', async () => {
            // Arrange
            const invalidInput = null;

            // Act & Assert
            await expect(service.methodName(invalidInput))
                .rejects.toThrow('Invalid input');
        });
    });
});
```

### Ejecutar Tests

```bash
# Todos los tests
pnpm test

# Tests de un paquete específico
cd packages/kace_cloud_core
pnpm test

# Tests con coverage
pnpm test -- --coverage

# Tests en modo watch
pnpm test -- --watch
```

### Cobertura Mínima

```
Funciones: 80%
Líneas: 80%
Statements: 80%
```

## Documentación

### Cuándo Documentar

- Nueva funcionalidad pública
- APIs o endpoints nuevos
- Cambios en la arquitectura
- Configuraciones importantes
- Procesos de despliegue

### Formato JSDoc

```javascript
/**
 * Crea un nuevo caso en el sistema.
 *
 * @param {Object} caseData - Datos del caso a crear.
 * @param {string} caseData.title - Título del caso.
 * @param {string} caseData.description - Descripción del caso.
 * @param {number} caseData.priorityId - ID de la prioridad.
 * @returns {Promise<Case>} El caso creado.
 * @throws {ValidationError} Si los datos son inválidos.
 *
 * @example
 * const newCase = await caseCreator.execute({
 *     title: 'Nuevo caso',
 *     description: 'Descripción del caso',
 *     priorityId: 1
 * });
 */
async execute(caseData) {
    // ...
}
```

### README de Paquetes

Cada paquete debe tener un README con:

1. Descripción del paquete
2. Instalación
3. Uso básico
4. API Reference
5. Ejemplos

## Recursos

- [Documentación de Arquitectura](./ARCHITECTURE.md)
- [Guía de Despliegue](./DEPLOYMENT.md)
- [Convenciones ESLint](./../packages/kace_cloud_eslint/index.js)
- [Configuración Prettier](./../packages/kace_cloud_prettier_config_shared/index.js)

## Soporte

Para dudas sobre contribución:
- Abrir un issue en el repositorio
- Contactar al equipo de desarrollo