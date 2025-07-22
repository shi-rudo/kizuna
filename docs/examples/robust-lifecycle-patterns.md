# Robust Lifecycle Pattern Examples

## Anti-Pattern: String Manipulation Based on Class Names

```typescript
// ❌ FRAGILE: Assumes naming convention
function getLifecycleType(lifecycleClass: any): string {
    return lifecycleClass.constructor.name.replace('Lifecycle', '').toLowerCase();
}

// ❌ FRAGILE: String-based lifecycle detection  
if (container.constructor.name.endsWith('Lifecycle')) {
    const type = container.constructor.name.replace('Lifecycle', '');
    // ... logic based on extracted type
}
```

## ✅ Robust Patterns

### 1. Abstract Method Approach
```typescript
abstract class BaseLifecycle implements Container {
    abstract getLifecycleType(): LifecycleType;
    
    // Common lifecycle behavior
    abstract getInstance(...args: any[]): any;
    abstract createScope(): Container;
    abstract dispose(): void;
}

class SingletonLifecycle extends BaseLifecycle {
    getLifecycleType(): LifecycleType {
        return LifecycleType.Singleton;
    }
}
```

### 2. Mapping-Based Approach
```typescript
enum LifecycleType {
    Singleton = 'singleton',
    Scoped = 'scoped',
    Transient = 'transient'
}

const LIFECYCLE_MAP = new Map<Function, LifecycleType>([
    [SingletonLifecycle, LifecycleType.Singleton],
    [ScopedLifecycle, LifecycleType.Scoped],
    [TransientLifecycle, LifecycleType.Transient]
]);

function getLifecycleType(lifecycle: Container): LifecycleType {
    return LIFECYCLE_MAP.get(lifecycle.constructor) || LifecycleType.Transient;
}
```

### 3. Symbol-Based Type Identification
```typescript
const LIFECYCLE_TYPE = Symbol('lifecycleType');

interface TypedContainer extends Container {
    readonly [LIFECYCLE_TYPE]: LifecycleType;
}

class SingletonLifecycle implements TypedContainer {
    readonly [LIFECYCLE_TYPE] = LifecycleType.Singleton;
}
```

### 4. Current Kizuna Approach (Already Robust)
```typescript
// ✅ Direct instantiation and type-safe usage
class ContainerBuilder {
    registerSingleton<T>(key: string, ctor: new (...args: any[]) => T, ...deps: string[]) {
        return this.registerTypeSafe(key, configurator, new SingletonLifecycle());
    }
    
    registerScoped<T>(key: string, ctor: new (...args: any[]) => T, ...deps: string[]) {
        return this.registerTypeSafe(key, configurator, new ScopedLifecycle());
    }
}
```

### 5. Parameter Name Validation (Kizuna Feature)
```typescript
// ✅ Strict parameter validation enabled by default
class EmailService {
    constructor(private logger: Logger, private mailer: MailService) {}
}

// This will fail validation - parameter names don't match
builder.registerScoped("EmailService", EmailService, "MailService", "Logger");
//                                                    ^^^^^^^^^^^ Wrong order!

// ✅ Correct - parameter names match
builder.registerScoped("EmailService", EmailService, "logger", "mailer");

// ✅ Opt-out if needed (not recommended)
builder
    .disableStrictParameterValidation()  // Disable validation
    .registerScoped("EmailService", EmailService, "MailService", "Logger"); // Now allowed
```

## Key Principles

1. **Avoid String-Based Type Detection**: Never rely on class names for behavior
2. **Use Explicit Type Information**: Abstract methods, enums, or symbols
3. **Prefer Composition Over Convention**: Explicit configuration over naming patterns
4. **Make Breaking Changes Obvious**: If names change, code should fail at compile time

## Benefits of Robust Approaches

- **Refactoring Safety**: Class renames don't break functionality
- **Type Safety**: Compile-time guarantees over runtime string parsing
- **Maintainability**: Clear contracts and explicit behavior
- **Performance**: No runtime string manipulation or reflection needed