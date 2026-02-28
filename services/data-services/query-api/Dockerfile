# Build stage
FROM golang:1.22-alpine AS builder

ARG GOPROXY=https://proxy.golang.org,direct
ENV GOPROXY=${GOPROXY}

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# 先复制 shared 模块
COPY shared/ ../shared/

COPY query-api/go.mod query-api/go.sum* ./
RUN go mod download

COPY query-api/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/query-api ./cmd/api

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/query-api .
COPY query-api/configs/ ./configs/

EXPOSE 8082

ENTRYPOINT ["./query-api"]
