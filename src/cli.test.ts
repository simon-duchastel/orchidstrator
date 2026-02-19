import { describe, it, expect, beforeEach, vi } from 'vitest';
import { log, setVerboseLogging, createLogger } from './utils/logger.js';

describe('CLI verbose flag', () => {
  const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    setVerboseLogging(false);
  });

  it('should not log anything by default when verbose is disabled', () => {
    log.log('test message');
    log.error('test error');
    log.warn('test warning');

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockConsoleWarn).not.toHaveBeenCalled();
  });

  it('should log messages when verbose is enabled via setVerboseLogging', () => {
    setVerboseLogging(true);

    log.log('test message');
    expect(mockConsoleLog).toHaveBeenCalledWith('', 'test message');

    log.error('test error');
    expect(mockConsoleError).toHaveBeenCalledWith('', 'test error');

    log.warn('test warning');
    expect(mockConsoleWarn).toHaveBeenCalledWith('', 'test warning');
  });

  it('should create logger with custom prefix', () => {
    const customLogger = createLogger('TEST', { verbose: true });

    customLogger.log('message');
    expect(mockConsoleLog).toHaveBeenCalledWith('[TEST] ', 'message');
  });
});
