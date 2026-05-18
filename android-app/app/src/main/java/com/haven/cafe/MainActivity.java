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
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;

import java.util.List;
import java.util.UUID;

public class MainActivity extends Activity {
    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothGatt bluetoothGatt;
    private BluetoothGattCharacteristic writeCharacteristic;
    private static final int PERMISSION_REQUEST = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new BluetoothBridge(), "AndroidBluetooth");

        BluetoothManager bm = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (bm != null) bluetoothAdapter = bm.getAdapter();

        requestBluetoothPermissions();

        webView.loadUrl("https://haven-beta-brown.vercel.app");
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

    public class BluetoothBridge {
        @JavascriptInterface
        public void connectPrinter() {
            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                runOnUiThread(() -> {
                    webView.evaluateJavascript("window.__btStatus && window.__btStatus('Bluetooth not available')", null);
                    Toast.makeText(MainActivity.this, "Enable Bluetooth", Toast.LENGTH_SHORT).show();
                });
                return;
            }

            BluetoothLeScanner scanner = bluetoothAdapter.getBluetoothLeScanner();
            if (scanner == null) return;

            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Scanning for printer...", Toast.LENGTH_SHORT).show());

            scanner.startScan(new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    BluetoothDevice device = result.getDevice();
                    String name = device.getName();
                    if (name != null && (name.contains("Printer") || name.contains("printer") ||
                            name.contains("POS") || name.contains("RPP") || name.contains("BlueTooth") ||
                            name.contains("Gprinter") || name.contains("XP") || name.contains("PT") ||
                            name.contains("MPT") || name.contains("HM") || name.contains("MTP"))) {
                        scanner.stopScan(this);
                        connectToDevice(device);
                    }
                }

                @Override
                public void onScanFailed(int errorCode) {
                    runOnUiThread(() -> {
                        webView.evaluateJavascript("window.__btStatus && window.__btStatus('Scan failed')", null);
                        Toast.makeText(MainActivity.this, "Scan failed", Toast.LENGTH_SHORT).show();
                    });
                }
            });

            // Stop scan after 10 seconds
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try { scanner.stopScan(new ScanCallback() {}); } catch (Exception e) {}
                if (writeCharacteristic == null) {
                    runOnUiThread(() -> {
                        webView.evaluateJavascript("window.__btStatus && window.__btStatus('No printer found')", null);
                        Toast.makeText(MainActivity.this, "No printer found. Make sure printer is ON.", Toast.LENGTH_LONG).show();
                    });
                }
            }, 10000);
        }

        private void connectToDevice(BluetoothDevice device) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Connecting to " + device.getName(), Toast.LENGTH_SHORT).show());

            bluetoothGatt = device.connectGatt(MainActivity.this, false, new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothGatt.STATE_CONNECTED) {
                        gatt.discoverServices();
                    } else {
                        runOnUiThread(() -> webView.evaluateJavascript("window.__btStatus && window.__btStatus('Disconnected')", null));
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    for (BluetoothGattService service : gatt.getServices()) {
                        for (BluetoothGattCharacteristic c : service.getCharacteristics()) {
                            if ((c.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0 ||
                                (c.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) {
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
                // Send in chunks of 20 bytes (BLE limit)
                for (int i = 0; i < data.length; i += 20) {
                    int end = Math.min(i + 20, data.length);
                    byte[] chunk = new byte[end - i];
                    System.arraycopy(data, i, chunk, 0, chunk.length);
                    writeCharacteristic.setValue(chunk);
                    bluetoothGatt.writeCharacteristic(writeCharacteristic);
                    Thread.sleep(50);
                }
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
        if (bluetoothGatt != null) bluetoothGatt.close();
    }
}
