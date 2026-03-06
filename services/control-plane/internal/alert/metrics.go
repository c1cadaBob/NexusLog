package alert

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	alertEvalDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "alert_eval_duration_seconds",
			Help:    "Duration of alert evaluation cycle in seconds",
			Buckets: prometheus.DefBuckets,
		},
	)
	alertEventsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "alert_events_total",
			Help: "Total number of alert events created",
		},
	)
)

func init() {
	prometheus.MustRegister(alertEvalDurationSeconds, alertEventsTotal)
}
