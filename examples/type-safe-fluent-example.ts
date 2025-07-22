/**
 * Fluent API Example
 * Demonstrates the FluentContainerBuilder with type-safe key tracking
 */
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';

// Example services
class Logger {
    public messages: string[] = [];
    
    log(message: string): void {
        this.messages.push(message);
        console.log(`[LOG]: ${message}`);
    }
}

class DatabaseService {
    constructor(private logger: Logger) {}
    
    connect(): void {
        this.logger.log('Connecting to database...');
    }
    
    query(sql: string): any[] {
        this.logger.log(`Executing: ${sql}`);
        return [{ id: 1, data: 'result' }];
    }
}

class UserService {
    constructor(private db: DatabaseService, private logger: Logger) {}
    
    async getUser(id: number): Promise<{ id: number; name: string }> {
        this.logger.log(`Getting user ${id}`);
        this.db.connect();
        this.db.query(`SELECT * FROM users WHERE id = ${id}`);
        return { id, name: 'John Doe' };
    }
}

console.log('=== TYPE-SAFE FLUENT API EXAMPLE ===\n');

// 🎯 Type-Safe Fluent Registration
// All registrations are type-safe with compile-time key validation

const container = new FluentContainerBuilder()
    // Type-safe constructor-based registration
    .registerSingleton('Logger', Logger)
    .registerSingleton('Database', DatabaseService, 'Logger')
    .registerScoped('UserService', UserService, 'Database', 'Logger')
    
    // Type-safe factory-based registration  
    .registerFactory('AppConfig', () => ({
        environment: 'development',
        apiUrl: 'https://api.example.com'
    }))
    
    // Factory functions for complex initialization
    .registerFactory('AdvancedService', (provider) => {
        const logger = provider.get('Logger');
        logger.log('Creating advanced service with complex logic');
        return { advanced: true };
    })
    
    .build(); // 🚀 Build with type safety!

console.log('✅ Container built with type-safe methods');

// 🎯 Type-Safe Resolution with Autocompletion
// IDE will suggest: 'Logger', 'Database', 'UserService', 'AppConfig'

const logger = container.get('Logger');        // Type: Logger (auto-inferred!)
const database = container.get('Database');    // Type: DatabaseService
const userService = container.get('UserService'); // Type: UserService
const appConfig = container.get('AppConfig');  // Type: inferred from factory

console.log('\n📦 Services resolved with type safety:');
console.log('- Logger:', logger.constructor.name);
console.log('- Database:', database.constructor.name);
console.log('- UserService:', userService.constructor.name);
console.log('- AppConfig:', typeof appConfig);

// 🔥 Use the services
userService.getUser(123).then(() => {
    console.log('\n📊 Logger messages:');
    logger.messages.forEach((msg, i) => console.log(`${i + 1}. ${msg}`));
});

// ✨ TypeScript Compile-Time Safety
// These would cause TypeScript compilation errors:
// const invalid = container.get('DoesNotExist'); // ❌ TS Error!
// const wrong = container.get('Logger').nonExistentMethod(); // ❌ TS Error!

// 🔄 Scoped Services Work Too
console.log('\n🔄 Testing scoped services:');
const scope1 = container.startScope();
const scope2 = container.startScope();

const userSvc1 = scope1.get('UserService');
const userSvc2 = scope2.get('UserService');

console.log('Different UserService instances (scoped):', userSvc1 !== userSvc2);
console.log('Same Logger instance (singleton):', 
    scope1.get('Logger') === scope2.get('Logger'));

// 🎉 Benefits of Type-Safe Fluent API:
console.log('\n🎉 TYPE-SAFE FLUENT API BENEFITS:');
console.log('✅ Simple, clean API with type safety');
console.log('✅ Type-safe service keys with IDE autocompletion');
console.log('✅ Compile-time errors for unregistered services');
console.log('✅ Automatic type inference for resolved services');
console.log('✅ Factory functions for complex initialization');
console.log('✅ All service lifecycles supported (singleton, scoped, transient)');

export { container };