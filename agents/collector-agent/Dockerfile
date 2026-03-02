# Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/collector-agent ./cmd/agent

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/collector-agent .
COPY configs/ ./configs/
COPY plugins/ ./plugins/

EXPOSE 9091

ENTRYPOINT ["./collector-agent"]
