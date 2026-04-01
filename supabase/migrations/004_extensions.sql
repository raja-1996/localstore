-- 004_extensions.sql
-- Enable PostgreSQL extensions required by LocalStore.
-- postgis:   geospatial data types and functions (GEOGRAPHY, ST_DWithin, etc.)
-- pg_trgm:   trigram-based text similarity (GIN indexes for fuzzy name search)
-- uuid-ossp: UUID generation functions (gen_random_uuid already in core,
--            but some clients rely on uuid_generate_v4())

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
