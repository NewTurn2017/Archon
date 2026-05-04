// HarneesLab path resolution utilities
export {
  expandTilde,
  isDocker,
  getHarneesLabHome,
  getHarneesLabWorkspacesPath,
  getHarneesLabWorktreesPath,
  getHarneesLabConfigPath,
  getCommandFolderSearchPaths,
  getWorkflowFolderSearchPaths,
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
  findMarkdownFilesRecursive,
  getWebDistDir,
} from './harneeslab-paths';

// Logger
export { createLogger, setLogLevel, getLogLevel, rootLogger } from './logger';
export type { Logger } from './logger';

// Build-time constants (rewritten by scripts/build-binaries.sh)
export { BUNDLED_IS_BINARY, BUNDLED_VERSION, BUNDLED_GIT_COMMIT } from './bundled-build';

// Update check
export {
  checkForUpdate,
  getCachedUpdateCheck,
  isNewerVersion,
  parseLatestRelease,
} from './update-check';
export type { UpdateCheckResult } from './update-check';

// Anonymous telemetry
export { captureWorkflowInvoked, shutdownTelemetry, isTelemetryDisabled } from './telemetry';
export type { WorkflowInvokedProperties } from './telemetry';
