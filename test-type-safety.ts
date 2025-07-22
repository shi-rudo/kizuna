// Quick test to verify type safety works
import { FluentContainerBuilder } from './src/api/fluent-container-builder';

class TestService {
    test(): string { return 'test'; }
}

const container = new FluentContainerBuilder()
    .registerSingleton('TestService', TestService)
    .build();

// This should work and provide proper typing
const service = container.get('TestService');
console.log('Type of service:', typeof service);
console.log('Service method result:', service.test());

// This should cause TypeScript error (uncomment to test)
// const invalid = container.get('DoesNotExist');