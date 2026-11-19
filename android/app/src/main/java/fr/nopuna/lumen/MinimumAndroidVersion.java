package fr.nopuna.lumen;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import javax.net.ssl.HttpsURLConnection;

final class MinimumAndroidVersion {
    static final String URL = "https://lumen.nopuna.fr/src/android-update-policy.json";
    private static final int MAX_BYTES = 256;

    private MinimumAndroidVersion() {}

    static int fetch(int timeoutMs) throws IOException, JSONException {
        long deadline = System.nanoTime() + timeoutMs * 1_000_000L;
        HttpsURLConnection connection = (HttpsURLConnection) new URL(URL).openConnection();
        connection.setConnectTimeout(timeoutMs);
        connection.setReadTimeout(timeoutMs);
        connection.setInstanceFollowRedirects(false);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty("User-Agent", "Lumen-Android-Update");
        try {
            if (connection.getResponseCode() != 200) throw new IOException("policy_http");
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream data = new ByteArrayOutputStream();
                byte[] buffer = new byte[MAX_BYTES + 1];
                int count;
                while ((count = input.read(buffer, 0, Math.min(buffer.length,
                        MAX_BYTES + 1 - data.size()))) > 0) {
                    data.write(buffer, 0, count);
                    if (data.size() > MAX_BYTES) throw new IOException("policy_size");
                    if (System.nanoTime() >= deadline) throw new IOException("policy_timeout");
                }
                Object minimum = new JSONObject(data.toString(StandardCharsets.UTF_8.name()))
                        .get("minimumVersionCode");
                if (!(minimum instanceof Integer)) throw new JSONException("policy_version");
                int code = (int) minimum;
                if (code < 1 || code > UpdatePolicy.MAX_VERSION_CODE) {
                    throw new JSONException("policy_version");
                }
                return code;
            }
        } finally {
            connection.disconnect();
        }
    }
}
