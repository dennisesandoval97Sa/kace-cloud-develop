# Code Review Report

**Branch:** [rama-origen] → [rama-base, ej. develop]  
**Review Type:** [full | focused | security | performance]  
**Files Reviewed:** [número o lista breve]  
**Date:** [YYYY-MM-DD]

## PR Summary

**Type:** [✨ New Feature | 🐛 Bug Fix | ♻️ Refactor | 📚 Docs | ⚡ Perf | 🔒 Security | Otro]  
**Scope:** [módulo o área, ej. cases, reports, kace_cloud_api_users]  
**Risk:** [Low | Medium | High]

[Descripción en 2–5 frases: qué hace el PR, alcance, si toca contrato API, datos sensibles o infraestructura.]

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | [n] |
| HIGH     | [n] |
| MEDIUM   | [n] |
| LOW      | [n] |
| INFO     | [n] |

**Overall Verdict:** [APPROVED | APPROVED WITH COMMENTS | CHANGES REQUESTED | REJECTED]

## Findings

### [SEVERITY] [Category - Subcategory] Título breve del hallazgo

**File:** `ruta/al/archivo.ext`[:línea-inicio-línea-fin] (y archivos relacionados si aplica)

**Description:** [Qué se observa en el código o en el diff.]

**Impact:** [Qué puede fallar: regresión, seguridad, UX, deuda técnica, incoherencia con arquitectura.]

**Suggested Fix:**

```text
[Pseudocódigo, diff sugerido o pasos concretos. Opcional: enlace a patrón en docs/Code Review Agent Guide.md]
```

---

(Repetir el bloque anterior por cada hallazgo.)

## Observaciones Positivas

- [Punto 1: buen patrón, test añadido, naming claro, etc.]
- [Punto 2]
- [Punto 3]

## Recomendaciones

1. [Prioridad alta o bloqueante si aplica]
2. [Mejora recomendada antes del merge]
3. [Seguimiento en PR posterior si es aceptable]

---

**Notas para el agente:** Sustituir todos los placeholders `[...]`. Ordenar findings por severidad (CRITICAL → INFO). Si no hay hallazgos en una severidad, mantener count en 0. Alinear categorías con la guía en [Code Review Agent Guide.md](./Code%20Review%20Agent%20Guide.md).
