import {
  createDIToken,
  DIContainer,
  DIToken,
  DITokenMetadata,
  withDependencies,
} from "@fioc/core";
import {
  ICommand,
  ICommandHandler,
  ICommandHandlerToken,
  ICommandToken,
  IEventBus,
  IHandlerMiddleware,
  IHandlerMiddlewareToken,
  INotification,
  INotificationHandler,
  INotificationHandlerToken,
  INotificationToken,
  IQuery,
  IQueryHandler,
  IQueryHandlerToken,
  IQueryToken,
  MiddleWareOrderToken,
} from "./IEventBus.js";

/**
 * Internal state type for tracking notification handlers.
 * Maps notification token keys to arrays of handler tokens.
 */
type EventBusNotificationsState<T = any> = {
  [K in keyof T]: K extends string
    ? T[K] extends DIToken<any, K>[]
      ? DIToken<any, K>[]
      : never
    : never;
};

/**
 * Internal state type for tracking command handlers.
 * Maps command token keys to single handler tokens (commands have one handler each).
 */
type EventBusCommandsState<T = any> = {
  [K in keyof T]: K extends string
    ? T[K] extends DIToken<any, K>
      ? DIToken<any, K>
      : never
    : never;
};

/**
 * Factory function for creating event bus instances.
 * Uses FIoC dependency injection to create an event bus with configured handlers and middlewares.
 *
 * This factory analyzes the container to discover all registered handlers and middlewares,
 * then creates an event bus instance that can route notifications and commands appropriately.
 *
 * @returns A DIFactory for IEventBus instance ready for registration
 */
export const EventBusFactory = withDependencies(
  DIContainer,
  MiddleWareOrderToken
).defineFactory(
  (
    container: DIContainer,
    middlewareOrder: DIToken<IHandlerMiddleware<any, any>>[]
  ): IEventBus => {
    const tokensNotificationHandlers = container.findImplementationTokens(
      INotificationHandlerToken
    );

    const tokensRequestsHandlers = [
      ...container.findImplementationTokens(ICommandHandlerToken),
      ...container.findImplementationTokens(IQueryHandlerToken),
    ];

    const tokensMiddlewares = container.findImplementationTokens(
      IHandlerMiddlewareToken
    );

    if (tokensMiddlewares.length > middlewareOrder.length) {
      throw new Error(
        "Missing middlewares in middleware order: " +
          tokensMiddlewares
            .filter((token) => middlewareOrder.indexOf(token) === -1)
            .map((token) => token.key)
            .join(", ")
      );
    }

    const notificationsState: EventBusNotificationsState = {};
    tokensNotificationHandlers.forEach((token) => {
      if (!token.metadata?.generics?.[0]) {
        throw new Error(
          `Notification handler ${token.key} is missing Notification generic`
        );
      }

      token.metadata?.generics?.forEach((notificationToken) => {
        notificationsState[notificationToken.key] ??= [];
        notificationsState[notificationToken.key].push(token);
      });
    });

    const requestsState: EventBusCommandsState = {};
    tokensRequestsHandlers.forEach((token) => {
      const commandToken = token.metadata?.generics?.[0];
      if (!commandToken) {
        throw new Error(
          `Request handler ${token.key} is missing generic Token`
        );
      }

      if (requestsState[commandToken.key]) {
        throw new Error(
          `Request handler ${token.key} is already registered for Token ${commandToken.key}`
        );
      }
      requestsState[commandToken.key] = token;
    });

    const middlewareState: EventBusNotificationsState = {};
    tokensMiddlewares.forEach((token) => {
      if (!token.metadata?.generics?.[0]) {
        throw new Error(`Middleware token ${token.key} is missing generics`);
      }

      token.metadata?.generics?.forEach((genericToken) => {
        middlewareState[genericToken.key] ??= [];
        middlewareState[genericToken.key].push(token);
      });
    });

    /**
     * Finds all middlewares applicable to a token by traversing its inheritance hierarchy.
     * First checks for middlewares registered for the specific token, then traverses up
     * the implements chain to find more general middlewares.
     *
     * @param token - The token to find middlewares for
     * @returns An array of middleware tokens applicable to the token
     */
    const findMiddlewaresForToken = (token: DIToken<any>) => {
      let middlewares = [...(middlewareState[token.key] ?? [])];

      if (!token.metadata?.implements?.length) {
        return middlewares;
      }

      token.metadata.implements.forEach((impToken) => {
        middlewares = [...middlewares, ...findMiddlewaresForToken(impToken)];
      });

      return Array.from(new Set(middlewares));
    };

    /**
     * Creates a middleware pipeline by ordering middlewares according to the configured order
     * and chaining them together using reduceRight.
     *
     * @param middlewares - Array of middleware tokens to include in the pipeline
     * @param executeHandler - The final handler function to execute after all middlewares
     * @returns A function that represents the complete middleware pipeline
     */
    const createMiddlewarePipeline = (
      middlewares: DIToken<IHandlerMiddleware<any, any>>[],
      executeHandler: (request: unknown) => Promise<any>
    ) => {
      const orderedMiddlewares = middlewares.length
        ? middlewareOrder.filter((token) => middlewares.includes(token))
        : [];

      const resolvedMiddlewares = orderedMiddlewares.map((token) =>
        container.resolve(token)
      );

      return resolvedMiddlewares.reduceRight((next, middleware) => {
        return (request: unknown) => middleware.handle(request, next);
      }, executeHandler);
    };

    /**
     * Executes all notification handlers sequentially for the given handlers array with the provided payload.
     *
     * @param handlers - Array of handler tokens to execute, or undefined if no handlers
     * @param payload - The payload to pass to each notification handler
     */
    const executeNotificationHandlersSequentially = async (
      handlers: DIToken<any>[] | undefined,
      payload: unknown
    ) => {
      if (handlers !== undefined) {
        for (const handler of handlers) {
          await container
            .resolve(handler as DIToken<INotificationHandler<any>>)
            .handle(payload);
        }
      }
    };

    /**
     * Executes all notification handlers in parallel for the given handlers array with the provided payload.
     *
     * @param handlers - Array of handler tokens to execute, or undefined if no handlers
     * @param payload - The payload to pass to each notification handler
     */
    const executeNotificationHandlersInParallel = async (
      handlers: DIToken<any>[] | undefined,
      payload: unknown
    ) => {
      if (handlers !== undefined) {
        await Promise.all(
          handlers.map(
            async (handler) =>
              await container
                .resolve(handler as DIToken<INotificationHandler<any>>)
                .handle(payload)
          )
        );
      }
    };

    /**
     * Executes all notification handlers in parallel for the given handlers array with the provided payload, but wont stop on error.
     *
     * @param handlers - Array of handler tokens to execute, or undefined if no handlers
     * @param payload - The payload to pass to each notification handler
     */
    const executeNotificationHandlersBestEffort = async (
      handlers: DIToken<any>[] | undefined,
      payload: unknown
    ) => {
      if (!handlers || handlers.length === 0) {
        return [];
      }

      const errors: Error[] = [];

      await Promise.all(
        handlers.map(async (handler) => {
          try {
            const handlerInstance = container.resolve(
              handler as DIToken<INotificationHandler<any>>
            );
            await handlerInstance.handle(payload);
          } catch (error) {
            errors.push(error as Error);
          }
        })
      );

      return errors;
    };

    return {
      async invoke(req) {
        const handlerToken = requestsState[req.token.key];

        if (!handlerToken) {
          throw new Error(
            `Request handler not found for Request ${req.token.key}`
          );
        }

        const handler: { handle: (value: any) => any } =
          container.resolve(handlerToken);

        const middlewares = findMiddlewaresForToken(req.token);

        const pipeline = createMiddlewarePipeline(
          middlewares,
          async (request: unknown): Promise<unknown> => {
            return handler.handle(request);
          }
        );

        return pipeline(req);
      },
      /**
       * Publishes a notification with the given payload.
       * @param notification The notification to publish.
       * @returns A promise that resolves when all notification handlers have been executed.
       */
      async publish(notification, strategy = "besteffort" as any) {
        const handlers = notificationsState[notification.token.key];

        const middlewares = findMiddlewaresForToken(notification.token);

        const pipeline = createMiddlewarePipeline(
          middlewares,
          async (request) => {
            switch (strategy) {
              case "parallel":
                return await executeNotificationHandlersInParallel(
                  handlers,
                  notification.payload
                );
              case "sequential":
                return await executeNotificationHandlersSequentially(
                  handlers,
                  notification.payload
                );
              case "besteffort":
                return await executeNotificationHandlersBestEffort(
                  handlers,
                  notification.payload
                );
              default:
                throw new Error(`Invalid publish strategy: ${strategy}`);
            }
          }
        );

        return (await pipeline(notification)) as Promise<
          typeof strategy extends "besteffort" ? Error[] : void
        >;
      },
    };
  }
);

/**
 * Creates a helper function for building notification tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for notifications.
 *
 * @template T - The type of the notification
 * @returns An object with an `as` method for creating notification tokens
 */
export function createNotificationDIToken<T extends INotification<any>>() {
  return {
    /**
     * Creates a notification token with the specified key and optional metadata.
     * Automatically adds INotificationToken in the implements metadata.
     *
     * @param key - Unique string identifier for this notification type
     * @param metadata - Optional metadata including generics and additional implements
     * @returns A configured notification token
     */
    as(key: string, metadata?: DITokenMetadata<T>) {
      return createDIToken<T>().as(key, {
        ...metadata,
        implements: [
          INotificationToken,
          ...(metadata?.implements ?? []),
        ] as any,
      });
    },
  };
}

/**
 * Creates a helper function for building command tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for commands.
 *
 * @template T - The type of the command payload
 * @template R - The type of the command result
 * @returns An object with an `as` method for creating command tokens
 */
export function createCommandDIToken<T extends ICommand<any, unknown>>() {
  return {
    /**
     * Creates a command token with the specified key and optional metadata.
     * Automatically adds ICommandToken in the implements metadata.
     *
     * @param key - Unique string identifier for this command type
     * @param metadata - Optional metadata including generics and additional implements
     * @returns A configured command token
     */
    as(key: string, metadata?: DITokenMetadata<T>) {
      return createDIToken<T>().as(key, {
        ...metadata,
        implements: [ICommandToken, ...(metadata?.implements ?? [])] as any,
      });
    },
  };
}

/**
 * Creates a helper function for building query tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for queries.
 *
 * @template T - The type of the query payload
 * @template R - The type of the query result
 * @returns An object with an `as` method for creating query tokens
 */
export function createQueryDIToken<T extends IQuery<any, unknown>>() {
  return {
    /**
     * Creates a query token with the specified key and optional metadata.
     * Automatically adds IQueryToken in the implements metadata.
     *
     * @param key - Unique string identifier for this query type
     * @param metadata - Optional metadata including generics and additional implements
     * @returns A configured query token
     */
    as(key: string, metadata?: DITokenMetadata<T>) {
      return createDIToken<T>().as(key, {
        ...metadata,
        implements: [IQueryToken, ...(metadata?.implements ?? [])] as any,
      });
    },
  };
}

/**
 * Creates a helper function for building notification handler tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for notification handlers.
 *
 * @template T - The type of the notification payload
 * @template R - The return type of the handler (typically void)
 * @returns An object with an `as` method for creating notification handler tokens
 */
export function createNotificationHandlerDIToken<
  T extends INotificationHandler<any>
>() {
  return {
    /**
     * Creates a notification handler token with the specified key and optional metadata.
     * Automatically implements the INotificationHandlerToken interface.
     *
     * @param key - Unique string identifier for this handler
     * @param metadata - Optional metadata including generics and additional implements
     * @returns A configured notification handler token
     */
    as(key: string, metadata?: DITokenMetadata<INotificationHandler<T>>) {
      return createDIToken<T>().as(key, {
        ...metadata,
        implements: [
          INotificationHandlerToken,
          ...(metadata?.implements ?? []),
        ] as any,
      });
    },
  };
}

/**
 * Creates a helper function for building command handler tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for command handlers.
 *
 * @template T - The command type (extends ICommand)
 * @template R - The return type of the command
 * @returns An object with an `as` method for creating command handler tokens
 */
export function createCommandHandlerDIToken<T extends ICommandHandler<any>>() {
  return {
    /**
     * Creates a command handler token with the specified key and optional metadata.
     * Automatically implements the ICommandHandlerToken interface.
     *
     * @param key - Unique string identifier for this handler
     * @param metadata - Optional metadata including generics and additional implements
     * @returns A configured command handler token
     */
    as(key: string, metadata?: DITokenMetadata<T>) {
      return createDIToken<T>().as(key, {
        ...metadata,
        implements: [
          ICommandHandlerToken,
          ...(metadata?.implements ?? []),
        ] as any,
      });
    },
  };
}

/**
 * Creates a helper function for building query handler tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for query handlers.
 *
 * @template T - The query type (extends IQuery)
 * @template R - The return type of the query
 * @returns An object with an `as` method for creating query handler tokens
 */
export function createQueryHandlerDIToken<T extends IQueryHandler<any>>() {
  return {
    /**
     * Creates a query handler token with the specified key and optional metadata.
     * Automatically implements the IQueryHandlerToken interface.
     *
     * @param key - Unique string identifier for this handler
     * @param metadata - Optional metadata including generics and additional implements
     * @returns A configured query handler token
     */
    as(key: string, metadata?: DITokenMetadata<T>) {
      return createDIToken<T>().as(key, {
        ...metadata,
        implements: [
          IQueryHandlerToken,
          ...(metadata?.implements ?? []),
        ] as any,
      });
    },
  };
}

/**
 * Creates a helper function for building middleware tokens with proper metadata.
 * This function returns an object with an `as` method that automatically sets up
 * the correct implements chain for middlewares.
 *
 * @template T - The type of the request (notification or command)
 * @template R - The return type of the handler chain
 * @returns An object with an `as` method for creating middleware tokens
 */
export function createMiddlewareDIToken<T, R>() {
  return {
    /**
     * Creates a middleware token with the specified key and optional metadata.
     * Automatically implements the IHandlerMiddlewareToken interface.
     * Use the generics field to specify which event types this middleware applies to.
     *
     * @param key - Unique string identifier for this middleware
     * @param metadata - Optional metadata including generics (target event types) and additional implements
     * @returns A configured middleware token
     */
    as(key: string, metadata?: DITokenMetadata<IHandlerMiddleware<T, R>>) {
      return createDIToken<IHandlerMiddleware<T, R>>().as(key, {
        ...metadata,
        implements: [IHandlerMiddlewareToken, ...(metadata?.implements ?? [])],
      });
    },
  };
}
