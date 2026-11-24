package fr.nopuna.lumen;

import org.junit.Test;

import static org.junit.Assert.*;

public final class NativeVersionTest {
    @Test
    public void wellFormedVersionBecomesTheLaunchFragment() {
        assertEquals("lumen-native=1.0.1+2", NativeVersion.fragment("1.0.1", 2));
        assertEquals("lumen-native=1.2+10", NativeVersion.fragment("1.2", 10));
    }

    @Test
    public void malformedVersionsAreNeverInvented() {
        assertNull(NativeVersion.fragment(null, 2));
        assertNull(NativeVersion.fragment("1.0.1-debug", 2));
        assertNull(NativeVersion.fragment("Chrome 120", 2));
        assertNull(NativeVersion.fragment("1.0.1", 0));
        assertNull(NativeVersion.fragment("1.0.1", 1_000_000_000L));
    }

    @Test
    public void existingFragmentsAreKept() {
        assertTrue(NativeVersion.applies(null));
        assertTrue(NativeVersion.applies(""));
        assertFalse(NativeVersion.applies("access_token=x"));
    }
}
