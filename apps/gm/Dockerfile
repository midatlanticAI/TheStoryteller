# syntax=docker/dockerfile:1
# The Storyteller Game Master: unmodified Claude Code, as Anthropic publishes it,
# plus the small service the Storyteller server calls. Build from the repo root:
#   docker compose up -d --build
# Optional for builds behind a TLS-inspecting proxy: --secret id=build_ca,src=<ca.pem>

FROM node:22-slim AS build
WORKDIR /src
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && npm install -g pnpm@10.28.0
COPY . .
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && pnpm install --frozen-lockfile --ignore-scripts --filter "@storyteller/gm..." \
 && pnpm --filter @storyteller/engine build \
 && pnpm --filter @storyteller/gm build

FROM node:22-slim
ARG CLAUDE_CODE_VERSION=2.1.321
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
 && npm cache clean --force \
 && useradd --create-home --shell /bin/bash gm \
 && mkdir -p /app
COPY --from=build /src/apps/gm/dist/server.mjs /app/server.mjs
USER gm
WORKDIR /home/gm
# /home/gm is a volume: Claude Code keeps its own sign-in there, so it survives restarts.
ENV HOME=/home/gm PORT=8080 DISABLE_AUTOUPDATER=1
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
