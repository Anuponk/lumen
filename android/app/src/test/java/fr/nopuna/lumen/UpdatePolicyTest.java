package fr.nopuna.lumen;

import org.junit.Test;

import static fr.nopuna.lumen.UpdatePolicy.Decision.*;
import static org.junit.Assert.*;

public final class UpdatePolicyTest {
    @Test
    public void compatibleVersionNeedsAnActualNewerPlayOffer() {
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 2, 0, false, false, false, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 2, 3, false, false, false, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 2, 0, true, false, false, false));
        assertEquals(RECOMMEND, UpdatePolicy.decide(3, 2, 4, false, false, false, false));
    }

    @Test
    public void mandatoryOnlyWhenPlayCanReachTheExplicitMinimum() {
        assertEquals(REQUIRE, UpdatePolicy.decide(3, 5, 5, false, false, false, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 5, 4, false, false, false, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 5, 0, false, false, false, false));
        assertEquals(STORE_ADVISORY, UpdatePolicy.decide(3, 5, 0, true, false, false, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(5, 5, 0, false, false, false, false));
    }

    @Test
    public void aDownloadIsOfferedForInstallOnceItIsReady() {
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 2, 4, false, false, false, true));
        assertEquals(READY, UpdatePolicy.decide(3, 2, 4, false, false, true, false));
        assertEquals(READY, UpdatePolicy.decide(3, 4, 4, false, false, true, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 5, 4, false, false, true, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(4, 2, 4, false, false, true, false));
    }

    @Test
    public void immediateResumesOnlyWhileStillRequired() {
        assertEquals(RESUME_IMMEDIATE, UpdatePolicy.decide(3, 5, 5, false, true, false, false));
        assertEquals(CONTINUE, UpdatePolicy.decide(3, 2, 5, false, true, false, false));
    }

    @Test
    public void laterExpiresAndDeclineOnlySuppressesItsOwnVersion() {
        long now = 10 * UpdatePolicy.DAY_MS;
        assertTrue(UpdatePolicy.isDeferred(4, 4, now + UpdatePolicy.DAY_MS, now));
        assertFalse(UpdatePolicy.isDeferred(4, 4, now + UpdatePolicy.DAY_MS, now + UpdatePolicy.DAY_MS));
        assertFalse(UpdatePolicy.isDeferred(4, 4, now + UpdatePolicy.DAY_MS, now - 1));
        assertTrue(UpdatePolicy.isDeferred(4, 4, Long.MAX_VALUE, now));
        assertFalse(UpdatePolicy.isDeferred(5, 4, Long.MAX_VALUE, now));
    }
}
