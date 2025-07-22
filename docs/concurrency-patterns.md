# Concurrency Patterns with Kizuna

## Overview

Kizuna is designed for JavaScript's single-threaded execution model and provides optimal performance for the majority of use cases. However, modern JavaScript applications sometimes need to handle concurrency through Web Workers, Node.js Worker Threads, or high-throughput server scenarios.

**This guide covers safe and effective patterns** for using Kizuna in concurrent environments.

## 🚨 Important: Kizuna is NOT Thread-Safe

**Kizuna does not provide built-in thread safety.** Sharing container instances across threads or concurrent contexts can lead to:

- Race conditions in service instance creation
- Inconsistent service state
- Memory leaks from incomplete disposal
- Unpredictable behavior in service resolution

**Instead, use the patterns below** to safely handle concurrency.

## 📋 Quick Reference

| Scenario | Recommended Pattern | Safety Level |
|----------|-------------------|--------------|
| Node.js Web Server | Request-Scoped Containers | ✅ Safe |
| Web Workers | Container-per-Worker | ✅ Safe |
| Node.js Worker Threads | Container-per-Thread | ✅ Safe |
| High-Concurrency Server | Message Passing | ✅ Safe |
| Shared Container | ❌ **Don't Do This** | 🚨 Unsafe |

## 1. Container-per-Worker Pattern ✅

**Use Case:** Browser applications with Web Workers or Service Workers

**Pattern:** Each worker creates its own container instance

### Example: Web Worker with Kizuna

**Main Thread:**
```typescript
// main.ts
import { ContainerBuilder } from '@shirudo/kizuna';

// Create container configuration (not the container itself)
const createContainer = () => new ContainerBuilder()
    .registerSingleton('Logger', Logger)
    .registerSingleton('ApiClient', ApiClient, 'Logger')
    .registerScoped('DataProcessor', DataProcessor, 'ApiClient')
    .build();

// Main thread has its own container
const mainContainer = createContainer();

// Spawn workers - they'll create their own containers
const worker = new Worker('worker.js');
worker.postMessage({ type: 'PROCESS_DATA', data: largeDataset });
```

**Worker Thread:**
```typescript
// worker.js
import { ContainerBuilder } from '@shirudo/kizuna';

// Worker creates its own isolated container
const workerContainer = new ContainerBuilder()
    .registerSingleton('Logger', Logger)
    .registerSingleton('ApiClient', ApiClient, 'Logger')
    .registerScoped('DataProcessor', DataProcessor, 'ApiClient')
    .build();

self.onmessage = async (e) => {
    if (e.data.type === 'PROCESS_DATA') {
        // Use worker's own container
        const processor = workerContainer.get('DataProcessor');
        const result = await processor.process(e.data.data);
        
        self.postMessage({ type: 'RESULT', result });
    }
};
```

### Benefits:
- ✅ Complete isolation between main thread and workers
- ✅ No race conditions or shared state issues
- ✅ Each worker can have different service configurations
- ✅ Easy to reason about and debug

## 2. Container-per-Thread Pattern ✅

**Use Case:** Node.js applications using Worker Threads

**Pattern:** Each thread creates and owns its own container

### Example: Node.js Worker Threads

**Main Thread:**
```typescript
// main.ts
import { Worker, isMainThread, parentPort } from 'worker_threads';
import { ContainerBuilder } from '@shirudo/kizuna';

if (isMainThread) {
    // Main thread setup
    const mainContainer = new ContainerBuilder()
        .registerSingleton('Logger', Logger)
        .registerSingleton('TaskQueue', TaskQueue, 'Logger')
        .build();

    // Create worker threads
    const workers = Array.from({ length: 4 }, () => {
        const worker = new Worker(__filename);
        return worker;
    });

    // Distribute work to threads
    const taskQueue = mainContainer.get('TaskQueue');
    workers.forEach((worker, index) => {
        worker.postMessage({
            type: 'INIT',
            workerId: index,
            config: getWorkerConfig(index)
        });
    });
} else {
    // Worker thread code (runs in separate file or same file with isMainThread check)
    workerThreadHandler();
}

function workerThreadHandler() {
    // Each worker creates its own container
    let workerContainer: TypeSafeServiceLocator<any>;

    parentPort?.on('message', (data) => {
        switch (data.type) {
            case 'INIT':
                // Initialize worker-specific container
                workerContainer = new ContainerBuilder()
                    .registerSingleton('Logger', Logger)
                    .registerSingleton('WorkerConfig', () => data.config)
                    .registerScoped('TaskProcessor', TaskProcessor, 'Logger', 'WorkerConfig')
                    .build();
                break;

            case 'PROCESS_TASK':
                // Process task using worker's container
                const processor = workerContainer.get('TaskProcessor');
                const result = processor.processTask(data.task);
                parentPort?.postMessage({ type: 'TASK_RESULT', result });
                break;
        }
    });
}
```

### Benefits:
- ✅ True parallel processing with isolated state
- ✅ Each thread optimized for its specific workload
- ✅ No synchronization primitives needed
- ✅ Clean shutdown and resource management per thread

## 3. Request-Scoped Containers Pattern ✅

**Use Case:** Web servers (Express, Fastify, Koa) handling concurrent requests

**Pattern:** Each request gets its own scope from a shared root container

### Example: Express.js with Request Scopes

```typescript
// server.ts
import express from 'express';
import { ContainerBuilder } from '@shirudo/kizuna';

// Create root container (shared, read-only after build)
const rootContainer = new ContainerBuilder()
    .registerSingleton('Logger', Logger)
    .registerSingleton('Database', Database, 'Logger')
    .registerScoped('UserService', UserService, 'Database', 'Logger')
    .registerScoped('RequestContext', RequestContext)
    .build();

const app = express();

// Middleware: Create request scope
app.use((req, res, next) => {
    // Each request gets its own scope
    req.services = rootContainer.startScope();
    
    // Cleanup when request completes
    res.on('finish', () => {
        req.services.dispose();
    });
    
    next();
});

// Route handlers use request-scoped services
app.get('/users/:id', async (req, res) => {
    try {
        // Get request-scoped service instance
        const userService = req.services.get('UserService');
        const user = await userService.getUser(req.params.id);
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Extend Express Request type
declare module 'express' {
    interface Request {
        services: TypeSafeServiceLocator<any>;
    }
}
```

### Advanced Request Scope Pattern:

```typescript
// Advanced middleware with request context
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || generateId();
    const userId = req.headers['x-user-id'];
    
    // Create request scope with context
    req.services = rootContainer.startScope();
    
    // Register request-specific instances
    req.services.registerInstance('RequestId', requestId);
    req.services.registerInstance('UserId', userId);
    req.services.registerInstance('RequestTime', Date.now());
    
    // Cleanup
    res.on('finish', async () => {
        await req.services.dispose();
    });
    
    next();
});
```

### Benefits:
- ✅ Complete isolation between concurrent requests
- ✅ Request-specific service instances and state
- ✅ Automatic cleanup when requests complete
- ✅ Shared singletons (database, cache) across requests
- ✅ Easy to test and reason about

## 4. Message Passing Pattern ✅

**Use Case:** High-throughput applications avoiding shared state entirely

**Pattern:** Services communicate through messages rather than shared objects

### Example: Event-Driven Architecture

```typescript
// message-bus.ts
import { EventEmitter } from 'events';
import { ContainerBuilder } from '@shirudo/kizuna';

class MessageBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0); // Remove limit for high-throughput
    }

    async sendCommand<T>(command: string, payload: any): Promise<T> {
        return new Promise((resolve, reject) => {
            const correlationId = generateId();
            
            // Listen for response
            const timeout = setTimeout(() => {
                this.removeAllListeners(`response:${correlationId}`);
                reject(new Error('Command timeout'));
            }, 5000);
            
            this.once(`response:${correlationId}`, (result) => {
                clearTimeout(timeout);
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result.data);
                }
            });
            
            // Send command
            this.emit('command', { command, payload, correlationId });
        });
    }
}

// Service modules run in isolation
class UserServiceModule {
    private container: TypeSafeServiceLocator<any>;
    
    constructor(private messageBus: MessageBus) {
        // Each module has its own container
        this.container = new ContainerBuilder()
            .registerSingleton('Logger', Logger)
            .registerSingleton('UserRepository', UserRepository, 'Logger')
            .build();
            
        this.setupHandlers();
    }
    
    private setupHandlers() {
        this.messageBus.on('command', async (msg) => {
            if (msg.command.startsWith('user.')) {
                try {
                    const result = await this.handleUserCommand(msg);
                    this.messageBus.emit(`response:${msg.correlationId}`, {
                        data: result
                    });
                } catch (error) {
                    this.messageBus.emit(`response:${msg.correlationId}`, {
                        error: error.message
                    });
                }
            }
        });
    }
    
    private async handleUserCommand(msg: any) {
        const userRepo = this.container.get('UserRepository');
        
        switch (msg.command) {
            case 'user.create':
                return await userRepo.create(msg.payload);
            case 'user.findById':
                return await userRepo.findById(msg.payload.id);
            default:
                throw new Error(`Unknown command: ${msg.command}`);
        }
    }
}

// Usage
const messageBus = new MessageBus();
const userModule = new UserServiceModule(messageBus);
const orderModule = new OrderServiceModule(messageBus);

// Services communicate through messages
const user = await messageBus.sendCommand('user.findById', { id: 123 });
const order = await messageBus.sendCommand('order.create', { userId: 123, total: 99.99 });
```

### Benefits:
- ✅ Complete isolation between service modules
- ✅ No shared state or race conditions
- ✅ Easy to scale horizontally (modules can run in separate processes)
- ✅ Clear service boundaries and contracts
- ✅ Easy to test individual modules

## 5. Cluster/Multi-Process Pattern ✅

**Use Case:** Node.js cluster mode or PM2 process management

**Pattern:** Each process gets its own container instance

### Example: Node.js Cluster

```typescript
// cluster-server.ts
import cluster from 'cluster';
import { cpus } from 'os';
import { ContainerBuilder } from '@shirudo/kizuna';

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);
    
    // Fork workers
    for (let i = 0; i < cpus().length; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Restart worker
    });
} else {
    // Worker process - create its own container
    const workerContainer = new ContainerBuilder()
        .registerSingleton('Logger', Logger)
        .registerSingleton('Database', Database, 'Logger')
        .registerScoped('RequestHandler', RequestHandler, 'Database')
        .build();
    
    // Start server in worker
    startServer(workerContainer);
}

function startServer(container: TypeSafeServiceLocator<any>) {
    const app = express();
    
    app.use((req, res, next) => {
        req.services = container.startScope();
        res.on('finish', () => req.services.dispose());
        next();
    });
    
    app.listen(3000, () => {
        console.log(`Worker ${process.pid} started`);
    });
}
```

### Benefits:
- ✅ True parallel processing across CPU cores
- ✅ Process-level fault isolation
- ✅ Independent container per worker process
- ✅ Easy horizontal scaling

## ❌ Anti-Patterns: What NOT to Do

### 1. ❌ Shared Container Across Threads

```typescript
// DON'T DO THIS
const sharedContainer = new ContainerBuilder().build();

// Thread 1
const worker1 = new Worker('worker1.js');
worker1.postMessage({ container: sharedContainer }); // ❌ DANGEROUS

// Thread 2  
const worker2 = new Worker('worker2.js');
worker2.postMessage({ container: sharedContainer }); // ❌ RACE CONDITIONS
```

**Problems:**
- Race conditions in service instance creation
- Shared state corruption
- Memory leaks from concurrent disposal

### 2. ❌ Concurrent Access to Same Scope

```typescript
// DON'T DO THIS
const scope = rootContainer.startScope();

// Multiple concurrent operations using same scope
Promise.all([
    processRequest1(scope), // ❌ UNSAFE
    processRequest2(scope), // ❌ RACE CONDITIONS
    processRequest3(scope)  // ❌ SHARED STATE
]);
```

**Problems:**
- Service instances shared between operations
- Unpredictable state mutations
- Difficult to debug issues

### 3. ❌ Passing Container Instances Between Processes

```typescript
// DON'T DO THIS
process.send({ 
    type: 'CONTAINER',
    container: containerInstance // ❌ WON'T SERIALIZE
});
```

**Problems:**
- Containers don't serialize properly
- Service instances lost in transfer
- Method binding broken

## 🧪 Testing Concurrent Patterns

### Testing Container Isolation

```typescript
// test/concurrency.test.ts
describe('Container Isolation', () => {
    it('should isolate containers between workers', async () => {
        const createContainer = () => new ContainerBuilder()
            .registerSingleton('Counter', () => ({ value: 0 }))
            .build();
        
        const container1 = createContainer();
        const container2 = createContainer();
        
        const counter1 = container1.get('Counter');
        const counter2 = container2.get('Counter');
        
        counter1.value = 10;
        counter2.value = 20;
        
        expect(counter1.value).toBe(10);
        expect(counter2.value).toBe(20); // Different instances
    });
    
    it('should isolate request scopes', () => {
        const rootContainer = new ContainerBuilder()
            .registerScoped('RequestData', () => ({ id: Math.random() }))
            .build();
        
        const scope1 = rootContainer.startScope();
        const scope2 = rootContainer.startScope();
        
        const data1 = scope1.get('RequestData');
        const data2 = scope2.get('RequestData');
        
        expect(data1.id).not.toBe(data2.id); // Different instances
    });
});
```

### Load Testing Request Scopes

```typescript
// test/load.test.ts
import { performance } from 'perf_hooks';

describe('Request Scope Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
        const container = new ContainerBuilder()
            .registerSingleton('Database', MockDatabase)
            .registerScoped('UserService', UserService, 'Database')
            .build();
        
        const startTime = performance.now();
        
        // Simulate 1000 concurrent requests
        const requests = Array.from({ length: 1000 }, async (_, i) => {
            const scope = container.startScope();
            try {
                const userService = scope.get('UserService');
                return await userService.getUser(i);
            } finally {
                scope.dispose();
            }
        });
        
        const results = await Promise.all(requests);
        const endTime = performance.now();
        
        expect(results).toHaveLength(1000);
        console.log(`Processed 1000 requests in ${endTime - startTime}ms`);
    });
});
```

## 📊 Performance Considerations

### Container Creation Overhead

| Pattern | Container Creation | Memory Usage | Performance |
|---------|-------------------|--------------|-------------|
| Single Container | Once | Low | ⭐⭐⭐⭐⭐ |
| Container per Request | Per Request | Medium | ⭐⭐⭐ |
| Container per Worker | Per Worker | Medium | ⭐⭐⭐⭐ |
| Container per Thread | Per Thread | High | ⭐⭐⭐⭐ |

### Optimization Tips

1. **Reuse Container Configurations:**
```typescript
// Good: Reuse builder configuration
const createContainer = () => containerBuilderConfig.build();

// Less efficient: Rebuild configuration each time
const createContainer = () => new ContainerBuilder()
    .registerSingleton(...)
    .registerScoped(...)
    .build();
```

2. **Pool Request Scopes for High-Throughput:**
```typescript
class ScopePool {
    private pool: TypeSafeServiceLocator<any>[] = [];
    
    getScope() {
        return this.pool.pop() || this.rootContainer.startScope();
    }
    
    returnScope(scope: TypeSafeServiceLocator<any>) {
        scope.reset(); // Clear instance cache
        this.pool.push(scope);
    }
}
```

## 🛡️ Safety Checklist

Before deploying concurrent applications with Kizuna:

- [ ] ✅ Each thread/worker has its own container instance
- [ ] ✅ Request scopes are properly isolated and disposed
- [ ] ✅ No container instances are shared across concurrent boundaries
- [ ] ✅ Message passing is used instead of shared state where appropriate
- [ ] ✅ Proper error handling prevents resource leaks
- [ ] ✅ Testing covers concurrent scenarios
- [ ] ✅ Performance testing validates scalability
- [ ] ✅ Memory usage is monitored under load

## 📚 Additional Resources

- [Node.js Worker Threads Guide](https://nodejs.org/api/worker_threads.html)
- [Web Workers API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Concurrency Patterns in Node.js](https://nodejs.dev/learn/nodejs-concurrency)
- [Express.js Best Practices for Performance](https://expressjs.com/en/advanced/best-practice-performance.html)

---

## Summary

**The key to safe concurrency with Kizuna:**

1. **Isolation**: Each concurrent context gets its own container
2. **Scoping**: Use request scopes for isolated operations  
3. **Message Passing**: Avoid shared state when possible
4. **Testing**: Verify isolation and performance under load

By following these patterns, you can build highly concurrent applications while maintaining the simplicity and performance benefits of Kizuna's design.