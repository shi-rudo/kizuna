# Kizuna Examples

This directory contains TypeScript examples for the Kizuna dependency injection library.

## Examples

### [`multiple-containers-domain-separation.ts`](./multiple-containers-domain-separation.ts)

**Domain organization with multiple containers**

This e-commerce example uses separate containers for two domains. Both containers use services from a shared infrastructure container.

Kizuna does not enforce domain boundaries. The application structure defines and maintains each boundary.

**What the example shows:**
- How to create domain-specific containers (User, Order domains)
- Sharing infrastructure services (Logger, EmailService) across domains
- Keeping domain registrations in separate containers
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

## Check the Examples

```bash
pnpm test:examples
```

This command type-checks every TypeScript file in this directory. The main build does not create a `dist/examples` directory.

The repository does not provide a command that executes these source files.

## Contributing Examples

When adding new examples:
1. Add clear TypeScript documentation.
2. Demonstrate one pattern or use case.
3. Add error handling and cleanup.
4. Update this README.
5. Run `pnpm test:examples`.

Each example must type-check without errors.
