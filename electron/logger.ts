import { BrowserWindow } from 'electron';

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
  if (windows.length > 0) {
    windows[0].webContents.send('log-entry', entry);
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
