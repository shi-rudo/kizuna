---
"@shirudo/kizuna": patch
---

Let a consumer bundle drop the unused diagnostics code.

- The internal no-op diagnostics reporter carries a pure annotation. Before, a bundle that used only `interfaceToken` or an error class still kept it.
- The package E2E workflow builds a Vite consumer that imports only `interfaceToken` and fails when the bundle keeps container, resolution, diagnostics, or validation code. The bundle is 51 bytes.
