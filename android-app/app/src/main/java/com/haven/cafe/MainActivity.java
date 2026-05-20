package com.haven.cafe;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;

import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothGatt bluetoothGatt;
    private BluetoothGattCharacteristic writeCharacteristic;
    private BluetoothLeScanner activeScanner;
    private ScanCallback activeScanCallback;
    private static final int PERMISSION_REQUEST = 1;
    private static final String URL = "https://haven-beta-brown.vercel.app";

    // Write queue for serialized BLE chunk delivery
    private final Queue<byte[]> writeQueue = new ArrayDeque<>();
    private final AtomicBoolean writeInProgress = new AtomicBoolean(false);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        setContentView(webView);

        WebView.setWebContentsDebuggingEnabled(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUserAgentString(settings.getUserAgentString() + " HavenCafeApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                Toast.makeText(MainActivity.this, "Loading...", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Toast.makeText(MainActivity.this, "Loaded!", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Toast.makeText(MainActivity.this, "Error: " + error.getDescription(), Toast.LENGTH_LONG).show();
                    new Handler(Looper.getMainLooper()).postDelayed(() -> view.loadUrl(URL), 3000);
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new BluetoothBridge(), "AndroidBluetooth");

        BluetoothManager bm = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (bm != null) bluetoothAdapter = bm.getAdapter();

        requestBluetoothPermissions();
        webView.loadUrl(URL);
    }

    private void requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissions(new String[]{
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.ACCESS_FINE_LOCATION
            }, PERMISSION_REQUEST);
        } else {
            requestPermissions(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION
            }, PERMISSION_REQUEST);
        }
    }

    /** Stop the active BLE scan safely. */
    private void stopActiveScan() {
        if (activeScanner != null && activeScanCallback != null) {
            try { activeScanner.stopScan(activeScanCallback); } catch (Exception ignored) {}
            activeScanner = null;
            activeScanCallback = null;
        }
    }

    /** Drain the write queue one chunk at a time, waiting for onCharacteristicWrite. */
    private void drainWriteQueue() {
        if (!writeInProgress.compareAndSet(false, true)) return;
        byte[] chunk = writeQueue.poll();
        if (chunk == null) {
            writeInProgress.set(false);
            return;
        }
        writeCharacteristic.setValue(chunk);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            bluetoothGatt.writeCharacteristic(writeCharacteristic,
                    chunk, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
        } else {
            writeCharacteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            bluetoothGatt.writeCharacteristic(writeCharacteristic);
        }
    }

    public class BluetoothBridge {
        @JavascriptInterface
        public void connectPrinter() {
            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                runOnUiThread(() -> {
                    webView.evaluateJavascript("window.__btStatus && window.__btStatus('Bluetooth not available')", null);
                    Toast.makeText(MainActivity.this, "Enable Bluetooth first!", Toast.LENGTH_SHORT).show();
                });
                return;
            }

            BluetoothLeScanner scanner = bluetoothAdapter.getBluetoothLeScanner();
            if (scanner == null) return;

            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Scanning for printer...", Toast.LENGTH_SHORT).show());

            ScanCallback callback = new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    BluetoothDevice device = result.getDevice();
                    String name = device.getName();
                    if (name != null && (name.contains("Printer") || name.contains("printer") ||
                            name.contains("POS") || name.contains("RPP") || name.contains("BlueTooth") ||
                            name.contains("Gprinter") || name.contains("XP") || name.contains("PT") ||
                            name.contains("MPT") || name.contains("HM") || name.contains("MTP") ||
                            name.contains("Thermal") || name.contains("BT"))) {
                        // Stop scan BEFORE connecting
                        stopActiveScan();
                        connectToDevice(device);
                    }
                }
            };

            activeScanner = scanner;
            activeScanCallback = callback;
            scanner.startScan(callback);

            // Timeout: stop scan after 10 seconds if no printer found
            mainHandler.postDelayed(() -> {
                if (activeScanCallback != null) {
                    stopActiveScan();
                    if (writeCharacteristic == null) {
                        runOnUiThread(() -> {
                            webView.evaluateJavascript("window.__btStatus && window.__btStatus('No printer found')", null);
                            Toast.makeText(MainActivity.this, "No printer found nearby", Toast.LENGTH_LONG).show();
                        });
                    }
                }
            }, 10000);
        }

        private void connectToDevice(BluetoothDevice device) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Connecting: " + device.getName(), Toast.LENGTH_SHORT).show());

            bluetoothGatt = device.connectGatt(MainActivity.this, false, new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothGatt.STATE_CONNECTED) {
                        gatt.discoverServices();
                    } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                        writeCharacteristic = null;
                        writeQueue.clear();
                        writeInProgress.set(false);
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    for (BluetoothGattService service : gatt.getServices()) {
                        for (BluetoothGattCharacteristic c : service.getCharacteristics()) {
                            if ((c.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0 ||
                                (c.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) {
                                writeCharacteristic = c;
                                runOnUiThread(() -> {
                                    webView.evaluateJavascript("window.__btStatus && window.__btStatus('connected')", null);
                                    Toast.makeText(MainActivity.this, "Printer connected!", Toast.LENGTH_SHORT).show();
                                });
                                return;
                            }
                        }
                    }
                }

                @Override
                public void onCharacteristicWrite(BluetoothGatt gatt,
                        BluetoothGattCharacteristic characteristic, int status) {
                    // Previous chunk done — send next one
                    writeInProgress.set(false);
                    if (!writeQueue.isEmpty()) {
                        // Small delay to let the printer buffer settle
                        mainHandler.postDelayed(MainActivity.this::drainWriteQueue, 20);
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean isConnected() {
            return writeCharacteristic != null;
        }

        @JavascriptInterface
        public boolean printData(String base64Data) {
            if (writeCharacteristic == null || bluetoothGatt == null) return false;
            try {
                byte[] data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                // Enqueue all 20-byte chunks
                writeQueue.clear();
                for (int i = 0; i < data.length; i += 20) {
                    int end = Math.min(i + 20, data.length);
                    byte[] chunk = new byte[end - i];
                    System.arraycopy(data, i, chunk, 0, chunk.length);
                    writeQueue.add(chunk);
                }
                // Start draining (callback-driven, no Thread.sleep)
                writeInProgress.set(false);
                drainWriteQueue();
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopActiveScan();
        if (bluetoothGatt != null) {
            bluetoothGatt.close();
            bluetoothGatt = null;
        }
    }
}
