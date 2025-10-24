import { createDIToken, type DIToken } from "@fioc/core";

/**
 * Represents a notification event that can be published to multiple handlers.
 * Notifications follow the publish-subscribe pattern where multiple handlers
 * can subscribe to the same event type.
 *
 * @template T - The type of the notification payload
 */
export interface INotification<T> {
  /** Timestamp when the notification was created */
  createdAt: Date;
  /** The FIoC token identifying this notification type */
  token: DIToken<INotification<T>>;
  /** The payload data carried by the notification */
  payload: T;
}

/**
 * Handler interface for processing notification events.
 * Notification handlers receive the payload and can perform side effects
 * but do not return values (fire-and-forget pattern).
 *
 * @template T - The type of the notification payload
 */
export interface INotificationHandler<T> {
  /**
   * Handles a notification payload.
   * @param payload - The notification payload to process
   * @returns The result of processing (typically void)
   */
  handle: (payload: T) => Promise<void>;
}

/**
 * Represents a command that expects a response.
 * Commands follow the request-response pattern where exactly one handler
 * processes the command and returns a result.
 *
 * @template T - The type of the command payload
 * @template R - The type of the command result
 */
export interface ICommand<T, R> {
  /** The FIoC token identifying this command type */
  token: DIToken<ICommand<T, R>>;
  /** The payload data carried by the command */
  payload: T;
  /** Timestamp when the command was created */
  createdAt: Date;
}

/**
 * Handler interface for processing command requests.
 * Command handlers receive the full command object and must return a result.
 * Only one handler should exist per command type.
 *
 * @template T - The command type (extends ICommand)
 * @template R - The return type of the command
 */
export interface ICommandHandler<T extends ICommand<any, unknown>> {
  /**
   * Handles a command and returns a result.
   * @param command - The command to process
   * @returns A promise that resolves to the command result
   */
  handle: (
    command: T
  ) => Promise<T extends ICommand<any, infer R> ? R : unknown>;
}

/**
 * Represents a query that expects a response.
 * Queries follow the request-response pattern where exactly one handler
 * processes the query and returns a result.
 *
 * @template T - The type of the query payload
 * @template R - The type of the query result
 */
export interface IQuery<T, R> {
  /** The FIoC token identifying this query type */
  token: DIToken<IQuery<T, R>>;
  /** The payload data carried by the query */
  payload: T;
  /** Timestamp when the query was created */
  createdAt: Date;
}

/**
 * Handler interface for processing query requests.
 * Query handlers receive the full query object and must return a result.
 * Only one handler should exist per query type.
 *
 * @template T - The query type (extends IQuery)
 * @template R - The return type of the query
 */
export interface IQueryHandler<T extends IQuery<any, unknown>> {
  /**
   * Handles a query and returns a result.
   * @param query - The query to process
   * @returns A promise that resolves to the query result
   */
  handle: (query: T) => Promise<T extends IQuery<any, infer R> ? R : unknown>;
}

/**
 * Middleware interface for intercepting and modifying handler execution.
 * Middlewares can perform cross-cutting concerns like logging, validation,
 * authentication, or caching before and after handler execution.
 *
 * @template T - The type of the request (notification or command)
 * @template R - The return type of the handler chain
 */
export interface IHandlerMiddleware<T, R> {
  /**
   * Processes a request and optionally calls the next middleware/handler.
   * @param req - The request object (notification or command)
   * @param next - Function to call the next middleware or handler in the chain
   * @returns A promise that resolves to the result of the handler chain
   */
  handle: (req: T, next: (req: T) => Promise<R>) => Promise<R>;
}

/**
 * Main event bus interface providing publish-subscribe and command capabilities.
 * The event bus manages the registration and execution of handlers and middlewares.
 */
export interface IEventBus {
  /**
   * Publishes a notification to all registered handlers.
   * This is a fire-and-forget operation that broadcasts to multiple subscribers.
   *
   * @template T - The type of the notification payload
   * @param notification - The notification to publish
   * @param strategy - The publish strategy to use
   * @returns A promise that resolves when all handlers have completed
   */
  publish<T, S extends "parallel" | "sequential" | "besteffort">(
    notification: INotification<T>,
    strategy?: S
  ): Promise<S extends "besteffort" ? Error[] : void>;

  /**
   * Invokes a command and returns the result from its handler.
   * Commands follow request-response pattern with exactly one handler.
   *
   * @template T - The type of the command payload
   * @template R - The type of the command result
   * @param command - The command to invoke
   * @returns A promise that resolves to the command result
   */
  invoke<T, R>(req: ICommand<T, R> | IQuery<T, R>): Promise<R>;
}

/**
 * FIoC token representing the base notification interface.
 * Used for middleware registration that applies to all notifications.
 */
export const INotificationToken =
  createDIToken<INotification<any>>().as("INotification");

/**
 * FIoC token representing the base notification handler interface.
 * Used internally for handler discovery and registration.
 */
export const INotificationHandlerToken = createDIToken<
  INotificationHandler<any>
>().as("INotificationHandler");

/**
 * FIoC token representing the base command interface.
 * Used for middleware registration that applies to all commands.
 */
export const ICommandToken = createDIToken<ICommand<any, any>>().as("ICommand");

/**
 * FIoC token representing the base command handler interface.
 * Used internally for handler discovery and registration.
 */
export const ICommandHandlerToken =
  createDIToken<ICommandHandler<any>>().as("ICommandHandler");

/**
 * FIoC token representing the base query interface.
 * Used for middleware registration that applies to all queries.
 */
export const IQueryToken = createDIToken<IQuery<any, any>>().as("IQuery");

/**
 * FIoC token representing the base query handler interface.
 * Used internally for handler discovery and registration.
 */
export const IQueryHandlerToken =
  createDIToken<IQueryHandler<any>>().as("IQueryHandler");

/**
 * FIoC token representing the base middleware interface.
 * Used internally for middleware discovery and registration.
 */
export const IHandlerMiddlewareToken =
  createDIToken<IHandlerMiddleware<any, any>>().as("IHandlerMiddleware");

/**
 * FIoC token representing the event bus interface.
 * Used to register and resolve the event bus instance from the container.
 */
export const IEventBusToken = createDIToken<IEventBus>().as("IEventBus");

/**
 * FIoC token for configuring the order of middleware execution.
 * Register an array of middleware tokens in the desired execution order.
 */
export const MiddleWareOrderToken =
  createDIToken<DIToken<IHandlerMiddleware<any, any>>[]>().as(
    "MiddleWareOrder"
  );
