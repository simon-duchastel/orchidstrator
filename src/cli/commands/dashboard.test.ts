import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dashboardAction } from './dashboard';

const { mockGetStatus, mockOpen } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockOpen: vi.fn(),
}));

vi.mock("../../process-manager", () => ({
  getStatus: mockGetStatus,
}));

vi.mock("open", () => ({
  default: mockOpen,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('dashboard command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should open dashboard when running', async () => {
    mockGetStatus.mockReturnValue({
      running: true,
      pid: 12345,
      serverUrl: 'http://127.0.0.1:3000',
    });

    await dashboardAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('Opening http://127.0.0.1:3000 in your browser...');
    expect(mockOpen).toHaveBeenCalledWith('http://127.0.0.1:3000');
  });

  it('should exit with code 1 when not running', async () => {
    mockGetStatus.mockReturnValue({
      running: false,
      pid: null,
      serverUrl: null,
    });

    await expect(dashboardAction()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith('Orchid is not running. Start it with: orchid up');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
