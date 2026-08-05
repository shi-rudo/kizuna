# Interface tokens and typed dependencies

Kizuna now uses interface tokens for interface registration and resolution.
Each token stores an interface type and one fixed string key.

This change affects these methods:

- `registerSingletonInterface`
- `registerScopedInterface`
- `registerTransientInterface`
- `TypeSafeServiceLocator.get`

## Create a token

Create each token once and reuse it:

```typescript
const EmailService = interfaceToken<IEmailService>()('EmailService');
const Cache = interfaceToken<ICache>()('Cache');
```

The first call supplies the interface type. The second call lets TypeScript infer
the exact literal key. Broad strings, unions, and open template-literal patterns
are not valid token keys.

## Replace string interface registrations

String interface registrations no longer compile:

```typescript
// Before
builder.registerScopedInterface<
  IEmailService,
  'EmailService',
  typeof SMTPEmailService
>('EmailService', SMTPEmailService, 'Logger');

// After
const EmailService = interfaceToken<IEmailService>()('EmailService');

builder.registerScopedInterface(
  EmailService,
  SMTPEmailService,
  'Logger'
);
```

The same token syntax applies to implementations without constructor dependencies:

```typescript
const Logger = interfaceToken<ILogger>()('Logger');
builder.registerSingletonInterface(Logger, ConsoleLogger);
```

## Resolve with the token

Pass the token to `get()` to preserve the interface type:

```typescript
const container = builder.build();
const emailService = container.get(EmailService); // IEmailService
```

An unregistered token fails TypeScript compilation. A token with the correct key
but a different interface type also fails compilation.

Tokens are strings at runtime. You can use a registered token as a constructor
dependency key:

```typescript
builder
  .registerSingletonInterface(EmailService, SMTPEmailService, 'Logger')
  .registerScoped('NotificationService', NotificationService, EmailService);
```

## Fix dependency errors

Each dependency must be registered before its consumer. The service type must
match the implementation constructor parameter at the same position.

If TypeScript reports an error, make these changes:

1. Register each dependency before its consumer.
2. Put the dependency keys in the constructor parameter order.
3. Add one key for each required parameter.
4. Remove keys that do not have a constructor parameter.
5. Use a key whose service type is assignable to the parameter type.

Optional constructor parameters accept zero or one matching key. Rest parameters
accept zero or more matching keys. A dependency list can match any public
constructor overload. Every public constructor overload must return a service
that is assignable to the token interface.

TypeScript uses structural types for these checks. Services with the same
structure are compatible even when they use different class names.
