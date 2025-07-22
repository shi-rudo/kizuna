/**
 * Validation Example
 * 
 * Demonstrates the validation capabilities of the unified ContainerBuilder
 */
import { ContainerBuilder } from '../src/api/container-builder';

// Example services
class Logger {
    log(message: string) { console.log(`[LOG]: ${message}`); }
}

class DatabaseService {
    constructor(private logger: Logger) {}
    connect() { this.logger.log('Connecting to database...'); }
}

class UserService {
    constructor(private db: DatabaseService, private logger: Logger) {}
    getUsers() { 
        this.logger.log('Getting users...');
        this.db.connect();
    }
}

console.log('=== VALIDATION EXAMPLE ===\n');

// Example 1: Valid configuration
console.log('1. Testing valid configuration:');
const validBuilder = new ContainerBuilder()
    .registerSingleton('Logger', Logger)
    .registerSingleton('DatabaseService', DatabaseService, 'Logger')
    .registerScoped('UserService', UserService, 'DatabaseService', 'Logger');

const validationIssues = validBuilder.validate();
console.log(`Validation issues: ${validationIssues.length === 0 ? 'None ✅' : validationIssues.join(', ')}`);

// Example 2: Invalid configuration with missing dependencies
console.log('\n2. Testing invalid configuration with missing dependencies:');
const invalidBuilder = new ContainerBuilder()
    .registerSingleton('DatabaseService', DatabaseService, 'MissingLogger')  // Missing Logger
    .registerScoped('UserService', UserService, 'DatabaseService', 'AnotherMissingLogger'); // Missing Logger

const invalidationIssues = invalidBuilder.validate();
console.log(`Validation issues found: ${invalidationIssues.length}`);
invalidationIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));

// Example 3: Build and use valid container
console.log('\n3. Building and using valid container:');
const revalidationIssues = validBuilder.validate();
if (revalidationIssues.length > 0) {
    console.error(`Revalidation failed with issues: ${revalidationIssues.join(', ')}`);
    throw new Error('Container build aborted due to validation issues.');
}
const container = validBuilder.build();

const userService = container.get('UserService');
userService.getUsers();

console.log('\n✅ Validation helps catch configuration issues before runtime!');
console.log('✅ Revalidation before building ensures consistency and safety!');

export { invalidBuilder, validBuilder };
