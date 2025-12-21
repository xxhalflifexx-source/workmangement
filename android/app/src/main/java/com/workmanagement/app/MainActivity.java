package com.workmanagement.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Manually register TextRecognitionPlugin for native OCR
        registerPlugin(TextRecognitionPlugin.class);
    }
}
