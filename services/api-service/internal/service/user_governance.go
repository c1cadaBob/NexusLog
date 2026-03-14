package service

import (
	"strings"

	"github.com/nexuslog/api-service/internal/repository"
)

const (
	reservedUsernameSuperAdmin        = "sys-superadmin"
	reservedUsernameSystemAutomation  = "system-automation"
	protectedRoleNameSuperAdmin       = "super_admin"
	protectedRoleNameSystemAutomation = "system_automation"
)

func isReservedUsername(username string) bool {
	switch strings.ToLower(strings.TrimSpace(username)) {
	case reservedUsernameSuperAdmin, reservedUsernameSystemAutomation:
		return true
	default:
		return false
	}
}

func isProtectedRoleName(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case protectedRoleNameSuperAdmin, protectedRoleNameSystemAutomation:
		return true
	default:
		return false
	}
}

func isProtectedRole(role repository.RoleRecord) bool {
	return isProtectedRoleName(role.Name)
}

func isProtectedUser(user repository.UserRecord) bool {
	return isReservedUsername(user.Username)
}
