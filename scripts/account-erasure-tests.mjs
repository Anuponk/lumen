// #316: run the actual private erasure unit tests in the standard quality gate.
// Keep tests in tests/ and import them here so they cannot silently be skipped.
import '../tests/deletion-authorization.test.mjs';
import '../tests/private-erasure-worker.test.mjs';
import '../tests/operator-postgres-adapter.test.mjs';
import '../tests/private-deletion-handler.test.mjs';
import '../tests/server-deletion-identity.test.mjs';
import '../tests/supabase-token-verifier.test.mjs';
import '../tests/verified-session-lookup.test.mjs';
import '../tests/verified-jwt-claims.test.mjs';
import '../tests/account-erasure-client.test.mjs';
import '../tests/verified-actor-resolver.test.mjs';
import '../tests/node-deletion-route.test.mjs';
import '../tests/recent-reauth-ledger.test.mjs';
