import { describe, it, expect, beforeEach, vi } from 'vitest';
import { upAction } from './up.js';

const { mockStartDaemon } = vi.hoisted(() => ({
  mockStartDaemon: vi.fn(),
}));

vi.mock("../process-manager.js", () => ({
  startDaemon: mockStartDaemon,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('up command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start daemon successfully', async () => {
    mockStartDaemon.mockResolvedValue({
      success: true,
      message: 'Orchid started (PID: 12345)',
    });

    await upAction();

    expect(mockStartDaemon).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid started (PID: 12345)');
  });

  it('should exit with code 1 on failure', async () => {
    mockStartDaemon.mockResolvedValue({
      success: false,
      message: 'Failed to start',
    });

    await expect(upAction()).rejects.toThrow('process.exit called');

    expect(mockConsoleLog).toHaveBeenCalledWith('Failed to start');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
