/**
 * Example demonstrating the Fluent API for Kizuna DI library
 * Covers: Class registration, Interface registration, and Factory functions
 */
import { FluentContainerBuilder } from '../src/api/fluent-container-builder';

// 1. INTERFACE DEFINITIONS
interface ILogger {
    log(message: string): void;
    error(message: string): void;
}

interface IDatabase {
    connect(): void;
    query(sql: string): any[];
    disconnect(): void;
}

interface IEmailService {
    send(to: string, subject: string, body: string): void;
}

// 2. CLASS IMPLEMENTATIONS
class ConsoleLogger implements ILogger {
    public messages: string[] = [];
    
    log(message: string): void {
        this.messages.push(`[LOG]: ${message}`);
        console.log(`[LOG]: ${message}`);
    }
    
    error(message: string): void {
        this.messages.push(`[ERROR]: ${message}`);
        console.error(`[ERROR]: ${message}`);
    }
}

class PostgreSQLDatabase implements IDatabase {
    private connected = false;
    
    constructor(private logger: ILogger) {}
    
    connect(): void {
        this.logger.log('Connecting to PostgreSQL database...');
        this.connected = true;
    }
    
    query(sql: string): any[] {
        if (!this.connected) {
            throw new Error('Database not connected');
        }
        this.logger.log(`Executing query: ${sql}`);
        return [{ id: 1, result: 'mock data' }];
    }
    
    disconnect(): void {
        this.logger.log('Disconnecting from database...');
        this.connected = false;
    }
}

class UserService {
    constructor(
        private database: IDatabase,
        private emailService: IEmailService,
        private logger: ILogger
    ) {}
    
    async createUser(userData: { name: string; email: string }): Promise<{ id: number; name: string; email: string }> {
        this.logger.log(`Creating user: ${userData.name}`);
        
        // Connect to database
        this.database.connect();
        
        // Save user
        this.database.query(`INSERT INTO users (name, email) VALUES ('${userData.name}', '${userData.email}')`);
        
        // Send welcome email
        this.emailService.send(userData.email, 'Welcome!', `Hello ${userData.name}, welcome to our platform!`);
        
        // Disconnect
        this.database.disconnect();
        
        return { id: 1, ...userData };
    }
}

// 3. FACTORY FUNCTIONS
// Factory functions receive a ServiceLocator to resolve dependencies
function createEmailServiceFactory(serviceProvider: any): IEmailService {
    // Resolve logger dependency from the container
    const logger = serviceProvider.get('ILogger') as ILogger;
    
    return {
        send(to: string, subject: string, body: string): void {
            logger.log(`Sending email to ${to}: ${subject}`);
            // Simulate email sending
            console.log(`📧 Email sent to ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Body: ${body}`);
        }
    };
}

function createAdvancedLoggerFactory(environment: string = 'development') {
    return (serviceProvider: any): ILogger => {
        if (environment === 'production') {
            return new class ProductionLogger implements ILogger {
                log(message: string): void {
                    console.log(`[PROD] ${new Date().toISOString()} - ${message}`);
                }
                error(message: string): void {
                    console.error(`[PROD ERROR] ${new Date().toISOString()} - ${message}`);
                }
            };
        }
        return new ConsoleLogger();
    };
}

// Simple factory function without dependencies
function createSimpleEmailService(): IEmailService {
    return {
        send(to: string, subject: string, body: string): void {
            console.log(`📨 Simple email to ${to}: ${subject}`);
            console.log(`Body: ${body}`);
        }
    };
}

// 🚀 FLUENT API EXAMPLES

console.log('=== FLUENT API EXAMPLES ===\n');

// Example 1: Basic Class Registration
console.log('1. BASIC CLASS REGISTRATION');
const basicContainer = new FluentContainerBuilder()
    .addSingleton(r => r.fromType(ConsoleLogger))
    .addScoped(r => r.fromType(PostgreSQLDatabase).withDependencies(ConsoleLogger))
    .build();

const logger = basicContainer.get(ConsoleLogger);
const database = basicContainer.get(PostgreSQLDatabase);

logger.log('Basic class registration working!');
database.connect();
database.query('SELECT * FROM users');
database.disconnect();

console.log('\n---\n');

// Example 2: Interface-Based Registration
console.log('2. INTERFACE-BASED REGISTRATION');
const interfaceContainer = new FluentContainerBuilder()
    // Register concrete implementation for ILogger interface
    .addSingleton(r => r.fromName('ILogger').useType(ConsoleLogger))
    // Register concrete implementation for IDatabase interface with dependencies
    .addScoped(r => r.fromName('IDatabase').useType(PostgreSQLDatabase).withDependencies('ILogger'))
    .build();

const iLogger = interfaceContainer.get<ILogger>('ILogger');
const iDatabase = interfaceContainer.get<IDatabase>('IDatabase');

iLogger.log('Interface-based registration working!');
iDatabase.connect();
iDatabase.query('SELECT * FROM products');
iDatabase.disconnect();

console.log('\n---\n');

// Example 3: Factory Function Registration
console.log('3. FACTORY FUNCTION REGISTRATION');

// Simple factory without dependencies
const simpleFactoryContainer = new FluentContainerBuilder()
    .addSingleton(r => r.fromName('ISimpleEmail').useFactory(() => createSimpleEmailService()))
    .build();

const simpleEmailService = simpleFactoryContainer.get<IEmailService>('ISimpleEmail');
simpleEmailService.send('user@example.com', 'Simple Test', 'This is from a simple factory!');

// Advanced factory with dependencies
const factoryContainer = new FluentContainerBuilder()
    // Register logger first (dependency for email service)
    .addSingleton(r => r.fromName('ILogger').useType(ConsoleLogger))
    // Register logger using advanced factory function
    .addSingleton(r => r.fromName('IAdvancedLogger').useFactory(createAdvancedLoggerFactory('development')))
    // Register email service using factory function that resolves dependencies from container
    .addSingleton(r => r.fromName('IEmailService').useFactory(createEmailServiceFactory))
    .build();

const factoryLogger = factoryContainer.get<ILogger>('IAdvancedLogger');
const emailService = factoryContainer.get<IEmailService>('IEmailService');

factoryLogger.log('Factory function registration working!');
emailService.send('user@example.com', 'Test', 'This is a test email from factory function!');

console.log('\n---\n');

// Example 4: Complex Real-World Scenario
console.log('4. COMPLEX REAL-WORLD SCENARIO');
const appContainer = new FluentContainerBuilder()
    // Register logger as singleton (one instance for entire application)
    .addSingleton(r => r.fromName('ILogger').useType(ConsoleLogger))
    
    // Register database as singleton (connection pooling)
    .addSingleton(r => r.fromName('IDatabase').useType(PostgreSQLDatabase).withDependencies('ILogger'))
    
    // Register email service using factory function
    .addSingleton(r => r.fromName('IEmailService').useFactory(createEmailServiceFactory))
    
    // Register user service as scoped (new instance per request/operation)
    .addScoped(r => r.fromType(UserService).withDependencies('IDatabase', 'IEmailService', 'ILogger'))
    .build();

// Simulate different request scopes
const scope1 = appContainer.startScope();
const scope2 = appContainer.startScope();

const userService1 = scope1.get(UserService);
const userService2 = scope2.get(UserService);

// Different UserService instances (scoped)
console.log('UserService instances are different (scoped):', userService1 !== userService2);

// But they share the same logger (singleton)
const sharedLogger1 = scope1.get<ILogger>('ILogger');
const sharedLogger2 = scope2.get<ILogger>('ILogger');
console.log('Logger instances are same (singleton):', sharedLogger1 === sharedLogger2);

// Use the services
console.log('\nCreating users in different scopes:');

userService1.createUser({ name: 'Alice Johnson', email: 'alice@example.com' }).then(() => {
    console.log('✅ User created in scope 1');
});

userService2.createUser({ name: 'Bob Smith', email: 'bob@example.com' }).then(() => {
    console.log('✅ User created in scope 2');
});

console.log('\n---\n');

// Example 5: Mixed Registration Patterns
console.log('5. MIXED REGISTRATION PATTERNS');
const mixedContainer = new FluentContainerBuilder()
    // Direct class registration
    .addSingleton(r => r.fromType(ConsoleLogger))
    
    // Interface registration with concrete type
    .addSingleton(r => r.fromName('IDatabase').useType(PostgreSQLDatabase).withDependencies(ConsoleLogger))
    
    // Factory function registration
    .addTransient(r => r.fromName('IEmailService').useFactory(() => ({
        send(to: string, subject: string, body: string): void {
            console.log(`📨 Quick email to ${to}: ${subject}`);
        }
    })))
    
    // Mixed dependencies: some by class, some by interface name
    .addScoped(r => r.fromType(UserService).withDependencies('IDatabase', 'IEmailService', ConsoleLogger))
    .build();

const mixedUserService = mixedContainer.get(UserService);
mixedUserService.createUser({ name: 'Charlie Brown', email: 'charlie@example.com' }).then(() => {
    console.log('✅ Mixed registration pattern working!');
});

console.log('\n=== FLUENT API FEATURES DEMONSTRATED ===');
console.log('✅ Class registration with .fromType()');
console.log('✅ Interface registration with .fromName().useType()');  
console.log('✅ Factory function registration with .fromName().useFactory()');
console.log('✅ Dependency injection with .withDependencies()');
console.log('✅ Service lifecycles: singleton, scoped, transient');
console.log('✅ Mixed registration patterns in same container');
console.log('✅ Real-world application architecture example');

export { 
    basicContainer, 
    interfaceContainer, 
    factoryContainer, 
    appContainer, 
    mixedContainer 
};