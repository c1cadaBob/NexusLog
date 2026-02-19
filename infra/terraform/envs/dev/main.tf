# NexusLog - 开发环境 Terraform 配置

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
  environment = "dev"
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
  vpc_cidr    = "10.10.0.0/16"
  tags        = local.tags
}

module "kubernetes" {
  source             = "../../modules/kubernetes"
  environment        = local.environment
  kubernetes_version = "1.28"
  node_groups = {
    system = {
      instance_type = "t3.medium"
      min_size      = 1
      max_size      = 2
      desired_size  = 1
      labels        = { role = "system" }
    }
    application = {
      instance_type = "t3.medium"
      min_size      = 1
      max_size      = 3
      desired_size  = 2
      labels        = { role = "application" }
    }
  }
  tags = local.tags
}

module "storage" {
  source      = "../../modules/storage"
  environment = local.environment
  elasticsearch = {
    version        = "8.13"
    instance_type  = "t3.medium"
    instance_count = 1
    volume_size    = 20
  }
  postgresql = {
    version        = "16"
    instance_class = "db.t3.medium"
    storage_size   = 20
    multi_az       = false
  }
  redis = {
    version    = "7.2"
    node_type  = "cache.t3.small"
    num_shards = 1
    replicas   = 0
  }
  tags = local.tags
}

module "observability" {
  source      = "../../modules/observability"
  environment = local.environment
  prometheus = {
    retention_days = 7
    storage_size   = 10
  }
  tags = local.tags
}
