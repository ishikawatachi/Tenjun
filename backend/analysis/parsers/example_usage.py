#!/usr/bin/env python3
"""
Example usage of Terraform Parser
Demonstrates parsing Terraform configurations and extracting security information
"""

import os
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from parsers.terraform_parser import TerraformParser, TerraformParserError


def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80 + "\n")


def example_parse_file():
    """Example: Parse a single Terraform file"""
    print_section("Example 1: Parse a Single File")
    
    # Create a sample Terraform file
    sample_tf = """
resource "aws_s3_bucket" "data_bucket" {
  bucket = "my-company-data-bucket"
  
  tags = {
    Name        = "Data Bucket"
    Environment = "Production"
  }
}

resource "aws_s3_bucket_public_access_block" "data_bucket_pab" {
  bucket = aws_s3_bucket.data_bucket.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-west-2"
}

variable "database_password" {
  type        = string
  description = "Database password"
  sensitive   = true
}
"""
    
    # Write to temp file
    temp_file = "/tmp/example.tf"
    with open(temp_file, 'w') as f:
        f.write(sample_tf)
    
    # Parse the file
    parser = TerraformParser()
    try:
        config = parser.parse_file(temp_file)
        
        print(f"✓ Successfully parsed {temp_file}")
        print(f"\nResources found: {len(config['resources'])}")
        for resource in config['resources']:
            print(f"  - {resource['full_name']} ({resource['cloud_provider']})")
        
        print(f"\nVariables found: {len(config['variables'])}")
        for var in config['variables']:
            sensitive_mark = " [SENSITIVE]" if var['sensitive'] else ""
            print(f"  - {var['name']}: {var['type']}{sensitive_mark}")
        
        print(f"\nStatistics:")
        stats = config['statistics']
        print(f"  Total resources: {stats['total_resources']}")
        print(f"  Total variables: {stats['total_variables']}")
        
    except TerraformParserError as e:
        print(f"✗ Parsing failed: {e}")
    finally:
        # Cleanup
        if os.path.exists(temp_file):
            os.remove(temp_file)


def example_parse_gcp_resources():
    """Example: Parse GCP resources"""
    print_section("Example 2: Parse GCP Infrastructure")
    
    sample_tf = """
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
        value = "0.0.0.0/0"
      }
    }
    
    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }
  }
  
  deletion_protection = false
}

resource "google_compute_instance" "web_server" {
  name         = "web-server-01"
  machine_type = "e2-medium"
  zone         = "us-central1-a"
  
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }
  
  network_interface {
    network = "default"
    
    access_config {
      // Ephemeral public IP
    }
  }
  
  tags = ["web", "http-server"]
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}
"""
    
    temp_file = "/tmp/gcp.tf"
    with open(temp_file, 'w') as f:
        f.write(sample_tf)
    
    parser = TerraformParser()
    try:
        config = parser.parse_file(temp_file)
        
        print(f"✓ Parsed GCP infrastructure")
        print(f"\nResources:")
        for resource in config['resources']:
            print(f"\n  {resource['full_name']}")
            print(f"    Type: {resource['resource_type']}")
            print(f"    Cloud: {resource['cloud_provider']}")
            print(f"    Properties: {list(resource['properties'].keys())}")
        
        print(f"\nProviders:")
        for provider in config['providers']:
            print(f"  {provider['name']}")
            print(f"    Region: {provider.get('region', 'N/A')}")
            
    except TerraformParserError as e:
        print(f"✗ Parsing failed: {e}")
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def example_parse_directory():
    """Example: Parse a directory of Terraform files"""
    print_section("Example 3: Parse Directory")
    
    # Create a temporary directory with multiple files
    temp_dir = "/tmp/terraform_example"
    os.makedirs(temp_dir, exist_ok=True)
    
    # main.tf
    with open(f"{temp_dir}/main.tf", 'w') as f:
        f.write("""
resource "aws_instance" "web" {
  ami           = "ami-12345"
  instance_type = "t3.micro"
  
  tags = {
    Name = "Web Server"
  }
}
""")
    
    # variables.tf
    with open(f"{temp_dir}/variables.tf", 'w') as f:
        f.write("""
variable "region" {
  type    = string
  default = "us-west-2"
}

variable "instance_count" {
  type    = number
  default = 1
}
""")
    
    # providers.tf
    with open(f"{temp_dir}/providers.tf", 'w') as f:
        f.write("""
terraform {
  required_version = ">= 1.0"
}

provider "aws" {
  region = var.region
}
""")
    
    parser = TerraformParser()
    try:
        config = parser.parse_directory(temp_dir)
        
        print(f"✓ Parsed directory: {temp_dir}")
        print(f"\nFiles processed: {len(config['source_files'])}")
        for file in config['source_files']:
            print(f"  - {os.path.basename(file)}")
        
        print(f"\nSummary:")
        stats = config['statistics']
        print(f"  Resources: {stats['total_resources']}")
        print(f"  Variables: {stats['total_variables']}")
        print(f"  Providers: {stats['total_providers']}")
        
        if config.get('terraform_version'):
            print(f"\nTerraform version required: {config['terraform_version']}")
        
    except TerraformParserError as e:
        print(f"✗ Parsing failed: {e}")
    finally:
        # Cleanup
        import shutil
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


def example_multi_cloud():
    """Example: Parse multi-cloud infrastructure"""
    print_section("Example 4: Multi-Cloud Infrastructure")
    
    sample_tf = """
# AWS Resources
resource "aws_s3_bucket" "data" {
  bucket = "data-bucket"
}

resource "aws_instance" "app" {
  ami           = "ami-12345"
  instance_type = "t3.micro"
}

# GCP Resources
resource "google_storage_bucket" "backup" {
  name     = "backup-bucket"
  location = "US"
}

resource "google_compute_instance" "worker" {
  name         = "worker-01"
  machine_type = "e2-micro"
  zone         = "us-central1-a"
  
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }
  
  network_interface {
    network = "default"
  }
}

# Azure Resources
resource "azurerm_storage_account" "logs" {
  name                     = "logsstorage"
  resource_group_name      = "rg-logs"
  location                 = "East US"
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
"""
    
    temp_file = "/tmp/multicloud.tf"
    with open(temp_file, 'w') as f:
        f.write(sample_tf)
    
    parser = TerraformParser()
    try:
        config = parser.parse_file(temp_file)
        
        print(f"✓ Parsed multi-cloud infrastructure")
        
        stats = config['statistics']
        print(f"\nCloud Provider Distribution:")
        for provider, count in stats['providers_by_type'].items():
            print(f"  {provider.upper()}: {count} resources")
        
        print(f"\nResources by Type:")
        resource_types = {}
        for resource in config['resources']:
            rt = resource['resource_type'].split('_')[0]
            resource_types[rt] = resource_types.get(rt, 0) + 1
        
        for rt, count in sorted(resource_types.items()):
            print(f"  {rt}: {count}")
        
    except TerraformParserError as e:
        print(f"✗ Parsing failed: {e}")
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def example_security_analysis():
    """Example: Identify security issues"""
    print_section("Example 5: Security Analysis")
    
    sample_tf = """
# Public S3 bucket (Security Risk!)
resource "aws_s3_bucket" "public_data" {
  bucket = "public-data-bucket"
  acl    = "public-read"
}

# Open security group (Security Risk!)
resource "aws_security_group" "web_sg" {
  name = "web-sg"
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Unencrypted database (Security Risk!)
resource "aws_db_instance" "main" {
  identifier           = "main-db"
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  storage_encrypted    = false
  publicly_accessible  = true
}

# Sensitive variables
variable "database_password" {
  type      = string
  sensitive = false  # Should be true!
}

variable "api_key" {
  type = string
}

variable "secret_token" {
  type = string
}
"""
    
    temp_file = "/tmp/security.tf"
    with open(temp_file, 'w') as f:
        f.write(sample_tf)
    
    parser = TerraformParser()
    try:
        config = parser.parse_file(temp_file)
        
        print(f"✓ Analyzing security configuration")
        
        # Check for public resources
        print(f"\n🔍 Security Findings:\n")
        
        issues_found = 0
        
        # Check S3 buckets
        for resource in config['resources']:
            if 'bucket' in resource['resource_type']:
                if resource['properties'].get('acl') in ['public-read', 'public-read-write']:
                    issues_found += 1
                    print(f"  ⚠️  HIGH: {resource['full_name']}")
                    print(f"      Public S3 bucket with ACL: {resource['properties']['acl']}")
                    print()
        
        # Check security groups
        for resource in config['resources']:
            if 'security_group' in resource['resource_type']:
                ingress_rules = resource['properties'].get('ingress', [])
                if not isinstance(ingress_rules, list):
                    ingress_rules = [ingress_rules]
                
                for rule in ingress_rules:
                    if '0.0.0.0/0' in rule.get('cidr_blocks', []):
                        issues_found += 1
                        port = rule.get('from_port')
                        print(f"  ⚠️  HIGH: {resource['full_name']}")
                        print(f"      Security group allows port {port} from 0.0.0.0/0")
                        print()
        
        # Check databases
        for resource in config['resources']:
            if 'database' in resource['resource_type'] or 'db_instance' in resource['resource_type']:
                if not resource['properties'].get('storage_encrypted', False):
                    issues_found += 1
                    print(f"  ⚠️  HIGH: {resource['full_name']}")
                    print(f"      Database does not have encryption enabled")
                    print()
                
                if resource['properties'].get('publicly_accessible', False):
                    issues_found += 1
                    print(f"  ⚠️  CRITICAL: {resource['full_name']}")
                    print(f"      Database is publicly accessible")
                    print()
        
        # Check sensitive variables
        print(f"\n🔐 Sensitive Variables:\n")
        sensitive_patterns = ['password', 'secret', 'token', 'key', 'credential']
        for var in config['variables']:
            if any(pattern in var['name'].lower() for pattern in sensitive_patterns):
                if not var['sensitive']:
                    issues_found += 1
                    print(f"  ⚠️  MEDIUM: Variable '{var['name']}'")
                    print(f"      Should be marked as sensitive = true")
                    print()
        
        print(f"\n{'=' * 80}")
        print(f"Total security issues found: {issues_found}")
        print(f"{'=' * 80}\n")
        
    except TerraformParserError as e:
        print(f"✗ Parsing failed: {e}")
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def main():
    """Run all examples"""
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                 Terraform Parser - Usage Examples                         ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
    """)
    
    try:
        example_parse_file()
        example_parse_gcp_resources()
        example_parse_directory()
        example_multi_cloud()
        example_security_analysis()
        
        print_section("Summary")
        print("✓ All examples completed successfully!")
        print("\nFor more information, see:")
        print("  - parsers/README.md - Full documentation")
        print("  - tests/test_terraform_parser.py - Unit tests")
        print("  - models/terraform.py - Data models")
        print()
        
    except Exception as e:
        print(f"\n✗ Error running examples: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
