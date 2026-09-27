#!/usr/bin/env sh
set -eu

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
curl --fail --silent --show-error http://127.0.0.1:4300/ >/dev/null
