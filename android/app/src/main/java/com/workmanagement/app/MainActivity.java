package com.workmanagement.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register plugin BEFORE super.onCreate() so it's added to bridgeBuilder
        // before the bridge is created in load()
        Log.d(TAG, "Registering TextRecognitionPlugin...");
        registerPlugin(TextRecognitionPlugin.class);
        Log.d(TAG, "TextRecognitionPlugin registered successfully");
        
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "MainActivity onCreate completed");
    }
}
