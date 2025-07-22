/**
 * Multiple Containers for Domain Separation Example
 * 
 * This example demonstrates how to use separate containers for different
 * business domains or bounded contexts in a larger application.
 * 
 * Benefits:
 * - Clear domain boundaries
 * - Prevents cross-domain dependencies
 * - Shared infrastructure services
 * - Independent domain evolution
 * - Easier testing and maintenance
 */

import { FluentContainerBuilder } from '../src/api/fluent-container-builder';
import { ServiceLocator } from '../src/api/contracts/interfaces';

// ========================================
// DOMAIN MODELS (for example purposes)
// ========================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface Order {
  id: string;
  userId: string;
  total: number;
  items: OrderItem[];
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface CreateOrderDto {
  userId: string;
  items: OrderItem[];
}

interface PaymentResult {
  success: boolean;
  transactionId: string;
}

// ========================================
// USER DOMAIN SERVICES
// ========================================

class UserRepository {
  async findById(id: string): Promise<User | null> {
    // Simulate database lookup
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      id,
      name: "John Doe",
      email: "john@example.com"
    };
  }

  async create(user: CreateUserDto): Promise<User> {
    // Simulate database insertion
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      id: `user_${Date.now()}`,
      ...user
    };
  }

  async findByEmail(_email: string): Promise<User | null> {
    // Simulate email lookup
    await new Promise(resolve => setTimeout(resolve, 10));
    return null; // Simplified for example
  }
}

class UserService {
  constructor(
    private userRepo: UserRepository, 
    private logger: Logger
  ) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user: ${userData.email}`);
    
    // Check if user already exists
    const existingUser = await this.userRepo.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = await this.userRepo.create(userData);
    this.logger.log(`User created with ID: ${user.id}`);
    
    return user;
  }

  async getUserById(id: string): Promise<User> {
    this.logger.log(`Fetching user: ${id}`);
    
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }
}

class UserNotificationService {
  constructor(private emailService: EmailService) {}

  async sendWelcomeEmail(user: User): Promise<void> {
    await this.emailService.send(
      user.email,
      'Welcome to our platform!',
      `Hello ${user.name}, welcome to our amazing platform!`
    );
  }

  async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    await this.emailService.send(
      user.email,
      'Password Reset Request',
      `Click here to reset your password: /reset?token=${resetToken}`
    );
  }
}

// ========================================
// ORDER DOMAIN SERVICES
// ========================================

class OrderRepository {
  async findById(id: string): Promise<Order | null> {
    // Simulate database lookup
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      id,
      userId: 'user_123',
      total: 99.99,
      items: [
        { productId: 'product_1', quantity: 2, price: 29.99 },
        { productId: 'product_2', quantity: 1, price: 39.99 }
      ]
    };
  }

  async create(order: CreateOrderDto): Promise<Order> {
    // Calculate total
    const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Simulate database insertion
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      id: `order_${Date.now()}`,
      userId: order.userId,
      total,
      items: order.items
    };
  }

  async findByUserId(_userId: string): Promise<Order[]> {
    // Simulate fetching user orders
    await new Promise(resolve => setTimeout(resolve, 20));
    return []; // Simplified for example
  }
}

class OrderService {
  constructor(
    private orderRepo: OrderRepository, 
    private logger: Logger
  ) {}

  async createOrder(orderData: CreateOrderDto): Promise<Order> {
    this.logger.log(`Creating order for user: ${orderData.userId}`);
    
    // Validate order data
    if (!orderData.items.length) {
      throw new Error('Order must contain at least one item');
    }

    const order = await this.orderRepo.create(orderData);
    this.logger.log(`Order created with ID: ${order.id}, Total: $${order.total}`);
    
    return order;
  }

  async getOrderById(id: string): Promise<Order> {
    this.logger.log(`Fetching order: ${id}`);
    
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }
    
    return order;
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    this.logger.log(`Fetching orders for user: ${userId}`);
    return await this.orderRepo.findByUserId(userId);
  }
}

class PaymentGateway {
  async charge(_amount: number): Promise<PaymentResult> {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate occasional failures
    const success = Math.random() > 0.1; // 90% success rate
    
    return {
      success,
      transactionId: success ? `tx_${Date.now()}` : ''
    };
  }

  async refund(_transactionId: string): Promise<boolean> {
    // Simulate refund processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return true;
  }
}

class PaymentService {
  constructor(private paymentGateway: PaymentGateway) {}

  async processPayment(order: Order): Promise<PaymentResult> {
    const result = await this.paymentGateway.charge(order.total);
    
    if (!result.success) {
      throw new Error('Payment failed');
    }
    
    return result;
  }

  async refundPayment(transactionId: string): Promise<boolean> {
    return await this.paymentGateway.refund(transactionId);
  }
}

// ========================================
// SHARED INFRASTRUCTURE SERVICES
// ========================================

class Logger {
  log(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  error(message: string, error?: Error): void {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
  }

  warn(message: string): void {
    console.warn(`[${new Date().toISOString()}] WARN: ${message}`);
  }
}

class EmailService {
  async send(to: string, subject: string, _body: string): Promise<void> {
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 30));
    console.log(`📧 Email sent to ${to}: ${subject}`);
  }
}

class DatabaseConfig {
  getConnectionString(): string {
    return process.env.DATABASE_URL || 'postgresql://localhost:5432/ecommerce';
  }

  getMaxConnections(): number {
    return parseInt(process.env.DB_MAX_CONNECTIONS || '10');
  }
}

class MetricsCollector {
  private metrics: Map<string, number> = new Map();

  increment(metric: string): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + 1);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}

// ========================================
// CONTAINER SETUP FUNCTIONS
// ========================================

/**
 * Creates the shared infrastructure container.
 * This container holds services that are used across multiple domains.
 */
function createSharedContainer(): ServiceLocator {
  const builder = new FluentContainerBuilder();

  // Infrastructure services - these are singletons shared across the application
  builder.addSingleton(r => r.fromType(DatabaseConfig));
  builder.addSingleton(r => r.fromType(Logger));
  builder.addSingleton(r => r.fromType(EmailService));
  builder.addSingleton(r => r.fromType(MetricsCollector));

  return builder.build();
}

/**
 * Creates the User domain container.
 * This container has access to shared infrastructure and manages user-specific services.
 */
function createUserDomainContainer(sharedContainer: ServiceLocator): ServiceLocator {
  const builder = new FluentContainerBuilder();

  // Import shared services from the infrastructure container
  const logger = sharedContainer.get(Logger);
  const emailService = sharedContainer.get(EmailService);
  const metricsCollector = sharedContainer.get(MetricsCollector);

  // Register shared services in this domain container
  builder.addSingleton(r => r.fromName('Logger').useFactory(() => logger));
  builder.addSingleton(r => r.fromName('EmailService').useFactory(() => emailService));
  builder.addSingleton(r => r.fromName('MetricsCollector').useFactory(() => metricsCollector));

  // Register user domain-specific services
  builder.addScoped(r => r.fromType(UserRepository));
  builder.addScoped(r => 
    r.fromType(UserService)
     .withDependencies(UserRepository, 'Logger')
  );
  builder.addScoped(r => 
    r.fromType(UserNotificationService)
     .withDependencies('EmailService')
  );

  return builder.build();
}

/**
 * Creates the Order domain container.
 * This container has access to shared infrastructure and manages order-specific services.
 */
function createOrderDomainContainer(sharedContainer: ServiceLocator): ServiceLocator {
  const builder = new FluentContainerBuilder();

  // Import shared services from the infrastructure container
  const logger = sharedContainer.get(Logger);
  const metricsCollector = sharedContainer.get(MetricsCollector);

  // Register shared services in this domain container
  builder.addSingleton(r => r.fromName('Logger').useFactory(() => logger));
  builder.addSingleton(r => r.fromName('MetricsCollector').useFactory(() => metricsCollector));

  // Register order domain-specific services
  builder.addScoped(r => r.fromType(OrderRepository));
  builder.addScoped(r => 
    r.fromType(OrderService)
     .withDependencies(OrderRepository, 'Logger')
  );
  builder.addScoped(r => r.fromType(PaymentGateway));
  builder.addScoped(r => 
    r.fromType(PaymentService)
     .withDependencies(PaymentGateway)
  );

  return builder.build();
}

// ========================================
// APPLICATION SETUP
// ========================================

/**
 * Main application class that manages multiple domain containers.
 * This demonstrates how to orchestrate different domains while maintaining separation.
 */
class ECommerceApplication {
  private sharedContainer!: ServiceLocator;
  private userDomainContainer!: ServiceLocator;
  private orderDomainContainer!: ServiceLocator;

  /**
   * Initialize all containers and their dependencies.
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing E-Commerce Application...');

    // Initialize shared infrastructure first
    this.sharedContainer = createSharedContainer();
    console.log('✅ Shared infrastructure container initialized');

    // Initialize domain containers with shared dependencies
    this.userDomainContainer = createUserDomainContainer(this.sharedContainer);
    console.log('✅ User domain container initialized');

    this.orderDomainContainer = createOrderDomainContainer(this.sharedContainer);
    console.log('✅ Order domain container initialized');

    console.log('🎉 Application initialization complete!');
  }

  /**
   * Domain-specific service accessors.
   * These methods provide clean access to domain services while maintaining boundaries.
   */
  
  // User Domain Services
  getUserService(): UserService {
    return this.userDomainContainer.get(UserService);
  }

  getUserNotificationService(): UserNotificationService {
    return this.userDomainContainer.get(UserNotificationService);
  }

  // Order Domain Services
  getOrderService(): OrderService {
    return this.orderDomainContainer.get(OrderService);
  }

  getPaymentService(): PaymentService {
    return this.orderDomainContainer.get(PaymentService);
  }

  // Shared Infrastructure Services
  getLogger(): Logger {
    return this.sharedContainer.get(Logger);
  }

  getMetricsCollector(): MetricsCollector {
    return this.sharedContainer.get(MetricsCollector);
  }

  /**
   * Create domain-specific scopes for request processing.
   */
  createUserDomainScope(): ServiceLocator {
    return this.userDomainContainer.startScope();
  }

  createOrderDomainScope(): ServiceLocator {
    return this.orderDomainContainer.startScope();
  }

  /**
   * Clean up all containers and resources.
   */
  dispose(): void {
    console.log('🧹 Cleaning up application resources...');
    
    this.userDomainContainer.dispose();
    this.orderDomainContainer.dispose();
    this.sharedContainer.dispose();
    
    console.log('✅ Application cleanup complete');
  }
}

// ========================================
// USAGE EXAMPLES
// ========================================

/**
 * Example: Express.js-style request handlers using domain-specific scopes
 */
async function simulateHttpRequestHandlers(app: ECommerceApplication): Promise<void> {
  console.log('\n📡 Simulating HTTP request handlers...\n');

  // Simulate POST /users - Create a new user
  console.log('--- POST /users ---');
  const userScope = app.createUserDomainScope();
  try {
    const userService = userScope.get(UserService);
    const notificationService = userScope.get(UserNotificationService);
    const metricsCollector = userScope.get('MetricsCollector') as MetricsCollector;

    const userData: CreateUserDto = {
      name: 'Alice Johnson',
      email: 'alice@example.com'
    };

    const user = await userService.createUser(userData);
    await notificationService.sendWelcomeEmail(user);
    metricsCollector.increment('users.created');

    console.log(`✅ User created:`, user);
  } catch (error) {
    console.error('❌ User creation failed:', error);
  } finally {
    userScope.dispose();
  }

  // Simulate POST /orders - Create a new order
  console.log('\n--- POST /orders ---');
  const orderScope = app.createOrderDomainScope();
  try {
    const orderService = orderScope.get(OrderService);
    const paymentService = orderScope.get(PaymentService);
    const metricsCollector = orderScope.get('MetricsCollector') as MetricsCollector;

    const orderData: CreateOrderDto = {
      userId: 'user_123',
      items: [
        { productId: 'laptop_1', quantity: 1, price: 999.99 },
        { productId: 'mouse_1', quantity: 2, price: 29.99 }
      ]
    };

    const order = await orderService.createOrder(orderData);
    const paymentResult = await paymentService.processPayment(order);
    
    metricsCollector.increment('orders.created');
    if (paymentResult.success) {
      metricsCollector.increment('payments.successful');
    } else {
      metricsCollector.increment('payments.failed');
    }

    console.log(`✅ Order created:`, { order, payment: paymentResult });
  } catch (error) {
    console.error('❌ Order creation failed:', error);
  } finally {
    orderScope.dispose();
  }

  // Show metrics
  const metrics = app.getMetricsCollector().getMetrics();
  console.log('\n📊 Current Metrics:', metrics);
}

/**
 * Example: Cross-domain workflow (user creates order)
 */
async function simulateCrossDomainWorkflow(app: ECommerceApplication): Promise<void> {
  console.log('\n🔄 Simulating cross-domain workflow...\n');

  // Step 1: Create user in User domain
  const userScope = app.createUserDomainScope();
  let userId: string;

  try {
    const userService = userScope.get(UserService);
    const user = await userService.createUser({
      name: 'Bob Smith',
      email: 'bob@example.com'
    });
    userId = user.id;
    console.log(`✅ Step 1 - User created: ${user.name} (${user.id})`);
  } finally {
    userScope.dispose();
  }

  // Step 2: Create order for user in Order domain
  const orderScope = app.createOrderDomainScope();
  try {
    const orderService = orderScope.get(OrderService);
    const paymentService = orderScope.get(PaymentService);
    
    const order = await orderService.createOrder({
      userId: userId,
      items: [
        { productId: 'book_1', quantity: 3, price: 15.99 },
        { productId: 'pen_1', quantity: 5, price: 2.99 }
      ]
    });

    const paymentResult = await paymentService.processPayment(order);
    
    console.log(`✅ Step 2 - Order created: ${order.id} ($${order.total})`);
    console.log(`✅ Step 3 - Payment processed: ${paymentResult.success ? 'Success' : 'Failed'}`);
  } finally {
    orderScope.dispose();
  }
}

/**
 * Example: Testing individual domains in isolation
 */
async function demonstrateTestingIsolation(): Promise<void> {
  console.log('\n🧪 Demonstrating testing isolation...\n');

  // Create mock shared container for testing
  const mockSharedContainer = {
    get: (key: any) => {
      if (key === Logger) {
        return {
          log: (msg: string) => console.log(`[MOCK LOG] ${msg}`),
          error: (msg: string) => console.log(`[MOCK ERROR] ${msg}`),
          warn: (msg: string) => console.log(`[MOCK WARN] ${msg}`)
        };
      }
      if (key === EmailService) {
        return {
          send: async (to: string, subject: string) => {
            console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
          }
        };
      }
      return null;
    },
    dispose: () => {},
    startScope: () => mockSharedContainer
  } as ServiceLocator;

  // Test User domain in isolation
  const userTestContainer = createUserDomainContainer(mockSharedContainer);
  const userScope = userTestContainer.startScope();

  try {
    const userService = userScope.get(UserService);
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com'
    });
    
    console.log(`✅ User domain test passed - User created: ${user.name}`);
  } catch (error) {
    console.error('❌ User domain test failed:', error);
  } finally {
    userScope.dispose();
    userTestContainer.dispose();
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main(): Promise<void> {
  const app = new ECommerceApplication();

  try {
    // Initialize the application
    await app.initialize();

    // Run examples
    await simulateHttpRequestHandlers(app);
    await simulateCrossDomainWorkflow(app);
    await demonstrateTestingIsolation();

  } catch (error) {
    console.error('Application error:', error);
  } finally {
    // Clean up
    app.dispose();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  ECommerceApplication,
  createSharedContainer,
  createUserDomainContainer,
  createOrderDomainContainer,
  // Export services for potential reuse
  UserService,
  OrderService,
  Logger,
  EmailService
};