import { describe, it, expect, vi } from "vitest";
import { buildDIContainer, createDIToken } from "@fioc/core";
import {
  EventBusFactory,
  createNotificationDIToken,
  createCommandDIToken,
  createNotificationHandlerDIToken,
  createCommandHandlerDIToken,
  createQueryDIToken,
  createQueryHandlerDIToken,
  createMiddlewareDIToken,
} from "../../core/EventBus.js";
import {
  INotificationHandlerToken,
  ICommandHandlerToken,
  IHandlerMiddlewareToken,
  INotification,
  ICommand,
  IQuery,
  IQueryHandler,
  MiddleWareOrderToken,
  IEventBusToken,
  INotificationToken,
  ICommandToken,
  IQueryToken,
  INotificationHandler,
  ICommandHandler,
} from "../../core/IEventBus.js";

// Test notification payload type
type TestNotificationPayload = {
  message: string;
};

const TestNotificationPayloadToken =
  createDIToken<TestNotificationPayload>().as("TestNotificationPayload");

// Test notification token
const TestNotificationToken = createNotificationDIToken<
  INotification<TestNotificationPayload>
>().as("TestNotification", {
  generics: [TestNotificationPayloadToken],
});

// Test notification handler
const TestNotificationHandlerToken = createNotificationHandlerDIToken<
  INotificationHandler<INotification<TestNotificationPayload>>
>().as("TestNotificationHandler", {
  generics: [TestNotificationToken],
});

// Test command payload type
type TestCommandPayload = {
  input: string;
};

const TestCommandPayloadToken =
  createDIToken<TestCommandPayload>().as("TestCommandPayload");

// Test command token
const TestCommandToken = createCommandDIToken<
  ICommand<TestCommandPayload, string>,
  string
>().as("TestCommand", {
  generics: [TestCommandPayloadToken],
});

// Test command handler
const TestCommandHandlerToken = createCommandHandlerDIToken<
  ICommandHandler<ICommand<TestCommandPayload, string>>
>().as("TestCommandHandler", {
  generics: [TestCommandToken],
});

// Test query payload type
type TestQueryPayload = {
  id: string;
};

// Test query token
const TestQueryToken =
  createQueryDIToken<
    IQuery<TestQueryPayload, { data: string; found: boolean }>
  >().as("TestQuery");

// Test query handler
const TestQueryHandlerToken = createQueryHandlerDIToken<
  IQueryHandler<IQuery<TestQueryPayload, { data: string; found: boolean }>>
>().as("TestQueryHandler", {
  generics: [TestQueryToken],
});

describe("EventBus", () => {
  describe("Notifications", () => {
    it("should publish notification to registered handler", async () => {
      const handlerSpy = vi.fn();

      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(TestNotificationHandlerToken, {
          handle: handlerSpy,
        })
        .getResult();

      const notification: INotification<TestNotificationPayload> = {
        createdAt: new Date(),
        token: TestNotificationToken,
        payload: { message: "test" },
      };
      const eventBus = container.resolve(IEventBusToken);

      await eventBus.publish(notification);

      expect(handlerSpy).toHaveBeenCalledWith({ message: "test" });
    });

    it("should publish to multiple handlers", async () => {
      const handler1Spy = vi.fn();
      const handler2Spy = vi.fn();

      const Handler1Token = createNotificationHandlerDIToken<
        INotificationHandler<INotification<TestNotificationPayload>>
      >().as("Handler1", {
        generics: [TestNotificationToken],
      });

      const Handler2Token = createNotificationHandlerDIToken<
        INotificationHandler<INotification<TestNotificationPayload>>
      >().as("Handler2", {
        generics: [TestNotificationToken],
      });

      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(Handler1Token, { handle: handler1Spy })
        .register(Handler2Token, { handle: handler2Spy })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      const notification: INotification<TestNotificationPayload> = {
        createdAt: new Date(),
        token: TestNotificationToken,
        payload: { message: "test" },
      };

      await eventBus.publish(notification);

      expect(handler1Spy).toHaveBeenCalledWith({ message: "test" });
      expect(handler2Spy).toHaveBeenCalledWith({ message: "test" });
    });
  });

  describe("Commands", () => {
    it("should invoke command and return result", async () => {
      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(TestCommandHandlerToken, {
          handle: async (cmd) => cmd.payload.input.toUpperCase(),
        })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      const command: ICommand<TestCommandPayload, string> = {
        createdAt: new Date(),
        token: TestCommandToken,
        payload: { input: "hello" },
      };

      const result = await eventBus.invoke(command);

      expect(result).toEqual("HELLO");
    });

    it("should throw error if command handler not found", async () => {
      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .getResult();
      const eventBus = container.resolve(IEventBusToken);

      const command: ICommand<TestCommandPayload, string> = {
        createdAt: new Date(),
        token: TestCommandToken,
        payload: { input: "hello" },
      };

      await expect(eventBus.invoke(command)).rejects.toThrow(
        "Request handler for Request TestCommand not found"
      );
    });
  });

  describe("Queries", () => {
    it("should invoke query and return result", async () => {
      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(TestQueryHandlerToken, {
          handle: async (query) => ({
            data: `Found: ${query.payload.id}`,
            found: true,
          }),
        })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      const query: IQuery<TestQueryPayload, { data: string; found: boolean }> =
        {
          createdAt: new Date(),
          token: TestQueryToken,
          payload: { id: "123" },
        };

      const result = await eventBus.invoke(query);

      expect(result).toEqual({ data: "Found: 123", found: true });
    });

    it("should throw error if query handler not found", async () => {
      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .getResult();
      const eventBus = container.resolve(IEventBusToken);

      const query: IQuery<TestQueryPayload, { data: string; found: boolean }> =
        {
          createdAt: new Date(),
          token: TestQueryToken,
          payload: { id: "123" },
        };

      await expect(eventBus.invoke(query)).rejects.toThrow(
        "Request handler for Request TestQuery not found"
      );
    });
  });

  describe("Middlewares", () => {
    it("should execute INotification Middleware in order", async () => {
      const log: string[] = [];
      const middleware1Spy = vi.fn().mockImplementation(async (req, next) => {
        log.push("middleware1 before");
        const result = await next(req);
        log.push("middleware1 after");
        return result;
      });

      const middleware2Spy = vi.fn().mockImplementation(async (req, next) => {
        log.push("middleware2 before");
        const result = await next(req);
        log.push("middleware2 after");
        return result;
      });

      const handlerSpy = vi.fn().mockImplementation(() => {
        log.push("handler");
      });

      const Middleware1Token = createMiddlewareDIToken<
        INotification<TestNotificationPayload>,
        void
      >().as("Middleware1", {
        generics: [INotificationToken],
      });

      const Middleware2Token = createMiddlewareDIToken<
        INotification<TestNotificationPayload>,
        void
      >().as("Middleware2", {
        generics: [INotificationToken],
      });

      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [Middleware1Token, Middleware2Token])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(Middleware1Token, { handle: middleware1Spy })
        .register(Middleware2Token, { handle: middleware2Spy })
        .register(TestNotificationHandlerToken, { handle: handlerSpy })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      const notification: INotification<TestNotificationPayload> = {
        createdAt: new Date(),
        token: TestNotificationToken,
        payload: { message: "test" },
      };

      await eventBus.publish(notification);

      expect(middleware1Spy).toHaveBeenCalled();
      expect(middleware2Spy).toHaveBeenCalled();
      expect(handlerSpy).toHaveBeenCalledWith({ message: "test" });
      expect(log).toEqual([
        "middleware1 before",
        "middleware2 before",
        "handler",
        "middleware2 after",
        "middleware1 after",
      ]);
    });

    it("should execute specific INotification Middleware in order", async () => {
      const log: string[] = [];
      const middleware1Spy = vi.fn().mockImplementation(async (req, next) => {
        log.push("middleware1 before");
        const result = await next(req);
        log.push("middleware1 after");
        return result;
      });

      const middleware2Spy = vi.fn().mockImplementation(async (req, next) => {
        log.push("middleware2 before");
        const result = await next(req);
        log.push("middleware2 after");
        return result;
      });

      const handlerSpy = vi.fn().mockImplementation((payload) => {
        log.push("handler");
      });

      const Middleware1Token = createMiddlewareDIToken<
        INotification<TestNotificationPayload>,
        void
      >().as("Middleware1", {
        generics: [TestNotificationToken],
      });

      const Middleware2Token = createMiddlewareDIToken<
        INotification<TestNotificationPayload>,
        void
      >().as("Middleware2", {
        generics: [TestNotificationToken],
      });

      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [Middleware1Token, Middleware2Token])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(Middleware1Token, { handle: middleware1Spy })
        .register(Middleware2Token, { handle: middleware2Spy })
        .register(TestNotificationHandlerToken, { handle: handlerSpy })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      const notification: INotification<TestNotificationPayload> = {
        createdAt: new Date(),
        token: TestNotificationToken,
        payload: { message: "test" },
      };

      await eventBus.publish(notification);

      expect(middleware1Spy).toHaveBeenCalled();
      expect(middleware2Spy).toHaveBeenCalled();
      expect(handlerSpy).toHaveBeenCalledWith({ message: "test" });
      expect(log).toEqual([
        "middleware1 before",
        "middleware2 before",
        "handler",
        "middleware2 after",
        "middleware1 after",
      ]);
    });

    it("should execute middlewares for both commands and queries", async () => {
      // Middleware that applies to all commands and queries
      const LoggingMiddlewareToken = createMiddlewareDIToken<any, any>().as(
        "LoggingMiddleware",
        {
          generics: [ICommandToken, IQueryToken], // Applies to both commands and queries
        }
      );

      const middlewareSpy = vi.fn().mockImplementation(async (req, next) => {
        const result = await next(req);
        return result;
      });

      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [LoggingMiddlewareToken])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(LoggingMiddlewareToken, { handle: middlewareSpy })
        .register(TestCommandHandlerToken, {
          handle: async (cmd) => cmd.payload.input.toUpperCase(),
        })
        .register(TestQueryHandlerToken, {
          handle: async (query) => ({
            data: `Found: ${query.payload.id}`,
            found: true,
          }),
        })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      // Test command with middleware
      const command: ICommand<TestCommandPayload, string> = {
        createdAt: new Date(),
        token: TestCommandToken,
        payload: { input: "hello" },
      };

      const commandResult = await eventBus.invoke(command);
      expect(commandResult).toEqual("HELLO");

      // Test query with middleware
      const query: IQuery<TestQueryPayload, { data: string; found: boolean }> =
        {
          createdAt: new Date(),
          token: TestQueryToken,
          payload: { id: "123" },
        };

      const queryResult = await eventBus.invoke(query);
      expect(queryResult).toEqual({ data: "Found: 123", found: true });

      // Check that middleware was called for both command and query
      expect(middlewareSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Exceptions", () => {
    it("should throw error when notification handler is missing generics", () => {
      expect(() => {
        const container = buildDIContainer()
          .register(MiddleWareOrderToken, [])
          .registerFactory(IEventBusToken, EventBusFactory)
          // @ts-expect-error Missing generics for INotificationHandlerToken
          .register(
            createDIToken().as("InvalidHandler", {
              implements: [INotificationHandlerToken],
            })
          )
          .getResult();

        // Resolve the event bus to trigger the factory and validation
        container.resolve(IEventBusToken);
      }).toThrow(
        "Notification handler InvalidHandler is missing Notification generic"
      );
    });

    it("should throw error when command handler is missing generics", () => {
      expect(() => {
        const container = buildDIContainer()
          .register(MiddleWareOrderToken, [])
          .registerFactory(IEventBusToken, EventBusFactory)
          // @ts-expect-error Missing generics for ICommandHandlerToken
          .register(
            createDIToken().as("InvalidHandler", {
              implements: [ICommandHandlerToken],
            })
          )
          .getResult();

        // Resolve the event bus to trigger the factory and validation
        container.resolve(IEventBusToken);
      }).toThrow("Command handler InvalidHandler is missing Command generic");
    });

    it("should throw error when middleware is missing generics", () => {
      expect(() => {
        const container = buildDIContainer()
          .register(MiddleWareOrderToken, [])
          .registerFactory(IEventBusToken, EventBusFactory)
          // @ts-expect-error Missing generics for IHandlerMiddlewareToken
          .register(
            createDIToken().as("InvalidMiddleware", {
              implements: [IHandlerMiddlewareToken],
            })
          )
          .getResult();

        // Resolve the event bus to trigger the factory and validation
        container.resolve(IEventBusToken);
      }).toThrow("Middleware token InvalidMiddleware is missing generics");
    });

    it("should throw error when command handler is registered twice for same command", () => {
      expect(() => {
        const container = buildDIContainer()
          .register(MiddleWareOrderToken, [])
          .registerFactory(IEventBusToken, EventBusFactory)
          .register(
            createCommandHandlerDIToken<
              ICommandHandler<ICommand<TestCommandPayload, string>>
            >().as("Handler1", { generics: [TestCommandToken] }),
            { handle: vi.fn() }
          )
          .register(
            createCommandHandlerDIToken<
              ICommandHandler<ICommand<TestCommandPayload, string>>
            >().as("Handler2", { generics: [TestCommandToken] }),
            { handle: vi.fn() }
          ) // Duplicate
          .getResult();

        // Resolve the event bus to trigger the factory and validation
        container.resolve(IEventBusToken);
      }).toThrow(
        "Command handler Handler2 is already registered for Command TestCommand"
      );
    });
  });
});
