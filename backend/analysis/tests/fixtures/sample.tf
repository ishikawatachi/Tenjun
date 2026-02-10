# Sample Terraform Configuration for Testing

# Provider configuration
provider "aws" {
  region = var.region
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}

# Variables
variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-west-2"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "development"
}

variable "database_password" {
  type        = string
  description = "Database admin password"
  sensitive   = true
}

# AWS Resources
resource "aws_s3_bucket" "data_bucket" {
  bucket = "my-company-data-bucket"
  
  tags = {
    Name        = "Data Bucket"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "data_bucket_pab" {
  bucket = aws_s3_bucket.data_bucket.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  
  root_block_device {
    volume_size = 20
    encrypted   = true
  }
  
  tags = {
    Name = "Web Server"
    Role = "Frontend"
  }
}

resource "aws_security_group" "web_sg" {
  name        = "web-security-group"
  description = "Security group for web servers"
  
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# GCP Resources
resource "google_sql_database_instance" "postgres" {
  name             = "postgres-instance"
  database_version = "POSTGRES_14"
  region           = "us-central1"
  
  settings {
    tier = "db-f1-micro"
    
    ip_configuration {
      ipv4_enabled = true
      
      authorized_networks {
        name  = "office-network"
        value = "203.0.113.0/24"
      }
    }
    
    backup_configuration {
      enabled            = true
      start_time         = "03:00"
      point_in_time_recovery_enabled = true
    }
  }
  
  deletion_protection = true
}

resource "google_compute_instance" "app_server" {
  name         = "app-server-01"
  machine_type = "e2-medium"
  zone         = "us-central1-a"
  
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
      size  = 20
    }
  }
  
  network_interface {
    network = "default"
    
    # No access_config - no public IP
  }
  
  metadata = {
    enable-oslogin = "TRUE"
  }
  
  tags = ["app-server", "backend"]
}

# Outputs
output "bucket_name" {
  value       = aws_s3_bucket.data_bucket.bucket
  description = "Name of the S3 bucket"
}

output "database_endpoint" {
  value       = google_sql_database_instance.postgres.connection_name
  description = "PostgreSQL connection endpoint"
  sensitive   = true
}
