import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile, lstat, readlink } from 'fs/promises';

const isWindows = process.platform === 'win32';

import {
  isDocker,
  getHarneesLabHome,
  getHarneesLabWorkspacesPath,
  getHarneesLabWorktreesPath,
  getHarneesLabConfigPath,
  getCommandFolderSearchPaths,
  getWorkflowFolderSearchPaths,
  expandTilde,
  getAppHarneesLabBasePath,
  getDefaultCommandsPath,
  getDefaultWorkflowsPath,
  logHarneesLabPaths,
  validateAppDefaultsPaths,
  parseOwnerRepo,
  getProjectRoot,
  getProjectSourcePath,
  getProjectWorktreesPath,
  getProjectArtifactsPath,
  getProjectLogsPath,
  getRunArtifactsPath,
  getRunLogPath,
  resolveProjectRootFromCwd,
  ensureProjectStructure,
  createProjectSourceSymlink,
} from './harneeslab-paths';

/** All env vars that path functions depend on */
const ENV_VARS = [
  'WORKSPACE_PATH',
  'WORKTREE_BASE',
  'HARNEESLAB_HOME',
  'HARNEESLAB_DOCKER',
  'HOME',
];

/**
 * Save and restore environment variables around each test.
 * Call at the top of a describe block to register beforeEach/afterEach hooks.
 */
function useEnvSnapshot(): void {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_VARS) {
      snapshot[key] = process.env[key];
    }
    delete process.env.HARNEESLAB_HOME;
    delete process.env.HARNEESLAB_DOCKER;
  });

  afterEach(() => {
    for (const key of ENV_VARS) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  });
}

describe('harneeslab-paths', () => {
  useEnvSnapshot();

  describe('expandTilde', () => {
    test('expands ~ to home directory', () => {
      expect(expandTilde('~/test')).toBe(join(homedir(), 'test'));
    });

    test('returns path unchanged if no tilde', () => {
      expect(expandTilde('/absolute/path')).toBe('/absolute/path');
    });
  });

  describe('isDocker', () => {
    test('returns true when WORKSPACE_PATH is /workspace', () => {
      process.env.WORKSPACE_PATH = '/workspace';
      expect(isDocker()).toBe(true);
    });

    test('returns true when HOME=/root and WORKSPACE_PATH set', () => {
      process.env.HOME = '/root';
      process.env.WORKSPACE_PATH = '/app/workspace';
      expect(isDocker()).toBe(true);
    });

    test('returns true when HARNEESLAB_DOCKER=true', () => {
      delete process.env.WORKSPACE_PATH;
      process.env.HARNEESLAB_DOCKER = 'true';
      expect(isDocker()).toBe(true);
    });

    test('returns false for local development', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HOME = homedir();
      expect(isDocker()).toBe(false);
    });
  });

  describe('getHarneesLabHome', () => {
    test('returns /.harneeslab in Docker', () => {
      process.env.WORKSPACE_PATH = '/workspace';
      expect(getHarneesLabHome()).toBe('/.harneeslab');
    });

    test('returns HARNEESLAB_HOME when set (local)', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = '/custom/harneeslab';
      expect(getHarneesLabHome()).toBe('/custom/harneeslab');
    });

    test('expands tilde in HARNEESLAB_HOME', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = '~/my-harneeslab';
      expect(getHarneesLabHome()).toBe(join(homedir(), 'my-harneeslab'));
    });

    test('returns ~/.harneeslab by default (local)', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getHarneesLabHome()).toBe(join(homedir(), '.harneeslab'));
    });

    test('returns /.harneeslab when HARNEESLAB_DOCKER=true', () => {
      process.env.HARNEESLAB_DOCKER = 'true';
      delete process.env.HARNEESLAB_HOME;
      expect(getHarneesLabHome()).toBe('/.harneeslab');
    });

    test('allows HARNEESLAB_HOME to override Docker home', () => {
      process.env.HARNEESLAB_DOCKER = 'true';
      process.env.HARNEESLAB_HOME = '/data/harneeslab';
      expect(getHarneesLabHome()).toBe('/data/harneeslab');
    });

    test('throws for literal undefined HARNEESLAB_HOME', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = 'undefined';
      expect(() => getHarneesLabHome()).toThrow('HARNEESLAB_HOME is set to the literal string');
    });
  });

  describe('getHarneesLabWorkspacesPath', () => {
    test('returns ~/.harneeslab/workspaces by default', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getHarneesLabWorkspacesPath()).toBe(join(homedir(), '.harneeslab', 'workspaces'));
    });

    test('returns /.harneeslab/workspaces in Docker', () => {
      process.env.HARNEESLAB_DOCKER = 'true';
      expect(getHarneesLabWorkspacesPath()).toBe(join('/', '.harneeslab', 'workspaces'));
    });

    test('uses HARNEESLAB_HOME when set', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = '/custom/harneeslab';
      expect(getHarneesLabWorkspacesPath()).toBe(join('/custom/harneeslab', 'workspaces'));
    });
  });

  describe('getHarneesLabWorktreesPath', () => {
    test('returns ~/.harneeslab/worktrees by default', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.WORKTREE_BASE;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getHarneesLabWorktreesPath()).toBe(join(homedir(), '.harneeslab', 'worktrees'));
    });

    test('returns /.harneeslab/worktrees in Docker', () => {
      process.env.HARNEESLAB_DOCKER = 'true';
      expect(getHarneesLabWorktreesPath()).toBe(join('/', '.harneeslab', 'worktrees'));
    });

    test('uses HARNEESLAB_HOME when set', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.WORKTREE_BASE;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = '/custom/harneeslab';
      expect(getHarneesLabWorktreesPath()).toBe(join('/custom/harneeslab', 'worktrees'));
    });
  });

  describe('getCommandFolderSearchPaths', () => {
    test('returns .harneeslab/commands and defaults by default', () => {
      const paths = getCommandFolderSearchPaths();
      expect(paths).toEqual(['.harneeslab/commands', '.harneeslab/commands/defaults']);
    });

    test('includes configured folder when provided', () => {
      const paths = getCommandFolderSearchPaths('.claude/commands/harneeslab');
      expect(paths).toEqual([
        '.harneeslab/commands',
        '.harneeslab/commands/defaults',
        '.claude/commands/harneeslab',
      ]);
    });

    test('.harneeslab/commands has highest priority', () => {
      const paths = getCommandFolderSearchPaths('.custom/commands');
      expect(paths[0]).toBe('.harneeslab/commands');
    });

    test('.harneeslab/commands/defaults has second priority', () => {
      const paths = getCommandFolderSearchPaths('.custom/commands');
      expect(paths[1]).toBe('.harneeslab/commands/defaults');
    });

    test('does not duplicate .harneeslab/commands if configured', () => {
      const paths = getCommandFolderSearchPaths('.harneeslab/commands');
      expect(paths).toEqual(['.harneeslab/commands', '.harneeslab/commands/defaults']);
    });

    test('does not duplicate .harneeslab/commands/defaults if configured', () => {
      const paths = getCommandFolderSearchPaths('.harneeslab/commands/defaults');
      expect(paths).toEqual(['.harneeslab/commands', '.harneeslab/commands/defaults']);
    });
  });

  describe('getWorkflowFolderSearchPaths', () => {
    test('returns .harneeslab/workflows', () => {
      const paths = getWorkflowFolderSearchPaths();
      expect(paths).toEqual(['.harneeslab/workflows']);
    });
  });

  describe('getHarneesLabConfigPath', () => {
    test('returns path to config.yaml', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getHarneesLabConfigPath()).toBe(join(homedir(), '.harneeslab', 'config.yaml'));
    });
  });

  describe('getAppHarneesLabBasePath', () => {
    test('returns repo root .harneeslab path in local development', () => {
      delete process.env.HARNEESLAB_DOCKER;
      delete process.env.WORKSPACE_PATH;
      const path = getAppHarneesLabBasePath();
      // Should end with .harneeslab and NOT contain packages/core or packages/paths
      expect(path).toMatch(/\.harneeslab$/);
      expect(path).not.toContain('packages/core');
      expect(path).not.toContain('packages/paths');
    });

    test('path exists and contains defaults directories', () => {
      delete process.env.HARNEESLAB_DOCKER;
      delete process.env.WORKSPACE_PATH;
      const path = getAppHarneesLabBasePath();
      // The path should end with .harneeslab and the directory should exist
      expect(path).toMatch(/\.harneeslab$/);
      expect(existsSync(path)).toBe(true);
    });
  });

  describe('getDefaultCommandsPath', () => {
    test('returns commands/defaults under app harneeslab base', () => {
      delete process.env.HARNEESLAB_DOCKER;
      delete process.env.WORKSPACE_PATH;
      const path = getDefaultCommandsPath();
      expect(path).toContain('.harneeslab');
      expect(path).toContain('commands');
      expect(path).toContain('defaults');
      expect(path).not.toContain('packages/core');
    });
  });

  describe('getDefaultWorkflowsPath', () => {
    test('returns workflows/defaults under app harneeslab base', () => {
      delete process.env.HARNEESLAB_DOCKER;
      delete process.env.WORKSPACE_PATH;
      const path = getDefaultWorkflowsPath();
      expect(path).toContain('.harneeslab');
      expect(path).toContain('workflows');
      expect(path).toContain('defaults');
      expect(path).not.toContain('packages/core');
    });
  });

  // =========================================================================
  // Project-centric path functions
  // =========================================================================

  describe('parseOwnerRepo', () => {
    test('parses owner/repo format', () => {
      expect(parseOwnerRepo('acme/widget')).toEqual({ owner: 'acme', repo: 'widget' });
    });

    test('returns null for bare name', () => {
      expect(parseOwnerRepo('widget')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(parseOwnerRepo('')).toBeNull();
    });

    test('returns null for trailing slash', () => {
      expect(parseOwnerRepo('acme/')).toBeNull();
    });

    test('returns null for leading slash', () => {
      expect(parseOwnerRepo('/widget')).toBeNull();
    });

    test('rejects nested paths with more than one slash', () => {
      const result = parseOwnerRepo('acme/nested/widget');
      expect(result).toBeNull();
    });

    test('rejects path traversal in owner', () => {
      expect(parseOwnerRepo('../etc/passwd')).toBeNull();
    });

    test('rejects path traversal in repo', () => {
      expect(parseOwnerRepo('acme/../../etc')).toBeNull();
    });

    test('rejects dot and dotdot segments', () => {
      expect(parseOwnerRepo('./widget')).toBeNull();
      expect(parseOwnerRepo('acme/..')).toBeNull();
      expect(parseOwnerRepo('../widget')).toBeNull();
      expect(parseOwnerRepo('.')).toBeNull();
    });

    test('accepts valid GitHub-style names with dots, hyphens, underscores', () => {
      expect(parseOwnerRepo('my-org/my_repo.js')).toEqual({
        owner: 'my-org',
        repo: 'my_repo.js',
      });
    });

    test('rejects names with spaces', () => {
      expect(parseOwnerRepo('my org/repo')).toBeNull();
    });

    test('rejects names with special characters', () => {
      expect(parseOwnerRepo('acme/repo;rm -rf')).toBeNull();
      expect(parseOwnerRepo('acme/$HOME')).toBeNull();
    });
  });

  describe('getProjectRoot', () => {
    test('returns path under workspaces', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      const result = getProjectRoot('acme', 'widget');
      expect(result).toBe(join(homedir(), '.harneeslab', 'workspaces', 'acme', 'widget'));
    });

    test('respects HARNEESLAB_HOME', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = '/custom/harneeslab';
      expect(getProjectRoot('acme', 'widget')).toBe(
        join('/custom/harneeslab', 'workspaces', 'acme', 'widget')
      );
    });

    test('works in Docker', () => {
      process.env.HARNEESLAB_DOCKER = 'true';
      expect(getProjectRoot('acme', 'widget')).toBe(
        join('/', '.harneeslab', 'workspaces', 'acme', 'widget')
      );
    });
  });

  describe('getProjectSourcePath', () => {
    test('appends source/ to project root', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getProjectSourcePath('acme', 'widget')).toBe(
        join(homedir(), '.harneeslab', 'workspaces', 'acme', 'widget', 'source')
      );
    });
  });

  describe('getProjectWorktreesPath', () => {
    test('appends worktrees/ to project root', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getProjectWorktreesPath('acme', 'widget')).toBe(
        join(homedir(), '.harneeslab', 'workspaces', 'acme', 'widget', 'worktrees')
      );
    });
  });

  describe('getProjectArtifactsPath', () => {
    test('appends artifacts/ to project root', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getProjectArtifactsPath('acme', 'widget')).toBe(
        join(homedir(), '.harneeslab', 'workspaces', 'acme', 'widget', 'artifacts')
      );
    });
  });

  describe('getProjectLogsPath', () => {
    test('appends logs/ to project root', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getProjectLogsPath('acme', 'widget')).toBe(
        join(homedir(), '.harneeslab', 'workspaces', 'acme', 'widget', 'logs')
      );
    });
  });

  describe('getRunArtifactsPath', () => {
    test('returns artifacts/runs/{id}/ path', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getRunArtifactsPath('acme', 'widget', 'run-123')).toBe(
        join(
          homedir(),
          '.harneeslab',
          'workspaces',
          'acme',
          'widget',
          'artifacts',
          'runs',
          'run-123'
        )
      );
    });
  });

  describe('getRunLogPath', () => {
    test('returns logs/{id}.jsonl path', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(getRunLogPath('acme', 'widget', 'run-123')).toBe(
        join(homedir(), '.harneeslab', 'workspaces', 'acme', 'widget', 'logs', 'run-123.jsonl')
      );
    });
  });

  describe('resolveProjectRootFromCwd', () => {
    test('resolves project root from a path under workspaces', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      const workspacesPath = getHarneesLabWorkspacesPath();
      const cwd = join(workspacesPath, 'acme', 'widget', 'source');
      expect(resolveProjectRootFromCwd(cwd)).toBe(join(workspacesPath, 'acme', 'widget'));
    });

    test('resolves from worktrees subpath', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      const workspacesPath = getHarneesLabWorkspacesPath();
      const cwd = join(workspacesPath, 'acme', 'widget', 'worktrees', 'feature-auth');
      expect(resolveProjectRootFromCwd(cwd)).toBe(join(workspacesPath, 'acme', 'widget'));
    });

    test('returns null for path outside workspaces', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      expect(resolveProjectRootFromCwd('/home/user/projects/my-repo')).toBeNull();
    });

    test('returns null for path with only owner (no repo)', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_HOME;
      delete process.env.HARNEESLAB_DOCKER;
      const workspacesPath = getHarneesLabWorkspacesPath();
      expect(resolveProjectRootFromCwd(join(workspacesPath, 'acme'))).toBeNull();
    });

    test('works with HARNEESLAB_HOME override', () => {
      delete process.env.WORKSPACE_PATH;
      delete process.env.HARNEESLAB_DOCKER;
      process.env.HARNEESLAB_HOME = join('/', 'custom', 'harneeslab');
      const cwd = join('/', 'custom', 'harneeslab', 'workspaces', 'acme', 'widget', 'source');
      expect(resolveProjectRootFromCwd(cwd)).toBe(
        join('/', 'custom', 'harneeslab', 'workspaces', 'acme', 'widget')
      );
    });
  });
});

describe('logHarneesLabPaths', () => {
  useEnvSnapshot();

  test('does not throw', () => {
    delete process.env.WORKSPACE_PATH;
    delete process.env.HARNEESLAB_HOME;
    delete process.env.HARNEESLAB_DOCKER;
    expect(() => logHarneesLabPaths()).not.toThrow();
  });
});

describe('validateAppDefaultsPaths', () => {
  test('does not throw for valid paths', async () => {
    await expect(validateAppDefaultsPaths()).resolves.toBeUndefined();
  });

  test('handles missing paths gracefully', async () => {
    const originalEnv = process.env.HARNEESLAB_DOCKER;
    process.env.HARNEESLAB_DOCKER = 'true';
    try {
      // In Docker mode, paths won't exist — should still not throw
      await expect(validateAppDefaultsPaths()).resolves.toBeUndefined();
    } finally {
      if (originalEnv === undefined) {
        delete process.env.HARNEESLAB_DOCKER;
      } else {
        process.env.HARNEESLAB_DOCKER = originalEnv;
      }
    }
  });
});

// =========================================================================
// Async filesystem tests (use temp directories for isolation)
// =========================================================================

describe('ensureProjectStructure', () => {
  let tempHarneesLabHome: string;
  useEnvSnapshot();

  beforeEach(async () => {
    delete process.env.WORKSPACE_PATH;
    delete process.env.HARNEESLAB_DOCKER;
    tempHarneesLabHome = join(
      tmpdir(),
      `harneeslab-paths-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    process.env.HARNEESLAB_HOME = tempHarneesLabHome;
  });

  afterEach(async () => {
    await rm(tempHarneesLabHome, { recursive: true, force: true });
  });

  test('creates all four project subdirectories', async () => {
    await ensureProjectStructure('acme', 'widget');

    const sourcePath = getProjectSourcePath('acme', 'widget');
    const worktreesPath = getProjectWorktreesPath('acme', 'widget');
    const artifactsPath = getProjectArtifactsPath('acme', 'widget');
    const logsPath = getProjectLogsPath('acme', 'widget');

    // All directories should exist
    expect((await lstat(sourcePath)).isDirectory()).toBe(true);
    expect((await lstat(worktreesPath)).isDirectory()).toBe(true);
    expect((await lstat(artifactsPath)).isDirectory()).toBe(true);
    expect((await lstat(logsPath)).isDirectory()).toBe(true);
  });

  test('is idempotent - safe to call twice', async () => {
    await ensureProjectStructure('acme', 'widget');
    await ensureProjectStructure('acme', 'widget');

    const sourcePath = getProjectSourcePath('acme', 'widget');
    expect((await lstat(sourcePath)).isDirectory()).toBe(true);
  });
});

describe('createProjectSourceSymlink', () => {
  let tempHarneesLabHome: string;
  let tempTarget: string;
  useEnvSnapshot();

  beforeEach(async () => {
    delete process.env.WORKSPACE_PATH;
    delete process.env.HARNEESLAB_DOCKER;
    tempHarneesLabHome = join(
      tmpdir(),
      `harneeslab-symlink-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    process.env.HARNEESLAB_HOME = tempHarneesLabHome;

    tempTarget = join(
      tmpdir(),
      `harneeslab-target-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(tempTarget, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempHarneesLabHome, { recursive: true, force: true });
    await rm(tempTarget, { recursive: true, force: true });
  });

  test.skipIf(isWindows)('creates a symlink pointing to the target', async () => {
    await ensureProjectStructure('acme', 'widget');
    await createProjectSourceSymlink('acme', 'widget', tempTarget);

    const linkPath = getProjectSourcePath('acme', 'widget');
    const stats = await lstat(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);
    expect(await readlink(linkPath)).toBe(tempTarget);
  });

  test.skipIf(isWindows)('is a no-op if symlink already points to same target', async () => {
    await ensureProjectStructure('acme', 'widget');
    await createProjectSourceSymlink('acme', 'widget', tempTarget);
    // Call again - should not throw
    await createProjectSourceSymlink('acme', 'widget', tempTarget);

    const linkPath = getProjectSourcePath('acme', 'widget');
    expect(await readlink(linkPath)).toBe(tempTarget);
  });

  test.skipIf(isWindows)('throws when symlink points to a different target', async () => {
    await ensureProjectStructure('acme', 'widget');
    await createProjectSourceSymlink('acme', 'widget', tempTarget);

    const otherTarget = join(tmpdir(), 'other-target');
    await mkdir(otherTarget, { recursive: true });

    try {
      await expect(createProjectSourceSymlink('acme', 'widget', otherTarget)).rejects.toThrow(
        'already points to'
      );
    } finally {
      await rm(otherTarget, { recursive: true, force: true });
    }
  });

  test.skipIf(isWindows)(
    'is a no-op when real directory with contents exists (clone case)',
    async () => {
      await ensureProjectStructure('acme', 'widget');

      // Put a file in the source dir to simulate a clone
      const sourcePath = getProjectSourcePath('acme', 'widget');
      await writeFile(join(sourcePath, 'README.md'), '# Hello');

      // Should not overwrite the directory with a symlink
      await createProjectSourceSymlink('acme', 'widget', tempTarget);

      const stats = await lstat(sourcePath);
      expect(stats.isDirectory()).toBe(true);
      expect(stats.isSymbolicLink()).toBe(false);
    }
  );

  test.skipIf(isWindows)(
    'replaces empty directory with symlink (ensureProjectStructure case)',
    async () => {
      await ensureProjectStructure('acme', 'widget');

      // source/ is empty from ensureProjectStructure
      await createProjectSourceSymlink('acme', 'widget', tempTarget);

      const linkPath = getProjectSourcePath('acme', 'widget');
      const stats = await lstat(linkPath);
      expect(stats.isSymbolicLink()).toBe(true);
      expect(await readlink(linkPath)).toBe(tempTarget);
    }
  );

  test.skipIf(isWindows)('creates symlink when source path does not exist', async () => {
    // Only create the parent, not the source dir itself
    const projectRoot = getProjectRoot('acme', 'widget');
    await mkdir(projectRoot, { recursive: true });

    await createProjectSourceSymlink('acme', 'widget', tempTarget);

    const linkPath = getProjectSourcePath('acme', 'widget');
    const stats = await lstat(linkPath);
    expect(stats.isSymbolicLink()).toBe(true);
  });
});
