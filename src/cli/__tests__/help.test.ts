import { describe, it, expect, vi } from 'vitest';
import { Command } from '@cliffy/command';
import { generateHelp } from '../help.js';

describe('help', () => {
  it('should generate flat help output', () => {
    const mockCommand = new Command()
      .name("test")
      .description("Test CLI")
      .command("foo")
        .description("Foo command")
        .option("-a, --alpha", "Alpha option")
        .arguments("<arg>")
        .action(() => {})
      .command("bar")
        .description("Bar command")
        .option("-b, --beta", "Beta option")
        .action(() => {});

    const help = generateHelp(mockCommand as any);
    
    expect(help).toContain('Usage: test [options] [command]');
    expect(help).toContain('Test CLI');
    expect(help).toContain('Commands:');
    expect(help).toContain('foo <arg>');
    expect(help).toContain('Foo command');
    expect(help).toContain('-a, --alpha');
    expect(help).toContain('bar');
    expect(help).toContain('Bar command');
  });
});
