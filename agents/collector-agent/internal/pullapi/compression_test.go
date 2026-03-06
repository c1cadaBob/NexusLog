package pullapi

import (
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteJSONCompressed_SmallPayload(t *testing.T) {
	payload := map[string]string{"msg": "hello"}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	writeJSONCompressed(w, http.StatusOK, payload, req)

	if w.Header().Get("Content-Encoding") == "gzip" {
		t.Error("small payload should not be gzip compressed")
	}
	if w.Header().Get("X-Compression") != "" {
		t.Error("X-Compression should not be set for small payload")
	}
	var result map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if result["msg"] != "hello" {
		t.Errorf("msg = %q, want hello", result["msg"])
	}
}

func TestWriteJSONCompressed_LargePayload(t *testing.T) {
	records := make([]map[string]string, 50)
	for i := range records {
		records[i] = map[string]string{
			"data":   strings.Repeat("x", 100),
			"source": "/var/log/app.log",
		}
	}
	payload := map[string]any{"records": records}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	writeJSONCompressed(w, http.StatusOK, payload, req)

	if w.Header().Get("Content-Encoding") != "gzip" {
		t.Fatal("large payload should be gzip compressed")
	}
	if w.Header().Get("X-Compression") != "gzip" {
		t.Error("X-Compression header should be 'gzip'")
	}
	origSize := w.Header().Get("X-Original-Size")
	if origSize == "" {
		t.Error("X-Original-Size should be set")
	}

	gz, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatalf("gzip reader: %v", err)
	}
	defer gz.Close()
	decoded, err := io.ReadAll(gz)
	if err != nil {
		t.Fatalf("decompress: %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal(decoded, &result); err != nil {
		t.Fatalf("unmarshal decompressed: %v", err)
	}
	recs := result["records"].([]any)
	if len(recs) != 50 {
		t.Errorf("records count = %d, want 50", len(recs))
	}

	if len(w.Body.Bytes()) >= len(decoded) {
		t.Errorf("compressed (%d) should be smaller than original (%d)", len(w.Body.Bytes()), len(decoded))
	}
}

func TestWriteJSONCompressed_NoAcceptEncoding(t *testing.T) {
	records := make([]map[string]string, 50)
	for i := range records {
		records[i] = map[string]string{"data": strings.Repeat("x", 100)}
	}
	payload := map[string]any{"records": records}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	writeJSONCompressed(w, http.StatusOK, payload, req)

	if w.Header().Get("Content-Encoding") == "gzip" {
		t.Error("should not compress without Accept-Encoding: gzip")
	}
}

func TestWriteJSONCompressed_EmptyPayload(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	writeJSONCompressed(w, http.StatusOK, map[string]any{}, req)

	if w.Header().Get("Content-Encoding") == "gzip" {
		t.Error("empty payload should not be compressed")
	}
}

func BenchmarkWriteJSONCompressed(b *testing.B) {
	records := make([]map[string]string, 100)
	for i := range records {
		records[i] = map[string]string{
			"data":   strings.Repeat("log line content ", 10),
			"source": "/var/log/app.log",
		}
	}
	payload := map[string]any{"records": records}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Encoding", "gzip")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		writeJSONCompressed(w, http.StatusOK, payload, req)
	}
}
