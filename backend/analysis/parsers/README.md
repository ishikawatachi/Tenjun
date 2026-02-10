# Terraform Parser for Threat Modeling

Parse Terraform HCL2 configurations to extract security-relevant infrastructure information for threat analysis.

## Features

- **HCL2 Parsing**: Full support for Terraform HCL2 syntax including string interpolation
- **Multi-Cloud Support**: AWS, GCP, Azure, and other providers
- **Resource Extraction**: Extract all resources with properties and dependencies
- **Variable Analysis**: Parse variables with type information, defaults, and validation rules
- **Provider Detection**: Identify provider configurations and versions
- **Module References**: Extract module sources and inputs
- **Data Sources**: Parse data source blocks
- **Security Analysis**: Identify publicly exposed resources, unencrypted storage, sensitive variables
- **Multi-File Projects**: Parse entire directories of .tf files

## Architecture

```
┌─────────────────┐
│  Node.js API    │
│  (TypeScript)   │
└────────┬────────┘
         │
         │ spawn()
         ▼
┌─────────────────┐
│  Python Parser  │
│  (HCL2 Library) │
└────────┬────────┘
         │
         │ returns JSON
         ▼
┌─────────────────┐
│  Threat Models  │
│  Node.js API    │
└─────────────────┘
```

## Installation

### Python Dependencies

```bash
cd backend/analysis
pip install -r requirements.txt
```

Required packages:
- `python-hcl2==4.3.2` - HCL2 parser
- `pytest==7.4.3` - Testing framework

### Node.js Setup

The TypeScript client is located in `backend/api/src/services/terraformParserClient.ts` and has no additional dependencies beyond the existing project packages.

## Usage

### Python API

#### Parse a Single File

```python
from parsers.terraform_parser import TerraformParser

parser = TerraformParser()
config = parser.parse_file('/path/to/main.tf')

print(f"Found {len(config['resources'])} resources")
print(f"Found {len(config['variables'])} variables")

# Access resources
for resource in config['resources']:
    print(f"- {resource['resource_type']}.{resource['name']}")
    print(f"  Cloud: {resource['cloud_provider']}")
    print(f"  Properties: {resource['properties']}")
```

#### Parse a Directory

```python
config = parser.parse_directory('/path/to/terraform/project')

# Get statistics
stats = config['statistics']
print(f"Total resources: {stats['total_resources']}")
print(f"By cloud provider:")
for provider, count in stats['providers_by_type'].items():
    print(f"  {provider}: {count}")
```

#### Extract Specific Components

```python
# Get all resources
resources = parser.extract_resources(hcl_dict, location='main.tf')

# Get all variables
variables = parser.extract_variables(hcl_dict)

# Get all providers
providers = parser.extract_providers(hcl_dict)

# Get all modules
modules = parser.extract_modules(hcl_dict)
```

### TypeScript/Node.js API

#### Basic Parsing

```typescript
import { TerraformParserClient } from './services/terraformParserClient';

const client = new TerraformParserClient({
  timeout: 30000,  // 30 seconds
  pythonPath: 'python3',
  maxFileSize: 10 * 1024 * 1024  // 10MB
});

// Parse a single file
const config = await client.parseFile('/path/to/main.tf');
console.log(`Found ${config.resources.length} resources`);

// Parse a directory
const projectConfig = await client.parseDirectory('/path/to/terraform/project');
console.log(`Parsed ${projectConfig.source_files.length} files`);
```

#### Security Analysis

```typescript
// Extract security-relevant resources
const securityResources = client.extractSecurityResources(config);
console.log(`Found ${securityResources.length} security resources`);

// Find sensitive variables
const sensitiveVars = client.findSensitiveVariables(config);
console.log(`Found ${sensitiveVars.length} potentially sensitive variables`);

// Analyze public exposure risks
const risks = client.analyzePublicExposure(config);
for (const risk of risks) {
  console.log(`[${risk.severity.toUpperCase()}] ${risk.resource.full_name}`);
  console.log(`  ${risk.risk}`);
}
```

#### Verify Dependencies

```typescript
const hasRequiredDeps = await client.verifyDependencies();
if (!hasRequiredDeps) {
  console.error('Missing Python dependencies. Run: pip install python-hcl2');
}
```

## Data Models

### Resource

```typescript
interface TerraformResource {
  resource_type: string;        // e.g., "aws_s3_bucket"
  name: string;                 // Resource name in Terraform
  full_name: string;            // "aws_s3_bucket.my_bucket"
  properties: Record<string, any>;
  location?: string;            // File path
  line_number?: number;
  depends_on: string[];         // Explicit dependencies
  provider?: string;            // Provider reference
  cloud_provider?: string;      // "aws", "gcp", "azure"
}
```

### Variable

```typescript
interface TerraformVariable {
  name: string;
  type?: string;                // "string", "number", "list(string)", etc.
  default?: any;
  description?: string;
  sensitive: boolean;
  validation_rules: any[];
  location?: string;
  line_number?: number;
}
```

### Provider

```typescript
interface TerraformProvider {
  name: string;                 // "aws", "google", "azurerm"
  full_name: string;            // "aws.secondary" if aliased
  alias?: string;
  version?: string;             // "~> 4.0"
  region?: string;
  configuration: Record<string, any>;
  location?: string;
  line_number?: number;
}
```

## Testing

### Run Python Tests

```bash
cd backend/analysis
pytest tests/test_terraform_parser.py -v
```

Test coverage includes:
- ✅ GCP SQL database parsing
- ✅ GCP compute instance parsing
- ✅ AWS S3 bucket parsing
- ✅ AWS EC2 instance parsing
- ✅ Variable extraction with validation
- ✅ Provider configurations
- ✅ Data sources
- ✅ Module references
- ✅ Multi-file directory parsing
- ✅ Error handling (invalid HCL, missing files)
- ✅ Dependency tracking (depends_on)
- ✅ Multi-cloud statistics

### Example Test Output

```
test_terraform_parser.py::TestTerraformParser::test_parse_gcp_sql_database PASSED
test_terraform_parser.py::TestTerraformParser::test_parse_gcp_compute_instance PASSED
test_terraform_parser.py::TestTerraformParser::test_parse_aws_s3_bucket PASSED
test_terraform_parser.py::TestTerraformParser::test_parse_variables PASSED
test_terraform_parser.py::TestTerraformParser::test_parse_providers PASSED
test_terraform_parser.py::TestTerraformParser::test_parse_directory PASSED
test_terraform_parser.py::TestTerraformParser::test_multi_cloud_statistics PASSED
```

## Security Analysis Features

The parser includes built-in security analysis helpers:

### 1. Public Exposure Detection

Identifies resources exposed to the internet:
- Instances with public IPs
- Security groups allowing `0.0.0.0/0`
- Storage buckets with public ACLs
- Load balancers with public endpoints

### 2. Encryption Validation

Checks if sensitive storage has encryption enabled:
- Database encryption at rest
- S3 bucket encryption
- EBS volume encryption
- Disk encryption sets

### 3. Sensitive Data Detection

Finds variables that may contain credentials:
- Matches patterns: `password`, `secret`, `token`, `api_key`
- Respects `sensitive = true` flag
- Checks variable descriptions

### 4. Compliance Mapping

Extracts configuration for compliance checks:
- Backup configurations
- Access logging settings
- Versioning status
- Network isolation

## Example Terraform Files

### GCP SQL Database

```hcl
resource "google_sql_database_instance" "master" {
  name             = "master-instance"
  database_version = "POSTGRES_14"
  region           = "us-central1"
  
  settings {
    tier = "db-f1-micro"
    
    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "public-access"
        value = "0.0.0.0/0"  # Security Risk!
      }
    }
    
    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }
  }
}
```

**Parsed Output:**
```json
{
  "resource_type": "google_sql_database_instance",
  "name": "master",
  "cloud_provider": "gcp",
  "properties": {
    "name": "master-instance",
    "database_version": "POSTGRES_14",
    "region": "us-central1",
    "settings": {
      "tier": "db-f1-micro",
      "ip_configuration": {
        "ipv4_enabled": true,
        "authorized_networks": {
          "name": "public-access",
          "value": "0.0.0.0/0"
        }
      }
    }
  }
}
```

### AWS S3 Bucket with Public Access

```hcl
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"
}

resource "aws_s3_bucket_public_access_block" "data_pab" {
  bucket = aws_s3_bucket.data.id
  
  block_public_acls       = false  # Risk!
  block_public_policy     = false  # Risk!
  ignore_public_acls      = false
  restrict_public_buckets = false
}
```

**Security Risk Detected:**
```json
{
  "resource": "aws_s3_bucket_public_access_block.data_pab",
  "risk": "Storage bucket may be publicly accessible",
  "severity": "high"
}
```

## Performance

- **Single File**: ~100-500ms depending on file size
- **Small Project** (5-10 files): ~500ms-1s
- **Large Project** (50+ files): ~2-5s
- **Maximum File Size**: 10MB (configurable)
- **Timeout**: 30s (configurable)

## Error Handling

The parser provides detailed error messages:

```python
try:
    config = parser.parse_file('invalid.tf')
except TerraformParserError as e:
    print(f"Parsing failed: {e}")
    # e.g., "HCL2 parsing error in invalid.tf: unexpected token"
```

Common errors:
- `File not found`: File doesn't exist
- `Unsupported file extension`: Not a .tf or .hcl file
- `HCL2 parsing error`: Invalid HCL syntax
- `Timeout`: Parsing took too long

## Integration with Threat Modeling

The parsed Terraform configuration can be used for:

1. **Automated Threat Detection**: Identify misconfigurations
2. **Attack Surface Analysis**: Map public-facing resources
3. **Data Flow Mapping**: Track data between resources
4. **Compliance Validation**: Check against security standards
5. **Risk Scoring**: Calculate risk based on configuration

## Environment Variables

```bash
# Python executable path (default: python3)
PYTHON_PATH=/usr/bin/python3

# Enable debug logging
LOG_LEVEL=DEBUG
```

## Limitations

- **State Files**: Does not parse `.tfstate` files (only `.tf` files)
- **Dynamic Blocks**: Complex `for_each` and `count` expressions are preserved as-is
- **String Interpolation**: Interpolated values are kept as strings (not evaluated)
- **Terraform Functions**: Functions like `file()`, `templatefile()` are not evaluated
- **Remote Modules**: Module sources are extracted but not downloaded/parsed

## Troubleshooting

### "ModuleNotFoundError: No module named 'hcl2'"

Install Python dependencies:
```bash
cd backend/analysis
pip install -r requirements.txt
```

### "Python parser failed with code 1"

Check the Python script path and permissions:
```bash
ls -la backend/analysis/parsers/terraform_parser.py
```

Verify Python can import the module:
```bash
cd backend/analysis
python3 -c "from parsers.terraform_parser import TerraformParser; print('OK')"
```

### "Timeout after 30000ms"

Increase timeout for large projects:
```typescript
const client = new TerraformParserClient({
  timeout: 60000  // 60 seconds
});
```

## Contributing

To add support for new resource types or cloud providers:

1. Update `Resource.cloud_provider` property in `models/terraform.py`
2. Add security analysis rules in `terraformParserClient.ts`
3. Add test cases in `test_terraform_parser.py`

## License

Part of the Threat Modeling Platform project.
