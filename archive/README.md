# Archive

This folder contains files moved out of active app flow on 2026-03-10.

## Search
- Search only archives: `rg -n "<pattern>" archive/`
- Search whole repo (including archive): `rg -n "<pattern>" .`

## Restore
- Restore one archived file/folder to its old location:
  1. Move it back with `mv`.
  2. Validate with tests/typecheck as needed.
- Because archive stays in-repo, all content remains git-tracked and recoverable.

## Snapshot Buckets
- `archive/2026-03-10/root-docs/`
- `archive/2026-03-10/thai-images/`
- `archive/2026-03-10/course/`
- `archive/2026-03-10/src/components/`
