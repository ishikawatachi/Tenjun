import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    path: string;
    encryptionKey: string;
  };
  jwt: {
    privateKey: string;
    publicKey: string;
    algorithm: 'RS256';
    expiresIn: string;
  };
  jira: {
    host: string;
    email: string;
    apiToken: string;
  };
  logging: {
    level: string;
    file: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    origin: string[];
  };
}

// Load RSA keys for JWT
const loadKey = (envVar: string, filePath: string): string => {
  const key = process.env[envVar];
  if (key) {
    return key.replace(/\\n/g, '\n');
  }
  
  try {
    return fs.readFileSync(path.resolve(filePath), 'utf8');
  } catch (error) {
    console.warn(`Warning: Could not load key from ${filePath}`);
    return '';
  }
};

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '../../data/threat-models.db'),
    encryptionKey: process.env.DB_ENCRYPTION_KEY || 'change-this-in-production',
  },
  
  jwt: {
    privateKey: loadKey('JWT_PRIVATE_KEY', './keys/private.pem'),
    publicKey: loadKey('JWT_PUBLIC_KEY', './keys/public.pem'),
    algorithm: 'RS256',
    expiresIn: '1h',
  },
  
  jira: {
    host: process.env.JIRA_HOST || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(__dirname, '../../logs/app.log'),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  },
};

// Validate critical configuration
if (config.nodeEnv === 'production') {
  if (!config.jwt.privateKey || !config.jwt.publicKey) {
    throw new Error('JWT keys must be configured in production');
  }
  if (config.database.encryptionKey === 'change-this-in-production') {
    throw new Error('Database encryption key must be changed in production');
  }
}

export default config;
