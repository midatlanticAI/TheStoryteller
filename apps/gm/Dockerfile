# syntax=docker/dockerfile:1
# The hosted Game Master: unmodified Claude Code, as Anthropic publishes it,
# plus the small service the Storyteller Worker talks to.
FROM node:22-slim
ARG CLAUDE_CODE_VERSION=2.1.321
# An optional CA bundle for builds behind a TLS-inspecting proxy; never copied into the image.
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi \
 && npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
 && npm cache clean --force \
 && useradd --create-home --shell /bin/bash gm
USER gm
WORKDIR /home/gm
ENV HOME=/home/gm PORT=8080 DISABLE_AUTOUPDATER=1
COPY --chown=gm:gm dist/server.mjs /home/gm/server.mjs
EXPOSE 8080
CMD ["node", "/home/gm/server.mjs"]
