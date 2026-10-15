# Pinned by digest so builds are reproducible; Dependabot bumps it when upstream ships fixes.
FROM nginxinc/nginx-unprivileged:1.31.6-alpine@sha256:884e0b7f42f303641b0f4e78755aea647521dca0b89ca3be7992ad78b5c07434
# CVE-2026-85091: the base ships zlib 1.3.2-r0. Remove once the pinned base includes 1.3.2-r1.
USER root
RUN apk add --no-cache --upgrade 'zlib>=1.3.2-r1'
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
# The base already runs as nginx (101); stating it keeps that guaranteed if the base ever changes.
USER 101
