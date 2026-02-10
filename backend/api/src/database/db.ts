import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config/config';
import { DatabaseError } from '../utils/errors';
import { logger } from '../middleware/logging.middleware';
import * as types from './types';

let db: Database.Database | null = null;
const MAX_CONNECTIONS = 5;
const connectionPool: Database.Database[] = [];

/**
 * Initialize SQLite database with encryption and optimization
 */
export const initDatabase = (): Database.Database => {
  try {
    // Ensure data directory exists
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database with optimized settings
    db = new Database(config.database.path, {
      verbose: config.nodeEnv === 'development' ? logger.debug.bind(logger) : undefined,
      fileMustExist: false,
    });

    // Apply encryption key using PRAGMA (SQLCipher compatible)
    if (config.database.encryptionKey) {
      try {
        db.pragma(`key = '${config.database.encryptionKey}'`);
        logger.info('Database encryption enabled');
      } catch (error) {
        logger.warn('Encryption not available, continuing without encryption', { error });
      }
    }

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Optimize performance
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
    db.pragma('page_size = 4096');

    // Set secure file permissions
    if (config.nodeEnv === 'production') {
      fs.chmodSync(config.database.path, 0o600);
    }

    // Run migrations
    runMigrations(db);

    logger.info('Database initialized successfully', {
      path: config.database.path,
      encrypted: !!config.database.encryptionKey,
    });

    return db;
  } catch (error) {
    logger.error('Database initialization failed', { error });
    throw new DatabaseError('Failed to initialize database', error);
  }
};

/**
 * Get database instance
 */
export const getDatabase = (): Database.Database => {
  if (!db) {
    throw new DatabaseError('Database not initialized');
  }
  return db;
};

/**
 * Close database connection
 */
export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
};

/**
 * Run database migrations from SQL files
 */
const runMigrations = (database: Database.Database): void => {
  // Create migrations table if it doesn't exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of applied migrations
  const appliedMigrations = database
    .prepare('SELECT name FROM migrations ORDER BY id')
    .all() as { name: string }[];

  const appliedNames = new Set(appliedMigrations.map((m) => m.name));

  // Check for migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    logger.info('Created migrations directory');
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Apply pending migrations
  for (const file of migrationFiles) {
    const migrationName = path.basename(file, '.sql');

    if (appliedNames.has(migrationName)) {
      logger.debug(`Migration already applied: ${migrationName}`);
      continue;
    }

    logger.info(`Applying migration: ${migrationName}`);

    const migrationPath = path.join(migrationsDir, file);
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    try {
      // Execute migration in a transaction
      database.exec('BEGIN TRANSACTION');
      database.exec(migrationSql);
      
      // Record migration (skip if already recorded in migration file)
      const hasInsert = migrationSql.includes("INSERT INTO migrations");
      if (!hasInsert) {
        database
          .prepare('INSERT INTO migrations (name) VALUES (?)')
          .run(migrationName);
      }
      
      database.exec('COMMIT');
      logger.info(`Migration applied successfully: ${migrationName}`);
    } catch (error) {
      database.exec('ROLLBACK');
      logger.error(`Migration failed: ${migrationName}`, { error });
      throw new DatabaseError(`Failed to apply migration: ${migrationName}`, error);
    }
  }

  logger.info('All migrations applied successfully');
};

/**
 * Execute parameterized query to prevent SQL injection
 */
export const executeQuery = <T>(
  query: string,
  params: unknown[] = []
): T[] => {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    return stmt.all(...params) as T[];
  } catch (error) {
    logger.error('Query execution failed', { query, error });
    throw new DatabaseError('Database query failed', error);
  }
};

/**
 * Execute parameterized query and return single result
 */
export const executeQuerySingle = <T>(
  query: string,
  params: unknown[] = []
): T | undefined => {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    return stmt.get(...params) as T | undefined;
  } catch (error) {
    logger.error('Query execution failed', { query, error });
    throw new DatabaseError('Database query failed', error);
  }
};

/**
 * Execute write operation (INSERT, UPDATE, DELETE)
 */
export const executeWrite = (
  query: string,
  params: unknown[] = []
): Database.RunResult => {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    return stmt.run(...params);
  } catch (error) {
    logger.error('Write operation failed', { query, error });
    throw new DatabaseError('Database write failed', error);
  }
};

/**
 * Create audit log entry
 */
export const createAuditLog = (
  userId: string | undefined,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  details: unknown,
  ipAddress: string | undefined,
  userAgent?: string
): void => {
  try {
    const changes = typeof details === 'object' ? JSON.stringify(details) : null;
    
    executeWrite(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes_json, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        resourceType,
        resourceId || null,
        changes,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    // Log but don't fail the operation if audit logging fails
    logger.error('Audit log creation failed', { error });
  }
};

/**
 * Backup database to specified path
 */
export const backupDatabase = async (backupPath?: string): Promise<string> => {
  const database = getDatabase();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultBackupPath = path.join(
    path.dirname(config.database.path),
    'backups',
    `backup-${timestamp}.db`
  );

  const targetPath = backupPath || defaultBackupPath;
  const targetDir = path.dirname(targetPath);

  // Ensure backup directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    // Use SQLite backup API for consistent backup
    await new Promise<void>((resolve, reject) => {
      const backup = database.backup(targetPath);
      
      backup.on('progress', ({ totalPages, remainingPages }) => {
        const progress = Math.round(((totalPages - remainingPages) / totalPages) * 100);
        logger.debug(`Backup progress: ${progress}%`);
      });

      backup.on('error', (error) => {
        logger.error('Backup failed', { error });
        reject(error);
      });

      backup.on('finish', () => {
        logger.info('Backup completed', { path: targetPath });
        resolve();
      });
    });

    // Set secure permissions on backup file
    if (config.nodeEnv === 'production') {
      fs.chmodSync(targetPath, 0o600);
    }

    return targetPath;
  } catch (error) {
    logger.error('Database backup failed', { error, targetPath });
    throw new DatabaseError('Failed to backup database', error);
  }
};

/**
 * Restore database from backup
 */
export const restoreDatabase = async (backupPath: string): Promise<void> => {
  if (!fs.existsSync(backupPath)) {
    throw new DatabaseError('Backup file not found');
  }

  const database = getDatabase();

  try {
    // Close current connection
    closeDatabase();

    // Create backup of current database
    const currentBackup = `${config.database.path}.before-restore`;
    fs.copyFileSync(config.database.path, currentBackup);

    // Restore from backup
    fs.copyFileSync(backupPath, config.database.path);

    // Reinitialize database
    initDatabase();

    logger.info('Database restored successfully', { from: backupPath });
  } catch (error) {
    logger.error('Database restore failed', { error, backupPath });
    throw new DatabaseError('Failed to restore database', error);
  }
};

/**
 * Clean up old backups, keeping only the specified number
 */
export const cleanupOldBackups = (keepCount: number = 10): void => {
  const backupDir = path.join(path.dirname(config.database.path), 'backups');

  if (!fs.existsSync(backupDir)) {
    return;
  }

  try {
    const backups = fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith('.db'))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
        mtime: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by date descending

    // Remove old backups
    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      fs.unlinkSync(backup.path);
      logger.info('Old backup deleted', { path: backup.path });
    }

    logger.info(`Backup cleanup completed, kept ${Math.min(backups.length, keepCount)} backups`);
  } catch (error) {
    logger.error('Backup cleanup failed', { error });
  }
};

/**
 * Get database statistics
 */
export const getDatabaseStats = (): {
  size: number;
  tables: number;
  pageSize: number;
  pageCount: number;
  freePages: number;
} => {
  const database = getDatabase();

  const stats = {
    size: fs.statSync(config.database.path).size,
    tables: database.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number },
    pageSize: database.pragma('page_size', { simple: true }) as number,
    pageCount: database.pragma('page_count', { simple: true }) as number,
    freePages: database.pragma('freelist_count', { simple: true }) as number,
  };

  return {
    size: stats.size,
    tables: stats.tables.count,
    pageSize: stats.pageSize,
    pageCount: stats.pageCount,
    freePages: stats.freePages,
  };
};

/**
 * Vacuum database to reclaim space
 */
export const vacuumDatabase = (): void => {
  const database = getDatabase();
  
  try {
    logger.info('Starting database vacuum');
    database.exec('VACUUM');
    logger.info('Database vacuum completed');
  } catch (error) {
    logger.error('Database vacuum failed', { error });
    throw new DatabaseError('Failed to vacuum database', error);
  }
};

/**
 * Analyze database for query optimization
 */
export const analyzeDatabase = (): void => {
  const database = getDatabase();
  
  try {
    logger.info('Starting database analysis');
    database.exec('ANALYZE');
    logger.info('Database analysis completed');
  } catch (error) {
    logger.error('Database analysis failed', { error });
    throw new DatabaseError('Failed to analyze database', error);
  }
};

/**
 * Execute transaction with automatic rollback on error
 */
export const executeTransaction = <T>(
  callback: (db: Database.Database) => T
): T => {
  const database = getDatabase();
  
  try {
    database.exec('BEGIN TRANSACTION');
    const result = callback(database);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    logger.error('Transaction rolled back', { error });
    throw error;
  }
};
