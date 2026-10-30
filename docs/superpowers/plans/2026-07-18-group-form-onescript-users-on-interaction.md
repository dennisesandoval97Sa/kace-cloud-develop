# GroupForm OneScript Users on Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send `kaceGroupUsers` postMessage to OneScript only when the admin interacts with `MultiSelectUsers` in GroupForm, not on initial load or internal bootstrap.

**Architecture:** Optional `onUserSelectionChange` callback on `MultiSelectUsers` wired only to the `MultiSelect` change handler; pure `postGroupUsersToOneScript` utility called from `GroupForm`; remove reactive `useEffect` on `listValues`.

**Tech Stack:** React, Vitest, postMessage iframe API, existing `MultiSelect` from `@kace/ui-shared`

## Global Constraints

- No code comments in generated code
- Minimal diff; optional backward-compatible prop on `MultiSelectUsers`
- TDD: failing test before implementation per task
- Branch: `bugfix/group-form-onescript-users-on-interaction`
- Test runner: Vitest from `apps/kace-saas`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/kace-saas/src/utils/postGroupUsersToOneScript.js` | Create | Pure OneScript postMessage sender |
| `apps/kace-saas/src/utils/postGroupUsersToOneScript.test.js` | Create | Unit tests for sender |
| `apps/kace-saas/src/components/core/multiselector/MultiSelectUsers.jsx` | Modify | User-only selection callback |
| `apps/kace-saas/src/components/core/multiselector/MultiSelectUsers.test.jsx` | Create | Tests for callback vs bootstrap |
| `apps/kace-saas/src/pages/Group/components/GroupForm.jsx` | Modify | Wire callback; remove useEffect |

---

### Task 1: Pure postMessage utility (TDD)

**Files:**
- Create: `apps/kace-saas/src/utils/postGroupUsersToOneScript.js`
- Create: `apps/kace-saas/src/utils/postGroupUsersToOneScript.test.js`

**Interfaces:**
- Produces: `postGroupUsersToOneScript(contentWindow, users, targetOrigin) => void`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect, vi } from "vitest";
import { postGroupUsersToOneScript } from "./postGroupUsersToOneScript.js";

describe("postGroupUsersToOneScript", () => {
    it("posts kaceGroupUsers with payload to target origin", () => {
        const postMessage = vi.fn();
        const contentWindow = { postMessage };
        const users = [{ id: "1", label: "Alice" }];
        const origin = "https://onescript.example.com";

        postGroupUsersToOneScript(contentWindow, users, origin);

        expect(postMessage).toHaveBeenCalledWith(
            { type: "kaceGroupUsers", payload: users },
            origin,
        );
    });

    it("does not post when contentWindow is null", () => {
        expect(() => postGroupUsersToOneScript(null, [], "https://x.com")).not.toThrow();
    });

    it("posts empty array when all users are cleared", () => {
        const postMessage = vi.fn();
        postGroupUsersToOneScript({ postMessage }, [], "https://x.com");
        expect(postMessage).toHaveBeenCalledWith(
            { type: "kaceGroupUsers", payload: [] },
            "https://x.com",
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/kace-saas && npx vitest run src/utils/postGroupUsersToOneScript.test.js`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```javascript
export function postGroupUsersToOneScript(contentWindow, users, targetOrigin) {
    if (!contentWindow) return;
    contentWindow.postMessage({ type: "kaceGroupUsers", payload: users }, targetOrigin);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/kace-saas && npx vitest run src/utils/postGroupUsersToOneScript.test.js`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/utils/postGroupUsersToOneScript.js apps/kace-saas/src/utils/postGroupUsersToOneScript.test.js
git commit -m "$(cat <<'EOF'
fix(groups): add pure utility to post group users to OneScript

EOF
)"
```

---

### Task 2: MultiSelectUsers user-only callback (TDD)

**Files:**
- Modify: `apps/kace-saas/src/components/core/multiselector/MultiSelectUsers.jsx`
- Create: `apps/kace-saas/src/components/core/multiselector/MultiSelectUsers.test.jsx`

**Interfaces:**
- Consumes: none from Task 1
- Produces: optional prop `onUserSelectionChange(users)` fired only on MultiSelect-driven changes

- [ ] **Step 1: Write the failing test**

Create a focused test that renders `MultiSelectUsers` with a mocked `MultiSelect` or tests the handler in isolation. Preferred pattern — mock `@kace/ui-shared` MultiSelect:

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MultiSelectUsers } from "./MultiSelectUsers.jsx";

const multiSelectPropsRef = { current: null };

vi.mock("@kace/ui-shared", () => ({
    MultiSelect: (props) => {
        multiSelectPropsRef.current = props;
        return null;
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../../hooks/useGenericSearchQuery", () => ({
    default: () => ({ data: { rows: [], total: 0 }, isFetching: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useDebounced", () => ({
    default: (fn) => fn,
}));

describe("MultiSelectUsers onUserSelectionChange", () => {
    beforeEach(() => {
        multiSelectPropsRef.current = null;
    });

    it("invokes onUserSelectionChange when MultiSelect updates selection", () => {
        const onUserSelectionChange = vi.fn();
        const setListValues = vi.fn();
        const next = [{ id: "2", label: "Bob" }];

        render(
            <MultiSelectUsers
                listValues={[]}
                setListValues={setListValues}
                values={[]}
                onUserSelectionChange={onUserSelectionChange}
            />,
        );

        act(() => {
            multiSelectPropsRef.current.setListValues(next);
        });

        expect(setListValues).toHaveBeenCalledWith(next);
        expect(onUserSelectionChange).toHaveBeenCalledWith(next);
    });

    it("does not require onUserSelectionChange to be defined", () => {
        const setListValues = vi.fn();
        render(
            <MultiSelectUsers listValues={[]} setListValues={setListValues} values={[]} />,
        );
        expect(() =>
            act(() => multiSelectPropsRef.current.setListValues([])),
        ).not.toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/kace-saas && npx vitest run src/components/core/multiselector/MultiSelectUsers.test.jsx`

Expected: FAIL — `onUserSelectionChange` not called / handler not wired

- [ ] **Step 3: Implement in MultiSelectUsers.jsx**

Add prop to destructuring:

```javascript
export const MultiSelectUsers = ({
    listValues,
    setListValues,
    values = [],
    enableSearch = false,
    listMode = false,
    onUserSelectionChange,
}) => {
```

Add handler after `setListValuesRef` effect:

```javascript
const handleUserSelectionChange = useCallback(
    (next) => {
        setListValues(next);
        onUserSelectionChange?.(next);
    },
    [setListValues, onUserSelectionChange],
);
```

In JSX, replace `setListValues={setListValues}` with `setListValues={handleUserSelectionChange}` on `MultiSelect`.

Add to PropTypes:

```javascript
onUserSelectionChange: PropTypes.func,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/kace-saas && npx vitest run src/components/core/multiselector/MultiSelectUsers.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/core/multiselector/MultiSelectUsers.jsx apps/kace-saas/src/components/core/multiselector/MultiSelectUsers.test.jsx
git commit -m "$(cat <<'EOF'
fix(multiselect): notify parent only on user-driven selection changes

EOF
)"
```

---

### Task 3: Wire GroupForm and remove reactive sync

**Files:**
- Modify: `apps/kace-saas/src/pages/Group/components/GroupForm.jsx`

**Interfaces:**
- Consumes: `postGroupUsersToOneScript` from Task 1
- Consumes: `onUserSelectionChange` from Task 2

- [ ] **Step 1: Remove reactive OneScript sync**

Delete:
- `initialUsersLoaded` ref and its assignment in `relatedUsers` effect
- entire `useEffect` on `[listValues]` that posts `kaceGroupUsers`

Keep `relatedUsers` effect that sets `listValues` — it must remain for display only.

- [ ] **Step 2: Add import and callback**

```javascript
import { postGroupUsersToOneScript } from "../../../utils/postGroupUsersToOneScript";
import { useCallback } from "react";
```

Add callback (merge `useCallback` into existing React import):

```javascript
const handleGroupUsersSelectionChange = useCallback(
    (users) => {
        if (!hasOneScriptGroups) return;
        const contentWindow = oneScriptRef.current?.contentWindow;
        postGroupUsersToOneScript(contentWindow, users, ONESCRIPT_KONECTA_CLOUD);
    },
    [hasOneScriptGroups, oneScriptRef],
);
```

- [ ] **Step 3: Pass prop to MultiSelectUsers**

```jsx
<MultiSelectUsers
    listValues={listValues}
    setListValues={setListValues}
    values={dataUsers.users}
    enableSearch={true}
    onUserSelectionChange={handleGroupUsersSelectionChange}
/>
```

- [ ] **Step 4: Run full related tests**

Run: `cd apps/kace-saas && npx vitest run src/utils/postGroupUsersToOneScript.test.js src/components/core/multiselector/MultiSelectUsers.test.jsx`

Expected: PASS

- [ ] **Step 5: Manual smoke check (edit group flow)**

1. Open group edit with existing users → OneScript must NOT receive `kaceGroupUsers` on load
2. Add a user → OneScript receives updated list
3. Clear all users → OneScript receives `[]`

- [ ] **Step 6: Commit**

```bash
git add apps/kace-saas/src/pages/Group/components/GroupForm.jsx
git commit -m "$(cat <<'EOF'
fix(groups): sync OneScript group users only on multiselect interaction

EOF
)"
```

---

## Plan Self-Review

- Spec coverage: all scenarios in behavior matrix covered by Tasks 1–3 and tests
- No placeholders
- Type/signature consistency: `onUserSelectionChange(users)` → `postGroupUsersToOneScript(contentWindow, users, origin)` throughout

## Execution Handoff

Plan complete. Choose execution mode when ready to implement.
