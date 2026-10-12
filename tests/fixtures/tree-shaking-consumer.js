// A consumer that uses only interfaceToken. A tree-shaking bundler must drop
// the container, resolution, diagnostics, and validation code.
import { interfaceToken } from "@shirudo/kizuna";

console.log(interfaceToken()("clock"));
