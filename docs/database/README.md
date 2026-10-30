# Documentación de Base de Datos

Guía completa del esquema de base de datos PostgreSQL y sistema de migraciones.

## Índice

1. [Tecnologías](#tecnologías)
2. [Configuración](#configuración)
3. [Esquema de Base de Datos](#esquema-de-base-de-datos)
4. [Migraciones](#migraciones)
5. [Consultas Comunes](#consultas-comunes)
6. [Mantenimiento](#mantenimiento)

> **Read/Write split por servicio:** ver [read-write-split.md](./read-write-split.md) — cómo enrutar
> lecturas de servicios no prioritarios al replica (registro `serviceDbRouting`, fachada `this.read`,
> read-after-write) y el playbook para migrar un nuevo servicio.

---

## Tecnologías

| Componente     | Tecnología  | Versión |
|----------------|-------------|---------|
| Base de datos  | PostgreSQL  | 16+     |
| Query Builder  | Knex.js     | 3.1.0   |
| Driver         | pg          | 8.16.0  |
| Testing        | SQLite3     | 5.1.7   |

---

## Configuración

### Ubicación

```
packages/kace_cloud_database/
├── migrations/           # 209 archivos de migración
├── seeds/               # Datos iniciales
├── knexfile.js          # Configuración
└── package.json
```

### knexfile.js

```javascript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const development = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    },
    pool: {
        min: 2,
        max: 10,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
    seeds: {
        directory: './seeds',
    },
};

export const production = {
    ...development,
    pool: {
        min: 2,
        max: 20,
    },
};

export const test = {
    client: 'sqlite3',
    connection: {
        filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
        directory: './migrations',
    },
};
```

### Variables de Entorno

```bash
# .env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kace_cloud
DB_USER=kace_admin
DB_PASSWORD=your_secure_password
DB_SCHEMA=public

# Usuario auxiliar (administrador)
DB_AUXILIAR_USER=kace_migrations
DB_AUXILIAR_PASSWORD=your_secure_password
```

---

## Esquema de Base de Datos

### Diagrama ER (Entidades Principales)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     usuarios    │     │     grupos      │     │      roles      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ nombre          │◀───▶│ nombre          │◀───▶│ nombre          │
│ email           │     │ descripcion     │     │ permisos (JSON) │
│ grupo_id (FK)   │     │ permisos (JSON) │     └─────────────────┘
│ rol_id (FK)     │     └─────────────────┘
└────────┬────────┘
         │
         │ crea/asignado
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      casos      │────▶│     estados     │     │clasificaciones  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ titulo          │     │ nombre          │     │ nombre          │
│ descripcion     │     │ color           │     │ nivel           │
│ estado_id (FK)  │     │ es_final        │     │ padre_id (FK)   │
│ clasificacion_id│     └─────────────────┘     └─────────────────┘
│ cliente_id (FK) │
│ usuario_asig_id │
│ created_at      │
└─────────────────┘
         │
         │ tiene
         ▼
┌─────────────────┐     ┌─────────────────┐
│  transiciones   │     │   history_casos │
├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │
│ estado_origen   │     │ caso_id (FK)    │
│ estado_destino  │     │ original_attrs  │
│ condiciones     │     │ new_attrs       │
└─────────────────┘     │ changed_attrs   │
                        │ usuario_id      │
                        │ created_at      │
                        └─────────────────┘
```

### Tablas Principales

#### Core

| Tabla      | Descripción          | Campos Clave                                        |
|------------|----------------------|-----------------------------------------------------|
| `casos`    | Casos/tickets        | id, titulo, estado_id, clasificacion_id, cliente_id |
| `usuarios` | Usuarios del sistema | id, nombre, email, grupo_id, rol_id                 |
| `grupos`   | Grupos de usuarios   | id, nombre, permisos (JSON)                         |
| `roles`    | Roles del sistema    | id, nombre, permisos (JSON)                         |
| `clientes` | Clientes/empresas    | id, nombre, documento, tipo_documento               |

#### Estados y Transiciones

| Tabla           | Descripción             | Campos Clave                                      |
|-----------------|-------------------------|---------------------------------------------------|
| `estados`       | Estados de casos        | id, nombre, color, es_final                       |
| `transiciones`  | Transiciones permitidas | estado_origen, estado_destino, condiciones        |
| `history_casos` | Historial de cambios    | caso_id, original_attrs, new_attrs, changed_attrs |

#### Clasificaciones

| Tabla                   | Descripción                | Campos Clave                |
|-------------------------|----------------------------|-----------------------------|
| `clasificaciones`       | Categorías jerárquicas     | id, nombre, nivel, padre_id |
| `niveles_clasificacion` | Niveles de clasificación   | id, nombre, orden           |

#### Workflows

| Tabla                    | Descripción                 | Campos Clave                            |
|--------------------------|-----------------------------|-----------------------------------------|
| `ws_rest_flows`          | Definición de workflows     | id, nombre, descripcion, activo         |
| `ws_rest_endpoints`      | Endpoints HTTP              | id, flow_id, url, method, headers, body |
| `ws_rest_functions`      | Funciones de transformación | id, nombre, codigo                      |
| `ws_rest_conditionals`   | Condiciones de branching    | id, operador, valor_izq, valor_der      |
| `ws_rest_workflow_steps` | Pasos del workflow          | id, flow_id, tipo, orden, config        |

#### Temporal

| Tabla                    | Descripción           | Campos Clave                                     |
|--------------------------|-----------------------|--------------------------------------------------|
| `agendas`                | Calendarios           | id, nombre, timezone                             |
| `agendas_grupos`         | Relación agenda-grupo | agenda_id, grupo_id                              |
| `agendas_dias_festivos`  | Días festivos         | agenda_id, fecha, descripcion                    |
| `appointments`           | Citas                 | id, agenda_id, caso_id, fecha_inicio, fecha_fin  |
| `appointment_time_slots` | Franjas horarias      | id, agenda_id, dia_semana, hora_inicio, hora_fin |

#### Configuración

| Tabla                    | Descripción             | Campos Clave                           |
|--------------------------|-------------------------|----------------------------------------|
| `global_configurations`  | Config global           | id, clave, valor (JSON), descripcion   |
| `auxiliar_definitions`   | Definiciones auxiliares | id, nombre, esquema (JSON)             |
| `auxiliar_schemas`       | Esquemas de datos       | id, definition_id, datos (JSON)        |
| `templates`              | Plantillas              | id, nombre, tipo, contenido, variables |

#### Comunicación

| Tabla            | Descripción          | Campos Clave                              |
|------------------|----------------------|-------------------------------------------|
| `mail_accounts`  | Cuentas de correo    | id, email, smtp_host, smtp_port, password |
| `notifications`  | Notificaciones       | id, usuario_id, titulo, mensaje, leida    |
| `comments`       | Comentarios en casos | id, caso_id, usuario_id, contenido        |

---

## Migraciones

### Estructura de Migración

```javascript
// migrations/20240115120000_create_casos.js
export async function up(knex) {
    await knex.schema.createTable('casos', (table) => {
        table.increments('id').primary();
        table.string('titulo', 200).notNullable();
        table.text('descripcion');
        table.integer('estado_id').unsigned().references('estados.id');
        table.integer('clasificacion_id').unsigned().references('clasificaciones.id');
        table.integer('cliente_id').unsigned().references('clientes.id');
        table.integer('usuario_creador_id').unsigned().references('usuarios.id');
        table.integer('usuario_asignado_id').unsigned().references('usuarios.id');
        table.integer('prioridad').defaultTo(3);
        table.jsonb('metadata').defaultTo('{}');
        table.timestamp('fecha_vencimiento');
        table.timestamps(true, true);
        table.timestamp('deleted_at');

        // Índices
        table.index(['estado_id']);
        table.index(['cliente_id']);
        table.index(['usuario_asignado_id']);
        table.index(['created_at']);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('casos');
}
```

### Comandos de Migración

```bash
cd packages/kace_cloud_database

# Ejecutar todas las migraciones pendientes
pnpm run migrate
# Equivalente a: knex migrate:latest

# Ver estado de migraciones
pnpm run migrate:status
# Equivalente a: knex migrate:status

# Ejecutar solo la última migración
pnpm run migrate:latest

# Rollback de la última batch
pnpm run migrate:rollback

# Rollback de todas las migraciones
pnpm run migrate:rollback --all

# Crear nueva migración
knex migrate:make nombre_migracion
```

---

## Mantenimiento

### Backup

```bash
# Backup completo
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql

# Backup de tablas específicas
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -t casos -t history_casos > cases_backup.sql

# Backup comprimido
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
# Restore desde backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup.sql

# Restore comprimido
gunzip -c backup.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### Índices Recomendados

```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_casos_estado ON casos(estado_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_casos_cliente ON casos(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_casos_usuario_asignado ON casos(usuario_asignado_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_casos_created_at ON casos(created_at DESC);
CREATE INDEX idx_casos_fecha_vencimiento ON casos(fecha_vencimiento) WHERE deleted_at IS NULL;

-- Índice para búsqueda de texto
CREATE INDEX idx_casos_titulo_gin ON casos USING gin(to_tsvector('spanish', titulo));

-- Índices para historial
CREATE INDEX idx_history_casos_caso_id ON history_casos(caso_id);
CREATE INDEX idx_history_casos_created_at ON history_casos(created_at DESC);

-- Índices para workflows
CREATE INDEX idx_ws_steps_flow ON ws_rest_workflow_steps(flow_id, orden);
```

### Vacuuming

```sql
-- Vacuum de tablas grandes
VACUUM ANALYZE casos;
VACUUM ANALYZE history_casos;

-- Vacuum completo (requiere lock exclusivo)
VACUUM FULL casos;
```

### Monitoreo

```sql
-- Tamaño de tablas
SELECT
    relname as tabla,
    pg_size_pretty(pg_total_relation_size(relid)) as tamaño
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- Conexiones activas
SELECT count(*) as conexiones_activas
FROM pg_stat_activity
WHERE state = 'active';

-- Queries lentas
SELECT
    query,
    calls,
    mean_time,
    total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Índices no utilizados
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%_pkey';
```

### Troubleshooting

#### Conexiones Agotadas

```sql
-- Ver conexiones por usuario
SELECT usename, count(*)
FROM pg_stat_activity
GROUP BY usename;

-- Matar conexiones idle
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '1 hour';
```

#### Locks

```sql
-- Ver locks activos
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Espacio en Disco

```sql
-- Ver espacio usado
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;
```
