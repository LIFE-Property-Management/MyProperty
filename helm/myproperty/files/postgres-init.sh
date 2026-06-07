# Bootstrap the Keycloak database next to the app database. Runs once, on first
# init, sourced by the postgres entrypoint. POSTGRES_USER / POSTGRES_DB are set by
# the image; KEYCLOAK_DB_PASSWORD is injected from the myproperty-postgres Secret.
# Keycloak gets a dedicated NON-superuser role scoped to its own DB; it cannot
# connect to the app database.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}'" \
  -c "CREATE DATABASE keycloak OWNER keycloak" \
  -c "REVOKE CONNECT ON DATABASE \"$POSTGRES_DB\" FROM PUBLIC" \
  -c "GRANT CONNECT ON DATABASE \"$POSTGRES_DB\" TO \"$POSTGRES_USER\""

# Unleash feature-flag server database (M5.6). Connects with the app superuser
# (myproperty-postgres Secret) for simplicity — proportionate for the deliverable.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE unleash"
