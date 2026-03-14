package httpguard

import (
	"bytes"
	"errors"
	"testing"
)

func TestReadLimitedBody_AllowsBodyWithinLimit(t *testing.T) {
	body, err := ReadLimitedBody(bytes.NewBufferString("ok"), 2)
	if err != nil {
		t.Fatalf("ReadLimitedBody() error = %v", err)
	}
	if string(body) != "ok" {
		t.Fatalf("ReadLimitedBody() = %q, want ok", string(body))
	}
}

func TestReadLimitedBody_RejectsOversizedBody(t *testing.T) {
	_, err := ReadLimitedBody(bytes.NewBufferString("toolarge"), 4)
	if !errors.Is(err, ErrResponseBodyTooLarge) {
		t.Fatalf("ReadLimitedBody() error = %v, want ErrResponseBodyTooLarge", err)
	}
}
