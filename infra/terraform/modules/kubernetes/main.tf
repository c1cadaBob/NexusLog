# NexusLog - Kubernetes 集群模块
# 创建 Kubernetes 集群及节点组

variable "project_name" {
  description = "项目名称"
  type        = string
  default     = "nexuslog"
}

variable "environment" {
  description = "部署环境 (dev/staging/prod)"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes 版本"
  type        = string
  default     = "1.28"
}

variable "node_groups" {
  description = "节点组配置"
  type = map(object({
    instance_type = string
    min_size      = number
    max_size      = number
    desired_size  = number
    labels        = map(string)
  }))
  default = {
    system = {
      instance_type = "t3.medium"
      min_size      = 2
      max_size      = 4
      desired_size  = 2
      labels        = { role = "system" }
    }
    application = {
      instance_type = "t3.large"
      min_size      = 2
      max_size      = 8
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
}

variable "tags" {
  description = "资源标签"
  type        = map(string)
  default     = {}
}

locals {
  cluster_name = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

output "cluster_name" {
  description = "Kubernetes 集群名称"
  value       = local.cluster_name
}

output "kubernetes_version" {
  description = "Kubernetes 版本"
  value       = var.kubernetes_version
}
