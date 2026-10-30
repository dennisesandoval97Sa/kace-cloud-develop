# Generador de folios / radicados

Módulo que permite **armar el código de un caso pieza por pieza** y asignarlo automáticamente
cuando el caso se crea, se reclasifica o se clona con una clasificación determinada.

Una configuración de folio es una lista ordenada de segmentos —texto fijo, fecha, campo del
caso y un consecutivo con relleno de ceros— que se concatenan para producir un código como
`5261000000050`. La configuración se asocia a una o varias clasificaciones desde el formulario
de cada clasificación y, a partir de ahí, todo caso de esas clasificaciones recibe su folio en la
columna `cases.folio`.

El consecutivo vive en una tabla de contadores propia (`folio_sequences`) y se reserva con un
incremento atómico dentro de la transacción del caso. El dominio solo acepta estructuras que no
pueden repetir un folio, un índice único sobre `cases.folio` hace de última red y, si aun así un
folio ya existe, se salta ese número en lugar de bloquear la creación. Un caso nunca cambia de
folio.

## Índice

| Documento | Para quién |
| --- | --- |
| [Guía funcional](guia-funcional.md) | Analista funcional, administrador del tenant. Cómo configurar un folio desde la pantalla, sin tecnicismos. |
| [Documentación técnica](documentacion-tecnica.md) | Desarrollo. Modelo de datos, reglas de unicidad, flujo de generación, concurrencia, API, frontend, tests y limitaciones. |
| [Preguntas frecuentes](preguntas-frecuentes.md) | Las decisiones de diseño que más se preguntan: por qué no se reutilizó `reference` y cómo se controla el consecutivo (entre configuraciones, entre clasificaciones y bajo concurrencia). |

## Ubicación del código

| Capa | Ruta |
| --- | --- |
| Dominio y aplicación | [`packages/kace_cloud_core/src/folio-configurations/`](../../packages/kace_cloud_core/src/folio-configurations/) |
| Generación en el caso | [`packages/kace_cloud_core/src/cases/application/folio/CaseFolioResolver.js`](../../packages/kace_cloud_core/src/cases/application/folio/CaseFolioResolver.js) |
| Microservicio | [`apps/apiv1/kace_cloud_api_folio_configurations/`](../../apps/apiv1/kace_cloud_api_folio_configurations/) |
| Frontend | [`apps/kace-saas/src/pages/FolioConfigurations/`](../../apps/kace-saas/src/pages/FolioConfigurations/) |
| Migraciones | `packages/kace_cloud_database/migrations/20261006120000..20261006120005_*` |
| Tests | [`packages/kace_cloud_core/tests/folio-configurations/`](../../packages/kace_cloud_core/tests/folio-configurations/) y `tests/cases/CaseFolioPaths.integration.test.js` |

> **No confundir con el folio legado.** Existe desde antes un mecanismo distinto que decora
> `external_code` (ajustes `add_folio_to_external_code` y `folio_length` en la configuración
> general). Sigue funcionando sin cambios y es independiente de este módulo.
