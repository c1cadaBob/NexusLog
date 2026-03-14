package model

import (
	"net/http"
	"testing"
)

func TestNormalizeAPIErrorNilFallback(t *testing.T) {
	err := NormalizeAPIError(nil)
	if err == nil {
		t.Fatalf("expected non-nil normalized error")
	}
	if err.HTTPStatus != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", err.HTTPStatus)
	}
	if err.Code != ErrorCodeInternalError {
		t.Fatalf("expected %s, got %s", ErrorCodeInternalError, err.Code)
	}
	if err.Message == "" {
		t.Fatalf("expected default message")
	}
	if err.Details == nil {
		t.Fatalf("expected non-nil details map")
	}
}

func TestNormalizeAPIErrorUseCatalogStatusAndMessage(t *testing.T) {
	in := &APIError{
		HTTPStatus: http.StatusInternalServerError,
		Code:       ErrorCodeAuthLoginInvalidCredentials,
	}
	out := NormalizeAPIError(in)

	if out.HTTPStatus != http.StatusUnauthorized {
		t.Fatalf("expected 401 from catalog mapping, got %d", out.HTTPStatus)
	}
	if out.Message != "username or password is incorrect" {
		t.Fatalf("unexpected default message: %q", out.Message)
	}
	if out.Details == nil {
		t.Fatalf("expected non-nil details map")
	}
}

func TestAuthErrorCatalogCoverage(t *testing.T) {
	catalog := AuthErrorCatalog()
	if len(catalog) < 33 {
		t.Fatalf("unexpected catalog size: %d", len(catalog))
	}

	cases := []string{
		ErrorCodeAuthRegisterInvalidArgument,
		ErrorCodeAuthRegisterRateLimited,
		ErrorCodeAuthLoginInvalidCredentials,
		ErrorCodeAuthLoginRateLimited,
		ErrorCodeAuthRefreshInvalidToken,
		ErrorCodeAuthLogoutInvalidToken,
		ErrorCodeAuthResetRequestRateLimited,
		ErrorCodeAuthResetRequestInternalError,
		ErrorCodeAuthResetConfirmInvalidToken,
	}
	for _, code := range cases {
		status, ok := catalog[code]
		if !ok {
			t.Fatalf("missing catalog entry for %s", code)
		}
		if status <= 0 {
			t.Fatalf("invalid status for %s: %d", code, status)
		}
	}
}
