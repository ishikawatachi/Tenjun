"""
Unit Tests for Terraform Parser
Tests parsing of GCP, AWS, and multi-cloud Terraform configurations
"""

import os
import json
import pytest
import tempfile
from pathlib import Path

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from parsers.terraform_parser import TerraformParser, TerraformParserError
from models.terraform import Resource, Variable, Provider


class TestTerraformParser:
    """Test suite for TerraformParser"""
    
    @pytest.fixture
    def parser(self):
        """Create parser instance"""
        return TerraformParser()
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test files"""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)
    
    def test_parse_gcp_sql_database(self, parser, temp_dir):
        """Test parsing GCP SQL database instance"""
        tf_content = '''
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
'''
        tf_file = temp_dir / "database.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['resources']) == 1
        resource = result['resources'][0]
        assert resource['resource_type'] == 'google_sql_database_instance'
        assert resource['name'] == 'master'
        assert resource['cloud_provider'] == 'gcp'
        assert resource['properties']['name'] == 'master-instance'
        assert resource['properties']['database_version'] == 'POSTGRES_14'
        assert resource['properties']['region'] == 'us-central1'
        
    def test_parse_gcp_compute_instance(self, parser, temp_dir):
        """Test parsing GCP compute instance"""
        tf_content = '''
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
  
  metadata = {
    ssh-keys = "admin:ssh-rsa AAAAB3..."
  }
  
  tags = ["web", "http-server", "https-server"]
}
'''
        tf_file = temp_dir / "compute.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['resources']) == 1
        resource = result['resources'][0]
        assert resource['resource_type'] == 'google_compute_instance'
        assert resource['name'] == 'web_server'
        assert resource['cloud_provider'] == 'gcp'
        assert resource['properties']['machine_type'] == 'e2-medium'
        assert resource['properties']['zone'] == 'us-central1-a'
        assert 'web' in resource['properties']['tags']
    
    def test_parse_aws_s3_bucket(self, parser, temp_dir):
        """Test parsing AWS S3 bucket"""
        tf_content = '''
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

resource "aws_s3_bucket_versioning" "data_bucket_versioning" {
  bucket = aws_s3_bucket.data_bucket.id
  
  versioning_configuration {
    status = "Enabled"
  }
}
'''
        tf_file = temp_dir / "s3.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['resources']) == 3
        
        # Check S3 bucket
        bucket = next(r for r in result['resources'] if r['name'] == 'data_bucket')
        assert bucket['resource_type'] == 'aws_s3_bucket'
        assert bucket['cloud_provider'] == 'aws'
        assert bucket['properties']['bucket'] == 'my-company-data-bucket'
        
        # Check public access block
        pab = next(r for r in result['resources'] if r['name'] == 'data_bucket_pab')
        assert pab['resource_type'] == 'aws_s3_bucket_public_access_block'
        assert pab['properties']['block_public_acls'] == False  # Security issue!
    
    def test_parse_aws_ec2_instance(self, parser, temp_dir):
        """Test parsing AWS EC2 instance"""
        tf_content = '''
resource "aws_instance" "app_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  subnet_id              = aws_subnet.private.id
  
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }
  
  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y nginx
              EOF
  
  tags = {
    Name = "App Server"
    Role = "Application"
  }
}
'''
        tf_file = temp_dir / "ec2.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['resources']) == 1
        instance = result['resources'][0]
        assert instance['resource_type'] == 'aws_instance'
        assert instance['name'] == 'app_server'
        assert instance['cloud_provider'] == 'aws'
        assert instance['properties']['instance_type'] == 't3.micro'
    
    def test_parse_variables(self, parser, temp_dir):
        """Test parsing variable definitions"""
        tf_content = '''
variable "region" {
  type        = string
  description = "AWS region for resources"
  default     = "us-east-1"
}

variable "instance_count" {
  type        = number
  description = "Number of instances to create"
  default     = 2
  
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "Instance count must be between 1 and 10"
  }
}

variable "database_password" {
  type        = string
  description = "Database admin password"
  sensitive   = true
}

variable "allowed_cidrs" {
  type        = list(string)
  description = "List of allowed CIDR blocks"
  default     = ["10.0.0.0/8"]
}

variable "environment_config" {
  type = object({
    name  = string
    tier  = string
  })
  description = "Environment configuration"
  default = {
    name = "production"
    tier = "standard"
  }
}
'''
        tf_file = temp_dir / "variables.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['variables']) == 5
        
        # Check string variable
        region_var = next(v for v in result['variables'] if v['name'] == 'region')
        # HCL parser may wrap type in ${...}
        assert 'string' in str(region_var['type'])
        assert region_var['default'] == 'us-east-1'
        assert not region_var['sensitive']
        
        # Check number variable with validation
        count_var = next(v for v in result['variables'] if v['name'] == 'instance_count')
        assert 'number' in str(count_var['type'])
        assert count_var['default'] == 2
        assert len(count_var['validation_rules']) > 0
        
        # Check sensitive variable
        password_var = next(v for v in result['variables'] if v['name'] == 'database_password')
        assert password_var['sensitive'] == True
        
        # Check list variable
        cidrs_var = next(v for v in result['variables'] if v['name'] == 'allowed_cidrs')
        assert 'list' in str(cidrs_var['type'])
        assert isinstance(cidrs_var['default'], list)
        
        # Check object variable
        env_var = next(v for v in result['variables'] if v['name'] == 'environment_config')
        assert 'object' in str(env_var['type'])
    
    def test_parse_providers(self, parser, temp_dir):
        """Test parsing provider configurations"""
        tf_content = '''
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"
  
  default_tags {
    tags = {
      Environment = "Production"
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  alias  = "secondary"
  region = "us-east-1"
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}
'''
        tf_file = temp_dir / "providers.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['providers']) >= 2
        assert result['terraform_version'] == '>= 1.0'
        
        # Check AWS provider
        aws_providers = [p for p in result['providers'] if p['name'] == 'aws']
        assert len(aws_providers) >= 1
        
        # Check for aliased provider
        aws_secondary = next((p for p in aws_providers if p.get('alias') == 'secondary'), None)
        if aws_secondary:
            assert aws_secondary['region'] == 'us-east-1'
        
        # Check Google provider
        gcp_provider = next((p for p in result['providers'] if p['name'] == 'google'), None)
        if gcp_provider:
            assert gcp_provider['configuration'].get('project') == 'my-gcp-project'
    
    def test_parse_data_sources(self, parser, temp_dir):
        """Test parsing data sources"""
        tf_content = '''
data "aws_ami" "ubuntu" {
  most_recent = true
  
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  
  owners = ["099720109477"]
}

data "google_compute_image" "debian" {
  family  = "debian-11"
  project = "debian-cloud"
}
'''
        tf_file = temp_dir / "data.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['data_sources']) == 2
        
        # Check AWS AMI data source
        ami_data = next(d for d in result['data_sources'] if d['name'] == 'ubuntu')
        assert ami_data['data_type'] == 'aws_ami'
        assert ami_data['properties']['most_recent'] == True
        
        # Check GCP image data source
        image_data = next(d for d in result['data_sources'] if d['name'] == 'debian')
        assert image_data['data_type'] == 'google_compute_image'
    
    def test_parse_modules(self, parser, temp_dir):
        """Test parsing module references"""
        tf_content = '''
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "3.14.0"
  
  name = "my-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["us-west-2a", "us-west-2b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
}

module "security_group" {
  source = "./modules/security-group"
  
  name        = "app-sg"
  description = "Security group for application"
  vpc_id      = module.vpc.vpc_id
  
  ingress_rules = ["http-80-tcp", "https-443-tcp"]
}
'''
        tf_file = temp_dir / "modules.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['modules']) == 2
        
        # Check VPC module (from registry)
        vpc_module = next(m for m in result['modules'] if m['name'] == 'vpc')
        assert vpc_module['source'] == 'terraform-aws-modules/vpc/aws'
        assert vpc_module['version'] == '3.14.0'
        assert vpc_module['inputs']['name'] == 'my-vpc'
        
        # Check security group module (local)
        sg_module = next(m for m in result['modules'] if m['name'] == 'security_group')
        assert sg_module['source'] == './modules/security-group'
        assert sg_module['version'] is None
    
    def test_parse_directory(self, parser, temp_dir):
        """Test parsing multiple files in a directory"""
        # Create multiple .tf files
        (temp_dir / "main.tf").write_text('''
resource "aws_instance" "web" {
  ami           = "ami-12345"
  instance_type = "t2.micro"
}
''')
        
        (temp_dir / "variables.tf").write_text('''
variable "region" {
  type    = string
  default = "us-west-2"
}
''')
        
        (temp_dir / "providers.tf").write_text('''
provider "aws" {
  region = var.region
}
''')
        
        result = parser.parse_directory(str(temp_dir))
        
        assert len(result['resources']) == 1
        assert len(result['variables']) == 1
        assert len(result['providers']) >= 1
        assert len(result['source_files']) == 3
        
        # Check statistics
        stats = result['statistics']
        assert stats['total_resources'] == 1
        assert stats['total_variables'] == 1
    
    def test_parse_invalid_file(self, parser, temp_dir):
        """Test error handling for invalid HCL"""
        tf_file = temp_dir / "invalid.tf"
        tf_file.write_text("this is not valid HCL {{{")
        
        with pytest.raises(TerraformParserError) as exc_info:
            parser.parse_file(str(tf_file))
        
        assert "parsing error" in str(exc_info.value).lower()
    
    def test_parse_nonexistent_file(self, parser):
        """Test error handling for missing file"""
        with pytest.raises(TerraformParserError) as exc_info:
            parser.parse_file("/nonexistent/file.tf")
        
        assert "not found" in str(exc_info.value).lower()
    
    def test_parse_unsupported_extension(self, parser, temp_dir):
        """Test error handling for unsupported file extension"""
        txt_file = temp_dir / "config.txt"
        txt_file.write_text("resource 'test' {}")
        
        with pytest.raises(TerraformParserError) as exc_info:
            parser.parse_file(str(txt_file))
        
        assert "unsupported" in str(exc_info.value).lower()
    
    def test_resource_depends_on(self, parser, temp_dir):
        """Test parsing resource dependencies"""
        tf_content = '''
resource "aws_instance" "web" {
  ami           = "ami-12345"
  instance_type = "t2.micro"
}

resource "aws_eip" "web_ip" {
  instance   = aws_instance.web.id
  depends_on = [aws_instance.web]
}
'''
        tf_file = temp_dir / "depends.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        eip = next(r for r in result['resources'] if r['name'] == 'web_ip')
        # HCL parser may wrap references in ${...}
        assert len(eip['depends_on']) > 0
        assert 'aws_instance.web' in str(eip['depends_on'][0])
    
    def test_multi_cloud_statistics(self, parser, temp_dir):
        """Test statistics for multi-cloud deployment"""
        tf_content = '''
resource "aws_s3_bucket" "data" {
  bucket = "data-bucket"
}

resource "google_storage_bucket" "backup" {
  name     = "backup-bucket"
  location = "US"
}

resource "azurerm_storage_account" "logs" {
  name                     = "logsstorage"
  resource_group_name      = "rg-logs"
  location                 = "East US"
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
'''
        tf_file = temp_dir / "multicloud.tf"
        tf_file.write_text(tf_content)
        
        result = parser.parse_file(str(tf_file))
        
        assert len(result['resources']) == 3
        
        # Check provider breakdown
        stats = result['statistics']
        providers = stats['providers_by_type']
        assert providers.get('aws', 0) >= 1
        assert providers.get('gcp', 0) >= 1
        assert providers.get('azure', 0) >= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
