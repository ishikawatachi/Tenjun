# Threat Modeling Platform - TypeScript Express API

A secure, production-ready TypeScript Express API for managing threat models and security analysis.

## Features

- 🔐 **JWT Authentication** with RS256 algorithm (1-hour token expiry)
- 🛡️ **Security Best Practices**: Helmet, CORS, rate limiting, SQL injection prevention
- 📝 **Request Validation** using Zod schemas
- 🗃️ **SQLite Database** with encryption support and migrations
- 📊 **Audit Logging** for all operations
- 🔌 **Jira Integration** for ticket creation
- 🤖 **AI Analysis Service** integration
- 📚 **Swagger/OpenAPI Documentation**
- ⚡ **Health Check Endpoint**

## Project Structure

```
src/
├── index.ts                    # Application entry point
├── config/
│   └── config.ts              # Configuration management
├── middleware/
│   ├── auth.middleware.ts     # JWT validation
│   ├── errorHandler.middleware.ts
│   └── logging.middleware.ts
├── routes/
│   ├── auth.routes.ts
│   ├── threatModels.routes.ts
│   └── analysis.routes.ts
├── controllers/
│   ├── authController.ts
│   ├── threatModelController.ts
│   └── analysisController.ts
├── services/
│   ├── threatModelService.ts
│   ├── analysisService.ts
│   └── jiraService.ts
├── database/
│   └── db.ts                  # SQLite connection & migrations
└── utils/
    └── errors.ts              # Custom error classes
```

## Prerequisites

- Node.js 18+ and npm
- OpenSSL (for generating RSA keys)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Generate RSA keys for JWT:**
   ```bash
   mkdir -p keys
   openssl genrsa -out keys/private.pem 2048
   openssl rsa -in keys/private.pem -pubout -out keys/public.pem
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

## Development

Run the development server with hot reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## Production

Build and run in production mode:

```bash
npm run build
npm start
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/refresh` - Refresh JWT token

### Threat Models
- `GET /api/threat-models` - List all threat models
- `GET /api/threat-models/:id` - Get specific threat model
- `POST /api/threat-models` - Create new threat model
- `PUT /api/threat-models/:id` - Update threat model
- `DELETE /api/threat-models/:id` - Delete threat model
- `GET /api/threat-models/:id/threats` - List threats for a model
- `POST /api/threat-models/:id/threats` - Create new threat

### Analysis
- `POST /api/analysis/analyze` - Analyze system for threats
- `POST /api/analysis/validate-diagram` - Validate data flow diagram
- `POST /api/analysis/statistics` - Get threat statistics
- `POST /api/analysis/jira/create` - Create Jira issue for threat
- `GET /api/analysis/jira/:issueKey` - Get Jira issue status
- `GET /api/analysis/health` - Check analysis service health

## Security Features

### SQL Injection Prevention
All database queries use parameterized statements:
```typescript
executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
```

### JWT Authentication
- RS256 algorithm (asymmetric encryption)
- 1-hour token expiry
- Bearer token format

### Audit Logging
All operations are logged with:
- User ID
- Action type
- Resource details
- IP address
- Timestamp

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable via environment variables

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DB_PATH` | Database file path | ./data/threat-models.db |
| `DB_ENCRYPTION_KEY` | Database encryption key | - |
| `JWT_PRIVATE_KEY` | RSA private key | - |
| `JWT_PUBLIC_KEY` | RSA public key | - |
| `JIRA_HOST` | Jira instance URL | - |
| `JIRA_EMAIL` | Jira user email | - |
| `JIRA_API_TOKEN` | Jira API token | - |
| `ANALYSIS_SERVICE_URL` | Analysis service URL | http://localhost:5000 |

## Database Schema

### Users
- `id` (PRIMARY KEY)
- `email` (UNIQUE)
- `password_hash`
- `role`
- `created_at`
- `updated_at`

### Threat Models
- `id` (PRIMARY KEY)
- `name`
- `description`
- `system_description`
- `data_flow_diagram`
- `created_by` (FOREIGN KEY → users)
- `created_at`
- `updated_at`

### Threats
- `id` (PRIMARY KEY)
- `threat_model_id` (FOREIGN KEY → threat_models)
- `category` (STRIDE categories)
- `title`
- `description`
- `severity`
- `likelihood`
- `impact`
- `mitigation`
- `status`
- `jira_ticket`
- `created_at`
- `updated_at`

### Audit Logs
- `id` (PRIMARY KEY)
- `user_id` (FOREIGN KEY → users)
- `action`
- `resource_type`
- `resource_id`
- `details`
- `ip_address`
- `timestamp`

## Testing

```bash
npm test
```

## Linting & Formatting

```bash
npm run lint
npm run format
```

## License

MIT
