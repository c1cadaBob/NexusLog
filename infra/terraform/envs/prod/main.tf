# NexusLog - 生产环境 Terraform 配置

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

locals {
  environment = "prod"
  project     = "nexuslog"
  tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

module "networking" {
  source      = "../../modules/networking"
  environment = local.environment
  vpc_cidr    = "10.30.0.0/16"
  tags        = local.tags
}

module "kubernetes" {
  source             = "../../modules/kubernetes"
  environment        = local.environment
  kubernetes_version = "1.28"
  node_groups = {
    system = {
      instance_type = "t3.medium"
      min_size      = 2
      max_size      = 4
      desired_size  = 2
      labels        = { role = "system" }
    }
    application = {
      instance_type = "t3.large"
      min_size      = 3
      max_size      = 10
      desired_size  = 3
      labels        = { role = "application" }
    }
    data = {
      instance_type = "r5.xlarge"
      min_size      = 3
      max_size      = 6
      desired_size  = 3
      labels        = { role = "data" }
    }
  }
  tags = local.tags
}

module "storage" {
  source      = "../../modules/storage"
  environment = local.environment
  elasticsearch = {
    version        = "8.13"
    instance_type  = "r5.xlarge"
    instance_count = 3
    volume_size    = 200
  }
  postgresql = {
    version        = "16"
    instance_class = "db.r5.xlarge"
    storage_size   = 200
    multi_az       = true
  }
  redis = {
    version    = "7.2"
    node_type  = "cache.r5.xlarge"
    num_shards = 3
    replicas   = 1
  }
  tags = local.tags
}

module "observability" {
  source      = "../../modules/observability"
  environment = local.environment
  prometheus = {
    retention_days = 30
    storage_size   = 100
  }
  tags = local.tags
}
