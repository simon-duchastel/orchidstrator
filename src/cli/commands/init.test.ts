import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAction } from './init';

const { mockInitializeOrchid } = vi.hoisted(() => ({
  mockInitializeOrchid: vi.fn(),
}));

vi.mock("../../commands/init/init", () => ({
  initializeOrchid: mockInitializeOrchid,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('init command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize orchid successfully', async () => {
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction({ repository: 'https://github.com/user/repo.git' });

    expect(mockInitializeOrchid).toHaveBeenCalledWith('https://github.com/user/repo.git');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized orchid');
  });

  it('should exit with code 1 on failure', async () => {
    mockInitializeOrchid.mockResolvedValue({
      success: false,
      message: 'Initialization failed',
    });

    await expect(initAction({ repository: 'https://github.com/user/repo.git' }))
      .rejects.toThrow('process.exit called');

    expect(mockConsoleLog).toHaveBeenCalledWith('Initialization failed');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
