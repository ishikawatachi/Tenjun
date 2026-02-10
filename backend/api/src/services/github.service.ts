import axios, { AxiosInstance, AxiosError } from 'axios';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../middleware/logging.middleware';
import { ExternalServiceError, ValidationError } from '../utils/errors';
import {
  gitClone,
  analyzeRepository,
  cleanupRepository,
  GitCloneOptions,
  RepoAnalysis,
} from '../utils/gitOperations';

export interface GitHubConfig {
  type: 'github.com' | 'enterprise';
  baseUrl?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface CreateIssuePayload {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface CreateCommentPayload {
  body: string;
}

export interface RateLimit {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

/**
 * GitHub API Client with support for github.com and GitHub Enterprise
 */
export class GitHubClient {
  private client: AxiosInstance;
  private config: GitHubConfig;
  private rateLimit: RateLimit | null = null;

  constructor(config: GitHubConfig) {
    this.config = config;

    const baseURL =
      config.type === 'enterprise'
        ? `${config.baseUrl}/api/v3`
        : 'https://api.github.com';

    this.client = axios.create({
      baseURL,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(config.token && { Authorization: `Bearer ${config.token}` }),
      },
      timeout: 30000,
    });

    // Response interceptor for rate limiting
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimit(response.headers);
        return response;
      },
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limit exceeded
          const resetTime = error.response.headers['x-ratelimit-reset'];
          const waitTime = resetTime
            ? new Date(parseInt(resetTime) * 1000).getTime() - Date.now()
            : 60000;

          logger.warn('GitHub rate limit exceeded, waiting', {
            waitTime: Math.ceil(waitTime / 1000),
          });

          await this.sleep(waitTime);
          return this.client.request(error.config!);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimit(headers: Record<string, string>): void {
    if (headers['x-ratelimit-limit']) {
      this.rateLimit = {
        limit: parseInt(headers['x-ratelimit-limit']),
        remaining: parseInt(headers['x-ratelimit-remaining']),
        reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
        used: parseInt(headers['x-ratelimit-used'] || '0'),
      };

      if (this.rateLimit.remaining < 10) {
        logger.warn('GitHub API rate limit running low', this.rateLimit);
      }
    }
  }

  /**
   * Get current rate limit status
   */
  public getRateLimit(): RateLimit | null {
    return this.rateLimit;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute API request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          // Don't retry client errors (except rate limit)
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw new ExternalServiceError(
              'GitHub',
              error.response?.data?.message || error.message
            );
          }
        }

        if (attempt === retries) {
          logger.error('GitHub API request failed after retries', { error });
          throw new ExternalServiceError('GitHub', 'Request failed after retries');
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn(`GitHub request failed, retrying in ${delay}ms`, {
          attempt,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await this.sleep(delay);
      }
    }

    throw new Error('Should not reach here');
  }

  /**
   * Get repository information
   */
  public async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<GitHubRepository>(`/repos/${owner}/${repo}`);
      return response.data;
    });
  }

  /**
   * List repositories for authenticated user
   */
  public async listRepositories(
    page: number = 1,
    perPage: number = 30
  ): Promise<GitHubRepository[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<GitHubRepository[]>('/user/repos', {
        params: { page, per_page: perPage, sort: 'updated' },
      });
      return response.data;
    });
  }

  /**
   * Create an issue in a repository
   */
  public async createIssue(
    owner: string,
    repo: string,
    payload: CreateIssuePayload
  ): Promise<GitHubIssue> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post<GitHubIssue>(
        `/repos/${owner}/${repo}/issues`,
        payload
      );
      logger.info('GitHub issue created', {
        repo: `${owner}/${repo}`,
        issue: response.data.number,
      });
      return response.data;
    });
  }

  /**
   * Create a comment on an issue or PR
   */
  public async createComment(
    owner: string,
    repo: string,
    issueNumber: number,
    payload: CreateCommentPayload
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(
        `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        payload
      );
      logger.info('GitHub comment created', {
        repo: `${owner}/${repo}`,
        issue: issueNumber,
      });
    });
  }

  /**
   * Get pull request information
   */
  public async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubPullRequest> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<GitHubPullRequest>(
        `/repos/${owner}/${repo}/pulls/${prNumber}`
      );
      return response.data;
    });
  }

  /**
   * Clone repository and analyze it
   */
  public async cloneAndAnalyzeRepository(
    repoUrl: string,
    options?: GitCloneOptions
  ): Promise<{ analysis: RepoAnalysis; localPath: string }> {
    const repoId = uuidv4();
    const localPath = path.join('/tmp', 'github-repos', repoId);

    try {
      logger.info('Starting repository clone and analysis', { repoUrl, localPath });

      // Clone repository
      await gitClone(repoUrl, localPath, options);

      // Analyze repository
      const analysis = await analyzeRepository(repoUrl, localPath);

      return { analysis, localPath };
    } catch (error) {
      // Clean up on error
      try {
        await cleanupRepository(localPath);
      } catch (cleanupError) {
        logger.error('Failed to cleanup after error', { localPath, cleanupError });
      }

      logger.error('Repository clone and analysis failed', { repoUrl, error });
      throw error;
    }
  }

  /**
   * Clone multiple repositories concurrently
   */
  public async cloneAndAnalyzeMultiple(
    repoUrls: string[],
    concurrency: number = 3
  ): Promise<Map<string, RepoAnalysis>> {
    const results = new Map<string, RepoAnalysis>();
    const errors = new Map<string, Error>();

    // Process repos in batches
    for (let i = 0; i < repoUrls.length; i += concurrency) {
      const batch = repoUrls.slice(i, i + concurrency);

      const promises = batch.map(async (repoUrl) => {
        try {
          const { analysis, localPath } = await this.cloneAndAnalyzeRepository(repoUrl);
          results.set(repoUrl, analysis);

          // Clean up after successful analysis
          await cleanupRepository(localPath);
        } catch (error) {
          errors.set(
            repoUrl,
            error instanceof Error ? error : new Error('Unknown error')
          );
          logger.error('Failed to process repository', { repoUrl, error });
        }
      });

      await Promise.all(promises);

      logger.info('Batch processed', {
        batch: i / concurrency + 1,
        total: Math.ceil(repoUrls.length / concurrency),
        successful: results.size,
        failed: errors.size,
      });
    }

    if (errors.size > 0) {
      logger.warn('Some repositories failed to process', {
        failed: Array.from(errors.keys()),
      });
    }

    return results;
  }

  /**
   * Verify webhook signature
   */
  public static verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  /**
   * Parse repository URL to extract owner and repo name
   */
  public static parseRepoUrl(
    url: string
  ): { owner: string; repo: string; isValid: boolean } {
    try {
      // Handle different URL formats
      // https://github.com/owner/repo
      // git@github.com:owner/repo.git
      // owner/repo

      let owner = '';
      let repo = '';

      if (url.includes('github.com')) {
        const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          owner = match[1];
          repo = match[2];
        }
      } else if (url.includes('/')) {
        const parts = url.split('/');
        if (parts.length >= 2) {
          owner = parts[parts.length - 2];
          repo = parts[parts.length - 1];
        }
      }

      // Remove .git suffix if present
      repo = repo.replace(/\.git$/, '');

      return {
        owner,
        repo,
        isValid: !!(owner && repo),
      };
    } catch {
      return { owner: '', repo: '', isValid: false };
    }
  }
}

/**
 * Create GitHub client from configuration
 */
export const createGitHubClient = (token?: string, baseUrl?: string): GitHubClient => {
  if (!token) {
    throw new ValidationError('GitHub token is required');
  }

  const config: GitHubConfig = {
    type: baseUrl ? 'enterprise' : 'github.com',
    token,
    ...(baseUrl && { baseUrl }),
  };

  return new GitHubClient(config);
};

export default GitHubClient;
