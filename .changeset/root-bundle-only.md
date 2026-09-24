---
"@shirudo/kizuna": patch
---

Ship only the files that consumers can reach.

- The package no longer contains the `dist/api/index.*` and `dist/core/index.*` bundles. The export map never published these paths. A deep import such as `@shirudo/kizuna/dist/core/index` worked only with resolvers that ignore the export map, and it now fails at runtime. Import from `@shirudo/kizuna` instead.
- The package no longer contains declaration maps. They pointed to `src/` files that the package does not ship.
- The packed tarball shrinks from about 306 KB to 160 KB, and the unpacked size from 1.5 MB to 748 KB. The root bundles and their source maps with embedded sources stay.
