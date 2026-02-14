import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statusAction } from './status';

const { mockGetStatus } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
}));

vi.mock("../../process-manager", () => ({
  getStatus: mockGetStatus,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('status command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show running status', () => {
    mockGetStatus.mockReturnValue({
      running: true,
      pid: 12345,
      serverUrl: 'http://127.0.0.1:3000',
    });

    statusAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is running (PID: 12345)');
    expect(mockConsoleLog).toHaveBeenCalledWith('Server: http://127.0.0.1:3000');
  });

  it('should show not running status', () => {
    mockGetStatus.mockReturnValue({
      running: false,
      pid: null,
      serverUrl: null,
    });

    statusAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is not running');
  });
});
