import { BrowserWindow } from 'electron';

export function setTargetWindow(_window: BrowserWindow | null): void {
  // Intentionally unused parameter - kept for API compatibility
  void _window;
  // Target window is set but not used in this module
  // Kept for potential future use or external references
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 1000;
const logBuffer: LogEntry[] = [];

function broadcastLog(entry: LogEntry): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('log-entry', entry);
    }
  });
  if (windows.length === 0) {
    console.log(
      `[${entry.level.toUpperCase()}] ${entry.message}`,
      entry.context || ''
    );
  }
}

function addLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  logBuffer.push(entry);

  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  broadcastLog(entry);
}

export function debug(
  message: string,
  context?: Record<string, unknown>
): void {
  addLog('debug', message, context);
}

export function info(message: string, context?: Record<string, unknown>): void {
  addLog('info', message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
  addLog('warn', message, context);
}

export function error(
  message: string,
  context?: Record<string, unknown>
): void {
  addLog('error', message, context);
}

export function getAllLogs(): LogEntry[] {
  return [...logBuffer];
}

export function clearLogs(): void {
  logBuffer.length = 0;
}
