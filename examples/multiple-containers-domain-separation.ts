/**
 * Multiple Containers for Domain Separation Example
 * 
 * This example demonstrates how to use separate containers for different
 * business domains or bounded contexts in a larger application using the
 * unified ContainerBuilder with full type safety.
 * 
 * Benefits:
 * - Clear domain boundaries with type safety
 * - Prevents cross-domain dependencies
 * - Shared infrastructure services
 * - Independent domain evolution
 * - Easier testing and maintenance
 * - Full IDE autocompletion and compile-time checking
 */

import { ContainerBuilder } from '../src/api/container-builder';
import { TypeSafeServiceLocator } from '../src/api/contracts/interfaces';

// ========================================
// DOMAIN MODELS
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
  async send(to: string, subject: string, body: string): Promise<void> {
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 30));
    console.log(`📧 Email sent to ${to}: ${subject}`);
  }
}

interface IConfig {
  getDatabaseUrl(): string;
  getMaxConnections(): number;
  getEnvironment(): string;
}

class DatabaseConfig implements IConfig {
  getDatabaseUrl(): string {
    return process.env.DATABASE_URL || 'postgresql://localhost:5432/ecommerce';
  }

  getMaxConnections(): number {
    return parseInt(process.env.DB_MAX_CONNECTIONS || '10');
  }

  getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }
}

interface IMetrics {
  increment(metric: string): void;
  getMetrics(): Record<string, number>;
}

class MetricsCollector implements IMetrics {
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
// USER DOMAIN SERVICES
// ========================================

interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(user: CreateUserDto): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
}

class UserRepository implements IUserRepository {
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

  async findByEmail(email: string): Promise<User | null> {
    // Simulate email lookup
    await new Promise(resolve => setTimeout(resolve, 10));
    return null; // Simplified for example
  }
}

class UserService {
  constructor(
    private userRepo: IUserRepository, 
    private logger: Logger,
    private metrics: IMetrics
  ) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user: ${userData.email}`);
    this.metrics.increment('user.creation.attempts');
    
    // Check if user already exists
    const existingUser = await this.userRepo.findByEmail(userData.email);
    if (existingUser) {
      this.metrics.increment('user.creation.duplicates');
      throw new Error('User already exists');
    }

    const user = await this.userRepo.create(userData);
    this.logger.log(`User created with ID: ${user.id}`);
    this.metrics.increment('user.creation.success');
    
    return user;
  }

  async getUserById(id: string): Promise<User> {
    this.logger.log(`Fetching user: ${id}`);
    this.metrics.increment('user.fetch.attempts');
    
    const user = await this.userRepo.findById(id);
    if (!user) {
      this.metrics.increment('user.fetch.notfound');
      throw new Error('User not found');
    }
    
    this.metrics.increment('user.fetch.success');
    return user;
  }
}

class UserNotificationService {
  constructor(
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async sendWelcomeEmail(user: User): Promise<void> {
    this.logger.log(`Sending welcome email to ${user.email}`);
    await this.emailService.send(
      user.email,
      'Welcome to our platform!',
      `Hello ${user.name}, welcome to our amazing platform!`
    );
  }

  async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    this.logger.log(`Sending password reset email to ${user.email}`);
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

interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  create(order: CreateOrderDto): Promise<Order>;
  findByUserId(userId: string): Promise<Order[]>;
}

class OrderRepository implements IOrderRepository {
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

  async findByUserId(userId: string): Promise<Order[]> {
    // Simulate fetching user orders
    await new Promise(resolve => setTimeout(resolve, 20));
    return []; // Simplified for example
  }
}

class OrderService {
  constructor(
    private orderRepo: IOrderRepository, 
    private logger: Logger,
    private metrics: IMetrics
  ) {}

  async createOrder(orderData: CreateOrderDto): Promise<Order> {
    this.logger.log(`Creating order for user: ${orderData.userId}`);
    this.metrics.increment('order.creation.attempts');
    
    // Validate order data
    if (!orderData.items.length) {
      this.metrics.increment('order.creation.validation_errors');
      throw new Error('Order must contain at least one item');
    }

    const order = await this.orderRepo.create(orderData);
    this.logger.log(`Order created with ID: ${order.id}, Total: $${order.total}`);
    this.metrics.increment('order.creation.success');
    
    return order;
  }

  async getOrderById(id: string): Promise<Order> {
    this.logger.log(`Fetching order: ${id}`);
    this.metrics.increment('order.fetch.attempts');
    
    const order = await this.orderRepo.findById(id);
    if (!order) {
      this.metrics.increment('order.fetch.notfound');
      throw new Error('Order not found');
    }
    
    this.metrics.increment('order.fetch.success');
    return order;
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    this.logger.log(`Fetching orders for user: ${userId}`);
    return await this.orderRepo.findByUserId(userId);
  }
}

interface IPaymentGateway {
  charge(amount: number): Promise<PaymentResult>;
  refund(transactionId: string): Promise<boolean>;
}

class PaymentGateway implements IPaymentGateway {
  async charge(amount: number): Promise<PaymentResult> {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate occasional failures
    const success = Math.random() > 0.1; // 90% success rate
    
    return {
      success,
      transactionId: success ? `tx_${Date.now()}` : ''
    };
  }

  async refund(transactionId: string): Promise<boolean> {
    // Simulate refund processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return true;
  }
}

class PaymentService {
  constructor(
    private paymentGateway: IPaymentGateway,
    private logger: Logger,
    private metrics: IMetrics
  ) {}

  async processPayment(order: Order): Promise<PaymentResult> {
    this.logger.log(`Processing payment for order ${order.id}: $${order.total}`);
    this.metrics.increment('payment.attempts');
    
    const result = await this.paymentGateway.charge(order.total);
    
    if (!result.success) {
      this.metrics.increment('payment.failures');
      throw new Error('Payment failed');
    }
    
    this.metrics.increment('payment.success');
    this.logger.log(`Payment successful: ${result.transactionId}`);
    
    return result;
  }

  async refundPayment(transactionId: string): Promise<boolean> {
    this.logger.log(`Processing refund for transaction: ${transactionId}`);
    return await this.paymentGateway.refund(transactionId);
  }
}

// ========================================
// TYPE-SAFE CONTAINER CREATION
// ========================================

/**
 * Creates the shared infrastructure container with full type safety.
 * This container holds services that are used across multiple domains.
 */
function createSharedContainer() {
  return new ContainerBuilder()
    // Infrastructure services - singletons shared across the application
    .registerInterface<IConfig>('IConfig', DatabaseConfig)
    .registerSingleton('Logger', Logger)
    .registerSingleton('EmailService', EmailService)
    .registerInterface<IMetrics>('IMetrics', MetricsCollector)
    
    // Configuration factory with environment-specific logic
    .registerFactory('AppSettings', (provider) => {
      const config = provider.get('IConfig');
      const logger = provider.get('Logger');
      
      logger.log(`Initializing app settings for ${config.getEnvironment()}`);
      
      return {
        environment: config.getEnvironment(),
        database: {
          url: config.getDatabaseUrl(),
          maxConnections: config.getMaxConnections()
        },
        features: {
          emailNotifications: config.getEnvironment() !== 'test',
          detailedLogging: config.getEnvironment() === 'development'
        }
      };
    })
    
    .build();
}

/**
 * Creates the User domain container with type-safe dependencies.
 * This container manages user-specific services with shared infrastructure.
 */
function createUserDomainContainer(sharedContainer: ReturnType<typeof createSharedContainer>) {
  return new ContainerBuilder()
    // Import shared services (singleton instances from shared container)
    .registerFactory('Logger', () => sharedContainer.get('Logger'))
    .registerFactory('EmailService', () => sharedContainer.get('EmailService'))
    .registerFactory('IMetrics', () => sharedContainer.get('IMetrics'))
    
    // User domain-specific services
    .registerInterface<IUserRepository>('IUserRepository', UserRepository)
    .registerScoped('UserService', UserService, 'IUserRepository', 'Logger', 'IMetrics')
    .registerScoped('UserNotificationService', UserNotificationService, 'EmailService', 'Logger')
    
    .build();
}

/**
 * Creates the Order domain container with type-safe dependencies.
 * This container manages order-specific services with shared infrastructure.
 */
function createOrderDomainContainer(sharedContainer: ReturnType<typeof createSharedContainer>) {
  return new ContainerBuilder()
    // Import shared services (singleton instances from shared container)
    .registerFactory('Logger', () => sharedContainer.get('Logger'))
    .registerFactory('IMetrics', () => sharedContainer.get('IMetrics'))
    
    // Order domain-specific services
    .registerInterface<IOrderRepository>('IOrderRepository', OrderRepository)
    .registerScoped('OrderService', OrderService, 'IOrderRepository', 'Logger', 'IMetrics')
    .registerInterface<IPaymentGateway>('IPaymentGateway', PaymentGateway)
    .registerScoped('PaymentService', PaymentService, 'IPaymentGateway', 'Logger', 'IMetrics')
    
    .build();
}

// Type aliases for better readability
type SharedContainer = ReturnType<typeof createSharedContainer>;
type UserDomainContainer = ReturnType<typeof createUserDomainContainer>;
type OrderDomainContainer = ReturnType<typeof createOrderDomainContainer>;

// ========================================
// TYPE-SAFE APPLICATION CLASS
// ========================================

/**
 * Main application class that manages multiple domain containers with full type safety.
 * This demonstrates how to orchestrate different domains while maintaining separation.
 */
class ECommerceApplication {
  private sharedContainer!: SharedContainer;
  private userDomainContainer!: UserDomainContainer;
  private orderDomainContainer!: OrderDomainContainer;

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

    // Log application settings
    const appSettings = this.sharedContainer.get('AppSettings');
    console.log(`📋 App Settings:`, {
      environment: appSettings.environment,
      features: appSettings.features
    });

    console.log('🎉 Application initialization complete!');
  }

  /**
   * Domain-specific service accessors with full type safety.
   * These methods provide clean access to domain services while maintaining boundaries.
   */
  
  // User Domain Services (fully typed!)
  getUserService(): UserService {
    return this.userDomainContainer.get('UserService');
  }

  getUserNotificationService(): UserNotificationService {
    return this.userDomainContainer.get('UserNotificationService');
  }

  // Order Domain Services (fully typed!)
  getOrderService(): OrderService {
    return this.orderDomainContainer.get('OrderService');
  }

  getPaymentService(): PaymentService {
    return this.orderDomainContainer.get('PaymentService');
  }

  // Shared Infrastructure Services (fully typed!)
  getLogger(): Logger {
    return this.sharedContainer.get('Logger');
  }

  getMetrics(): IMetrics {
    return this.sharedContainer.get('IMetrics');
  }

  getAppSettings() {
    return this.sharedContainer.get('AppSettings');
  }

  /**
   * Create domain-specific scopes for request processing with type safety.
   */
  createUserDomainScope(): UserDomainContainer {
    return this.userDomainContainer.startScope();
  }

  createOrderDomainScope(): OrderDomainContainer {
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
// USAGE EXAMPLES WITH TYPE SAFETY
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
    // All services are fully typed! ✨
    const userService = userScope.get('UserService');            // Type: UserService
    const notificationService = userScope.get('UserNotificationService'); // Type: UserNotificationService
    const metrics = userScope.get('IMetrics');                  // Type: IMetrics

    const userData: CreateUserDto = {
      name: 'Alice Johnson',
      email: 'alice@example.com'
    };

    const user = await userService.createUser(userData);
    await notificationService.sendWelcomeEmail(user);
    metrics.increment('users.created');

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
    // All services are fully typed! ✨
    const orderService = orderScope.get('OrderService');        // Type: OrderService
    const paymentService = orderScope.get('PaymentService');    // Type: PaymentService
    const metrics = orderScope.get('IMetrics');                 // Type: IMetrics

    const orderData: CreateOrderDto = {
      userId: 'user_123',
      items: [
        { productId: 'laptop_1', quantity: 1, price: 999.99 },
        { productId: 'mouse_1', quantity: 2, price: 29.99 }
      ]
    };

    const order = await orderService.createOrder(orderData);
    const paymentResult = await paymentService.processPayment(order);
    
    metrics.increment('orders.created');
    if (paymentResult.success) {
      metrics.increment('payments.successful');
    } else {
      metrics.increment('payments.failed');
    }

    console.log(`✅ Order created:`, { order, payment: paymentResult });
  } catch (error) {
    console.error('❌ Order creation failed:', error);
  } finally {
    orderScope.dispose();
  }

  // Show metrics
  const metrics = app.getMetrics().getMetrics();
  console.log('\n📊 Current Metrics:', metrics);
}

/**
 * Example: Cross-domain workflow with type safety
 */
async function simulateCrossDomainWorkflow(app: ECommerceApplication): Promise<void> {
  console.log('\n🔄 Simulating cross-domain workflow...\n');

  // Step 1: Create user in User domain
  const userScope = app.createUserDomainScope();
  let userId: string;

  try {
    const userService = userScope.get('UserService'); // Type: UserService ✨
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
    const orderService = orderScope.get('OrderService');    // Type: OrderService ✨
    const paymentService = orderScope.get('PaymentService'); // Type: PaymentService ✨
    
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
 * Example: Testing with type-safe mocks
 */
async function demonstrateTestingWithTypeSafety(): Promise<void> {
  console.log('\n🧪 Demonstrating type-safe testing...\n');

  // Create test implementations that match the real shared container structure
  class TestConfig implements IConfig {
    getDatabaseUrl() { return 'test://localhost'; }
    getMaxConnections() { return 5; }
    getEnvironment() { return 'test'; }
  }

  class TestMetrics implements IMetrics {
    increment(metric: string) { console.log(`[TEST METRIC] ${metric}`); }
    getMetrics() { return { 'test.metric': 1 }; }
  }

  class TestLogger extends Logger {
    log(message: string): void {
      console.log(`[TEST LOG] ${message}`);
    }
    error(message: string, error?: Error): void {
      console.log(`[TEST ERROR] ${message}`, error);
    }
    warn(message: string): void {
      console.log(`[TEST WARN] ${message}`);
    }
  }

  class TestEmailService extends EmailService {
    async send(to: string, subject: string): Promise<void> {
      console.log(`[TEST EMAIL] To: ${to}, Subject: ${subject}`);
    }
  }

  // Create a type-safe test container that exactly matches the shared container signature
  const testSharedContainer = new ContainerBuilder()
    .registerInterface<IConfig>('IConfig', TestConfig)
    .registerSingleton('Logger', TestLogger)
    .registerSingleton('EmailService', TestEmailService)
    .registerInterface<IMetrics>('IMetrics', TestMetrics)
    .registerFactory('AppSettings', (provider) => {
      const config = provider.get('IConfig');
      const logger = provider.get('Logger');
      
      logger.log('Initializing test app settings');
      
      return {
        environment: 'test',
        database: {
          url: config.getDatabaseUrl(),
          maxConnections: config.getMaxConnections()
        },
        features: {
          emailNotifications: false,
          detailedLogging: true
        }
      };
    })
    .build();

  const testUserContainer = createUserDomainContainer(testSharedContainer);
  const userScope = testUserContainer.startScope();

  try {
    const userService = userScope.get('UserService'); // Type: UserService ✨
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com'
    });
    
    console.log(`✅ Type-safe test passed - User created: ${user.name}`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    userScope.dispose();
    testUserContainer.dispose();
    testSharedContainer.dispose();
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
    await demonstrateTestingWithTypeSafety();

    console.log('\n🎉 TYPE-SAFE MULTI-CONTAINER BENEFITS:');
    console.log('✅ Full type safety across all domains');
    console.log('✅ Clear domain boundaries with interface separation');  
    console.log('✅ Shared infrastructure with singleton management');
    console.log('✅ IDE autocompletion for all service access');
    console.log('✅ Compile-time error detection');
    console.log('✅ Easy testing with type-safe mocks');
    console.log('✅ Independent domain evolution');

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
  EmailService,
  // Export interfaces
  type IUserRepository,
  type IOrderRepository,
  type IPaymentGateway,
  type IConfig,
  type IMetrics
};