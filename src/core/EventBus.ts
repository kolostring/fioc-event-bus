import { DIContainer, DIToken, withDependencies } from "@fioc/core";
import {
  ICommandHandlerToken,
  IEventBus,
  IHandlerMiddleware,
  IHandlerMiddlewareToken,
  INotificationHandler,
  INotificationHandlerToken,
  MiddleWareOrderToken,
} from "./IEventBus.js";

type EventBusNotificationsState<T = any> = {
  [K in keyof T]: K extends string
    ? T[K] extends DIToken<any, K>[]
      ? DIToken<any, K>[]
      : never
    : never;
};

type EventBusCommandsState<T = any> = {
  [K in keyof T]: K extends string
    ? T[K] extends DIToken<any, K>
      ? DIToken<any, K>
      : never
    : never;
};

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

    const tokensCommandHandlers =
      container.findImplementationTokens(ICommandHandlerToken);

    const tokensMiddlewares = container.findImplementationTokens(
      IHandlerMiddlewareToken
    );

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

    const commandsState: EventBusCommandsState = {};
    tokensCommandHandlers.forEach((token) => {
      const commandToken = token.metadata?.generics?.[0];
      if (!commandToken) {
        throw new Error(
          `Command handler ${token.key} is missing Command generic`
        );
      }

      if (commandsState[commandToken.key]) {
        throw new Error(
          `Command handler ${token.key} is already registered for Command ${commandToken.key}`
        );
      }
      commandsState[commandToken.key] = token;
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

    return {
      async invoke(command) {
        const handlerToken = commandsState[command.token.key];

        if (!handlerToken) {
          throw new Error(
            `Command handler for Command ${command.token.key} not found`
          );
        }

        const handler: { handle: (value: any) => any } =
          container.resolve(handlerToken);

        let middlewares = [] as DIToken<IHandlerMiddleware<any, any>>[];
        let tokenHead = command.token;

        while (tokenHead.metadata?.implements?.[0]) {
          tokenHead = tokenHead.metadata.implements[0];
          middlewares = [
            ...middlewares,
            ...(middlewareState[tokenHead.key] ?? []),
          ];
        }

        const orderedMiddlewares = middlewares.length
          ? middlewareOrder.filter((token) => middlewares.includes(token))
          : [];

        const resolvedMiddlewares = orderedMiddlewares.map((token) =>
          container.resolve(token)
        );

        const executeHandler = async (request: unknown): Promise<unknown> => {
          return handler.handle(request);
        };

        const pipeline = resolvedMiddlewares.reduceRight((next, middleware) => {
          return (request: unknown) => middleware.handle(request, next);
        }, executeHandler);
        return pipeline(command) as any;
      },
      async publish(notification) {
        const handlers = notificationsState[notification.token.key];

        let middlewares = [] as DIToken<IHandlerMiddleware<any, any>>[];
        let tokenHead = notification.token;

        while (tokenHead.metadata?.implements?.[0]) {
          tokenHead = tokenHead.metadata.implements[0];
          middlewares = [
            ...middlewares,
            ...(middlewareState[tokenHead.key] ?? []),
          ];
        }

        const orderedMiddlewares = middlewares.length
          ? middlewareOrder.filter((token) => middlewares.includes(token))
          : [];

        const resolvedMiddlewares = orderedMiddlewares.map((token) =>
          container.resolve(token)
        );

        const executeHandler = async (request: unknown) => {
          if (handlers !== undefined) {
            for (const handler of handlers) {
              await container
                .resolve(handler as DIToken<INotificationHandler<any, any>>)
                .handle(notification.payload);
            }
          }
        };

        const pipeline = resolvedMiddlewares.reduceRight((next, middleware) => {
          return (request: unknown) => middleware.handle(request, next);
        }, executeHandler);

        return pipeline(notification) as any;
      },
    };
  }
);
