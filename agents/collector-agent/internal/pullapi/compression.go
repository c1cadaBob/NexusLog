package pullapi

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
)

const (
	compressionThreshold = 1024 // skip gzip for payloads < 1KB
	gzipLevel            = gzip.BestSpeed
)

var gzipBufPool = sync.Pool{
	New: func() any {
		return new(bytes.Buffer)
	},
}

// writeJSONCompressed writes a JSON payload, applying gzip compression if:
// 1. The client sends Accept-Encoding: gzip
// 2. The serialized payload is >= compressionThreshold (1KB)
func writeJSONCompressed(w http.ResponseWriter, status int, payload any, r *http.Request) {
	data, err := json.Marshal(payload)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"code":"INTERNAL_ERROR","message":"json marshal failed"}`))
		return
	}

	acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
	if !acceptsGzip || len(data) < compressionThreshold {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(data)
		return
	}

	buf := gzipBufPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer gzipBufPool.Put(buf)

	gz, _ := gzip.NewWriterLevel(buf, gzipLevel)
	if _, err := gz.Write(data); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(data)
		return
	}
	if err := gz.Close(); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(data)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Encoding", "gzip")
	w.Header().Set("X-Compression", "gzip")
	w.Header().Set("X-Original-Size", intToStr(len(data)))
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

func intToStr(n int) string {
	return json.Number(json.Number(itoa(n))).String()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 20)
	for n > 0 {
		buf = append(buf, byte('0'+n%10))
		n /= 10
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}
