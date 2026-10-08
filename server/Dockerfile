FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80
WORKDIR /app
COPY package.json package-lock.json ./
# CVE-2026-85091: the base ships zlib 1.3.2-r0. Remove once the pinned base includes 1.3.2-r1.
RUN apk add --no-cache --upgrade 'zlib>=1.3.2-r1'
# Package managers aren't needed at runtime, and their bundled dependencies are the usual source of image CVEs.
RUN npm ci --omit=dev \
 && rm -rf /usr/local/lib/node_modules /opt/yarn-* /root/.npm \
 && cd /usr/local/bin && rm -f npm npx corepack yarn yarnpkg
COPY server/ server/
COPY public/src/shared/ public/src/shared/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server/index.js"]
