/**
 * Example demonstrating the new type-safe API for Kizuna DI library
 */
import { ContainerBuilder } from '../src/api/container-builder';

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

// 🎉 NEW TYPE-SAFE API - Direct constructor registration
// Build container with full type safety and autocompletion
const container = new ContainerBuilder()
    .registerSingleton('Logger', ConsoleLogger)
    .registerSingleton('DatabaseService', DatabaseService, 'Logger')
    .registerScoped('UserService', UserService, 'DatabaseService', 'Logger')
    .buildTypeSafe();

// ✨ IDE Autocompletion: When you type container.get(", your IDE will suggest:
// - "Logger"
// - "DatabaseService" 
// - "UserService"

// 🔥 Type Inference: No need for generics! Types are automatically inferred:
const logger = container.get('Logger');           // Type: ConsoleLogger ✅
const database = container.get('DatabaseService'); // Type: DatabaseService ✅
const userService = container.get('UserService');  // Type: UserService ✅

// 🚨 Compile-time Safety: This will cause TypeScript compilation error:
// const invalid = container.get('NonExistentService'); // ❌ TS Error!

// 🔄 Scoping still works with type safety
const scope = container.startScope();
const scopedUserService = scope.get('UserService'); // Type: UserService ✅

// 🎯 All method calls work with proper type inference
logger.log('Type-safe logging!');                    // ✅ Works!
const results = database.query('SELECT * FROM users'); // ✅ Works!

// For async operations, wrap in an async function
async function demonstrateAsyncCall() {
    const user = await userService.getUser(123);      // ✅ Works!
    return user;
}

async function main() {
    const user = await userService.getUser(1);
    console.log(`User: ${user.name}`);
    
    // Demonstrate scoped services
    const scope1 = container.startScope();
    const scope2 = container.startScope();
    
    const userSvc1 = scope1.get('UserService');
    const userSvc2 = scope2.get('UserService');
    
    console.log('Scoped services are different instances:', userSvc1 !== userSvc2);
}

// ⚡ The old API still works for backward compatibility
const oldBuilder = new ContainerBuilder();
oldBuilder.addSingleton(r => r.fromType(ConsoleLogger));
const oldContainer = oldBuilder.build();
const oldLogger = oldContainer.get(ConsoleLogger); // Works as before

export { container, main };