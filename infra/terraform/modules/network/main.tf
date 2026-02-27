# NexusLog - 网络模块
# 创建 VPC、子网、安全组等网络基础设施

variable "project_name" {
  description = "项目名称"
  type        = string
  default     = "nexuslog"
}

variable "environment" {
  description = "部署环境 (dev/staging/prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR 地址块"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "可用区列表"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "私有子网 CIDR 列表"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "公有子网 CIDR 列表"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
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

output "vpc_cidr" {
  description = "VPC CIDR"
  value       = var.vpc_cidr
}

output "private_subnet_cidrs" {
  description = "私有子网 CIDR 列表"
  value       = var.private_subnet_cidrs
}

output "public_subnet_cidrs" {
  description = "公有子网 CIDR 列表"
  value       = var.public_subnet_cidrs
}
