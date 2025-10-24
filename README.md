# @fioc/event-bus

**FIoC Event Bus** is a lightweight, type-safe event-driven architecture library for **TypeScript** and **JavaScript**, built on top of **FIoC (Fluid Inversion of Control)**. It simplifies event handling with **notifications** (publish-subscribe), **commands** (request-response), and **middlewares**, all integrated with FIoC's dependency injection container.

It enables decoupled communication between components, making your applications more modular and maintainable.

> 💡 Built on FIoC's fluid DI, it leverages type-safe tokens and metadata for seamless handler registration and resolution.

---

## 🚀 Quick Start

Install via npm, yarn, or pnpm:

```bash
npm install @fioc/event-bus

# or

yarn add @fioc/event-bus

# or

pnpm add @fioc/event-bus
```

A minimal “Hello World” example (with inference comments):

```ts
import { buildDIContainer, createDIToken } from "@fioc/core";
import { EventBusFactory, IEventBusToken, MiddleWareOrderToken, createNotificationDIToken, createNotificationHandlerDIToken } from "@fioc/event-bus";

interface UserCreatedPayload {
  userId: string;
  email: string;
}

const UserCreatedToken = createNotificationDIToken<UserCreatedPayload>()
  .as("UserCreated");

const LoggerHandlerToken = createNotificationHandlerDIToken<INotification<UserCreatedPayload>, void>()
  .as("LoggerHandler", {
    generics: [UserCreatedToken]
  });

const container = buildDIContainer()
  .register(MiddleWareOrderToken, [])
  .registerFactory(IEventBusToken, EventBusFactory)
  .register(LoggerHandlerToken, {
    handle: (payload: INotification<UserCreatedPayload>) => console.log(`User created: ${payload.payload.email}`)
  })
  .getResult();

const eventBus = container.resolve(IEventBusToken);

const notification = {
  createdAt: new Date(),
  token: UserCreatedToken,
  payload: { userId: "123", email: "user@example.com" }
};

await eventBus.publish(notification); // Logs: User created: user@example.com
```

---

## ✨ Features

- 🪶 **Lightweight & Type-Safe** — zero reflection, built on FIoC's tree-shakeable DI.
- 📡 **Notifications (Publish-Subscribe)** — broadcast events to multiple handlers asynchronously.
- ⚡ **Commands (Request-Response)** — invoke handlers synchronously with return values.
- 🛡️ **Middlewares** — chainable middleware with hierarchical discovery (specific → general).
- 🎯 **Automatic Handler Discovery** — uses FIoC's metadata to find and resolve handlers.
- 🔄 **Immutable Integration** — works seamlessly with FIoC's scopes and containers.
- 🔌 **Universal** — compatible with Node.js, browser, Deno, Bun, and serverless.
- 🧩 **Composable** — merge event buses or swap configurations dynamically.
- 🏗️ **Factory Pattern** — clean dependency injection with `EventBusFactory`.
- 🛠️ **Utility Functions** — helper functions for creating tokens: `createNotificationDIToken`, `createCommandDIToken`, `createNotificationHandlerDIToken`, `createCommandHandlerDIToken`, `createMiddlewareDIToken`.
- 🔗 **FIoC Ecosystem** — integrates with:
    - [`@fioc/react`](https://www.npmjs.com/package/@fioc/react)
    - [`@fioc/next`](https://www.npmjs.com/package/@fioc/next)

---

## 📘 Table of Contents

- [Quick Start](#-quick-start)
- [Creating Notifications](#creating-notifications)
- [Creating Commands](#creating-commands)
- [Registering Handlers](#registering-handlers)
- [Publishing Notifications](#publishing-notifications)
- [Invoking Commands](#invoking-commands)
- [Middlewares](#middlewares)
- [Event Bus Factory](#event-bus-factory)
- [Why FIoC Event Bus?](#why-fioc-event-bus)
- [Contributing](#contributing)
- [License](#license)

---

## 🔔 Creating Notifications

Notifications represent events that can be published to multiple subscribers.

```ts
import { createNotificationDIToken } from "@fioc/event-bus";

interface OrderPlacedNotification {
  orderId: string;
  amount: number;
}

const OrderPlacedToken = createNotificationDIToken<OrderPlacedNotification>()
  .as("OrderPlaced");
```

---

## ⚡ Creating Commands

Commands are request-response messages handled by a single handler.

```ts
import { createCommandDIToken } from "@fioc/event-bus";

interface CreateUserCommand {
  email: string;
  name: string;
}

const CreateUserToken = createCommandDIToken<CreateUserCommand, { userId: string; success: boolean }>()
  .as("CreateUser");
```

---

## 🛠️ Registering Handlers

Handlers are registered as FIoC tokens with metadata linking them to notifications or commands.

### Notification Handler

```ts
import { createNotificationDIToken, createNotificationHandlerDIToken } from "@fioc/event-bus";

const OrderPlacedToken = createNotificationDIToken<OrderPlacedNotification>()
  .as("OrderPlaced");

const EmailNotificationHandlerToken = createNotificationHandlerDIToken<OrderPlacedNotification, void>()
  .as("EmailNotificationHandler", {
    generics: [OrderPlacedToken]
  });

const container = buildDIContainer()
  .register(MiddleWareOrderToken, [])
  .registerFactory(IEventBusToken, EventBusFactory)
  .register(EmailNotificationHandlerToken, {
    handle: (payload: OrderPlacedNotification) => {
      // Send email logic
      console.log(`Email sent for order ${payload.orderId}`);
    }
  })
  .getResult();

const eventBus = container.resolve(IEventBusToken);
```

### Command Handler

```ts
import { createCommandDIToken, createCommandHandlerDIToken } from "@fioc/event-bus";

const CreateUserToken = createCommandDIToken<CreateUserCommand, { userId: string; success: boolean }>()
  .as("CreateUser");

const CreateUserHandlerToken = createCommandHandlerDIToken<ICommand<CreateUserCommand, { userId: string; success: boolean }>, { userId: string; success: boolean }>()
  .as("CreateUserHandler", {
    generics: [CreateUserToken]
  });

const container = buildDIContainer()
  .register(MiddleWareOrderToken, [])
  .registerFactory(IEventBusToken, EventBusFactory)
  .register(CreateUserHandlerToken, {
    handle: async (command: CreateUserCommand) => {
      // Create user logic
      return { userId: "123", success: true };
    }
  })
  .getResult();

const eventBus = container.resolve(IEventBusToken);
```

---

## 📡 Publishing Notifications

Publish notifications to trigger all registered handlers asynchronously.

```ts
const eventBus = container.resolve(IEventBusToken);

const notification = {
  createdAt: new Date(),
  token: OrderPlacedToken,
  payload: { orderId: "456", amount: 99.99 }
};

await eventBus.publish(notification); // All handlers for OrderPlaced will execute
```

---

## ⚡ Invoking Commands

Invoke commands to get a response from the single registered handler.

```ts
const eventBus = container.resolve(IEventBusToken);

const command = {
  createdAt: new Date(),
  token: CreateUserToken,
  payload: { email: "new@example.com", name: "John Doe" }
};

const result = await eventBus.invoke(command); // result: { userId: "123", success: true }
```

---

## 🛡️ Middlewares

Middlewares allow chaining logic before and after handler execution.

```ts
import { createMiddlewareDIToken } from "@fioc/event-bus";

const LoggingMiddlewareToken = createMiddlewareDIToken<INotification<OrderPlacedNotification>, void>()
  .as("LoggingMiddleware", {
    generics: [OrderPlacedToken]
  });

const container = buildDIContainer()
  .register(MiddleWareOrderToken, [LoggingMiddlewareToken])
  .registerFactory(IEventBusToken, EventBusFactory)
  .register(LoggingMiddlewareToken, {
    handle: async (req, next) => {
      console.log("Before handler");
      const result = await next(req);
      console.log("After handler");
      return result;
    }
  })
  .getResult();

const eventBus = container.resolve(IEventBusToken);
```

---

## 🏗️ Event Bus Factory

The `EventBusFactory` creates an event bus instance through FIoC's dependency injection system. Register it as a factory and resolve the `IEventBusToken` to get the event bus instance.

```ts
import { EventBusFactory, IEventBusToken, MiddleWareOrderToken } from "@fioc/event-bus";

const container = buildDIContainer()
  .register(MiddleWareOrderToken, []) // Register middleware order
  .registerFactory(IEventBusToken, EventBusFactory) // Register the factory
  // ... register handlers and middlewares
  .getResult();

const eventBus = container.resolve(IEventBusToken); // Get the event bus instance
```

---

## 🛠️ Utility Functions

The event bus provides helper functions to simplify token creation and automatically handle the correct implements metadata:

```ts
import {
  createNotificationDIToken,
  createCommandDIToken,
  createNotificationHandlerDIToken,
  createCommandHandlerDIToken,
  createMiddlewareDIToken
} from "@fioc/event-bus";

// Create notification tokens
const UserRegisteredToken = createNotificationDIToken<UserRegisteredEvent>()
  .as("UserRegistered");

// Create command tokens
const CreateOrderToken = createCommandDIToken<CreateOrderCommand, OrderResult>()
  .as("CreateOrder");

// Create handler tokens
const EmailHandlerToken = createNotificationHandlerDIToken<UserRegisteredEvent, void>()
  .as("EmailHandler", { generics: [UserRegisteredToken] });

const OrderHandlerToken = createCommandHandlerDIToken<ICommand<CreateOrderCommand, OrderResult>, OrderResult>()
  .as("OrderHandler", { generics: [CreateOrderToken] });

// Create middleware tokens
const LoggingMiddlewareToken = createMiddlewareDIToken<INotification<UserRegisteredEvent>, void>()
  .as("LoggingMiddleware", { generics: [UserRegisteredToken] });
```

These utilities automatically set up the correct implements metadata, eliminating boilerplate code.

---

## 🏛️ Architecture & Code Structure

The event bus is implemented as a FIoC factory with several key components:

### Core Components
- **EventBusFactory**: Main factory function that creates the event bus instance
- **Handler Discovery**: Automatic resolution of handlers based on token metadata
- **Middleware Pipeline**: Chainable middleware execution with proper ordering
- **Token Hierarchy**: Support for specific and general token matching

### Key Features
- **Hierarchical Middleware Discovery**: Middlewares can be registered for specific event types or general interfaces
- **Type-Safe Handler Resolution**: Full TypeScript inference for all operations
- **Immutable State Management**: Clean separation of registration and execution phases
- **Composable Architecture**: Easy to extend with new handler types or middleware patterns

### Implementation Details
The factory uses helper functions for common operations:
- `findMiddlewaresForToken()`: Discovers applicable middlewares by traversing token inheritance
- `createMiddlewarePipeline()`: Builds the middleware execution chain
- `executeNotificationHandlers()`: Handles notification broadcasting to multiple subscribers

---

## 🧩 Why FIoC Event Bus?

### Pros

- **Type-Safe Event Handling** — Full TypeScript inference for notifications, commands, and handlers.
- **Decoupled Architecture** — Publish-subscribe and command patterns reduce coupling.
- **Middleware Support** — Flexible pre/post-processing for cross-cutting concerns.
- **FIoC Integration** — Leverages FIoC's metadata for automatic handler discovery.
- **Immutable & Safe** — Works with FIoC's scopes for isolated event handling.
- **Tree-Shakeable** — No runtime overhead, built on FIoC's principles.

### Cons

- **Requires FIoC** — Depends on FIoC container for handler resolution.
- **Metadata-Heavy** — Uses generics and implements for type-safe resolution.

---

## 🤝 Contributing

Contributions are welcome!
Feel free to open issues or submit pull requests on [GitHub](https://github.com/kolostring/fioc). Please include tests for behavioral changes and keep changes small and focused.

---

## 📜 License

Licensed under the [MIT License](./LICENSE).
