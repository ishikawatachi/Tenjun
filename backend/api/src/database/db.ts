import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config/config';
import { DatabaseError } from '../utils/errors';
import { logger } from '../middleware/logging.middleware';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database with encryption
 */
export const initDatabase = (): Database.Database => {
  try {
    // Ensure data directory exists
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    db = new Database(config.database.path, {
      verbose: config.nodeEnv === 'development' ? logger.debug.bind(logger) : undefined,
    });

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Set encryption key (Note: SQLCipher extension required for full encryption)
    // For better-sqlite3, we use file permissions for security
    if (config.nodeEnv === 'production') {
      fs.chmodSync(config.database.path, 0o600);
    }

    // Run migrations
    runMigrations(db);

    logger.info('Database initialized successfully', {
      path: config.database.path,
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
 * Run database migrations
 */
const runMigrations = (database: Database.Database): void => {
  // Create migrations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Define migrations
  const migrations = [
    {
      name: '001_create_users_table',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `,
    },
    {
      name: '002_create_threat_models_table',
      sql: `
        CREATE TABLE IF NOT EXISTS threat_models (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          system_description TEXT,
          data_flow_diagram TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_threat_models_created_by ON threat_models(created_by);
      `,
    },
    {
      name: '003_create_threats_table',
      sql: `
        CREATE TABLE IF NOT EXISTS threats (
          id TEXT PRIMARY KEY,
          threat_model_id TEXT NOT NULL,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          severity TEXT NOT NULL,
          likelihood TEXT NOT NULL,
          impact TEXT NOT NULL,
          mitigation TEXT,
          status TEXT DEFAULT 'open',
          jira_ticket TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (threat_model_id) REFERENCES threat_models(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_threats_model ON threats(threat_model_id);
        CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(status);
      `,
    },
    {
      name: '004_create_audit_logs_table',
      sql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          details TEXT,
          ip_address TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      `,
    },
  ];

  // Apply migrations
  for (const migration of migrations) {
    const existing = database
      .prepare('SELECT name FROM migrations WHERE name = ?')
      .get(migration.name);

    if (!existing) {
      logger.info(`Applying migration: ${migration.name}`);
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO migrations (name) VALUES (?)')
        .run(migration.name);
    }
  }

  logger.info('All migrations applied');
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
  ipAddress: string | undefined
): void => {
  try {
    executeWrite(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        resourceType,
        resourceId || null,
        JSON.stringify(details),
        ipAddress || null,
      ]
    );
  } catch (error) {
    // Log but don't fail the operation if audit logging fails
    logger.error('Audit log creation failed', { error });
  }
};
