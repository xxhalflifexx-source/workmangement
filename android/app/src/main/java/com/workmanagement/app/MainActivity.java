package com.workmanagement.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Manually register TextRecognitionPlugin
        // This ensures the plugin is available even if annotation processing fails
        registerPlugin(TextRecognitionPlugin.class);
    }
}
