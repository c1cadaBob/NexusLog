# NexusLog - 可观测性模块
# 管理 Prometheus、Grafana、Jaeger 等可观测性基础设施

variable "project_name" {
  description = "项目名称"
  type        = string
  default     = "nexuslog"
}

variable "environment" {
  description = "部署环境 (dev/staging/prod)"
  type        = string
}

variable "prometheus" {
  description = "Prometheus 配置"
  type = object({
    retention_days = number
    storage_size   = number
  })
  default = {
    retention_days = 30
    storage_size   = 50
  }
}

variable "grafana" {
  description = "Grafana 配置"
  type = object({
    admin_password = string
  })
  default = {
    admin_password = "changeme"
  }
  sensitive = true
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

output "prometheus_retention_days" {
  value = var.prometheus.retention_days
}
