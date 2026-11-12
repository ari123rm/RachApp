package com.ariel.rachapp;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
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
    private static final int REQ_CAMERA = 9402;
    private ActivityResultLauncher<String> contactsPermissionLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;
    private ActivityResultLauncher<Intent> cameraCaptureLauncher;
    private File pendingCameraFile = null;
    private boolean bridgeRegistered = false;

    @Keep
    @CapacitorPlugin(
        name = "RachAppContacts",
        permissions = {
            @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS })
        }
    )
    public static class RachAppContactsPlugin extends Plugin {
        @PluginMethod
        public void getContacts(PluginCall call) {
            if (getPermissionState("contacts") == PermissionState.GRANTED) {
                loadContactsForCall(call);
            } else {
                requestPermissionForAlias("contacts", call, "contactsPermsCallback");
            }
        }

        @PermissionCallback
        public void contactsPermsCallback(PluginCall call) {
            if (getPermissionState("contacts") == PermissionState.GRANTED) {
                loadContactsForCall(call);
            } else {
                JSObject ret = new JSObject();
                ret.put("contacts", new JSArray());
                ret.put("status", "permission_denied");
                call.resolve(ret);
            }
        }

        private void loadContactsForCall(PluginCall call) {
            Context ctx = getContext();
            new Thread(() -> {
                JSArray contactsArr = queryDeviceContactsAsJSArray(ctx);
                JSObject ret = new JSObject();
                ret.put("contacts", contactsArr);
                ret.put("status", "ok");
                call.resolve(ret);
            }).start();
        }
    }

    @Keep
    public class ReceiptBridge {
        @Keep
        @JavascriptInterface
        public String getPendingReceipt() {
            String res = pendingSharedReceipt;
            pendingSharedReceipt = null;
            return res;
        }

        @Keep
        @JavascriptInterface
        public void clearPendingReceipt() {
            pendingSharedReceipt = null;
        }

        @Keep
        @JavascriptInterface
        public void shareFileBase64(String dataUrl, String title) {
            try {
                if (dataUrl == null || dataUrl.isEmpty()) return;

                String mimeType = "image/jpeg";
                String ext = "jpg";
                String base64Content = dataUrl;

                if (dataUrl.startsWith("data:")) {
                    int commaIndex = dataUrl.indexOf(",");
                    if (commaIndex != -1) {
                        String header = dataUrl.substring(5, commaIndex);
                        base64Content = dataUrl.substring(commaIndex + 1);
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

        @Keep
        @JavascriptInterface
        public void requestContacts() {
            runOnUiThread(() -> {
                try {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.READ_CONTACTS)
                            == PackageManager.PERMISSION_GRANTED) {
                        loadPhoneContactsAndDeliver();
                    } else if (contactsPermissionLauncher != null) {
                        contactsPermissionLauncher.launch(Manifest.permission.READ_CONTACTS);
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

        @Keep
        @JavascriptInterface
        public void takePhoto() {
            runOnUiThread(() -> {
                try {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        launchNativeCameraIntent();
                    } else if (cameraPermissionLauncher != null) {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                    } else {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.CAMERA},
                            REQ_CAMERA
                        );
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    dispatchCameraPayload("", "error");
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RachAppContactsPlugin.class);
        contactsPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (Boolean.TRUE.equals(isGranted)) {
                    loadPhoneContactsAndDeliver();
                } else {
                    dispatchContactsPayload("[]", "permission_denied");
                }
            }
        );
        cameraPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (Boolean.TRUE.equals(isGranted)) {
                    launchNativeCameraIntent();
                } else {
                    dispatchCameraPayload("", "permission_denied");
                }
            }
        );
        cameraCaptureLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK) {
                    processCapturedCameraPhoto(pendingCameraFile, result.getData());
                } else {
                    if (pendingCameraFile != null && pendingCameraFile.exists()) {
                        try {
                            pendingCameraFile.delete();
                        } catch (Exception ignored) {}
                    }
                    pendingCameraFile = null;
                    dispatchCameraPayload("", "cancelled");
                }
            }
        );
        super.onCreate(savedInstanceState);
        setupBridge();
        handleSendIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        setupBridge();
        if (pendingSharedReceipt != null) {
            deliverToWebView();
        }
    }

    private void setupBridge() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null && !bridgeRegistered) {
                webView.addJavascriptInterface(new ReceiptBridge(), "AndroidReceiptBridge");
                bridgeRegistered = true;
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
        } else if (requestCode == REQ_CAMERA) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                launchNativeCameraIntent();
            } else {
                dispatchCameraPayload("", "permission_denied");
            }
        }
    }

    private void launchNativeCameraIntent() {
        try {
            File cacheDir = new File(getCacheDir(), "shared_receipts");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            pendingCameraFile = new File(cacheDir, "camera_avatar_" + System.currentTimeMillis() + ".jpg");
            Uri photoUri = FileProvider.getUriForFile(
                MainActivity.this,
                getPackageName() + ".fileprovider",
                pendingCameraFile
            );

            Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            takePictureIntent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );

            if (cameraCaptureLauncher != null) {
                cameraCaptureLauncher.launch(takePictureIntent);
            } else {
                dispatchCameraPayload("", "error");
            }
        } catch (Exception e) {
            e.printStackTrace();
            dispatchCameraPayload("", "error");
        }
    }

    private void processCapturedCameraPhoto(final File photoFile, final Intent dataIntent) {
        new Thread(() -> {
            try {
                Bitmap bitmap = null;
                int rotationDegrees = 0;
                boolean flipHorizontal = false;

                if (photoFile != null && photoFile.exists() && photoFile.length() > 0) {
                    String path = photoFile.getAbsolutePath();
                    try {
                        ExifInterface exif = new ExifInterface(path);
                        int orientation = exif.getAttributeInt(
                            ExifInterface.TAG_ORIENTATION,
                            ExifInterface.ORIENTATION_NORMAL
                        );
                        switch (orientation) {
                            case ExifInterface.ORIENTATION_ROTATE_90:
                                rotationDegrees = 90;
                                break;
                            case ExifInterface.ORIENTATION_ROTATE_180:
                                rotationDegrees = 180;
                                break;
                            case ExifInterface.ORIENTATION_ROTATE_270:
                                rotationDegrees = 270;
                                break;
                            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:
                                flipHorizontal = true;
                                break;
                            case ExifInterface.ORIENTATION_TRANSPOSE:
                                rotationDegrees = 90;
                                flipHorizontal = true;
                                break;
                            case ExifInterface.ORIENTATION_TRANSVERSE:
                                rotationDegrees = 270;
                                flipHorizontal = true;
                                break;
                            default:
                                break;
                        }
                    } catch (Exception ignored) {}

                    BitmapFactory.Options boundsOpts = new BitmapFactory.Options();
                    boundsOpts.inJustDecodeBounds = true;
                    BitmapFactory.decodeFile(path, boundsOpts);

                    int sampleSize = 1;
                    int maxDim = Math.max(boundsOpts.outWidth, boundsOpts.outHeight);
                    while (maxDim / sampleSize > 1600) {
                        sampleSize *= 2;
                    }

                    BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
                    decodeOpts.inSampleSize = sampleSize;
                    bitmap = BitmapFactory.decodeFile(path, decodeOpts);
                }

                if (bitmap == null && dataIntent != null && dataIntent.getExtras() != null) {
                    Object rawData = dataIntent.getExtras().get("data");
                    if (rawData instanceof Bitmap) {
                        bitmap = (Bitmap) rawData;
                    }
                }

                if (photoFile != null && photoFile.exists()) {
                    try {
                        photoFile.delete();
                    } catch (Exception ignored) {}
                }

                if (bitmap == null) {
                    dispatchCameraPayload("", "error");
                    return;
                }

                int width = bitmap.getWidth();
                int height = bitmap.getHeight();
                int targetMax = 1400;
                float scale = 1.0f;
                if (width > targetMax || height > targetMax) {
                    scale = Math.min((float) targetMax / width, (float) targetMax / height);
                }

                if (rotationDegrees != 0 || flipHorizontal || scale < 1.0f) {
                    Matrix matrix = new Matrix();
                    if (scale < 1.0f) {
                        matrix.postScale(scale, scale);
                    }
                    if (flipHorizontal) {
                        matrix.postScale(-1.0f, 1.0f);
                    }
                    if (rotationDegrees != 0) {
                        matrix.postRotate(rotationDegrees);
                    }
                    Bitmap transformed = Bitmap.createBitmap(bitmap, 0, 0, width, height, matrix, true);
                    if (transformed != bitmap) {
                        bitmap.recycle();
                        bitmap = transformed;
                    }
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 88, baos);
                byte[] jpegBytes = baos.toByteArray();
                bitmap.recycle();

                String base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
                String dataUrl = "data:image/jpeg;base64," + base64;
                dispatchCameraPayload(dataUrl, "ok");
            } catch (Exception e) {
                e.printStackTrace();
                dispatchCameraPayload("", "error");
            }
        }).start();
    }

    private void dispatchCameraPayload(String dataUrl, String status) {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                String quotedUrl = JSONObject.quote(dataUrl != null ? dataUrl : "");
                String quotedStatus = JSONObject.quote(status != null ? status : "error");
                String js = "try {" +
                        "  window.dispatchEvent(new CustomEvent('rachappCameraPhoto', {" +
                        "    detail: { dataUrl: " + quotedUrl + ", status: " + quotedStatus + " }" +
                        "  }));" +
                        "} catch(e) { console.error(e); }";
                webView.post(() -> webView.evaluateJavascript(js, null));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static JSArray queryDeviceContactsAsJSArray(Context context) {
        JSArray arr = new JSArray();
        Set<String> seenKeys = new HashSet<>();
        Cursor cursor = null;
        try {
            cursor = context.getContentResolver().query(
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
                    String digits = phone.replaceAll("\\D", "");
                    if (name.isEmpty() && digits.isEmpty()) continue;

                    String dedupKey = name.toLowerCase() + "|" + (digits.length() >= 8 ? digits.substring(digits.length() - 8) : digits);
                    if (seenKeys.contains(dedupKey)) continue;
                    seenKeys.add(dedupKey);

                    JSObject obj = new JSObject();
                    obj.put("name", name.isEmpty() ? phone.trim() : name);
                    obj.put("phone", phone.trim());
                    arr.put(obj);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (cursor != null) {
                try {
                    cursor.close();
                } catch (Exception ignored) {}
            }
        }
        return arr;
    }

    private void loadPhoneContactsAndDeliver() {
        new Thread(() -> {
            JSONArray arr = queryDeviceContactsAsJSArray(MainActivity.this);
            dispatchContactsPayload(arr.toString(), "ok");
        }).start();
    }

    private void dispatchContactsPayload(String jsonArrayString, String status) {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                String quotedJson = JSONObject.quote(jsonArrayString);
                String quotedStatus = JSONObject.quote(status);
                String js = "try {" +
                        "  var parsed = JSON.parse(" + quotedJson + ");" +
                        "  if (" + quotedStatus + " === 'ok' && Array.isArray(parsed)) {" +
                        "    try { localStorage.setItem('rachapp_phone_contacts_cache', " + quotedJson + "); } catch(e) {}" +
                        "  }" +
                        "  window.dispatchEvent(new CustomEvent('rachappContactsLoaded', {" +
                        "    detail: { contacts: parsed, status: " + quotedStatus + ", error: " + quotedStatus + " === 'ok' ? null : " + quotedStatus + " }" +
                        "  }));" +
                        "  window.dispatchEvent(new CustomEvent('rachappPhoneContacts', {" +
                        "    detail: { contacts: parsed, status: " + quotedStatus + ", error: " + quotedStatus + " === 'ok' ? null : " + quotedStatus + " }" +
                        "  }));" +
                        "} catch(e) { console.error(e); }";
                webView.post(() -> webView.evaluateJavascript(js, null));
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
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action) && type != null) {
            if (type.startsWith("image/")) {
                java.util.ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (uris != null && !uris.isEmpty()) {
                    intent.removeExtra(Intent.EXTRA_STREAM);
                    setIntent(new Intent(Intent.ACTION_MAIN));
                    processUriAndDeliver(uris.get(0), type);
                }
            }
        }
    }

    private void processUriAndDeliver(Uri uri, String mimeType) {
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
            String cleanMime = mimeType.contains("pdf") ? "application/pdf" : "image/jpeg";
            if (mimeType.contains("png")) cleanMime = "image/png";

            pendingSharedReceipt = "data:" + cleanMime + ";base64," + base64;

            deliverToWebView();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void deliverToWebView() {
        if (pendingSharedReceipt == null) return;
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                String receiptToDeliver = pendingSharedReceipt;
                pendingSharedReceipt = null;

                String quoted = JSONObject.quote(receiptToDeliver);
                String js = "try {" +
                        "  localStorage.setItem('rachapp_pending_shared_receipt', " + quoted + ");" +
                        "  window.dispatchEvent(new CustomEvent('rachappSharedReceipt', { detail: { dataUrl: " + quoted + " } }));" +
                        "} catch(e) {}";
                webView.post(() -> webView.evaluateJavascript(js, null));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
