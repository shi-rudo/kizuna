---
"@shirudo/kizuna": minor
---

Add `borrowSingletonFrom()` for selective, non-owning singleton imports.
Require the source to be the root container that owns the singleton.
Support borrowing across compatible ESM, CommonJS, and duplicate package copies.
Emit declarations that work with TypeScript NodeNext module resolution.
Type-check every TypeScript example.
Correct examples that used unavailable APIs.
Clarify that package builds do not emit example files.
