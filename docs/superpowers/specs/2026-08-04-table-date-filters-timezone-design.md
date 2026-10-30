# Table date filters timezone — Design Spec

**Branch:** `fix/frontend-date-filters-timezone`  
**Base:** `origin/develop`  
**Date:** 2026-08-04  
**Scope:** Date range filters from frontend tables only (legacy + DataTable V2 + src_v2 table filter builder)

## Context

Los registros se persisten en UTC. Al filtrar por campos fecha desde tablas del frontal (Colombia, México y otros tenants LATAM), los resultados no coinciden con el día calendario que el usuario eligió.

Causa raíz combinada:

1. `DatePickerWithRange` formatea el rango con una `Z` **literal** sobre componentes de fecha del calendario (`yyyy-MM-dd'T'00:00:00.000'Z'`), no como instante UTC real.
2. El pipeline legacy (`useHookFilter`) intenta “corregir” con `toZonedTime` / `fromZonedTime` sobre ese valor engañoso.
3. El pipeline DataTable V2 (`useDataTable` + `componentsV2/.../DataTable`) envía el valor del picker **sin** normalizar.
4. `src_v2` `filterBuilder` (`case "date"`) también pasa el valor tal cual.

Payload que el backend ya interpreta bien (día local con offset):

```json
{
  "field": "created_at",
  "value": "2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00",
  "type": "AND",
  "operator": "between"
}
```

(También es aceptable el offset corto `-05` si el backend lo parsea; preferimos ISO-8601 con `:00` por estabilidad en tests.)

## Goals

- Filtrar por **día calendario** en la zona del **navegador** del usuario.
- Bounds: inicio `00:00:00.000` y fin `23:59:59.999` con offset real de esa TZ.
- Un helper de dominio puro, testeable con TDD, compartido por todos los stacks de tablas.
- Cubrir campos fecha usados en filtros de tabla (`fecha_*`, columnas exactas existentes, y gaps como `receipt_at` tras inventario).
- Suite LATAM parametrizada (8 zonas) como estándar preventivo.
- Código mínimo, SOLID, sin duplicar lógica de TZ en los hooks.

## Non-goals

- Formularios, exports, notificaciones u otros envíos de fechas fuera de tablas.
- Cambiar `DatePickerWithRange` / `DateTimePickerWithRange` globalmente (siguen emitiendo `Z` literal; el helper corrige en el borde de filtro de tabla).
- Usar timezone del tenant o `VITE_TIMEZONE` como fuente de verdad.
- Cambios de backend, schema o persistencia UTC.
- Refactors no relacionados de `useHookFilter` / `useDataTable`.

## Decisions

| Decisión | Elección |
|----------|----------|
| Fuente de TZ | Zona del navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`), inyectable en tests |
| Semántica del día | Día calendario local: `00:00:00.000`–`23:59:59.999` + offset |
| Formato de salida | ISO con offset completo preferido (`XXX` → `-05:00`); aceptable cualquier forma que el backend parseé |
| Alcance UI | Solo filtros desde tablas |
| Stacks | Legacy `table-component` + DataTable V2 (`componentsV2` / `useDataTable`) + `src_v2` `filterBuilder` |
| Enfoque | Helper puro + cableado en cada orquestador |
| Input engañoso con `Z` | Interpretar `YYYY-MM-DD` como día calendario; **no** tratar la `Z` como UTC absoluto |
| Date vs datetime | **Date** (`DatePickerWithRange`): día calendario completo con offset (bug principal). **Datetime** (`DateTimePickerWithRange`): preservar horas elegidas en TZ del navegador y serializar con offset (o instante equivalente); no forzar 00:00–23:59 si el valor trae hora explícita |
| Picker | Sin cambios en esta entrega |

## Architecture

```text
DatePickerWithRange / DateTimePickerWithRange
        │  valor crudo (a menudo con Z literal)
        ▼
┌────────────────────────────────────────────────┐
│ normalizeTableDateRangeFilter(value, timeZone) │  dominio único
└────────────────────────────────────────────────┘
        │
   ┌────┼────────────────────┐
   ▼    ▼                    ▼
Legacy              DataTable V2           src_v2 tablas
useHookFilter       useDataTable           filterBuilder
normalizeDateRange  al aplicar filtros     case "date"
```

### Units

1. **`normalizeTableDateRangeFilter` (puro)**  
   - Firma: `(value: string, timeZone: string, options?: { mode?: 'date' | 'datetime' }) → string | null`  
   - Parsea `"start, end"` (o un solo lado).  
   - Modo `date` (default, filtros de tabla con date picker): extrae `YYYY-MM-DD` (ignora `Z` engañosa); materializa `00:00:00.000` / `23:59:59.999` en `timeZone` con offset real.  
   - Modo `datetime`: interpreta cada lado como instante o wall-clock; re-serializa en `timeZone` con offset **preservando** HH:mm:ss.SSS (no colapsar a día completo).  
   - Formato: `yyyy-MM-dd'T'HH:mm:ss.SSSXXX`.  
   - Inválido, vacío o rango invertido → `null`.  
   - Sin React, sin I/O.  
   - Ubicación: módulo dedicado importable desde legacy, V2 y src_v2 sin ciclos; **no** mezclado con `dateUtils` de display/`VITE_TIMEZONE`.

2. **`resolveDateFilterOperator` (existente)**  
   - Inventariar columnas `between` / `date` / `datetime` de tablas.  
   - Ampliar `DATE_EXACT_COLUMNS` (u equivalente) solo donde falte cobertura (candidato: `receipt_at`).

3. **Legacy orchestration — `useHookFilter`**  
   - Reemplazar el `normalizeDateRange` inline por el helper + TZ del navegador.  
   - `buildFilterCriteriaFromForm` sin cambios de contrato.

4. **V2 orchestration — `useDataTable`**  
   - En `handleApplyFilters` (o helper privado usado ahí), normalizar valores de criterios fecha/`between` antes de `setUserFilters` y de la query.  
   - Detectar por `data_type` date/datetime del schema: `date` → mode `date`; `datetime` → mode `datetime`.

5. **src_v2 — `filterBuilder`**  
   - En `case "date"`, normalizar `value` con el helper en mode `date` + TZ del navegador.

### Data flow (éxito)

1. Usuario elige `2026-07-23` en Bogotá.  
2. Picker emite algo como `2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z`.  
3. Helper → `2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00`.  
4. Search API aplica `between` contra timestamps UTC almacenados → filas del día local correcto.

### Error handling

| Caso | Comportamiento |
|------|----------------|
| Vacío / no parseable | `null`; legacy muestra toast `invalidDateRange` si solo había fechas |
| Un solo día | Mismo día en ambos bounds |
| end < start | `null` |
| TZ inválida (tests) | Fallo explícito; no silenciar |

## Testing (TDD)

### Helper — matriz LATAM

Archivo dedicado, p. ej. `normalizeTableDateRangeFilter.test.js`, parametrizado:

| País | IANA |
|------|------|
| Colombia | `America/Bogota` |
| México | `America/Mexico_City` |
| Chile | `America/Santiago` |
| Argentina | `America/Argentina/Buenos_Aires` |
| Perú | `America/Lima` |
| Brasil | `America/Sao_Paulo` |
| Uruguay | `America/Montevideo` |
| Ecuador | `America/Guayaquil` |

Casos mínimos por zona:

1. Un día → bounds con offset correcto.  
2. Rango multi-día → start del primer día / end del último.  
3. Input con `Z` literal del picker → mismo resultado que día calendario.  
4. Offset ISO parseable (`-05:00` preferido).  
5. Caso cerca de medianoche (día local ≠ día UTC) al menos para Bogota y Mexico_City.

### Cableado

- Legacy: criterio `between` generado vía `buildFilterCriteriaFromForm` + helper real.  
- V2: aplicar filtros date → valor normalizado en `userFilters`.  
- `filterBuilder` `type: "date"` → value normalizado.

Orden TDD: tests helper (rojo) → helper (verde) → cableados → inventario campos.

## Files to create or modify (expected)

| Archivo | Cambio |
|---------|--------|
| `.../normalizeTableDateRangeFilter.js` (nuevo) | Helper puro |
| `.../normalizeTableDateRangeFilter.test.js` (nuevo) | Suite LATAM + edge cases |
| `table-component/hooks/useHookFilter.js` | Usar helper; quitar TZ inline |
| `table-component/helpers.js` | Ampliar detección de campos fecha si inventario lo pide |
| `hooks/useDataTable.jsx` | Normalizar fechas al aplicar filtros |
| `src_v2/shared/utils/filterBuilder.util.js` | Normalizar en `case "date"` |
| Tests de cableado existentes / nuevos | Legacy + V2 + filterBuilder |

Rutas exactas del helper se fijan en el plan de implementación; el criterio es: importable desde legacy, V2 y src_v2 sin ciclos.

## Success criteria

1. Filtrar un día en tabla (`created_at` u otro campo fecha) desde TZ Colombia/México devuelve solo registros de ese día local.  
2. El `value` del `between` lleva offset real (ISO estable).  
3. Legacy `DataTableContainer` / `useHookFilter` y DataTable V2 / `useDataTable` usan el mismo helper.  
4. `filterBuilder` de src_v2 normaliza fechas de tabla.  
5. Suite LATAM (8 zonas) en verde.  
6. Sin cambios de picker global ni de backend.

## Implementation order

1. Tests del helper (matriz LATAM) → implementación.  
2. Cablear legacy `useHookFilter`.  
3. Cablear `useDataTable`.  
4. Cablear `filterBuilder`.  
5. Inventario / ampliación de `resolveDateFilterOperator`.  
6. Tests de cableado ligeros.
