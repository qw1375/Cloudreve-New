# syntax=docker/dockerfile:1

###############################################################################
# 1. Frontend
#
# Pinned to $BUILDPLATFORM so pnpm and vite always run natively. Running them
# under QEMU for linux/arm64 takes tens of minutes and produces the same bytes.
###############################################################################
FROM --platform=$BUILDPLATFORM node:22-alpine AS web

WORKDIR /web

RUN corepack enable

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true \
 || pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

COPY web/ ./

ARG VERSION=4.19.2
ENV CR_NAME=cloudreve-frontend \
    CR_VERSION=${VERSION} \
    npm_package_name=cloudreve-frontend \
    npm_package_version=${VERSION}

RUN pnpm build

###############################################################################
# 2. Backend
#
# Go cross-compiles without CGO, so the build stage also stays native.
###############################################################################
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build

ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

RUN apk add --no-cache zip

COPY src/go.mod src/go.sum ./
RUN go mod download

COPY src/ ./
COPY NOTICE ./NOTICE

COPY --from=web /web/build /tmp/web-build

RUN mkdir -p application/statics/stage/assets \
 && cp -r /tmp/web-build application/statics/stage/assets/build \
 && cd application/statics/stage \
 && zip -q -r ../assets.zip . \
 && cd /src \
 && rm -rf application/statics/stage

ARG VERSION=4.19.2
ARG COMMIT=unknown

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath \
      -ldflags "-s -w \
        -X 'github.com/cloudreve/Cloudreve/v4/application/constants.BackendVersion=${VERSION}' \
        -X 'github.com/cloudreve/Cloudreve/v4/application/constants.LastCommit=${COMMIT}' \
        -X 'github.com/cloudreve/Cloudreve/v4/application/constants.IsPro=false'" \
      -o /out/cloudreve .

###############################################################################
# 3. Runtime
###############################################################################
FROM alpine:latest

WORKDIR /cloudreve

RUN apk update \
    && apk add --no-cache tzdata vips-tools ffmpeg libreoffice aria2 supervisor \
       font-noto font-noto-cjk libheif libraw-tools \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && mkdir -p ./data/temp/aria2 \
    && chmod -R 766 ./data/temp/aria2

ENV CR_ENABLE_ARIA2=1 \
    CR_SETTING_DEFAULT_thumb_ffmpeg_enabled=1 \
    CR_SETTING_DEFAULT_thumb_vips_enabled=1 \
    CR_SETTING_DEFAULT_thumb_libreoffice_enabled=1 \
    CR_SETTING_DEFAULT_media_meta_ffprobe=1 \
    CR_SETTING_DEFAULT_thumb_libraw_enabled=1

COPY src/.build/aria2.supervisor.conf src/.build/entrypoint.sh ./
COPY --from=build /out/cloudreve ./cloudreve
COPY LICENSE NOTICE ./

RUN chmod +x ./cloudreve ./entrypoint.sh

EXPOSE 5212 443 6888 6888/udp

VOLUME ["/cloudreve/data"]

ENTRYPOINT ["sh", "./entrypoint.sh"]
