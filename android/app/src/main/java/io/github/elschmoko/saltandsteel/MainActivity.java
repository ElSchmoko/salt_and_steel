package io.github.elschmoko.saltandsteel;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Salt & Steel for Android.
 *
 * The game always runs from its GitHub Pages address, so each launch picks up the newest version
 * that has been pushed to the repository. The page is fetched fresh when there is a connection and
 * kept on the phone, so the game still opens offline (from the last copy seen, or from the copy
 * packed into the app). Because the address never changes, saved games stay where they are.
 */
public class MainActivity extends Activity {
    static final String GAME_URL = "https://elschmoko.github.io/salt_and_steel/";
    static final String CACHE_FILE = "game.html";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#081a24"));
        w.setNavigationBarColor(Color.parseColor("#081a24"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#081a24"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new GameClient());
        setContentView(web);
        hideBars();

        if (state != null) web.restoreState(state);
        else web.loadUrl(GAME_URL);
    }

    private void hideBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) hideBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    /** The back button closes an open panel in the game (Escape); a second press leaves the app. */
    private long lastBack = 0;

    @Override
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBack < 600) { super.onBackPressed(); return; }
        lastBack = now;
        web.evaluateJavascript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", null);
    }

    private class GameClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (u.toString().startsWith(GAME_URL)) return false;
            // other links open in the browser
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            String url = req.getUrl().toString();
            boolean page = req.isForMainFrame() && (url.equals(GAME_URL) || url.equals(GAME_URL + "index.html") || url.startsWith(GAME_URL + "?") || url.startsWith(GAME_URL + "#"));
            if (!page) return null;
            byte[] html = fetchFresh();
            if (html == null) html = readCached();
            if (html == null) html = readBundled();
            if (html == null) return null;
            return new WebResourceResponse("text/html", "utf-8", new ByteArrayInputStream(html));
        }
    }

    /** Newest game from GitHub Pages, or null when offline. A good copy is kept for offline play. */
    private byte[] fetchFresh() {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(GAME_URL + "?t=" + System.currentTimeMillis()).openConnection();
            c.setConnectTimeout(5000);
            c.setReadTimeout(10000);
            c.setUseCaches(false);
            c.setRequestProperty("Cache-Control", "no-cache");
            if (c.getResponseCode() != 200) return null;
            byte[] data = readAll(c.getInputStream());
            if (data.length < 10000) return null;
            try (FileOutputStream f = new FileOutputStream(new File(getFilesDir(), CACHE_FILE))) { f.write(data); }
            return data;
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private byte[] readCached() {
        File f = new File(getFilesDir(), CACHE_FILE);
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) { return readAll(in); } catch (Exception e) { return null; }
    }

    private byte[] readBundled() {
        try (InputStream in = getAssets().open("index.html")) { return readAll(in); } catch (Exception e) { return null; }
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }
}
