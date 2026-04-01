package notification

import (
	"context"
	"encoding/json"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestChannelRepository_UpdateChannel_UsesIDThenTenantArgs(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewChannelRepository(db)
	ctx := context.Background()
	tenantID := "10000000-0000-0000-0000-000000000001"
	channelID := "30000000-0000-0000-0000-000000000001"
	now := time.Now().UTC()
	name := "updated-channel"
	enabled := true
	config := json.RawMessage(`{"smtp_host":"smtp.163.com","smtp_port":587,"from_email":"ops@example.com","recipients":["ops@example.com"],"use_tls":true}`)

	mock.ExpectQuery("FROM notification_channels").
		WithArgs(channelID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_by", "created_at", "updated_at"}).
			AddRow(channelID, tenantID, "original-channel", "email", []byte(`{"smtp_host":"smtp.163.com"}`), true, "user-1", now.Add(-time.Hour), now.Add(-30*time.Minute)))

	mock.ExpectQuery(regexp.QuoteMeta(`
	UPDATE notification_channels
	SET updated_at = now(), name = $3, config = $4, enabled = $5
	WHERE id = $1::uuid AND tenant_id = $2::uuid
	RETURNING id::text, tenant_id::text, name, type, config, enabled, created_by::text, created_at, updated_at
	`)).
		WithArgs(channelID, tenantID, name, config, enabled).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_by", "created_at", "updated_at"}).
			AddRow(channelID, tenantID, name, "email", config, true, "user-1", now.Add(-time.Hour), now))

	updated, err := repo.UpdateChannel(ctx, tenantID, channelID, &name, &config, &enabled)
	if err != nil {
		t.Fatalf("UpdateChannel() error = %v", err)
	}
	if updated.ID != channelID {
		t.Fatalf("expected channel id %s, got %s", channelID, updated.ID)
	}
	if updated.TenantID != tenantID {
		t.Fatalf("expected tenant id %s, got %s", tenantID, updated.TenantID)
	}
	if updated.Name != name {
		t.Fatalf("expected name %s, got %s", name, updated.Name)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
