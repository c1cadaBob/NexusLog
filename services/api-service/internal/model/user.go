package model

// CreateUserRequest defines request payload for POST /api/v1/users.
type CreateUserRequest struct {
	Username    string  `json:"username"`
	Password    string  `json:"password"`
	Email       string  `json:"email"`
	DisplayName string  `json:"display_name"`
	RoleID      *string `json:"role_id,omitempty"`
}

// UpdateUserRequest defines request payload for PUT /api/v1/users/:id.
type UpdateUserRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	Email       *string `json:"email,omitempty"`
	Status      *string `json:"status,omitempty"`
}

// ListUsersFilter defines query params for GET /api/v1/users.
type ListUsersFilter struct {
	Query  string
	Status string
	RoleID string
}

// BatchUpdateUsersStatusRequest defines request payload for POST /api/v1/users/batch/status.
type BatchUpdateUsersStatusRequest struct {
	UserIDs []string `json:"user_ids"`
	Status  string   `json:"status"`
}

// BatchUpdateUsersStatusResponseData defines successful batch status update response.
type BatchUpdateUsersStatusResponseData struct {
	Requested int    `json:"requested"`
	Updated   int    `json:"updated"`
	Status    string `json:"status"`
}

// AssignRoleRequest defines request payload for POST /api/v1/users/:id/roles.
type AssignRoleRequest struct {
	RoleID string `json:"role_id"`
}

// UserData defines user in list/detail response.
type UserData struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email"`
	DisplayName string     `json:"display_name"`
	Status      string     `json:"status"`
	LastLoginAt *string    `json:"last_login_at,omitempty"`
	CreatedAt   string     `json:"created_at"`
	UpdatedAt   string     `json:"updated_at"`
	Roles       []RoleData `json:"roles,omitempty"`
}

// RoleData defines role in response.
type RoleData struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// ListUsersResponseData defines successful list users response.
type ListUsersResponseData struct {
	Users []UserData `json:"users"`
	Total int        `json:"total"`
	Page  int        `json:"page"`
	Limit int        `json:"limit"`
}

// CreateUserResponseData defines successful create user response.
type CreateUserResponseData struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// GetMeResponseData defines response for GET /users/me (user + roles + permissions).
type GetMeResponseData struct {
	User        UserData   `json:"user"`
	Roles       []RoleData `json:"roles"`
	Permissions []string   `json:"permissions"`
}
