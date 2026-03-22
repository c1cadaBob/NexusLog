package repository

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	sharedauth "github.com/nexuslog/data-services/shared/auth"
)

func TestBuildESQuery_UsesStructuredV2FieldsAndFilterAliases(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{
		TenantID: "tenant-a",
		Keywords: "dnf.exceptions.RepoError",
		Filters: map[string]any{
			"level":      "error",
			"service":    "keycloak",
			"agent_id":   "agent-1",
			"batch_id":   "batch-1",
			"statusCode": 500,
			"traceId":    "trace-1",
			"spanId":     "span-1",
		},
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)

	assertContainsAll(t, encoded, []string{
		`"message^3"`,
		`"event.original"`,
		`"error.message^2"`,
		`"error.stack_trace"`,
		`"service.name^2"`,
		`"service.instance.id"`,
		`"container.name"`,
		`"log.file.path"`,
		`"source.path"`,
		`"agent.id"`,
		`"event.record_id"`,
		`"nexuslog.transport.batch_id"`,
		`"trace.id"`,
		`"span.id"`,
		`"request.id"`,
	})

	assertContainsAll(t, encoded, []string{
		`"log.level":"error"`,
		`"service.name":"keycloak"`,
		`"value":"*/keycloak"`,
		`"agent.id":"agent-1"`,
		`"nexuslog.transport.batch_id":"batch-1"`,
		`"http.response.status_code":500`,
		`"trace.id":"trace-1"`,
		`"span.id":"span-1"`,
	})
}

func TestBuildESQuery_TreatsKeywordsAsLiteralTextAndDropsUnknownFilters(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{
		TenantID: "tenant-a",
		Keywords: `error OR *`,
		Filters: map[string]any{
			"unknown.field": "boom",
			"service":       `key*cloak?`,
		},
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)
	if !strings.Contains(encoded, `"multi_match"`) {
		t.Fatalf("expected multi_match query, got %s", encoded)
	}
	if strings.Contains(encoded, `"simple_query_string"`) {
		t.Fatalf("unexpected simple_query_string in %s", encoded)
	}
	if strings.Contains(encoded, `unknown.field`) {
		t.Fatalf("unexpected unknown filter field in %s", encoded)
	}
	if !strings.Contains(encoded, `"value":"*/keycloak"`) {
		t.Fatalf("expected sanitized wildcard value, got %s", encoded)
	}
	if strings.Contains(encoded, `"value":"*/key*cloak?"`) {
		t.Fatalf("unexpected wildcard metacharacters in wildcard clause: %s", encoded)
	}
}

func TestBuildESQuery_UsesHostCompatibilityFilterAlias(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{
		TenantID: "tenant-a",
		Filters: map[string]any{
			"host": "dev-server-centos8",
		},
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)

	assertContainsAll(t, encoded, []string{
		`"host.name":"dev-server-centos8"`,
		`"hostname":"dev-server-centos8"`,
		`"syslog_hostname":"dev-server-centos8"`,
		`"server_id":"dev-server-centos8"`,
		`"agent.hostname":"dev-server-centos8"`,
	})
}

func TestBuildESQuery_ExcludesRealtimeInternalNoiseWhenRequested(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{
		TenantID: "tenant-a",
		Filters: map[string]any{
			"exclude_internal_noise": true,
		},
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)

	assertContainsAll(t, encoded, []string{
		`"must_not"`,
		`"/api/v1/query/logs"`,
		`"/api/v1/query/stats/aggregate"`,
		`"/api/v1/query/stats/overview"`,
		`"/metrics"`,
		`"GET \"/healthz\""`,
		`"GET \"/readyz\""`,
		`"POST /_bulk?timeout=1m HTTP/1.1"`,
		`"GET /_cluster/health HTTP/1.1"`,
		`"ingest scheduler created task"`,
		`"kafka_producer.go:153: 发送"`,
		`"GET /subjects HTTP/1.1"`,
		`"Processing srvr command from"`,
		`"kafka_exporter.go:678]"`,
		`"Leader imbalance ratio for broker"`,
		`"Topics not in preferred replica for broker"`,
		`"Checking need to trigger auto leader balancing"`,
		`"Processing automatic preferred replica leader election"`,
		`"Triggering checkpoint"`,
		`"Completed checkpoint"`,
		`"Marking checkpoint"`,
		`"checkpoint complete:"`,
		`"Name collision: Group already contains a Metric with the name 'pendingCommittables'"`,
		`"run-docker-runtime"`,
		`"Succeeded."`,
		`"chronyd["`,
		`"Selected source"`,
		`"Detected falseticker"`,
		`"comm=\"iptables\""`,
		`"type=NETFILTER_CFG"`,
		`"type=SYSCALL"`,
		`"type=PROCTITLE"`,
		`"comm=\"dockerd\""`,
		`"type=ANOM_PROMISCUOUS"`,
	})
}

func TestBuildESQuery_UsesMatchNoneWhenTenantMissing(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{Keywords: "error"})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)
	if !strings.Contains(encoded, `"match_none"`) {
		t.Fatalf("expected match_none query, got %s", encoded)
	}
	if strings.Contains(encoded, `"tenant_id"`) {
		t.Fatalf("unexpected tenant filter in %s", encoded)
	}
}

func TestBuildESQuery_SkipsTenantFilterWhenBypassEnabled(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{
		TenantID:        "tenant-a",
		TenantReadScope: sharedauth.TenantReadScopeAllTenants,
		Keywords:        "error",
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)
	if strings.Contains(encoded, `"tenant_id":"tenant-a"`) {
		t.Fatalf("unexpected tenant filter in %s", encoded)
	}
	if strings.Contains(encoded, `"nexuslog.governance.tenant_id":"tenant-a"`) {
		t.Fatalf("unexpected governance tenant filter in %s", encoded)
	}
	if strings.Contains(encoded, `"match_none"`) {
		t.Fatalf("unexpected match_none query in %s", encoded)
	}
	if !strings.Contains(encoded, `"multi_match"`) {
		t.Fatalf("expected keyword query to remain intact, got %s", encoded)
	}
}

func TestBuildESQuery_UsesAuthorizedTenantSetWhenPresent(t *testing.T) {
	query := BuildESQuery(SearchLogsInput{
		TenantReadScope:     sharedauth.TenantReadScopeTenant,
		AuthorizedTenantIDs: []string{"tenant-b", "tenant-a", "tenant-b"},
		Keywords:            "error",
	})

	raw, err := json.Marshal(query)
	if err != nil {
		t.Fatalf("marshal query failed: %v", err)
	}
	encoded := string(raw)
	assertContainsAll(t, encoded, []string{
		`"terms":{"tenant_id":["tenant-a","tenant-b"]}`,
		`"terms":{"nexuslog.governance.tenant_id":["tenant-a","tenant-b"]}`,
	})
	if strings.Contains(encoded, `"match_none"`) {
		t.Fatalf("unexpected match_none query in %s", encoded)
	}
}

func TestNormalizeFilterField_MapsFrontendAliasesToV2Fields(t *testing.T) {
	tests := map[string]string{
		"level":      "log.level",
		"host":       "host.name",
		"service":    "service.name",
		"source":     "source.path",
		"agent_id":   "agent.id",
		"batch_id":   "nexuslog.transport.batch_id",
		"traceId":    "trace.id",
		"spanId":     "span.id",
		"statusCode": "http.response.status_code",
	}

	for input, want := range tests {
		if got := normalizeFilterField(input); got != want {
			t.Fatalf("normalizeFilterField(%q)=%q, want %q", input, got, want)
		}
	}
}

func TestBuildESSort_AppendsStableTieBreakers(t *testing.T) {
	sorts := buildESSort([]SortField{{Field: "@timestamp", Order: "desc"}})
	wantFields := []string{"@timestamp", "nexuslog.ingest.received_at", "event.sequence", "log.offset", "source.path", "event.id"}
	if len(sorts) != len(wantFields) {
		t.Fatalf("buildESSort returned %d clauses, want %d", len(sorts), len(wantFields))
	}

	for index, field := range wantFields {
		options := sortOptions(t, sorts[index], field)
		wantOrder := "desc"
		if field == "source.path" {
			wantOrder = "asc"
		}
		if got := options["order"]; got != wantOrder {
			t.Fatalf("sort[%d] order=%v, want %s", index, got, wantOrder)
		}
		if got := options["missing"]; got != "_last" {
			t.Fatalf("sort[%d] missing=%v, want _last", index, got)
		}
	}

	if got := sortOptions(t, sorts[0], "@timestamp")["unmapped_type"]; got != "date" {
		t.Fatalf("@timestamp unmapped_type=%v, want date", got)
	}
	if got := sortOptions(t, sorts[1], "nexuslog.ingest.received_at")["unmapped_type"]; got != "date" {
		t.Fatalf("nexuslog.ingest.received_at unmapped_type=%v, want date", got)
	}
	if got := sortOptions(t, sorts[2], "event.sequence")["unmapped_type"]; got != "long" {
		t.Fatalf("event.sequence unmapped_type=%v, want long", got)
	}
	if got := sortOptions(t, sorts[3], "log.offset")["unmapped_type"]; got != "long" {
		t.Fatalf("log.offset unmapped_type=%v, want long", got)
	}
	if got := sortOptions(t, sorts[4], "source.path")["unmapped_type"]; got != "keyword" {
		t.Fatalf("source.path unmapped_type=%v, want keyword", got)
	}
	if got := sortOptions(t, sorts[5], "event.id")["unmapped_type"]; got != "keyword" {
		t.Fatalf("event.id unmapped_type=%v, want keyword", got)
	}
}

func TestBuildESSort_DropsUnknownFields(t *testing.T) {
	sorts := buildESSort([]SortField{{Field: `script[0]`, Order: "asc"}})
	wantFields := []string{"@timestamp", "nexuslog.ingest.received_at", "event.sequence", "log.offset", "source.path", "event.id"}
	if len(sorts) != len(wantFields) {
		t.Fatalf("buildESSort returned %d clauses, want %d", len(sorts), len(wantFields))
	}
	for index, field := range wantFields {
		if _, ok := sorts[index][field]; !ok {
			t.Fatalf("sort[%d] missing field %s: %#v", index, field, sorts[index])
		}
	}
}

func TestBuildESSort_DeduplicatesRequestedTieBreakers(t *testing.T) {
	sorts := buildESSort([]SortField{
		{Field: "@timestamp", Order: "desc"},
		{Field: "event.id", Order: "asc"},
	})
	wantFields := []string{"@timestamp", "event.id", "nexuslog.ingest.received_at", "event.sequence", "log.offset", "source.path"}
	if len(sorts) != len(wantFields) {
		t.Fatalf("buildESSort returned %d clauses, want %d", len(sorts), len(wantFields))
	}
	for index, field := range wantFields {
		if _, ok := sorts[index][field]; !ok {
			t.Fatalf("sort[%d] missing field %s: %#v", index, field, sorts[index])
		}
	}
	if got := sortOptions(t, sorts[1], "event.id")["order"]; got != "asc" {
		t.Fatalf("event.id order=%v, want asc", got)
	}
}

func sortOptions(t *testing.T, clause map[string]any, field string) map[string]any {
	t.Helper()
	raw, ok := clause[field]
	if !ok {
		t.Fatalf("sort clause missing %s: %#v", field, clause)
	}
	options, ok := raw.(map[string]any)
	if !ok {
		t.Fatalf("sort clause for %s has unexpected type %T", field, raw)
	}
	return options
}

func TestSearchLogs_FirstPageSkipsAutoPIT(t *testing.T) {
	var pitCalls int
	var capturedSearch map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/nexuslog-logs-read/_pit":
			pitCalls++
			http.Error(w, "unexpected pit open", http.StatusBadRequest)
		case r.Method == http.MethodPost && r.URL.Path == "/nexuslog-logs-read/_search":
			if err := json.NewDecoder(r.Body).Decode(&capturedSearch); err != nil {
				t.Fatalf("decode search body failed: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"took": 5,
				"timed_out": false,
				"hits": {
					"total": {"value": 10000, "relation": "gte"},
					"hits": [
						{
							"_id": "log-first-page",
							"_index": "nexuslog-logs-read",
							"sort": ["2026-03-13T08:00:00Z", 99],
							"_source": {"message": "hello first page"}
						}
					]
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	result, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantID: "tenant-a",
		Page:     1,
		PageSize: 20,
		Sort:     []SortField{{Field: "@timestamp", Order: "desc"}},
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}
	if pitCalls != 0 {
		t.Fatalf("pitCalls=%d, want 0", pitCalls)
	}
	if _, exists := capturedSearch["pit"]; exists {
		t.Fatalf("pit should be omitted for first page realtime-style query: %#v", capturedSearch)
	}
	if got := capturedSearch["from"]; got != float64(0) {
		t.Fatalf("from=%v, want 0", got)
	}
	if got := capturedSearch["track_total_hits"]; got != float64(defaultTrackTotalHitsLimit) {
		t.Fatalf("track_total_hits=%v, want %d", got, defaultTrackTotalHitsLimit)
	}
	if result.PITID != "" {
		t.Fatalf("result.PITID=%q, want empty", result.PITID)
	}
	if result.Total != 10000 || result.TotalRelation != totalRelationGreaterThanEqual {
		t.Fatalf("unexpected total metadata: total=%d relation=%q", result.Total, result.TotalRelation)
	}
	if len(result.NextSearchAfter) != 2 {
		t.Fatalf("len(result.NextSearchAfter)=%d, want 2", len(result.NextSearchAfter))
	}
}

func TestSearchLogs_OpensPITAndReturnsNextSearchAfter(t *testing.T) {
	var pitCalls int
	var capturedSearch map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/nexuslog-logs-read/_pit":
			pitCalls++
			if got := r.URL.Query().Get("keep_alive"); got != defaultPITKeepAlive {
				t.Fatalf("keep_alive=%q, want %q", got, defaultPITKeepAlive)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"pit-opened"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/_search":
			if err := json.NewDecoder(r.Body).Decode(&capturedSearch); err != nil {
				t.Fatalf("decode search body failed: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"took": 7,
				"timed_out": false,
				"pit_id": "pit-refreshed",
				"hits": {
					"total": {"value": 12345},
					"hits": [
						{
							"_id": "log-1",
							"_index": "nexuslog-logs-read",
							"sort": ["2026-03-13T08:00:00Z", 99],
							"_source": {"message": "hello"}
						}
					]
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	result, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantID: "tenant-a",
		Page:     2,
		PageSize: 20,
		Sort:     []SortField{{Field: "@timestamp", Order: "desc"}},
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}
	if pitCalls != 1 {
		t.Fatalf("pitCalls=%d, want 1", pitCalls)
	}
	pit, ok := capturedSearch["pit"].(map[string]any)
	if !ok {
		t.Fatalf("search body pit missing: %#v", capturedSearch)
	}
	if got := pit["id"]; got != "pit-opened" {
		t.Fatalf("pit.id=%v, want pit-opened", got)
	}
	if got := pit["keep_alive"]; got != defaultPITKeepAlive {
		t.Fatalf("pit.keep_alive=%v, want %s", got, defaultPITKeepAlive)
	}
	if got := capturedSearch["track_total_hits"]; got != true {
		t.Fatalf("track_total_hits=%v, want true", got)
	}
	if got := capturedSearch["from"]; got != float64(20) {
		t.Fatalf("from=%v, want 20", got)
	}
	if _, exists := capturedSearch["search_after"]; exists {
		t.Fatalf("search_after should be omitted for regular pages: %#v", capturedSearch)
	}
	if result.PITID != "pit-refreshed" {
		t.Fatalf("result.PITID=%q, want pit-refreshed", result.PITID)
	}
	if len(result.NextSearchAfter) != 2 {
		t.Fatalf("len(result.NextSearchAfter)=%d, want 2", len(result.NextSearchAfter))
	}
}

func TestSearchLogs_UsesProvidedCursorForDeepPagination(t *testing.T) {
	var pitCalls int
	var capturedSearch map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/nexuslog-logs-read/_pit":
			pitCalls++
			http.Error(w, "unexpected pit open", http.StatusBadRequest)
		case r.Method == http.MethodPost && r.URL.Path == "/_search":
			if err := json.NewDecoder(r.Body).Decode(&capturedSearch); err != nil {
				t.Fatalf("decode search body failed: %v", err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"took": 3,
				"timed_out": false,
				"pit_id": "pit-existing",
				"hits": {
					"total": {"value": 20001},
					"hits": []
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	_, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantID:    "tenant-a",
		Page:        501,
		PageSize:    20,
		Sort:        []SortField{{Field: "@timestamp", Order: "desc"}},
		PITID:       "pit-existing",
		SearchAfter: []any{"2026-03-13T08:00:00Z", 99},
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}
	if pitCalls != 0 {
		t.Fatalf("pitCalls=%d, want 0", pitCalls)
	}
	pit, ok := capturedSearch["pit"].(map[string]any)
	if !ok {
		t.Fatalf("search body pit missing: %#v", capturedSearch)
	}
	if got := pit["id"]; got != "pit-existing" {
		t.Fatalf("pit.id=%v, want pit-existing", got)
	}
	searchAfter, ok := capturedSearch["search_after"].([]any)
	if !ok || len(searchAfter) != 2 {
		t.Fatalf("search_after=%#v, want 2 values", capturedSearch["search_after"])
	}
	if _, exists := capturedSearch["from"]; exists {
		t.Fatalf("from should be omitted when search_after is used: %#v", capturedSearch)
	}
}

func TestSearchLogs_ReopensPITWhenExistingPITExpires(t *testing.T) {
	var pitCalls int
	var searchCalls int
	var firstSearch map[string]any
	var secondSearch map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/nexuslog-logs-read/_pit":
			pitCalls++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"pit-reopened"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/_search":
			searchCalls++
			captured := map[string]any{}
			if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
				t.Fatalf("decode search body failed: %v", err)
			}
			if searchCalls == 1 {
				firstSearch = captured
				http.Error(w, `{"error":{"type":"resource_not_found_exception","reason":"point in time not found"}}`, http.StatusNotFound)
				return
			}
			secondSearch = captured
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"took": 4,
				"timed_out": false,
				"pit_id": "pit-reopened-refreshed",
				"hits": {
					"total": {"value": 20001},
					"hits": [
						{
							"_id": "log-recovered",
							"_index": "nexuslog-logs-read",
							"sort": ["2026-03-13T08:00:01Z", 100],
							"_source": {"message": "recovered after pit refresh"}
						}
					]
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	result, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantID:    "tenant-a",
		Page:        501,
		PageSize:    20,
		Sort:        []SortField{{Field: "@timestamp", Order: "desc"}},
		PITID:       "pit-stale",
		SearchAfter: []any{"2026-03-13T08:00:00Z", 99},
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}
	if pitCalls != 1 {
		t.Fatalf("pitCalls=%d, want 1", pitCalls)
	}
	if searchCalls != 2 {
		t.Fatalf("searchCalls=%d, want 2", searchCalls)
	}
	firstPit, ok := firstSearch["pit"].(map[string]any)
	if !ok || firstPit["id"] != "pit-stale" {
		t.Fatalf("first search pit=%#v, want pit-stale", firstSearch["pit"])
	}
	secondPit, ok := secondSearch["pit"].(map[string]any)
	if !ok || secondPit["id"] != "pit-reopened" {
		t.Fatalf("second search pit=%#v, want pit-reopened", secondSearch["pit"])
	}
	secondSearchAfter, ok := secondSearch["search_after"].([]any)
	if !ok || len(secondSearchAfter) != 2 {
		t.Fatalf("second search_after=%#v, want original cursor", secondSearch["search_after"])
	}
	if result.PITID != "pit-reopened-refreshed" {
		t.Fatalf("result.PITID=%q, want pit-reopened-refreshed", result.PITID)
	}
	if len(result.Hits) != 1 || result.Hits[0].ID != "log-recovered" {
		t.Fatalf("unexpected result hits: %+v", result.Hits)
	}
}

func TestSearchWithBody_RetriesOnceOnTransientServerError(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if requestCount == 1 {
			http.Error(w, `{"error":"es overloaded"}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 4,
			"timed_out": false,
			"hits": {"total": {"value": 7}, "hits": []},
			"aggregations": {
				"by_dim": {"buckets": [{"key":"info","doc_count":7}]}
			}
		}`))
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	result, err := repo.SearchWithBody(context.Background(), map[string]any{
		"size": 0,
	})
	if err != nil {
		t.Fatalf("SearchWithBody() error = %v", err)
	}
	if requestCount != 2 {
		t.Fatalf("requestCount=%d, want 2", requestCount)
	}
	if result.Total != 7 {
		t.Fatalf("result.Total=%d, want 7", result.Total)
	}
}

func TestSearchWithBody_MapsRepeatedTransientFailuresToBackendUnavailable(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		http.Error(w, `{"error":"es overloaded"}`, http.StatusServiceUnavailable)
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	_, err := repo.SearchWithBody(context.Background(), map[string]any{
		"size": 0,
	})
	if !errors.Is(err, ErrSearchBackendUnavailable) {
		t.Fatalf("SearchWithBody() error = %v, want ErrSearchBackendUnavailable", err)
	}
	if requestCount != 2 {
		t.Fatalf("requestCount=%d, want 2", requestCount)
	}
}

func TestSearchLogs_RetriesOnceOnTransientServerError(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if r.Method != http.MethodPost || r.URL.Path != "/nexuslog-logs-read/_search" {
			http.NotFound(w, r)
			return
		}
		requestCount++
		if requestCount == 1 {
			http.Error(w, `{"error":"es overloaded"}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 5,
			"timed_out": false,
			"hits": {
				"total": {"value": 1},
				"hits": [
					{
						"_id": "log-1",
						"_index": "nexuslog-logs-read",
						"sort": ["2026-03-13T08:00:00Z", 99],
						"_source": {"message": "recovered after retry"}
					}
				]
			}
		}`))
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	result, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantID: "tenant-a",
		Page:     1,
		PageSize: 20,
		Sort:     []SortField{{Field: "@timestamp", Order: "desc"}},
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}
	if requestCount != 2 {
		t.Fatalf("requestCount=%d, want 2", requestCount)
	}
	if result.Total != 1 {
		t.Fatalf("result.Total=%d, want 1", result.Total)
	}
	if len(result.Hits) != 1 || result.Hits[0].ID != "log-1" {
		t.Fatalf("unexpected result hits: %+v", result.Hits)
	}
}

func TestSearchLogs_MapsRepeatedTransientFailuresToBackendUnavailable(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if r.Method != http.MethodPost || r.URL.Path != "/nexuslog-logs-read/_search" {
			http.NotFound(w, r)
			return
		}
		requestCount++
		http.Error(w, `{"error":"es overloaded"}`, http.StatusServiceUnavailable)
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	_, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantID: "tenant-a",
		Page:     1,
		PageSize: 20,
	})
	if !errors.Is(err, ErrSearchBackendUnavailable) {
		t.Fatalf("SearchLogs() error = %v, want ErrSearchBackendUnavailable", err)
	}
	if requestCount != 2 {
		t.Fatalf("requestCount=%d, want 2", requestCount)
	}
}

func TestSearchLogs_AcceptsAuthorizedTenantSetWithoutCurrentTenant(t *testing.T) {
	var captured map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"took": 1,
			"timed_out": false,
			"hits": {"total": {"value": 0}, "hits": []},
			"aggregations": {}
		}`))
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	_, err := repo.SearchLogs(context.Background(), SearchLogsInput{
		TenantReadScope:     sharedauth.TenantReadScopeTenant,
		AuthorizedTenantIDs: []string{"tenant-b", "tenant-a"},
		Page:                1,
		PageSize:            20,
	})
	if err != nil {
		t.Fatalf("SearchLogs() error = %v", err)
	}

	raw, err := json.Marshal(captured)
	if err != nil {
		t.Fatalf("marshal captured request failed: %v", err)
	}
	encoded := string(raw)
	assertContainsAll(t, encoded, []string{
		`"terms":{"tenant_id":["tenant-a","tenant-b"]}`,
		`"terms":{"nexuslog.governance.tenant_id":["tenant-a","tenant-b"]}`,
	})
}

func TestSearchLogs_RejectsMissingTenantScope(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		http.NotFound(w, r)
	}))
	defer server.Close()

	repo := &ElasticsearchRepository{
		address: server.URL,
		index:   "nexuslog-logs-read",
		client:  server.Client(),
	}
	_, err := repo.SearchLogs(context.Background(), SearchLogsInput{Page: 1, PageSize: 20})
	if !errors.Is(err, ErrTenantScopeRequired) {
		t.Fatalf("SearchLogs() error = %v, want ErrTenantScopeRequired", err)
	}
	if called {
		t.Fatal("expected repository to reject before issuing network request")
	}
}

func assertContainsAll(t *testing.T, raw string, fragments []string) {
	t.Helper()
	for _, fragment := range fragments {
		if !strings.Contains(raw, fragment) {
			t.Fatalf("expected query to contain %s, got %s", fragment, raw)
		}
	}
}
