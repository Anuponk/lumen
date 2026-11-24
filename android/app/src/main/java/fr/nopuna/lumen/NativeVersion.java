package fr.nopuna.lumen;

import java.util.regex.Pattern;

/**
 * #848: the installed app's own versionName and versionCode, handed to the web game
 * as a launch-URL fragment ({@code #lumen-native=1.0.1+2}). A fragment never reaches
 * a server and keeps the offline shell cacheable; the web side validates it again.
 */
final class NativeVersion {
    private static final Pattern NAME = Pattern.compile("^[0-9]{1,3}(\\.[0-9]{1,3}){1,3}$");

    private NativeVersion() {}

    /** The fragment for a well-formed version, or null (nothing invented). */
    static String fragment(String versionName, long versionCode) {
        if (versionName == null || !NAME.matcher(versionName).matches()) return null;
        if (versionCode < 1 || versionCode > 999_999_999L) return null;
        return "lumen-native=" + versionName + "+" + versionCode;
    }

    /** Adds the fragment only when the launch URL carries none (Auth links keep theirs). */
    static boolean applies(String existingFragment) {
        return existingFragment == null || existingFragment.isEmpty();
    }
}
