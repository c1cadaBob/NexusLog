# ---- 构建阶段 ----
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/collector-agent ./cmd/agent

# ---- 运行阶段 ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/collector-agent .
COPY configs/ ./configs/

EXPOSE 8080

ENTRYPOINT ["./collector-agent"]
