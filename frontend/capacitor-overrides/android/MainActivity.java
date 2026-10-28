package com.ariel.rachapp;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private static String pendingSharedReceipt = null;
    private static final int REQ_READ_CONTACTS = 9401;

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

                    @JavascriptInterface
                    public void shareReceipt(String dataUrl, String title) {
                        try {
                            if (dataUrl == null || dataUrl.trim().isEmpty()) return;

                            String base64Content = dataUrl.trim();
                            String mimeType = "image/jpeg";
                            String ext = "jpg";

                            if (base64Content.contains(",")) {
                                String header = base64Content.substring(0, base64Content.indexOf(","));
                                base64Content = base64Content.substring(base64Content.indexOf(",") + 1);
                                if (header.contains("image/png")) {
                                    mimeType = "image/png";
                                    ext = "png";
                                } else if (header.contains("application/pdf")) {
                                    mimeType = "application/pdf";
                                    ext = "pdf";
                                } else if (header.contains("image/webp")) {
                                    mimeType = "image/webp";
                                    ext = "webp";
                                }
                            }

                            byte[] bytes = Base64.decode(base64Content, Base64.DEFAULT);

                            File cacheDir = new File(getCacheDir(), "shared_receipts");
                            if (!cacheDir.exists()) {
                                cacheDir.mkdirs();
                            }
                            File file = new File(cacheDir, "comprovante_rachapp." + ext);
                            FileOutputStream fos = new FileOutputStream(file);
                            fos.write(bytes);
                            fos.flush();
                            fos.close();

                            Uri fileUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                file
                            );

                            Intent shareIntent = new Intent(Intent.ACTION_SEND);
                            shareIntent.setType(mimeType);
                            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                            shareIntent.putExtra(Intent.EXTRA_TEXT, "Comprovante de pagamento - RachApp");
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                            Intent chooser = Intent.createChooser(
                                shareIntent,
                                title != null && !title.isEmpty() ? title : "Compartilhar comprovante"
                            );
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(chooser);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }

                    @JavascriptInterface
                    public void requestContacts() {
                        runOnUiThread(() -> {
                            try {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.READ_CONTACTS)
                                        == PackageManager.PERMISSION_GRANTED) {
                                    loadPhoneContactsAndDeliver();
                                } else {
                                    ActivityCompat.requestPermissions(
                                        MainActivity.this,
                                        new String[]{Manifest.permission.READ_CONTACTS},
                                        REQ_READ_CONTACTS
                                    );
                                }
                            } catch (Exception e) {
                                e.printStackTrace();
                                dispatchContactsPayload("[]", "error");
                            }
                        });
                    }
                }, "AndroidReceiptBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_READ_CONTACTS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                loadPhoneContactsAndDeliver();
            } else {
                dispatchContactsPayload("[]", "permission_denied");
            }
        }
    }

    private void loadPhoneContactsAndDeliver() {
        new Thread(() -> {
            JSONArray arr = new JSONArray();
            Set<String> seenKeys = new HashSet<>();
            Cursor cursor = null;
            try {
                cursor = getContentResolver().query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        ContactsContract.CommonDataKinds.Phone.NUMBER
                    },
                    null,
                    null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
                );
                if (cursor != null) {
                    int nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                    int numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    while (cursor.moveToNext()) {
                        String name = nameIdx >= 0 ? cursor.getString(nameIdx) : "";
                        String phone = numIdx >= 0 ? cursor.getString(numIdx) : "";
                        if (name == null) name = "";
                        if (phone == null) phone = "";
                        name = name.trim();
                        String digits = phone.replaceAll("\\D+", "");
                        if (name.isEmpty() && digits.isEmpty()) continue;

                        String dedupKey = name.toLowerCase() + "|" + digits;
                        if (seenKeys.contains(dedupKey)) continue;
                        seenKeys.add(dedupKey);

                        JSONObject obj = new JSONObject();
                        obj.put("name", name.isEmpty() ? phone : name);
                        obj.put("phone", phone.trim());
                        arr.put(obj);
                    }
                }
                dispatchContactsPayload(arr.toString(), null);
            } catch (Exception e) {
                e.printStackTrace();
                dispatchContactsPayload("[]", "error");
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }).start();
    }

    private void dispatchContactsPayload(String jsonArrayStr, String error) {
        runOnUiThread(() -> {
            try {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    String errVal = error != null ? JSONObject.quote(error) : "null";
                    String js = "try {" +
                        "  window.dispatchEvent(new CustomEvent('rachappPhoneContacts', { detail: { contacts: " + jsonArrayStr + ", error: " + errVal + " } }));" +
                        "} catch(e) { console.error('Error delivering contacts:', e); }";
                    webView.post(() -> webView.evaluateJavascript(js, null));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
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
