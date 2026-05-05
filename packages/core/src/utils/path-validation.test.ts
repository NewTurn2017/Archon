/**
 * Unit tests for path validation utilities
 *
 * NOTE: These tests use dynamic imports and module cache clearing
 * to test different WORKSPACE_PATH configurations.
 */

import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { resolve, join } from 'path';
import { homedir } from 'os';

// Helper to import fresh module with cleared cache
async function importFresh() {
  // Clear the module from cache by deleting it from Loader registry
  const modulePath = require.resolve('./path-validation');
  const harneeslabPathsModulePath = require.resolve('@harneeslab/paths');
  delete require.cache[modulePath];
  delete require.cache[harneeslabPathsModulePath];
  return import('./path-validation');
}

// Default harneeslab workspaces path
function getDefaultWorkspacesPath(): string {
  return join(homedir(), '.harneeslab', 'workspaces');
}

describe('path-validation', () => {
  const originalWorkspacePath = process.env.WORKSPACE_PATH;
  const originalHarneesLabHome = process.env.HARNEESLAB_HOME;
  const originalHarneesLabDocker = process.env.HARNEESLAB_DOCKER;

  beforeEach(() => {
    // Reset to default for consistent test behavior (clear Docker detection too)
    delete process.env.WORKSPACE_PATH;
    delete process.env.HARNEESLAB_HOME;
    delete process.env.HARNEESLAB_DOCKER;
  });

  afterAll(() => {
    // Restore original env vars
    if (originalWorkspacePath !== undefined) {
      process.env.WORKSPACE_PATH = originalWorkspacePath;
    } else {
      delete process.env.WORKSPACE_PATH;
    }
    if (originalHarneesLabHome !== undefined) {
      process.env.HARNEESLAB_HOME = originalHarneesLabHome;
    } else {
      delete process.env.HARNEESLAB_HOME;
    }
    if (originalHarneesLabDocker !== undefined) {
      process.env.HARNEESLAB_DOCKER = originalHarneesLabDocker;
    } else {
      delete process.env.HARNEESLAB_DOCKER;
    }
  });

  describe('isPathWithinWorkspace', () => {
    test('should allow paths within default harneeslab workspaces', async () => {
      const { isPathWithinWorkspace } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(isPathWithinWorkspace(`${defaultPath}/repo`)).toBe(true);
      expect(isPathWithinWorkspace(`${defaultPath}/repo/src`)).toBe(true);
      expect(isPathWithinWorkspace(defaultPath)).toBe(true);
    });

    test('should allow relative paths that resolve within workspace', async () => {
      const { isPathWithinWorkspace } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(isPathWithinWorkspace('repo', defaultPath)).toBe(true);
      expect(isPathWithinWorkspace('./repo', defaultPath)).toBe(true);
      expect(isPathWithinWorkspace('repo/src/file.ts', defaultPath)).toBe(true);
    });

    test('should reject path traversal attempts', async () => {
      const { isPathWithinWorkspace } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(isPathWithinWorkspace(`${defaultPath}/../etc/passwd`)).toBe(false);
      expect(isPathWithinWorkspace('../etc/passwd', defaultPath)).toBe(false);
      expect(isPathWithinWorkspace(`${defaultPath}/repo/../../etc/passwd`)).toBe(false);
      expect(isPathWithinWorkspace('foo/../../../etc/passwd', defaultPath)).toBe(false);
    });

    test('should reject paths outside workspace', async () => {
      const { isPathWithinWorkspace } = await importFresh();
      expect(isPathWithinWorkspace('/etc/passwd')).toBe(false);
      expect(isPathWithinWorkspace('/tmp/file')).toBe(false);
      expect(isPathWithinWorkspace('/var/log/syslog')).toBe(false);
    });

    test('should reject paths that look similar but are outside workspace', async () => {
      const { isPathWithinWorkspace } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(isPathWithinWorkspace(`${defaultPath}-other`)).toBe(false);
    });

    test('should use HARNEESLAB_HOME env var when set', async () => {
      process.env.HARNEESLAB_HOME = '/custom/harneeslab';
      const { isPathWithinWorkspace } = await importFresh();
      expect(isPathWithinWorkspace('/custom/harneeslab/workspaces/repo')).toBe(true);
      const defaultPath = getDefaultWorkspacesPath();
      expect(isPathWithinWorkspace(`${defaultPath}/repo`)).toBe(false); // Default path now rejected
    });

    test('should reject default workspace when HARNEESLAB_HOME is set', async () => {
      process.env.HARNEESLAB_HOME = '/custom/harneeslab';
      const { isPathWithinWorkspace } = await importFresh();
      expect(isPathWithinWorkspace('/custom/harneeslab/workspaces/repo')).toBe(true);
      expect(isPathWithinWorkspace(`${getDefaultWorkspacesPath()}/repo`)).toBe(false);
    });
  });

  describe('validateAndResolvePath', () => {
    test('should return resolved path for valid paths', async () => {
      const { validateAndResolvePath } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(validateAndResolvePath(`${defaultPath}/repo`)).toBe(resolve(`${defaultPath}/repo`));
      expect(validateAndResolvePath('repo', defaultPath)).toBe(resolve(`${defaultPath}/repo`));
      expect(validateAndResolvePath('./src', `${defaultPath}/repo`)).toBe(
        resolve(`${defaultPath}/repo/src`)
      );
    });

    test('should throw for path traversal attempts', async () => {
      const { validateAndResolvePath } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(() => validateAndResolvePath('../etc/passwd', defaultPath)).toThrow(
        `Path must be within ${defaultPath} directory`
      );
      expect(() => validateAndResolvePath(`${defaultPath}/../etc/passwd`)).toThrow(
        `Path must be within ${defaultPath} directory`
      );
    });

    test('should throw for paths outside workspace', async () => {
      const { validateAndResolvePath } = await importFresh();
      const defaultPath = getDefaultWorkspacesPath();
      expect(() => validateAndResolvePath('/etc/passwd')).toThrow(
        `Path must be within ${defaultPath} directory`
      );
      expect(() => validateAndResolvePath('/tmp/evil')).toThrow(
        `Path must be within ${defaultPath} directory`
      );
    });

    test('should use custom HARNEESLAB_HOME for validation and error message', async () => {
      process.env.HARNEESLAB_HOME = '/my/custom/harneeslab';
      const { validateAndResolvePath } = await importFresh();
      const customWorkspace = resolve('/my/custom/harneeslab/workspaces');
      // Valid path under custom workspace
      expect(validateAndResolvePath('/my/custom/harneeslab/workspaces/repo')).toBe(
        resolve('/my/custom/harneeslab/workspaces/repo')
      );
      // Path under default workspace should now throw with custom workspace in message
      const defaultPath = getDefaultWorkspacesPath();
      expect(() => validateAndResolvePath(`${defaultPath}/repo`)).toThrow(
        `Path must be within ${customWorkspace} directory`
      );
    });
  });
});
