import { describe, it, expect, beforeEach, vi } from 'vitest';
import { downAction } from './down.js';

const { mockStopDaemon } = vi.hoisted(() => ({
  mockStopDaemon: vi.fn(),
}));

vi.mock("../process-manager.js", () => ({
  stopDaemon: mockStopDaemon,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('down command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stop daemon successfully', async () => {
    mockStopDaemon.mockResolvedValue({
      success: true,
      message: 'Orchid stopped (was PID: 12345)',
    });

    await downAction();

    expect(mockStopDaemon).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid stopped (was PID: 12345)');
  });

  it('should exit with code 1 when not running', async () => {
    mockStopDaemon.mockResolvedValue({
      success: false,
      message: 'Orchid is not running',
    });

    await expect(downAction()).rejects.toThrow('process.exit called');

    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is not running');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
