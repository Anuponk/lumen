package fr.nopuna.lumen;

final class UpdatePolicy {
    static final int BASELINE = 2;
    static final int MAX_VERSION_CODE = 2_100_000_000;
    static final long DAY_MS = 86_400_000;

    enum Decision { CONTINUE, RECOMMEND, READY, REQUIRE, RESUME_IMMEDIATE, STORE_ADVISORY }

    private UpdatePolicy() {}

    static Decision decide(int installed, int minimum, int offered, boolean playUnavailable,
            boolean immediateInProgress, boolean downloaded, boolean flexibleInProgress) {
        if (offered <= installed) {
            return playUnavailable && installed < minimum
                    ? Decision.STORE_ADVISORY : Decision.CONTINUE;
        }
        if (installed < minimum) {
            if (offered < minimum) return Decision.CONTINUE;
            if (downloaded) return Decision.READY;
            return immediateInProgress ? Decision.RESUME_IMMEDIATE : Decision.REQUIRE;
        }
        if (downloaded) return Decision.READY;
        return immediateInProgress || flexibleInProgress ? Decision.CONTINUE : Decision.RECOMMEND;
    }

    static boolean isDeferred(int offered, int previous, long until, long now) {
        if (offered != previous) return false;
        if (until == Long.MAX_VALUE) return true;
        // A clock reset must not suppress the prompt indefinitely.
        return until > now && until - now <= DAY_MS;
    }
}
