type LogContext = Record<string, unknown>;

export interface AppLogger {
  error(message: string, error?: unknown, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
}

class ConsoleLogger implements AppLogger {
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(message, { error, ...context });
  }

  warn(message: string, context?: LogContext): void {
    if (import.meta.env.DEV) console.warn(message, context);
  }
}

export const logger: AppLogger = new ConsoleLogger();
