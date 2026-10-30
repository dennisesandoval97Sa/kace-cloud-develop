# Classifications select infinite-scroll seed — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or implement in-session with TDD).

**Goal:** Seed/missing selected al final + gate de scroll infinito solo tras gesto de usuario.

**Architecture:** Helper puro append seed; hook React `useInfiniteScrollGate` compartido por `Select` y `MultiSelect`; `MultiSelectTemplate` deja page data A→Z y append missing.

**Tech stack:** React, Vitest, Testing Library.

---

### Task 1: `mergeSeedIntoOptions` append

**Files:** `selectByProviderOptions.js` + `.test.js`, ajustar `useSelectByProviderQuery.test.js` si asume seed `[0]`.

1. RED: test espera `[...options, seed]`
2. GREEN: cambiar prepend → append
3. Actualizar test hook `options[0]` → seed al final

### Task 2: `useInfiniteScrollGate`

**Files:** nuevo `.../hooks/useInfiniteScrollGate.js` + test (bajo ui-shared o `apps/kace-saas/src/hooks`).

API: `arm`, `reset`, `consume` (true solo si armed; desarma).

### Task 3: `Select` scroll gate

**Files:** `Select.jsx`, `Select.search.test.jsx`, `ui/select.jsx` (forward `onWheel`/`onTouchStart`/`onPointerDown` al Viewport).

- Reset al abrir
- Arm con gesto usuario en viewport
- `handleScroll` solo pagina si `consume()`
- Actualizar tests existentes: gesto + scroll; nuevo: scroll sin gesto no pagina; un fetch desarma

### Task 4: `MultiSelect` scroll gate

**Files:** `MultiSelect.jsx` + test nuevo si no hay cobertura local.

Misma semántica que Task 3.

### Task 5: `MultiSelectTemplate` missing al final

**Files:** `MultiSelectTemplate.jsx` + `.test.jsx`

- `sort(data)` + append missing (sin re-sort conjunto)
- Test con missing que ordenaría *antes* alfabéticamente → debe quedar al final

### Task 6: Verificar

```bash
cd apps/kace-saas && npx vitest run \
  src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.test.js \
  src/hooks/useSelectByProviderQuery.test.js \
  src/components/ui-shared/src/components/Select/Select.search.test.jsx \
  src/pages/Classifications/components/MultiSelectTemplate.test.jsx \
  <gate + MultiSelect tests>
```
