import { describe, it, expect, vi } from "vitest";
import { buildDIContainer, createDIToken, DIToken } from "@fioc/core";
import { EventBusFactory } from "../../core/EventBus.js";
import {
  INotificationHandlerToken,
  ICommandHandlerToken,
  IHandlerMiddlewareToken,
  INotification,
  ICommand,
  INotificationHandler,
  MiddleWareOrderToken,
  IEventBusToken,
  INotificationToken,
  ICommandToken,
  IHandlerMiddleware,
} from "../../core/IEventBus.js";

// Test notification payload type
type TestNotificationPayload = {
  message: string;
};

const TestNotificationPayloadToken = createDIToken<TestNotificationPayload>().as("TestNotificationPayload");

// Test command payload type
type TestCommandPayload = {
  input: string;
};

const TestCommandPayloadToken = createDIToken<TestCommandPayload>().as("TestCommandPayload");

// Test notification token
const TestNotificationToken = createDIToken<INotification<TestNotificationPayload>>().as("TestNotification", {
  implements: [INotificationToken],
  generics: [TestNotificationPayloadToken]
});

// Test command token
const TestCommandToken = createDIToken<ICommand<TestCommandPayload, string>>().as("TestCommand", {
  implements: [ICommandToken],
  generics: [TestCommandPayloadToken]
});

// Test notification handler
const TestNotificationHandlerToken = createDIToken<INotificationHandler<any, any>>()
  .as("TestNotificationHandler", {
    implements: [INotificationHandlerToken],
    generics: [TestNotificationToken]
  });

// Test command handler
const TestCommandHandlerToken = createDIToken()
  .as("TestCommandHandler", {
    implements: [ICommandHandlerToken],
    generics: [TestCommandToken]
  });

// Test middleware
const TestMiddlewareToken = createDIToken()
  .as("TestMiddleware", {
    implements: [IHandlerMiddlewareToken],
    generics: [TestNotificationToken]
  });

describe("EventBus", () => {
  describe("Notifications", () => {
    it("should publish notification to registered handler", async () => {
      const handlerSpy = vi.fn();

      const container = buildDIContainer()
        .register(MiddleWareOrderToken, [])
        .registerFactory(IEventBusToken, EventBusFactory)
        .register(TestNotificationHandlerToken, {
          handle: handlerSpy
        })
        .getResult();

      const notification: INotification<TestNotificationPayload> = {
        createdAt: new Date(),
        token: TestNotificationToken,
        payload: { message: "test" }
      };
      const eventBus = container.resolve(IEventBusToken);

      await eventBus.publish(notification);

      expect(handlerSpy).toHaveBeenCalledWith({ message: "test" });
    });

    it("should publish to multiple handlers", async () => {
      const handler1Spy = vi.fn();
      const handler2Spy = vi.fn();

      const Handler1Token = createDIToken<INotificationHandler<INotification<TestNotificationPayload>, void>>()
        .as("Handler1", {
          implements: [INotificationHandlerToken],
          generics: [TestNotificationToken]
        });

      const Handler2Token = createDIToken<INotificationHandler<INotification<TestNotificationPayload>, void>>()
        .as("Handler2", {
          implements: [INotificationHandlerToken],
          generics: [TestNotificationToken]
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
        payload: { message: "test" }
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
          handle: async (cmd) => ({ result: cmd.payload.input.toUpperCase() })
        })
        .getResult();

      const eventBus = container.resolve(IEventBusToken);

      const command: ICommand<TestCommandPayload, string> = {
        createdAt: new Date(),
        token: TestCommandToken,
        payload: { input: "hello" }
      };

      const result = await eventBus.invoke(command);

      expect(result).toEqual({ result: "HELLO" });
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
        payload: { input: "hello" }
      };

      await expect(eventBus.invoke(command)).rejects.toThrow(
        "Command handler for Command TestCommand not found"
      );
    });
  });

  describe("Middlewares", () => {
    it("should execute middleware in order", async () => {
      const middleware1Spy = vi.fn().mockImplementation(async (req, next) => {
        console.log("middleware1 before");
        const result = await next(req);
        console.log("middleware1 after");
        return result;
      });

      const middleware2Spy = vi.fn().mockImplementation(async (req, next) => {
        console.log("middleware2 before");
        const result = await next(req);
        console.log("middleware2 after");
        return result;
      });

      const handlerSpy = vi.fn();

      const Middleware1Token = createDIToken<IHandlerMiddleware<any, any>>()
        .as("Middleware1", {
          implements: [IHandlerMiddlewareToken],
          generics: [TestNotificationToken]
        });

      const Middleware2Token = createDIToken<IHandlerMiddleware<any, any>>()
        .as("Middleware2", {
          implements: [IHandlerMiddlewareToken],
          generics: [TestNotificationToken]
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
        payload: { message: "test" }
      };

      await eventBus.publish(notification);

      expect(middleware1Spy).toHaveBeenCalled();
      expect(middleware2Spy).toHaveBeenCalled();
      expect(handlerSpy).toHaveBeenCalledWith({ message: "test" });
    });
  });
});
