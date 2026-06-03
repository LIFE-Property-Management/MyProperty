-- myproperty is already created by the POSTGRES_DB env var.
-- This script creates the Keycloak database on the same instance.
CREATE DATABASE keycloak;

-- Unleash feature-flag server database (M5.6), same instance as app + keycloak.
CREATE DATABASE unleash;
