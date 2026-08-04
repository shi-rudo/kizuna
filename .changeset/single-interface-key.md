---
"@shirudo/kizuna": patch
---

Reject interface registration key types that can represent more than one runtime value. This includes unions and open template-literal patterns. Use one fixed string literal as the key type.
