FROM golang:1.23-alpine AS build

WORKDIR /src
COPY server.go ./server.go

# 构建无 CGO 的静态二进制，减小镜像体积并降低运行依赖。
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/gateway-smoke-mock ./server.go

FROM alpine:3.20

# 以非 root 用户运行，保持最小权限。
RUN adduser -D -u 10001 app

COPY --from=build /out/gateway-smoke-mock /usr/local/bin/gateway-smoke-mock

USER app
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/gateway-smoke-mock"]
