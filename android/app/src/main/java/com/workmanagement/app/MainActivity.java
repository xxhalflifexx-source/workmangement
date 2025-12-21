package com.workmanagement.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Manually register TextRecognitionPlugin
        // This ensures the plugin is available even if auto-discovery fails
        ArrayList<Class<? extends Plugin>> plugins = new ArrayList<>();
        plugins.add(TextRecognitionPlugin.class);
        this.init(savedInstanceState, plugins);
    }
}
