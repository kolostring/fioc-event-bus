import { createDIToken, type DIToken } from "@fioc/core";

export interface INotification<T> {
  createdAt: Date;
  token: DIToken<INotification<T>>;
  payload: T;
}

export interface INotificationHandler<T, R> {
  handle: (payload: T) => R;
}

export interface ICommand<T, R> {
  token: DIToken<ICommand<T, R>>;
  payload: T;
  createdAt: Date;
}

export interface ICommandHandler<T extends ICommand<any, R>, R> {
  handle: (command: T) => Promise<R>;
}

export interface IHandlerMiddleware<T, R> {
  handle: (req: T, next: (req: T) => Promise<R>) => Promise<R>;
}

export interface IEventBus {
  publish<T>(notification: INotification<T>): Promise<void>;
  invoke<T, R>(command: ICommand<T, R>): Promise<R>;
}

export const INotificationToken =
  createDIToken<INotification<any>>().as("INotification");

export const INotificationHandlerToken = createDIToken<
  INotificationHandler<any, any>
>().as("INotificationHandler");

export const ICommandToken = createDIToken<ICommand<any, any>>().as("ICommand");

export const ICommandHandlerToken =
  createDIToken<ICommandHandler<any, any>>().as("ICommandHandler");
export const IHandlerMiddlewareToken =
  createDIToken<IHandlerMiddleware<any, any>>().as("IHandlerMiddleware");
export const IEventBusToken = createDIToken<IEventBus>().as("IEventBus");

export const MiddleWareOrderToken =
  createDIToken<DIToken<IHandlerMiddleware<any, any>>[]>().as(
    "MiddleWareOrder"
  );
