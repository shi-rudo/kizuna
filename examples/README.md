# Kizuna Examples

This directory contains comprehensive examples demonstrating various patterns and use cases with the Kizuna dependency injection library.

## Examples

### [`multiple-containers-domain-separation.ts`](./multiple-containers-domain-separation.ts)

**Domain-Driven Design with Multiple Containers**

A complete e-commerce application example showing how to use multiple containers to separate business domains while sharing infrastructure services.

**What you'll learn:**
- How to create domain-specific containers (User, Order domains)
- Sharing infrastructure services (Logger, EmailService) across domains
- Preventing cross-domain dependencies
- Request-scoped processing with Express.js integration
- Testing individual domains in isolation
- Cross-domain workflows

**Key patterns demonstrated:**
- Shared infrastructure container
- Domain container factories
- Cross-container dependency injection
- Scoped request handling
- Resource cleanup and disposal
- Mock testing strategies

**Run the example:**
```bash
npm run build
node dist/examples/multiple-containers-domain-separation.js
```

This example is perfect for understanding how to architect larger applications with clear domain boundaries while maintaining shared infrastructure concerns.

## Running Examples

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Run individual examples:**
   ```bash
   node dist/examples/[example-name].js
   ```

## Contributing Examples

When adding new examples:
1. Include comprehensive TypeScript documentation
2. Demonstrate a specific pattern or use case
3. Add error handling and cleanup
4. Update this README with the new example
5. Ensure examples compile without errors

Examples should be self-contained and runnable, providing clear learning value for different Kizuna usage patterns.