# Terraform Parser Quick Start

## Installation

```bash
cd /home/mandark/threat-model-platform/backend/analysis
pip install -r requirements.txt
```

## Run Tests

```bash
cd /home/mandark/threat-model-platform/backend/analysis
pytest tests/test_terraform_parser.py -v
```

## Run Example

```bash
cd /home/mandark/threat-model-platform/backend/analysis
python3 parsers/example_usage.py
```

## Start Flask API

```bash
cd /home/mandark/threat-model-platform/backend/analysis
python3 app.py
```

The service will start on port 3002.

## API Endpoints

### 1. Parse Terraform File

**POST** `/terraform/parse-file`

```bash
curl -X POST http://localhost:3002/terraform/parse-file \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/path/to/main.tf"
  }'
```

**Response:**
```json
{
  "resources": [...],
  "variables": [...],
  "providers": [...],
  "statistics": {
    "total_resources": 5,
    "total_variables": 3,
    "providers_by_type": {
      "aws": 3,
      "gcp": 2
    }
  }
}
```

### 2. Parse Terraform Directory

**POST** `/terraform/parse-directory`

```bash
curl -X POST http://localhost:3002/terraform/parse-directory \
  -H "Content-Type: application/json" \
  -d '{
    "directory_path": "/path/to/terraform/project"
  }'
```

### 3. Analyze Security

**POST** `/terraform/analyze-security`

```bash
curl -X POST http://localhost:3002/terraform/analyze-security \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "resources": [...],
      "variables": [...]
    }
  }'
```

**Response:**
```json
{
  "total_issues": 5,
  "severity_counts": {
    "critical": 1,
    "high": 2,
    "medium": 2,
    "low": 0
  },
  "issues": [
    {
      "severity": "high",
      "resource": "aws_s3_bucket.data",
      "issue": "Public S3 bucket",
      "description": "Bucket has public ACL: public-read",
      "recommendation": "Set ACL to private"
    }
  ]
}
```

## Node.js Usage

```typescript
import { TerraformParserClient } from './services/terraformParserClient';

const client = new TerraformParserClient();

// Parse file
const config = await client.parseFile('/path/to/main.tf');

// Analyze security
const risks = client.analyzePublicExposure(config);
console.log(`Found ${risks.length} security risks`);
```

## Documentation

See [parsers/README.md](parsers/README.md) for complete documentation.
