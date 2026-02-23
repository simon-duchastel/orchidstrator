import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAction } from './init.js';

const { mockInitializeOrchid, mockIsDirectoryEmpty } = vi.hoisted(() => ({
  mockInitializeOrchid: vi.fn(),
  mockIsDirectoryEmpty: vi.fn(),
}));

const { mockConfirmPrompt } = vi.hoisted(() => ({
  mockConfirmPrompt: vi.fn(),
}));

vi.mock("../orchid-lifecycle/index.js", () => ({
  initializeOrchid: mockInitializeOrchid,
  isDirectoryEmpty: mockIsDirectoryEmpty,
}));

vi.mock("@cliffy/prompt/confirm", () => ({
  Confirm: {
    prompt: mockConfirmPrompt,
  },
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit called with code ${code ?? 'undefined'}`);
});

describe('init command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDirectoryEmpty.mockReturnValue(true);
    mockConfirmPrompt.mockResolvedValue(false);
  });

  it('should initialize orchid successfully in empty directory', async () => {
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction({}, 'https://github.com/user/repo.git');

    expect(mockIsDirectoryEmpty).toHaveBeenCalled();
    expect(mockConfirmPrompt).not.toHaveBeenCalled();
    expect(mockInitializeOrchid).toHaveBeenCalledWith(
      'https://github.com/user/repo.git',
      { allowNonEmptyDir: false }
    );
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized orchid');
  });

  it('should prompt user when directory is not empty and proceed if confirmed', async () => {
    mockIsDirectoryEmpty.mockReturnValue(false);
    mockConfirmPrompt.mockResolvedValue(true);
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction({}, 'https://github.com/user/repo.git');

    expect(mockIsDirectoryEmpty).toHaveBeenCalled();
    expect(mockConfirmPrompt).toHaveBeenCalledWith({
      message: "This directory is not empty. Orchid will clone the repository in this directory and create lots of other files. It's best run in an empty directory - are you sure you want to proceed?",
      default: false,
    });
    expect(mockInitializeOrchid).toHaveBeenCalledWith(
      'https://github.com/user/repo.git',
      { allowNonEmptyDir: false }
    );
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized orchid');
  });

  it('should cancel initialization when user declines non-empty directory', async () => {
    mockIsDirectoryEmpty.mockReturnValue(false);
    mockConfirmPrompt.mockResolvedValue(false);

    await expect(initAction({}, 'https://github.com/user/repo.git'))
      .rejects.toThrow('process.exit called with code 0');

    expect(mockIsDirectoryEmpty).toHaveBeenCalled();
    expect(mockConfirmPrompt).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith('Initialization cancelled.');
    expect(mockInitializeOrchid).not.toHaveBeenCalled();
  });

  it('should skip prompt when --dangerously-init-in-non-empty-dir flag is set', async () => {
    mockIsDirectoryEmpty.mockReturnValue(false);
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction({ dangerouslyInitInNonEmptyDir: true }, 'https://github.com/user/repo.git');

    expect(mockIsDirectoryEmpty).not.toHaveBeenCalled();
    expect(mockConfirmPrompt).not.toHaveBeenCalled();
    expect(mockInitializeOrchid).toHaveBeenCalledWith(
      'https://github.com/user/repo.git',
      { allowNonEmptyDir: true }
    );
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized orchid');
  });

  it('should exit with code 1 on failure', async () => {
    mockInitializeOrchid.mockResolvedValue({
      success: false,
      message: 'Initialization failed',
    });

    await expect(initAction({}, 'https://github.com/user/repo.git'))
      .rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleLog).toHaveBeenCalledWith('Initialization failed');
  });

  it('should pass allowNonEmptyDir when directory is empty but flag is set', async () => {
    mockIsDirectoryEmpty.mockReturnValue(true);
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction({ dangerouslyInitInNonEmptyDir: true }, 'https://github.com/user/repo.git');

    expect(mockIsDirectoryEmpty).not.toHaveBeenCalled();
    expect(mockConfirmPrompt).not.toHaveBeenCalled();
    expect(mockInitializeOrchid).toHaveBeenCalledWith(
      'https://github.com/user/repo.git',
      { allowNonEmptyDir: true }
    );
  });
});
