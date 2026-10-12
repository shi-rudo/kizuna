---
"@shirudo/kizuna": patch
---

Let a consumer bundle drop the unused diagnostics code.

- The internal no-op diagnostics reporter carries a pure annotation. Before, a bundle that used only `interfaceToken` or an error class still kept it.
- A test and the package E2E workflow build a Vite consumer that imports only `interfaceToken`. They fail when the bundle keeps container, resolution, diagnostics, validation, or borrowing code, still imports the package, or grows beyond 1 KiB. The test uses the Vite version that the repository pins, and the E2E workflow uses the current Vite release.
