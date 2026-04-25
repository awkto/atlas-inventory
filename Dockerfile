FROM node:22-slim AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim

ARG LITESTREAM_VERSION=0.5.11
ARG TARGETARCH=amd64

# sqlite3 CLI is used by the backup job for atomic .backup dumps.
# litestream is the replication transport for HA mode.
# Litestream asset arch differs from buildx TARGETARCH (amd64 → x86_64).
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 ca-certificates curl \
 && case "${TARGETARCH}" in \
      amd64) LS_ARCH=x86_64 ;; \
      arm64) LS_ARCH=arm64  ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}"; exit 1 ;; \
    esac \
 && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${LS_ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin litestream \
 && apt-get purge -y --auto-remove curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ app/
COPY --from=frontend-build /app/dist /app/static
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
