# Pinned by digest so builds are reproducible; Dependabot bumps it when upstream ships fixes.
FROM nginxinc/nginx-unprivileged:1.31.6-alpine@sha256:b9241c6e7b8e9a862f129d8d4199ab64b10390949a78bdd5603379b32c844083
# CVE-2026-85091: the base ships zlib 1.3.2-r0. Remove once the pinned base includes 1.3.2-r1.
USER root
RUN apk add --no-cache --upgrade 'zlib>=1.3.2-r1'
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
# The base already runs as nginx (101); stating it keeps that guaranteed if the base ever changes.
USER 101
