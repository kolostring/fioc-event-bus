# @fioc/event-bus

**FIoC Event Bus** provides a comprehensive, type-safe event-driven architecture system built on top of [`@fioc/core`](https://www.npmjs.com/package/@fioc/core).  
It enables CQRS (Command Query Responsibility Segregation), domain events, and event-driven patterns with full dependency injection integration — completely reflection-free and decorator-free.

> 💡 Built for complex event-driven architectures, microservices, and domain-driven design — without reflection or decorators.

---

## 🚀 Quick Start

Install via npm, yarn, or pnpm:

```bash
npm install @fioc/event-bus @fioc/core

# or

yarn add @fioc/event-bus @fioc/core

# or

pnpm add @fioc/event-bus @fioc/core
```

---

## 📘 Table of Contents

- [Quick Start](#-quick-start)
- [Core Concepts](#-core-concepts)
- [Defining Events & Commands](#-defining-events--commands)
- [Creating Handlers](#-creating-handlers)
- [Using the Event Bus](#-using-the-event-bus)
- [Middleware & Interceptors](#-middleware--interceptors)
- [Execution Strategies](#-execution-strategies)
- [Metadata & Token Discovery](#-metadata--token-discovery)
- [Integration with FIoC Containers](#-integration-with-fioc-containers)
- [API Reference](#-api-reference)
- [Examples](#-examples)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🧩 Core Concepts

The Event Bus package introduces several key abstractions for building event-driven applications:

| Concept                | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| **INotification**      | Domain events that can have multiple handlers                       |
| **ICommand**           | Commands that perform actions (single handler)                      |
| **IQuery**             | Queries that retrieve data (single handler)                         |
| **IEventBus**          | Central service for publishing events and invoking commands/queries |
| **IHandlerMiddleware** | Interceptors for cross-cutting concerns                             |

Everything is **fully typed**, **DI-integrated**, and **metadata-aware** — no decorators, no `reflect-metadata`.

---

## 🔔 Defining Events & Commands

### Notifications (Domain Events)

```typescript
import { createNotificationDIToken } from "@fioc/event-bus";

// Define notification payload type
export type UserRegisteredPayload = {
  userId: string;
  email: string;
  timestamp: Date;
};

export interface UserRegisteredNotification
  extends INotification<UserRegisteredPayload> {}

// Create notification token
export const UserRegisteredNotificationToken =
  createNotificationDIToken<UserRegisteredNotification>().as("UserRegistered", {
    generics: [
      /* Optional payload token */
    ],
  });
```

### Commands

```typescript
import { createCommandDIToken } from "@fioc/event-bus";

export type CreateUserCommandPayload = {
  email: string;
  password: string;
  name: string;
};

export interface CreateUserCommand
  extends ICommand<CreateUserCommandPayload, string> {}

export const CreateUserCommandToken =
  createCommandDIToken<CreateUserCommand>().as("CreateUser");
```

### Queries

```typescript
import { createQueryDIToken } from "@fioc/event-bus";

export type GetUserByIdQueryPayload = {
  userId: string;
};

export interface GetUserByIdQuery
  extends IQuery<GetUserByIdQueryPayload, User> {}

export const GetUserByIdQuery =
  createQueryDIToken<GetUserByIdQuery>().as("GetUserById");
```

---

## 🛠️ Creating Handlers

### Notification Handlers (Multiple per Event)

```typescript
import { createNotificationHandlerDIToken } from "@fioc/event-bus";
import { UserRegisteredNotification } from "./events";

export interface SendWelcomeEmailHandler
  extends INotificationHandler<UserRegisteredNotification> {}

export const SendWelcomeEmailHandlerToken =
  createNotificationHandlerDIToken().as("SendWelcomeEmail", {
    generics: [UserRegisteredNotificationToken], // Needs to specify the notification token
  });

// Implementation
const sendWelcomeEmailHandlerImpl: SendWelcomeEmailHandler = {
  async handle(payload) {
    await emailService.sendWelcomeEmail(event.payload.email);
  },
};
```

### Command Handlers (Single per Command)

```typescript
import { createCommandHandlerDIToken } from "@fioc/event-bus";
import { CreateUserCommand } from "./commands";

export interface CreateUserHandler extends ICommandHandler<CreateUserCommand> {}

export const CreateUserHandlerToken = createCommandHandlerDIToken().as(
  "CreateUserHandler",
  {
    generics: [CreateUserCommandToken], // Needs to specify the command token
  }
);

// Implementation
const createUserHandlerImpl: CreateUserHandler = {
  async handle(command: { payload: CreateUserCommandPayload }) {
    const user = await userService.createUser(command.payload);
    return user.id; // Must match command result type
  },
};
```

### Query Handlers (Single per Query)

```typescript
import { createQueryHandlerDIToken } from "@fioc/event-bus";
import { GetUserByIdQuery } from "./queries";

export interface GetUserByIdHandler extends IQueryHandler<GetUserByIdQuery> {}

export const GetUserByIdHandlerToken = createQueryHandlerDIToken().as(
  "GetUserByIdHandler",
  {
    generics: [GetUserByIdQueryToken], // Needs to specify the query token
  }
);

// Implementation
const getUserByIdHandlerImpl: GetUserByIdHandler = {
  async handle(query: { payload: GetUserByIdQueryPayload }) {
    return await userRepository.findById(query.payload.userId);
  },
};
```

---

## 📡 Using the Event Bus

### Basic Setup

```typescript
import { buildDIContainer } from "@fioc/core";
import { EventBusFactory, IEventBusToken } from "@fioc/event-bus";

const container = buildDIContainer()
  .registerFactory(IEventBusToken, EventBusFactory)
  .register(SendWelcomeEmailHandlerToken, sendWelcomeEmailHandler)
  .register(CreateUserHandlerToken, createUserHandler)
  .register(GetUserByIdHandlerToken, getUserByIdHandler)
  .getResult();

const eventBus = container.resolve(IEventBusToken);
```

### Publishing Notifications

```typescript
// Publish a domain event
await eventBus.publish({
  token: UserRegisteredNotification,
  payload: {
    userId: "123",
    email: "user@example.com",
    timestamp: new Date(),
  },
  createdAt: new Date(),
});

// With different execution strategies
await eventBus.publish(notification, "parallel"); // All handlers run concurrently
await eventBus.publish(notification, "sequential"); // Handlers run one after another
await eventBus.publish(notification, "besteffort"); // Parallel but continue on handler errors
```

### Invoking Commands & Queries

```typescript
// Invoke a command
const userId = await eventBus.invoke({
  token: CreateUserCommand,
  payload: {
    email: "user@example.com",
    password: "securepassword",
    name: "John Doe",
  },
  createdAt: new Date(),
});

// Invoke a query
const user = await eventBus.invoke({
  token: GetUserByIdQuery,
  payload: { userId: "123" },
  createdAt: new Date(),
});
```

---

## 🔌 Middleware & Interceptors

Middleware allows you to implement cross-cutting concerns like logging, validation, and error handling.

### Creating Middleware

```typescript
import { createMiddlewareDIToken, IQueryToken, ICommandToken } from "@fioc/event-bus";

export interface LoggingMiddleware extends IHandlerMiddleware<IQuery<any> | ICommand<any> ,unknown>

export const LoggingMiddleware = createMiddlewareDIToken().as(
  "LoggingMiddleware",
  {
    generics: [IQueryToken, ICommandToken], // Apply to all commands and queries
  }
);

const loggingMiddleware = {
  async handle(request, next: (request: any) => Promise<any>) {
    console.log("Processing request:", request.token.key);
    const startTime = Date.now();

    try {
      const result = await next(request);
      console.log("Request completed in", Date.now() - startTime, "ms");
      return result;
    } catch (error) {
      console.error("Request failed:", error);
      throw error;
    }
  },
};
```

### Middleware Registration & Ordering

```typescript
import { MiddleWareOrderToken } from "@fioc/event-bus";

const container = buildDIContainer()
  .register(MiddleWareOrderToken, [LoggingMiddleware, ValidationMiddleware]) // Middleware Order declaration
  .registerFactory(IEventBusToken, EventBusFactory)
  .register(LoggingMiddleware, loggingMiddleware)
  .register(ValidationMiddleware, validationMiddleware)
  .getResult();
```

### Applying Middleware to Specific Event Types

```typescript
// Apply to all notifications
const NotificationLoggingMiddleware = createMiddlewareDIToken().as(
  "NotificationLogging",
  {
    generics: [INotificationToken], // Apply to all notifications
  }
);

// Apply to specific notification
const UserEventMiddleware = createMiddlewareDIToken().as(
  "UserEventMiddleware",
  {
    generics: [UserRegisteredNotification], // Apply only to user registration
  }
);

// Apply to multiple types
const CommandQueryMiddleware = createMiddlewareDIToken().as(
  "CommandQueryMiddleware",
  {
    generics: [ICommandToken, IQueryToken], // Apply to all commands and queries
  }
);
```

---

## ⚡ Execution Strategies

The event bus supports different execution strategies for notification handlers:

### Parallel (Default)

```typescript
await eventBus.publish(notification, "parallel");
```

- All handlers execute concurrently
- Fastest execution time
- Use when handlers are independent

### Sequential

```typescript
await eventBus.publish(notification, "sequential");
```

- Handlers execute one after another
- Guaranteed order of execution
- Use when handlers have dependencies

### Best Effort (Default)

```typescript
const errors = await eventBus.publish(notification, "besteffort");
```

- All handlers execute concurrently
- Continues execution even if some handlers fail
- Returns array of errors from failed handlers
- Use for non-critical background tasks

---

---

## 📚 API Reference

### Core Tokens

| Token                       | Description                               |
| --------------------------- | ----------------------------------------- |
| `IEventBusToken`            | The main event bus service                |
| `MiddleWareOrderToken`      | Array defining middleware execution order |
| `INotificationToken`        | Base token for all notifications          |
| `ICommandToken`             | Base token for all commands               |
| `IQueryToken`               | Base token for all queries                |
| `INotificationHandlerToken` | Base token for notification handlers      |
| `ICommandHandlerToken`      | Base token for command handlers           |
| `IQueryHandlerToken`        | Base token for query handlers             |
| `IHandlerMiddlewareToken`   | Base token for middleware                 |

### Factory Functions

| Function                             | Description                         |
| ------------------------------------ | ----------------------------------- |
| `createNotificationDIToken()`        | Creates notification tokens         |
| `createCommandDIToken()`             | Creates command tokens              |
| `createQueryDIToken()`               | Creates query tokens                |
| `createNotificationHandlerDIToken()` | Creates notification handler tokens |
| `createCommandHandlerDIToken()`      | Creates command handler tokens      |
| `createQueryHandlerDIToken()`        | Creates query handler tokens        |
| `createMiddlewareDIToken()`          | Creates middleware tokens           |

### Interfaces

| Interface                  | Description                    |
| -------------------------- | ------------------------------ |
| `IEventBus`                | Main event bus interface       |
| `INotification<T>`         | Domain event interface         |
| `ICommand<T, R>`           | Command interface              |
| `IQuery<T, R>`             | Query interface                |
| `INotificationHandler<T>`  | Notification handler interface |
| `ICommandHandler<T>`       | Command handler interface      |
| `IQueryHandler<T>`         | Query handler interface        |
| `IHandlerMiddleware<T, R>` | Middleware interface           |

---

## 🤝 Contributing

Contributions are welcome!  
Open an issue or submit a PR on [GitHub](https://github.com/kolostring/fioc).

Please include tests for new features or fixes and keep commits focused.

---

## 📜 License

Licensed under the [MIT License](./LICENSE).
