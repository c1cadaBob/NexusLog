# NexusLog - 存储模块
# 管理 Elasticsearch、PostgreSQL、Redis、MinIO 等存储资源

variable "project_name" {
  description = "项目名称"
  type        = string
  default     = "nexuslog"
}

variable "environment" {
  description = "部署环境 (dev/staging/prod)"
  type        = string
}

variable "elasticsearch" {
  description = "Elasticsearch 配置"
  type = object({
    version       = string
    instance_type = string
    instance_count = number
    volume_size   = number
  })
  default = {
    version        = "8.13"
    instance_type  = "r5.large"
    instance_count = 3
    volume_size    = 100
  }
}

variable "postgresql" {
  description = "PostgreSQL 配置"
  type = object({
    version        = string
    instance_class = string
    storage_size   = number
    multi_az       = bool
  })
  default = {
    version        = "16"
    instance_class = "db.r5.large"
    storage_size   = 100
    multi_az       = true
  }
}

variable "redis" {
  description = "Redis 配置"
  type = object({
    version       = string
    node_type     = string
    num_shards    = number
    replicas      = number
  })
  default = {
    version    = "7.2"
    node_type  = "cache.r5.large"
    num_shards = 3
    replicas   = 1
  }
}

variable "tags" {
  description = "资源标签"
  type        = map(string)
  default     = {}
}

locals {
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

output "elasticsearch_version" {
  value = var.elasticsearch.version
}

output "postgresql_version" {
  value = var.postgresql.version
}

output "redis_version" {
  value = var.redis.version
}
