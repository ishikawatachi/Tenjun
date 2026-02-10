import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../middleware/logging.middleware';
import { ExternalServiceError } from '../utils/errors';

export interface GitCloneOptions {
  depth?: number;
  branch?: string;
  singleBranch?: boolean;
  timeout?: number;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  checksum: string;
  modified: Date;
}

export interface RepoAnalysis {
  repoUrl: string;
  clonedAt: Date;
  files: {
    infrastructure: FileInfo[];
    code: FileInfo[];
    config: FileInfo[];
    all: FileInfo[];
  };
  dependencies: {
    npm?: Record<string, string>;
    python?: string[];
    go?: string[];
    maven?: string[];
  };
  statistics: {
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  };
}

/**
 * Clone a Git repository to a local path
 */
export const gitClone = async (
  repoUrl: string,
  localPath: string,
  options: GitCloneOptions = {}
): Promise<void> => {
  const {
    depth = 1,
    branch,
    singleBranch = true,
    timeout = 300000, // 5 minutes
  } = options;

  return new Promise((resolve, reject) => {
    // Build git clone command arguments
    const args = ['clone'];

    if (depth) {
      args.push('--depth', depth.toString());
    }

    if (branch) {
      args.push('--branch', branch);
    }

    if (singleBranch) {
      args.push('--single-branch');
    }

    args.push(repoUrl, localPath);

    logger.info('Cloning repository', { repoUrl, localPath, args });

    const gitProcess = spawn('git', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    gitProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    gitProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      gitProcess.kill('SIGTERM');
      reject(new ExternalServiceError('Git', 'Clone operation timed out'));
    }, timeout);

    gitProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        logger.info('Repository cloned successfully', { repoUrl, localPath });
        resolve();
      } else {
        logger.error('Git clone failed', {
          repoUrl,
          code,
          stderr,
          stdout,
        });
        reject(
          new ExternalServiceError(
            'Git',
            `Clone failed with code ${code}: ${stderr || stdout}`
          )
        );
      }
    });

    gitProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      logger.error('Git process error', { error, repoUrl });
      reject(new ExternalServiceError('Git', error.message));
    });
  });
};

/**
 * Get list of files matching specified extensions
 */
export const getFileList = async (
  basePath: string,
  extensions?: string[]
): Promise<FileInfo[]> => {
  const files: FileInfo[] = [];

  const walk = async (dir: string): Promise<void> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip .git directory and node_modules
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();

          // Filter by extensions if specified
          if (extensions && !extensions.includes(ext)) {
            continue;
          }

          const stats = await fs.stat(fullPath);
          const checksum = await calculateChecksum(fullPath);

          files.push({
            path: fullPath,
            relativePath: path.relative(basePath, fullPath),
            extension: ext,
            size: stats.size,
            checksum,
            modified: stats.mtime,
          });
        }
      }
    } catch (error) {
      logger.error('Error walking directory', { dir, error });
      throw error;
    }
  };

  await walk(basePath);
  return files;
};

/**
 * Calculate SHA256 checksum of a file
 */
export const calculateChecksum = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = require('fs').createReadStream(filePath);

    stream.on('data', (data: Buffer) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

/**
 * Extract package dependencies from common dependency files
 */
export const extractDependencies = async (
  basePath: string
): Promise<RepoAnalysis['dependencies']> => {
  const dependencies: RepoAnalysis['dependencies'] = {};

  try {
    // Check for package.json (Node.js)
    const packageJsonPath = path.join(basePath, 'package.json');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );
      dependencies.npm = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
    } catch {
      // File doesn't exist or invalid JSON
    }

    // Check for requirements.txt (Python)
    const requirementsPath = path.join(basePath, 'requirements.txt');
    try {
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      dependencies.python = requirements
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    } catch {
      // File doesn't exist
    }

    // Check for go.mod (Go)
    const goModPath = path.join(basePath, 'go.mod');
    try {
      const goMod = await fs.readFile(goModPath, 'utf-8');
      dependencies.go = goMod
        .split('\n')
        .filter((line) => line.trim().startsWith('require'))
        .map((line) => line.trim());
    } catch {
      // File doesn't exist
    }

    // Check for pom.xml (Maven/Java)
    const pomPath = path.join(basePath, 'pom.xml');
    try {
      await fs.access(pomPath);
      dependencies.maven = ['pom.xml found - parse XML for detailed dependencies'];
    } catch {
      // File doesn't exist
    }
  } catch (error) {
    logger.error('Error extracting dependencies', { basePath, error });
  }

  return dependencies;
};

/**
 * Analyze a cloned repository
 */
export const analyzeRepository = async (
  repoUrl: string,
  localPath: string
): Promise<RepoAnalysis> => {
  logger.info('Analyzing repository', { repoUrl, localPath });

  // Define file categories
  const infrastructureExtensions = ['.tf', '.tfvars', '.yaml', '.yml', '.json'];
  const codeExtensions = ['.py', '.go', '.ts', '.js', '.java', '.rb', '.php', '.cs'];
  const configExtensions = ['.env', '.config', '.conf', '.ini', '.toml'];

  // Get all files
  const allFiles = await getFileList(localPath);

  // Categorize files
  const infrastructureFiles = allFiles.filter((f) =>
    infrastructureExtensions.includes(f.extension)
  );
  const codeFiles = allFiles.filter((f) => codeExtensions.includes(f.extension));
  const configFiles = allFiles.filter((f) => configExtensions.includes(f.extension));

  // Extract dependencies
  const dependencies = await extractDependencies(localPath);

  // Calculate statistics
  const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
  const fileTypes: Record<string, number> = {};

  allFiles.forEach((file) => {
    const ext = file.extension || 'no-extension';
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  });

  const analysis: RepoAnalysis = {
    repoUrl,
    clonedAt: new Date(),
    files: {
      infrastructure: infrastructureFiles,
      code: codeFiles,
      config: configFiles,
      all: allFiles,
    },
    dependencies,
    statistics: {
      totalFiles: allFiles.length,
      totalSize,
      fileTypes,
    },
  };

  logger.info('Repository analysis completed', {
    repoUrl,
    totalFiles: allFiles.length,
    infrastructureFiles: infrastructureFiles.length,
    codeFiles: codeFiles.length,
  });

  return analysis;
};

/**
 * Clean up cloned repository
 */
export const cleanupRepository = async (localPath: string): Promise<void> => {
  try {
    await fs.rm(localPath, { recursive: true, force: true });
    logger.info('Repository cleaned up', { localPath });
  } catch (error) {
    logger.error('Failed to cleanup repository', { localPath, error });
    throw error;
  }
};

/**
 * Execute git command with retry logic
 */
export const executeGitCommand = async (
  args: string[],
  cwd: string,
  retries: number = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const gitProcess = spawn('git', args, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        gitProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        gitProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        gitProcess.on('close', (code) => {
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`Git command failed: ${stderr || stdout}`));
          }
        });

        gitProcess.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      if (attempt === retries) {
        logger.error('Git command failed after retries', { args, cwd, error });
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`Git command failed, retrying in ${delay}ms`, {
        args,
        attempt,
        error,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Should not reach here');
};
