/**
 * Unified ContainerBuilder Example
 * 
 * Demonstrates the ultimate type-safe dependency injection container that supports:
 * - Constructor-based registration
 * - Interface-based registration  
 * - Factory-based registration
 * - All service lifecycles (singleton, scoped, transient)
 * - Full type safety with IDE autocompletion
 */
import { ContainerBuilder } from '../src/api/container-builder';

// =================
// SERVICE DEFINITIONS
// =================

// Basic services
class Logger {
    private messages: string[] = [];
    
    log(message: string): void {
        this.messages.push(message);
        console.log(`[LOG]: ${message}`);
    }
    
    getMessages(): string[] {
        return [...this.messages];
    }
}

// Interface-based services
interface IDatabase {
    connect(): Promise<void>;
    query<T>(sql: string): Promise<T[]>;
}

class PostgreSQLDatabase implements IDatabase {
    constructor(private logger: Logger) {}
    
    async connect(): Promise<void> {
        this.logger.log('Connecting to PostgreSQL database...');
    }
    
    async query<T>(sql: string): Promise<T[]> {
        this.logger.log(`Executing query: ${sql}`);
        return [] as T[];
    }
}

interface ICache {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

class RedisCache implements ICache {
    constructor(private logger: Logger) {}
    
    async get<T>(key: string): Promise<T | null> {
        this.logger.log(`Cache GET: ${key}`);
        return null;
    }
    
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        this.logger.log(`Cache SET: ${key} (TTL: ${ttl || 'none'})`);
    }
}

// Business logic services
class UserService {
    constructor(
        private database: IDatabase,
        private cache: ICache,
        private logger: Logger
    ) {}
    
    async getUser(id: number): Promise<{ id: number; name: string }> {
        this.logger.log(`Getting user ${id}`);
        
        // Try cache first
        const cached = await this.cache.get<any>(`user:${id}`);
        if (cached) {
            this.logger.log(`User ${id} found in cache`);
            return cached;
        }
        
        // Query database
        await this.database.connect();
        const users = await this.database.query(`SELECT * FROM users WHERE id = ${id}`);
        
        const user = { id, name: 'John Doe' };
        await this.cache.set(`user:${id}`, user, 300);
        
        return user;
    }
}

console.log('=== UNIFIED CONTAINER BUILDER EXAMPLE ===\n');

// =================
// THE ULTIMATE CONTAINER
// =================

const container = new ContainerBuilder()
    // 🏗️ Constructor-based registration
    .registerSingleton('Logger', Logger)
    .registerScoped('UserService', UserService, 'IDatabase', 'ICache', 'Logger')
    
    // 🎯 Interface-based registration
    .registerInterface<IDatabase>('IDatabase', PostgreSQLDatabase, 'Logger')
    .registerScopedInterface<ICache>('ICache', RedisCache, 'Logger')
    
    // 🏭 Factory-based registration
    .registerFactory('AppConfig', (provider) => {
        const logger = provider.get('Logger'); // Type: Logger ✅
        logger.log('Initializing application configuration');
        
        return {
            environment: process.env.NODE_ENV || 'development',
            database: {
                host: 'localhost',
                port: 5432,
                name: 'myapp'
            },
            redis: {
                host: 'localhost',
                port: 6379
            },
            features: {
                caching: true,
                analytics: false
            }
        };
    })
    
    .registerScopedFactory('RequestContext', (provider) => {
        const logger = provider.get('Logger');
        const requestId = crypto.randomUUID();
        logger.log(`Creating request context: ${requestId}`);
        
        return {
            requestId,
            startTime: Date.now(),
            userAgent: 'example-client'
        };
    })
    
    .registerTransientFactory('Timestamp', () => {
        return new Date().toISOString();
    })
    
    .build(); // 🚀 Build the ultimate container!

console.log('✅ Unified container built successfully!\n');

// =================
// TYPE-SAFE RESOLUTION
// =================

console.log('🎯 Demonstrating type-safe service resolution:\n');

// All services are fully typed!
const logger = container.get('Logger');              // Type: Logger
const userService = container.get('UserService');   // Type: UserService
const database = container.get('IDatabase');        // Type: IDatabase  
const cache = container.get('ICache');              // Type: ICache
const config = container.get('AppConfig');          // Type: inferred from factory!

console.log('Service types resolved:');
console.log(`- Logger: ${logger.constructor.name}`);
console.log(`- UserService: ${userService.constructor.name}`);
console.log(`- Database: ${database.constructor.name}`);
console.log(`- Cache: ${cache.constructor.name}`);
console.log(`- Config: ${typeof config}`);

// =================
// DEMONSTRATE SCOPED SERVICES
// =================

console.log('\n🔄 Testing scoped services:\n');

const scope1 = container.startScope();
const scope2 = container.startScope();

const userSvc1 = scope1.get('UserService');
const userSvc2 = scope2.get('UserService');
const context1 = scope1.get('RequestContext');
const context2 = scope2.get('RequestContext');

console.log('Scoped service behavior:');
console.log(`- Different UserService instances: ${userSvc1 !== userSvc2}`);
console.log(`- Different RequestContext instances: ${context1 !== context2}`);
console.log(`- Same Logger instance (singleton): ${scope1.get('Logger') === scope2.get('Logger')}`);

// =================
// USE THE SERVICES
// =================

console.log('\n📊 Using the services:\n');

// Use the user service (demonstrates all integrations working together)
userService.getUser(123).then(() => {
    console.log('\n📝 All logged messages:');
    logger.getMessages().forEach((msg, i) => console.log(`${i + 1}. ${msg}`));
    
    console.log('\n🎉 UNIFIED CONTAINER BENEFITS:');
    console.log('✅ One API for all registration patterns');
    console.log('✅ Full type safety with IDE autocompletion');  
    console.log('✅ Constructor, interface, and factory registration');
    console.log('✅ All service lifecycles supported');
    console.log('✅ Type-safe factory functions with provider access');
    console.log('✅ Compile-time errors for invalid registrations');
    console.log('✅ Zero runtime configuration needed');
    console.log('✅ Perfect for any TypeScript project!');
});

export { container };