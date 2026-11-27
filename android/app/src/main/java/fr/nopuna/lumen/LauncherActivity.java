package fr.nopuna.lumen;

import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.LocaleManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.LocaleList;
import android.util.Log;
import android.widget.Toast;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallException;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

import org.json.JSONException;

import java.io.IOException;

public final class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final String TAG = "LumenPlayUpdate";
    private static final String PLAY_STORE = "com.android.vending";
    private static final int CHECK_MS = 2000;
    private static final int FLEXIBLE_REQUEST = 8450;
    private static final int IMMEDIATE_REQUEST = 8451;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private AppUpdateManager updates;
    private SharedPreferences preferences;
    private int installed;
    private int minimum = UpdatePolicy.BASELINE;
    private int offered;
    private int checkGeneration;
    private boolean gate;
    private boolean resumed;
    private boolean checking;
    private boolean policyDone;
    private boolean playDone;
    private boolean required;
    private boolean resolveAfterResume;
    private boolean continueOnResume;
    private boolean completing;
    private boolean storeOpened;
    private boolean forceStore;
    private int pendingRequest;
    private String policyStatus = "baseline";
    private String playStatus = "unchecked";
    private AppUpdateInfo updateInfo;
    private AlertDialog dialog;

    @Override
    protected void onCreate(Bundle state) {
        // The helper calls shouldLaunchImmediately() after normalizing the Android task.
        super.onCreate(state);
        if (!gate) return;
        preferences = getSharedPreferences("play_updates_v1", MODE_PRIVATE);
        if (state != null) {
            pendingRequest = state.getInt("updateRequest");
            offered = state.getInt("updateOffered");
            required = state.getBoolean("updateRequired");
            forceStore = state.getBoolean("updateStoreOnly");
            storeOpened = state.getBoolean("updateStoreOpened");
        }
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        Intent intent = getIntent();
        gate = Intent.ACTION_MAIN.equals(intent.getAction()) && intent.hasCategory(Intent.CATEGORY_LAUNCHER)
                && !intent.hasCategory(Intent.CATEGORY_BROWSABLE) && intent.getData() == null
                && isPlayInstall() && isColdTask();
        return !gate;
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        if (!gate || isFinishing() || pendingRequest != 0 || completing) return;
        if (dialog != null) {
            if (!isColdTask() || !hasNetwork()) continueToTwa();
            return;
        }
        if (storeOpened) {
            storeOpened = false;
            if (required) check();
            else continueToTwa();
        } else if (continueOnResume) {
            continueToTwa();
        } else if (resolveAfterResume) {
            resolveAfterResume = false;
            resolve();
        } else if (!checking) {
            check();
        }
    }

    @Override
    protected void onPause() {
        resumed = false;
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putInt("updateRequest", pendingRequest);
        state.putInt("updateOffered", offered);
        state.putBoolean("updateRequired", required);
        state.putBoolean("updateStoreOnly", forceStore);
        state.putBoolean("updateStoreOpened", storeOpened);
    }

    @Override
    protected void onDestroy() {
        gate = false;
        handler.removeCallbacksAndMessages(null);
        dismissDialog();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private boolean isPlayInstall() {
        try {
            PackageManager packages = getPackageManager();
            PackageInfo info = packages.getPackageInfo(getPackageName(), 0);
            installed = info.versionCode;
            String installer = Build.VERSION.SDK_INT >= 30
                    ? packages.getInstallSourceInfo(getPackageName()).getInstallingPackageName()
                    : packages.getInstallerPackageName(getPackageName());
            return PLAY_STORE.equals(installer) && !getPackageName().endsWith(".debug");
        } catch (PackageManager.NameNotFoundException | SecurityException error) {
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private boolean isColdTask() {
        if (!isTaskRoot()) return false;
        // Chrome hosts the existing TWA above its launcher in the Lumen task. Also
        // refuse the gate if another Lumen task (including a payment activity) is live.
        ActivityManager manager = getSystemService(ActivityManager.class);
        if (manager == null) return false;
        boolean foundRoot = false;
        try {
            for (ActivityManager.AppTask task : manager.getAppTasks()) {
                ActivityManager.RecentTaskInfo info = task.getTaskInfo();
                if (info == null) return false;
                int taskId = Build.VERSION.SDK_INT >= 29 ? info.taskId : info.id;
                if (taskId == getTaskId()) {
                    if (Build.VERSION.SDK_INT >= 29 && info.numActivities != 1) return false;
                    foundRoot = true;
                } else if (taskId >= 0) {
                    return false;
                }
            }
        } catch (IllegalArgumentException | SecurityException error) {
            return false;
        }
        return foundRoot;
    }

    private boolean hasNetwork() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null) return false;
        Network active = manager.getActiveNetwork();
        NetworkCapabilities capabilities = active == null ? null : manager.getNetworkCapabilities(active);
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void check() {
        dismissDialog();
        if (!isColdTask() || !hasNetwork()) {
            playStatus = "unsafe_or_offline";
            log("continue");
            continueToTwa();
            return;
        }
        int generation = ++checkGeneration;
        checking = true;
        policyDone = false;
        playDone = false;
        updateInfo = null;
        offered = 0;
        minimum = UpdatePolicy.BASELINE;
        policyStatus = "baseline";
        playStatus = "timeout";
        handler.postDelayed(() -> finishCheck(generation), CHECK_MS);

        new Thread(() -> {
            int code = UpdatePolicy.BASELINE;
            String status = "unavailable";
            try {
                code = MinimumAndroidVersion.fetch(CHECK_MS);
                status = "verified";
            } catch (IOException | JSONException ignored) {
                // A failed policy fetch cannot introduce a new compatibility block.
            }
            final int fetchedCode = code;
            final String fetchedStatus = status;
            handler.post(() -> {
                if (!isChecking(generation)) return;
                minimum = fetchedCode;
                policyStatus = fetchedStatus;
                policyDone = true;
                if (playDone) finishCheck(generation);
            });
        }, "lumen-update-policy").start();

        updates = AppUpdateManagerFactory.create(this);
        updates.getAppUpdateInfo().addOnCompleteListener(task -> {
            if (!isChecking(generation)) return;
            if (task.isSuccessful()) {
                updateInfo = task.getResult();
                playStatus = "availability_" + updateInfo.updateAvailability()
                        + "_install_" + updateInfo.installStatus();
                if (updateInfo.updateAvailability() == UpdateAvailability.UPDATE_NOT_AVAILABLE
                        && updateInfo.installStatus() != InstallStatus.DOWNLOADED) {
                    finishCheck(generation);
                    return;
                }
            } else {
                Exception error = task.getException();
                playStatus = error instanceof InstallException
                        ? "error_" + ((InstallException) error).getErrorCode() : "error";
            }
            playDone = true;
            if (policyDone) finishCheck(generation);
        });
    }

    private boolean isChecking(int generation) {
        return gate && checking && generation == checkGeneration && !isFinishing();
    }

    private void finishCheck(int generation) {
        if (!isChecking(generation)) return;
        checking = false;
        if (!resumed) {
            resolveAfterResume = true;
            return;
        }
        resolve();
    }

    private void resolve() {
        if (!isColdTask() || !hasNetwork()) {
            continueToTwa();
            return;
        }
        boolean immediateInProgress = false;
        boolean downloaded = false;
        boolean flexibleInProgress = false;
        if (updateInfo != null) {
            int availability = updateInfo.updateAvailability();
            int status = updateInfo.installStatus();
            immediateInProgress = availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
            downloaded = status == InstallStatus.DOWNLOADED;
            flexibleInProgress = status == InstallStatus.PENDING || status == InstallStatus.DOWNLOADING
                    || status == InstallStatus.INSTALLING;
            if (availability == UpdateAvailability.UPDATE_AVAILABLE || immediateInProgress || downloaded) {
                offered = updateInfo.availableVersionCode();
            }
        }
        boolean playUnavailable = updateInfo == null
                || (updateInfo.updateAvailability() == UpdateAvailability.UNKNOWN && !downloaded);
        required = installed < minimum && offered >= minimum;
        UpdatePolicy.Decision decision = UpdatePolicy.decide(installed, minimum, offered,
                playUnavailable, immediateInProgress, downloaded, flexibleInProgress);
        log(decision.name());
        switch (decision) {
            case RESUME_IMMEDIATE:
                if (!forceStore && startFlow(AppUpdateType.IMMEDIATE)) return;
                showOffer(true, false);
                break;
            case REQUIRE:
                showOffer(true, false);
                break;
            case READY:
                if (required || !isDeferred("ready")) showOffer(false, true);
                else continueToTwa();
                break;
            case STORE_ADVISORY:
                if (!isDeferred("policy")) showStoreAdvisory();
                else continueToTwa();
                break;
            case RECOMMEND:
                if (!isDeferred("offer")) showOffer(false, false);
                else continueToTwa();
                break;
            default:
                continueToTwa();
        }
    }

    private void showOffer(boolean immediate, boolean ready) {
        int type = immediate ? AppUpdateType.IMMEDIATE : AppUpdateType.FLEXIBLE;
        boolean playFlowAllowed = !forceStore && updateInfo != null
                && updateInfo.isUpdateTypeAllowed(type);
        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setTitle(required ? R.string.update_required_title : R.string.update_title)
                .setMessage(ready && !forceStore ? R.string.update_ready
                        : required ? R.string.update_required : R.string.update_recommended)
                .setCancelable(!required);
        if (ready && !forceStore) {
            builder.setPositiveButton(R.string.update_restart, (view, which) -> completeUpdate());
        } else if (playFlowAllowed) {
            builder.setPositiveButton(R.string.update_action, (view, which) -> {
                if (!startFlow(type) && gate) showOffer(immediate, ready);
            });
        } else {
            builder.setPositiveButton(R.string.update_store, (view, which) -> openStore());
        }
        if (required) {
            builder.setNegativeButton(R.string.update_exit, (view, which) -> finish());
        } else {
            builder.setNegativeButton(R.string.update_later,
                    (view, which) -> postpone(ready ? "ready" : "offer"));
            builder.setOnCancelListener(view -> postpone(ready ? "ready" : "offer"));
        }
        showDialog(builder);
    }

    private void showStoreAdvisory() {
        showDialog(new AlertDialog.Builder(this)
                .setTitle(R.string.update_title)
                .setMessage(R.string.update_store_advisory)
                .setPositiveButton(R.string.update_store, (view, which) -> openStore())
                .setNegativeButton(R.string.update_later, (view, which) -> postpone("policy"))
                .setOnCancelListener(view -> postpone("policy")));
    }

    private void showDialog(AlertDialog.Builder builder) {
        dismissDialog();
        dialog = builder.create();
        dialog.show();
    }

    private void dismissDialog() {
        if (dialog == null) return;
        dialog.dismiss();
        dialog = null;
    }

    @SuppressWarnings("deprecation")
    private boolean startFlow(int type) {
        if (!isColdTask() || !resumed || !hasNetwork()) {
            continueToTwa();
            return false;
        }
        if (updateInfo != null && updateInfo.isUpdateTypeAllowed(type)) {
            int request = type == AppUpdateType.IMMEDIATE ? IMMEDIATE_REQUEST : FLEXIBLE_REQUEST;
            try {
                if (updates.startUpdateFlowForResult(updateInfo, this,
                        AppUpdateOptions.newBuilder(type).build(), request)) {
                    pendingRequest = request;
                    dismissDialog();
                    log(type == AppUpdateType.IMMEDIATE ? "immediate_started" : "flexible_started");
                    return true;
                }
            } catch (IntentSender.SendIntentException ignored) {
                // The Play listing remains available when Play cannot start its UI.
            }
        }
        forceStore = true;
        log("flow_unavailable");
        return false;
    }

    private void completeUpdate() {
        if (!isColdTask() || !resumed || !hasNetwork()) {
            continueToTwa();
            return;
        }
        dismissDialog();
        completing = true;
        log("complete_requested");
        updates.completeUpdate().addOnCompleteListener(task -> {
            if (!gate || isFinishing()) return;
            completing = false;
            if (task.isSuccessful()) {
                finish();
            } else {
                forceStore = true;
                log("complete_failed");
                if (resumed) showOffer(required, true);
                else resolveAfterResume = true;
            }
        });
    }

    private void openStore() {
        String product = "details?id=" + getPackageName();
        Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://" + product));
        market.setPackage(PLAY_STORE);
        if (!isColdTask() || !resumed || !hasNetwork()) {
            continueToTwa();
            return;
        }
        if (!required) defer(offered > installed ? "offer" : "policy", false);
        dismissDialog();
        try {
            try {
                startActivity(market);
            } catch (ActivityNotFoundException ignored) {
                Intent web = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/" + product));
                startActivity(web);
            }
            storeOpened = true;
            log("store_opened");
        } catch (ActivityNotFoundException | SecurityException error) {
            log("store_unavailable");
            Toast.makeText(this, R.string.update_store_unavailable, Toast.LENGTH_LONG).show();
            if (required) showOffer(true, false);
            else continueToTwa();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (!gate || request != pendingRequest) return;
        pendingRequest = 0;
        switch (request) {
            case FLEXIBLE_REQUEST:
                log(result == RESULT_OK ? "flexible_accepted"
                        : result == RESULT_CANCELED ? "flexible_declined" : "flexible_failed");
                if (result == RESULT_OK || result == RESULT_CANCELED) {
                    defer("offer", result == RESULT_CANCELED);
                    continueToTwa();
                } else {
                    forceStore = true;
                }
                break;
            case IMMEDIATE_REQUEST:
                log(result == RESULT_OK ? "immediate_accepted"
                        : result == RESULT_CANCELED ? "immediate_cancelled" : "immediate_failed");
                // Requery on resume. A cancellation never relaunches the Play dialog on its own.
                forceStore = true;
                break;
            default:
                break;
        }
    }

    private int deferralVersion(String key) {
        return "policy".equals(key) ? minimum : offered;
    }

    private boolean isDeferred(String key) {
        return UpdatePolicy.isDeferred(deferralVersion(key), preferences.getInt(key + "_code", 0),
                preferences.getLong(key + "_until", 0), System.currentTimeMillis());
    }

    private void defer(String key, boolean declined) {
        long until = declined ? Long.MAX_VALUE : System.currentTimeMillis() + UpdatePolicy.DAY_MS;
        preferences.edit().putInt(key + "_code", deferralVersion(key)).putLong(key + "_until", until).apply();
    }

    private void postpone(String key) {
        defer(key, false);
        log("postponed");
        continueToTwa();
    }

    private void continueToTwa() {
        if (!resumed) {
            // onActivityResult precedes onResume after returning from the Play activity.
            continueOnResume = true;
            return;
        }
        gate = false;
        dismissDialog();
        launchTwa();
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri url = super.getLaunchingUrl();
        if (url.getFragment() != null || !"/".equals(url.getPath())) return url;
        // #1021 language, then #848 native version (see NativeVersion), in one fragment.
        String fragment = "lumen-app-language=" + appLanguage();
        String nativeVersion = nativeVersionFragment();
        if (nativeVersion != null) fragment += "&" + nativeVersion;
        return url.buildUpon().encodedFragment(fragment).build();
    }

    private String appLanguage() {
        LocaleList preferred = LocaleList.getDefault();
        if (Build.VERSION.SDK_INT >= 33) {
            LocaleManager manager = getSystemService(LocaleManager.class);
            if (manager != null) {
                preferred = manager.getApplicationLocales();
                if (preferred.isEmpty()) preferred = manager.getSystemLocales();
            }
        }
        for (int i = 0; i < preferred.size(); i++) {
            String language = preferred.get(i).getLanguage();
            if ("fr".equals(language) || "en".equals(language) || "es".equals(language)) return language;
        }
        return "auto";
    }

    @SuppressWarnings("deprecation")
    private String nativeVersionFragment() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return NativeVersion.fragment(info.versionName, code);
        } catch (PackageManager.NameNotFoundException | RuntimeException error) {
            return null;
        }
    }

    private void log(String event) {
        Log.i(TAG, "event=" + event + " installed=" + installed + " minimum=" + minimum
                + " offered=" + offered + " policy=" + policyStatus + " play=" + playStatus);
    }
}
