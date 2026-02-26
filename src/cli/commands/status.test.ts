import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statusAction } from './status.js';

const { mockGetStatus } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
}));

vi.mock("../../process/manager.js", () => ({
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
    });

    statusAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is running (PID: 12345)');
  });

  it('should show not running status', () => {
    mockGetStatus.mockReturnValue({
      running: false,
      pid: null,
    });

    statusAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is not running');
  });
});
