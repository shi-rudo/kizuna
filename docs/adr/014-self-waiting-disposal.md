# ADR-014: Self-Waiting Disposal

## Status

Accepted.

## Context

`disposeAsync()` waits for two kinds of work before it settles:

- The cached Promise of a singleton or scoped factory. `disposeAsync()` needs
  the resolved value to clean it up.
- A cleanup that already runs, when a second call arrives (ADR-012).

Because of this, two patterns wait for themselves:

1. An `async` factory awaits other work, then awaits `disposeAsync()` of its
   own container or scope. The disposal waits for the factory Promise. The
   factory Promise waits for the disposal.
2. A cleanup hook awaits other work, then awaits `disposeAsync()` of its own
   container or scope. The second call waits for the cleanup that runs. That
   cleanup waits for the hook.

In both patterns, no Promise settles, and the disposal never finishes. Before
release `1.0.0-rc.11`, the second pattern returned at once. At that time, a
second call did not wait for the cleanup that runs.

## Decision

Kizuna keeps both patterns as usage rules. It does not detect them, and it
reports no diagnostic event for them.

To detect the patterns, Kizuna must know which asynchronous operation calls
`disposeAsync()`. Only an asynchronous context gives this information, for
example `AsyncLocalStorage` in Node.js. Kizuna supports edge runtimes such as
workerd without `nodejs_compat`, and these runtimes do not provide it.

Without that context, each pattern looks like a correct use. A shutdown can
start while a factory still creates its value. A second caller can wait for a
cleanup that runs. A diagnostic event at these points also occurs for correct
code, so it does not identify the fault.

A timeout can report a disposal that takes a long time. It cannot tell a
disposal that waits for itself from a slow cleanup. Each application also needs
a different time limit. For these reasons, Kizuna does not use a timeout.

Kizuna detects the one form that it can see. A cleanup hook can call
`disposeAsync()` of its own container while Kizuna starts the hook, before the
first `await` of the hook. Kizuna resolves this call at once (ADR-012).

## Consequences

- The README describes both patterns and their correction in the section
  "When `disposeAsync()` never settles".
- An application that needs a time limit for its shutdown adds the limit around
  its own `disposeAsync()` call.
- The supported runtimes can get an asynchronous context in the future, for
  example through the TC39 AsyncContext proposal. Then Kizuna can detect both
  patterns, and the project reviews this decision again.
