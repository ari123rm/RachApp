package com.ariel.rachapp;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {
    private static String pendingSharedReceipt = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupBridge();
        handleSendIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        setupBridge();
        deliverPendingReceiptToWebView();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent);
    }

    private void setupBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();

                // Intercepta requisições de download do WebView para abrir no navegador/DownloadManager nativo
                webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public String getPendingReceipt() {
                        String res = pendingSharedReceipt;
                        pendingSharedReceipt = null;
                        return res;
                    }

                    @JavascriptInterface
                    public void clearPendingReceipt() {
                        pendingSharedReceipt = null;
                    }

                    @JavascriptInterface
                    public void openExternalUrl(String url) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }, "AndroidReceiptBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void handleSendIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if (type.startsWith("image/") || type.equals("application/pdf")) {
                Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (imageUri != null) {
                    intent.removeExtra(Intent.EXTRA_STREAM);
                    setIntent(new Intent(Intent.ACTION_MAIN));
                    processUriAndDeliver(imageUri, type);
                }
            }
        }
    }

    private void processUriAndDeliver(Uri uri, String mimeType) {
        new Thread(() -> {
            try {
                InputStream is = getContentResolver().openInputStream(uri);
                if (is == null) return;

                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                int nRead;
                byte[] data = new byte[16384];
                while ((nRead = is.read(data, 0, data.length)) != -1) {
                    buffer.write(data, 0, nRead);
                }
                buffer.flush();
                byte[] bytes = buffer.toByteArray();
                is.close();

                String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                String dataUrl = "data:" + (mimeType.contains("pdf") ? "application/pdf" : "image/jpeg") + ";base64," + base64;
                pendingSharedReceipt = dataUrl;

                runOnUiThread(this::deliverPendingReceiptToWebView);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void deliverPendingReceiptToWebView() {
        if (pendingSharedReceipt == null) return;

        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                String receiptToDeliver = pendingSharedReceipt;
                pendingSharedReceipt = null; // Evita loop no onResume

                String quoted = JSONObject.quote(receiptToDeliver);
                String js = "try {" +
                        "  localStorage.setItem('rachapp_pending_shared_receipt', " + quoted + ");" +
                        "  window.dispatchEvent(new CustomEvent('rachappSharedReceipt', { detail: { dataUrl: " + quoted + " } }));" +
                        "} catch(e) { console.error('Error delivering receipt:', e); }";
                webView.post(() -> webView.evaluateJavascript(js, null));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
