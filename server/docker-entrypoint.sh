#!/bin/sh
set -e

# The `db` service's healthcheck (pg_isready) only confirms Postgres is
# accepting connections, not that this specific database/user combo is
# ready — retry briefly so a fresh container start doesn't lose an alembic
# run to a race against Postgres's own startup.
attempt=0
until uv run --no-sync alembic upgrade head; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 10 ]; then
    echo "alembic upgrade head failed after $attempt attempts" >&2
    exit 1
  fi
  echo "Waiting for the database to accept migrations (attempt $attempt)..."
  sleep 2
done

exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8000
