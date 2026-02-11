# LLM Integration for Threat Analysis

AI-powered threat description, remediation, and compliance explanation using Claude 3.5 Sonnet and GPT-4o.

## Features

- **Threat Description Generator**: Generate human-readable 2-3 sentence explanations of security threats
- **Remediation Generator**: Step-by-step fixes with cloud-specific CLI commands and Terraform code
- **Compliance Explainer**: Map threats to DORA, BAFIN, ISO27001, and other regulatory frameworks
- **Attack Scenario Generator**: Red team-style attack narratives
- **Risk Assessment**: Business impact analysis with regulatory implications
- **Dual-Provider Support**: Claude 3.5 Sonnet (primary) with GPT-4o fallback
- **Response Caching**: LRU cache with TTL to prevent redundant API calls
- **Request Queuing**: Limit concurrent requests (max 50)
- **Retry Logic**: Exponential backoff for rate limits and timeouts
- **Audit Logging**: Request/response tracking with timestamps and token usage

## Architecture

```
┌─────────────────┐
│ Flask API       │
│ /llm/*          │
└────────┬────────┘
         │
┌────────▼────────────┐
│ ThreatGenerator     │
│ - generate_*()      │
└──┬────────┬─────────┘
   │        │
   │   ┌────▼─────┐
   │   │ Cache    │
   │   │ (LRU)    │
   │   └──────────┘
   │
┌──▼─────────────┐
│ LLMClient      │
│ - Claude 3.5   │
│ - GPT-4o       │
└────────────────┘
```

## Setup

### 1. API Keys

Add your API keys to `.env`:

```bash
# Required: At least one API key
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Optional: Cache configuration
LLM_ENABLE_CACHE=true  # default: true
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

Dependencies:
- `anthropic~=0.79.0` - Claude API client
- `openai~=2.20.0` - OpenAI API client  
- `tenacity~=9.1.4` - Retry logic with exponential backoff

### 3. Start the Service

```bash
python app.py
```

## API Endpoints

### Generate Threat Description

```http
POST /llm/threat/describe
Content-Type: application/json

{
  "config": {
    "resource_type": "aws_s3_bucket",
    "name": "data-bucket",
    "properties": {"acl": "public-read"}
  },
  "threat_rule": {
    "id": "AWS-S3-001",
    "name": "Public S3 Bucket",
    "category": "Data Exposure"
  }
}
```

**Response:**
```json
{
  "description": "This S3 bucket allows public read access, exposing sensitive data to anyone on the internet. An attacker can enumerate and download all objects without authentication. This violates the principle of least privilege and creates a critical data exposure risk.",
  "timestamp": "2024-01-15T10:30:00Z",
  "cached": false
}
```

### Generate Remediation

```http
POST /llm/threat/remediate
Content-Type: application/json

{
  "threat": {
    "name": "Public S3 Bucket",
    "description": "Bucket allows public access",
    "severity": "high"
  },
  "context": {
    "cloud_provider": "aws",
    "service_type": "aws_s3_bucket",
    "resource_name": "data-bucket",
    "current_config": {"acl": "public-read"}
  }
}
```

**Response:**
```json
{
  "remediation": "**Step 1: Disable Public Access**\n```bash\naws s3api put-public-access-block --bucket data-bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true\n```\n\n**Step 2: Remove Public ACL**\n```bash\naws s3api put-bucket-acl --bucket data-bucket --acl private\n```\n\n**Step 3: Update Terraform**\n```hcl\nresource \"aws_s3_bucket\" \"data_bucket\" {\n  bucket = \"data-bucket\"\n  acl    = \"private\"\n}\n\nresource \"aws_s3_bucket_public_access_block\" \"data_bucket\" {\n  bucket = aws_s3_bucket.data_bucket.id\n  \n  block_public_acls       = true\n  block_public_policy     = true\n  ignore_public_acls      = true\n  restrict_public_buckets = true\n}\n```\n\n**Step 4: Verify**\n```bash\naws s3api get-bucket-acl --bucket data-bucket\naws s3api get-public-access-block --bucket data-bucket\n```",
  "timestamp": "2024-01-15T10:31:00Z",
  "cloud_provider": "aws"
}
```

### Generate Compliance Explanation

```http
POST /llm/threat/compliance
Content-Type: application/json

{
  "threat": {
    "name": "Unencrypted Database",
    "description": "Database lacks encryption at rest"
  },
  "framework": "ISO27001",
  "control_id": "A.10.1.1"
}
```

**Response:**
```json
{
  "explanation": "**ISO27001 A.10.1.1 - Cryptographic Controls**\n\nThis control requires organizations to implement cryptographic controls to protect information confidentiality, authenticity, and integrity.\n\n**Violation:** The database lacks encryption at rest, storing sensitive data in plaintext. This violates the requirement for cryptographic protection of data at rest.\n\n**Remediation:** Enable transparent data encryption (TDE) for the database. All data files, log files, and backup files must be encrypted using AES-256.\n\n**Evidence for Auditors:**\n- Database encryption configuration showing TDE enabled\n- Key management documentation (rotation, access controls)\n- Encryption verification test results",
  "framework": "ISO27001",
  "control_id": "A.10.1.1",
  "timestamp": "2024-01-15T10:32:00Z"
}
```

### Generate Attack Scenario

```http
POST /llm/threat/attack-scenario
Content-Type: application/json

{
  "threat": {
    "name": "SQL Injection",
    "description": "Allows malicious SQL queries"
  },
  "service_info": {
    "service_type": "web_application",
    "technology": "Node.js + PostgreSQL"
  }
}
```

### Generate Risk Assessment

```http
POST /llm/threat/risk-assess
Content-Type: application/json

{
  "threat": {
    "name": "Data Breach",
    "description": "Customer data exposure"
  },
  "business_context": {
    "industry": "Financial Services",
    "data_sensitivity": "high",
    "regulatory_requirements": ["GDPR", "PCI-DSS"]
  }
}
```

### Get Statistics

```http
GET /llm/statistics
```

**Response:**
```json
{
  "statistics": {
    "llm": {
      "total_requests": 1250,
      "active_requests": 3,
      "total_tokens": 450000,
      "provider_usage": {
        "claude": 1100,
        "openai": 150
      }
    },
    "cache": {
      "size": 342,
      "max_size": 1000,
      "hits": 890,
      "misses": 360,
      "hit_rate": 71.2,
      "ttl": 3600
    }
  },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

## Python Usage

```python
from llm.threat_generator import ThreatGenerator

# Initialize
generator = ThreatGenerator(
    claude_api_key="sk-ant-xxxxx",
    openai_api_key="sk-xxxxx",
    enable_cache=True
)

# Generate threat description
description = generator.generate_threat_description(
    config={
        "resource_type": "aws_s3_bucket",
        "name": "data-bucket",
        "properties": {"acl": "public-read"}
    },
    threat_rule={
        "id": "AWS-S3-001",
        "name": "Public S3 Bucket",
        "category": "Data Exposure"
    }
)

# Generate remediation
remediation = generator.generate_remediation(
    threat={
        "name": "Public S3 Bucket",
        "description": "Bucket allows public access"
    },
    context={
        "cloud_provider": "aws",
        "service_type": "aws_s3_bucket",
        "resource_name": "data-bucket",
        "current_config": {"acl": "public-read"}
    }
)

# Generate compliance explanation
explanation = generator.generate_compliance_explanation(
    threat={
        "name": "Unencrypted Database",
        "description": "Database lacks encryption at rest"
    },
    framework="ISO27001",
    control_id="A.10.1.1"
)

# Get statistics
stats = generator.get_statistics()
print(f"Cache hit rate: {stats['cache']['hit_rate']:.1f}%")
```

## TypeScript Client

```typescript
interface ThreatDescription {
  description: string;
  timestamp: string;
  cached: boolean;
}

async function generateThreatDescription(
  config: any,
  threatRule: any
): Promise<ThreatDescription> {
  const response = await fetch('http://localhost:3002/llm/threat/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, threat_rule: threatRule })
  });
  
  if (!response.ok) {
    throw new Error(`LLM API error: ${response.statusText}`);
  }
  
  return await response.json();
}

// Usage
const description = await generateThreatDescription(
  {
    resource_type: 'aws_s3_bucket',
    name: 'data-bucket',
    properties: { acl: 'public-read' }
  },
  {
    id: 'AWS-S3-001',
    name: 'Public S3 Bucket',
    category: 'Data Exposure'
  }
);

console.log(description.description);
```

## Prompt Customization

Edit `llm/prompt_templates.py` to customize prompts:

```python
@staticmethod
def threat_description(service_type: str, service_name: str, 
                       properties: Dict[str, Any], threat_name: str,
                       threat_category: str) -> str:
    """Customize threat description prompt"""
    return f"""
Given this {service_type} configuration:
- Name: {service_name}
- Properties: {json.dumps(properties, indent=2)}

Explain the "{threat_name}" threat ({threat_category}) in 2-3 sentences.

Focus on:
1. What vulnerability exists
2. How it can be exploited  
3. Potential impact

Be specific, technical, and concise.
"""
```

## Cache Configuration

Adjust cache settings in `utils/cache.py`:

```python
# Default: 1000 entries, 1 hour TTL
cache = ResponseCache(max_size=1000, ttl=3600)

# For high-traffic: Larger cache, longer TTL
cache = ResponseCache(max_size=5000, ttl=7200)

# For testing: Small cache, short TTL
cache = ResponseCache(max_size=10, ttl=60)
```

## Cost Optimization

### 1. Enable Caching (Default)
Identical requests are served from cache without API calls.

### 2. Use Cache Statistics
Monitor hit rate:
```bash
curl http://localhost:3002/llm/statistics
```

If hit rate < 50%, consider increasing cache size.

### 3. Batch Requests
Generate all threat descriptions in one session to maximize cache hits.

### 4. Adjust Token Limits
Reduce `max_tokens` in `llm/threat_generator.py`:

```python
# Current
response = self.llm_client.generate(prompt, max_tokens=1500)

# Optimized
response = self.llm_client.generate(prompt, max_tokens=800)
```

### 5. Monitor Provider Usage
Claude is typically more cost-effective than GPT-4o. Check provider distribution:

```bash
curl http://localhost:3002/llm/statistics | jq '.statistics.llm.provider_usage'
```

## Error Handling

### No API Keys

```bash
# Check logs
WARNING - No LLM API keys configured
```

**Solution:** Add API keys to `.env`

### Rate Limits

The client automatically retries with exponential backoff (3 attempts, 2-10s wait).

**Custom retry configuration** in `llm/llm_client.py`:

```python
@retry(
    stop=stop_after_attempt(5),  # Increase attempts
    wait=wait_exponential(multiplier=1, min=4, max=20),  # Longer waits
    retry=retry_if_exception_type(RateLimitError)
)
```

### API Timeouts

Default timeout: 60s. Adjust in `llm/llm_client.py`:

```python
# Claude
response = self.claude_client.messages.create(
    timeout=120.0,  # 2 minutes
    ...
)

# OpenAI  
response = self.openai_client.chat.completions.create(
    timeout=120.0,  # 2 minutes
    ...
)
```

## Testing

Run unit tests:

```bash
pytest tests/test_llm_integration.py -v
```

Test coverage:
- LLMClient: Claude/OpenAI calls, fallback, retry logic
- PromptTemplates: All 6 template generators
- ResponseCache: get/set, expiration, LRU eviction
- ThreatGenerator: All 5 generation methods

## System Prompts

System prompts define the AI's role and expertise. Customize in `llm/prompt_templates.py`:

### Security Architect (Threat Descriptions)
```python
SYSTEM_PROMPTS = {
    'threat_description': """You are an expert security architect..."""
}
```

### DevSecOps Engineer (Remediations)
```python
SYSTEM_PROMPTS = {
    'remediation': """You are a DevSecOps engineer..."""
}
```

### Compliance Analyst (Compliance)
```python
SYSTEM_PROMPTS = {
    'compliance_explanation': """You are a compliance analyst..."""
}
```

## Rate Limits

| Provider | Limit          | Concurrent |
|----------|----------------|------------|
| Claude   | 50 req/min     | 50         |
| GPT-4o   | 500 req/min    | 50         |

Adjust semaphore in `llm/llm_client.py`:

```python
class LLMClient:
    def __init__(self, ...):
        self._semaphore = asyncio.Semaphore(100)  # Increase to 100
```

## Supported Frameworks

Compliance frameworks supported by `generate_compliance_explanation()`:

- **EU**: DORA, NIS2, GDPR
- **Germany**: BAFIN BAIT, KRITIS, GDPdU
- **International**: ISO27001, SOC2, NIST CSF, CIS Controls
- **Financial**: PCI-DSS, SWIFT CSP
- **Industry**: HIPAA, TISAX, CSA CCM

## Logging

Request/response audit trail:

```python
# In llm/llm_client.py
logger.info(f"LLM Request: provider={provider}, tokens={tokens}, elapsed={elapsed}s")
```

**Sample log:**
```
2024-01-15 10:30:15 - llm.llm_client - INFO - LLM Request: provider=claude, tokens=350, elapsed=1.2s
2024-01-15 10:30:16 - llm.threat_generator - INFO - Generated threat description for AWS-S3-001
```

## License

MIT
