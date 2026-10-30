# Atomic product User creation with User-Group Memberships

After server-side object identity hardening, product **User** create could persist a **User** under a server-generated id while a follow-up membership call still used a discarded client id, leaving a **User** without **User-Group Memberships**. We decided product create must accept `group_ids` and create the **User** and initial **User-Group Memberships** in one database transaction (not “return id + second HTTP call”), so a membership failure cannot leave a newly created **User** without memberships. Updating memberships after create stays a separate operation.

## Considered Options

- **Return `{ id }` and keep two HTTP calls** — fixes the id mismatch but not the atomic guarantee.
- **Atomic create with `group_ids` on `POST /users`** — chosen for the product invariant that create never leaves a groupless **User**.
