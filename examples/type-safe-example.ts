/**
 * Example demonstrating the TypeSafe API for Kizuna DI library
 */
import { TypeSafeContainerBuilder } from '../src/api/type-safe-container-builder';

// Example services
interface ILogger {
    log(message: string): void;
}

class ConsoleLogger implements ILogger {
    log(message: string): void {
        console.log(`[LOG]: ${message}`);
    }
}

class DatabaseService {
    constructor(private logger: ILogger) {}
    
    query(sql: string): any[] {
        this.logger.log(`Executing: ${sql}`);
        return [];
    }
}

class UserService {
    constructor(private db: DatabaseService, private logger: ILogger) {}
    
    async getUser(id: number): Promise<{ id: number; name: string }> {
        this.logger.log(`Getting user ${id}`);
        this.db.query(`SELECT * FROM users WHERE id = ${id}`);
        return { id, name: 'John Doe' };
    }
}

// 🎉 TYPE-SAFE API - Direct constructor registration
// Build container with full type safety and autocompletion
const container = new TypeSafeContainerBuilder()
    .registerSingleton('Logger', ConsoleLogger)
    .registerSingleton('DatabaseService', DatabaseService, 'Logger')
    .registerScoped('UserService', UserService, 'DatabaseService', 'Logger')
    .buildTypeSafe();

// 🚀 INTERFACE-KEY REGISTRATION PATTERN
// Register services using interface types with type safety
// Using step-by-step registration for better TypeScript inference
const builder = new TypeSafeContainerBuilder();
const withLogger = builder.registerInterface<ILogger>('ILogger', ConsoleLogger);
const withDatabase = withLogger.registerSingleton('DatabaseService', DatabaseService, 'ILogger');
const interfaceContainer = withDatabase.registerScoped('UserService', UserService, 'DatabaseService', 'ILogger').buildTypeSafe();

// Alternative: Mixed pattern (interface + concrete types)
const mixedContainer = new TypeSafeContainerBuilder()
    .registerInterface<ILogger>('ILogger', ConsoleLogger)  // Interface registration
    .registerSingleton('DatabaseService', DatabaseService, 'ILogger')  // Concrete registration
    .registerScoped('UserService', UserService, 'DatabaseService', 'ILogger')
    .buildTypeSafe();

// ✨ IDE Autocompletion: When you type container.get(", your IDE will suggest:
// - "Logger"
// - "DatabaseService" 
// - "UserService"

// 🔥 Type Inference: No need for generics! Types are automatically inferred:
const logger = container.get('Logger');           // Type: ConsoleLogger ✅
const database = container.get('DatabaseService'); // Type: DatabaseService ✅
const userService = container.get('UserService');  // Type: UserService ✅

// 🎯 INTERFACE-BASED RESOLUTION with Type Safety:
// The step-by-step approach ensures proper TypeScript type inference
const iLogger = interfaceContainer.get('ILogger');         // Type: ILogger ✅
const iDatabase = interfaceContainer.get('DatabaseService'); // Type: DatabaseService ✅
const iUserService = interfaceContainer.get('UserService'); // Type: UserService ✅

// Mixed container example
const mixedLogger = mixedContainer.get('ILogger');         // Type: ILogger ✅
const mixedDatabase = mixedContainer.get('DatabaseService'); // Type: DatabaseService ✅
const mixedUserService = mixedContainer.get('UserService'); // Type: UserService ✅

// 🚨 Compile-time Safety: This will cause TypeScript compilation error:
// const invalid = container.get('NonExistentService'); // ❌ TS Error!

// 🔄 Scoping still works with type safety
const scope = container.startScope();
const scopedUserService = scope.get('UserService'); // Type: UserService ✅

// 🎯 All method calls work with proper type inference
logger.log('Type-safe logging!');                    // ✅ Works!
const results = database.query('SELECT * FROM users'); // ✅ Works!

// 🔗 Interface-based calls work seamlessly
iLogger.log('Interface-based logging!');             // ✅ Works!
const interfaceResults = iDatabase.query('SELECT * FROM users'); // ✅ Works!

// Mixed container calls
mixedLogger.log('Mixed container logging!');         // ✅ Works!
const mixedResults = mixedDatabase.query('SELECT * FROM mixed'); // ✅ Works!

// For async operations, wrap in an async function
async function demonstrateAsyncCall() {
    const user = await userService.getUser(123);       // ✅ Works!
    const interfaceUser = await iUserService.getUser(456); // ✅ Works with interface!
    const mixedUser = await mixedUserService.getUser(789); // ✅ Works with mixed container!
    return { user, interfaceUser, mixedUser };
}

async function main() {
    const user = await userService.getUser(1);
    const interfaceUser = await iUserService.getUser(2);
    const mixedUser = await mixedUserService.getUser(3);
    console.log(`User: ${user.name}, Interface User: ${interfaceUser.name}, Mixed User: ${mixedUser.name}`);
    
    // Demonstrate scoped services work with all approaches
    const scope1 = container.startScope();
    const scope2 = container.startScope();
    const interfaceScope = interfaceContainer.startScope();
    const mixedScope = mixedContainer.startScope();
    
    const userSvc1 = scope1.get('UserService');
    const userSvc2 = scope2.get('UserService');
    const iUserSvcScoped = interfaceScope.get('UserService');
    const mixedUserSvcScoped = mixedScope.get('UserService');
    
    console.log('Scoped services are different instances:', userSvc1 !== userSvc2);
    console.log('Interface scoped service works:', iUserSvcScoped !== iUserService);
    console.log('Mixed scoped service works:', mixedUserSvcScoped !== mixedUserService);
}

// ⚡ The fluent API is available for runtime flexibility
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
const fluentBuilder = new FluentContainerBuilder();
fluentBuilder.addSingleton(r => r.fromType(ConsoleLogger));
const fluentContainer = fluentBuilder.build();
const fluentLogger = fluentContainer.get(ConsoleLogger); // Runtime flexibility

export { container, interfaceContainer, mixedContainer, main };