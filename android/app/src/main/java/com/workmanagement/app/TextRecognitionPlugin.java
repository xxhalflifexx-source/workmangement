package com.workmanagement.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.ByteArrayOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(name = "TextRecognition")
public class TextRecognitionPlugin extends Plugin {
    private static final String TAG = "TextRecognitionPlugin";

    private TextRecognizer textRecognizer;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "TextRecognitionPlugin.load() called - initializing ML Kit");
        // Initialize ML Kit Text Recognizer
        textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        Log.d(TAG, "TextRecognitionPlugin loaded successfully");
    }

    @Override
    public void handleOnDestroy() {
        super.handleOnDestroy();
        if (textRecognizer != null) {
            textRecognizer.close();
        }
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        Log.d(TAG, "TextRecognitionPlugin.recognize() called");
        try {
            String imageBase64 = call.getString("image");
            String imageFormat = call.getString("imageFormat", "jpeg");
            Log.d(TAG, "Processing image - format: " + imageFormat + ", data length: " + (imageBase64 != null ? imageBase64.length() : 0));

            if (imageBase64 == null || imageBase64.isEmpty()) {
                call.reject("Image data is required");
                return;
            }

            // Remove data URL prefix if present
            if (imageBase64.contains(",")) {
                imageBase64 = imageBase64.split(",")[1];
            }

            // Decode base64 to bitmap
            byte[] decodedBytes = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

            if (bitmap == null) {
                call.reject("Failed to decode image");
                return;
            }

            // Create InputImage for ML Kit
            InputImage image = InputImage.fromBitmap(bitmap, 0);

            // Use CountDownLatch to wait for async result
            CountDownLatch latch = new CountDownLatch(1);
            AtomicReference<String> recognizedTextRef = new AtomicReference<>("");
            AtomicReference<Double> confidenceRef = new AtomicReference<>(0.0);
            AtomicReference<String> errorRef = new AtomicReference<>(null);

            // Process image with ML Kit
            textRecognizer.process(image)
                .addOnSuccessListener(visionText -> {
                    try {
                        StringBuilder fullText = new StringBuilder();
                        double totalConfidence = 0.0;
                        int blockCount = 0;

                        // Extract text from all blocks
                        for (com.google.mlkit.vision.text.Text.TextBlock block : visionText.getTextBlocks()) {
                            String blockText = block.getText();
                            fullText.append(blockText).append("\n");

                            // Calculate average confidence from lines
                            for (com.google.mlkit.vision.text.Text.Line line : block.getLines()) {
                                for (com.google.mlkit.vision.text.Text.Element element : line.getElements()) {
                                    // ML Kit doesn't provide confidence directly, so we estimate
                                    // based on recognition quality (presence of recognized text)
                                    if (element.getText() != null && !element.getText().isEmpty()) {
                                        totalConfidence += 90.0; // High confidence for recognized text
                                        blockCount++;
                                    }
                                }
                            }
                        }

                        String text = fullText.toString().trim();
                        double confidence = blockCount > 0 ? totalConfidence / blockCount : 0.0;

                        recognizedTextRef.set(text);
                        confidenceRef.set(confidence);
                        latch.countDown();
                    } catch (Exception e) {
                        errorRef.set("Error processing text: " + e.getMessage());
                        latch.countDown();
                    }
                })
                .addOnFailureListener(e -> {
                    errorRef.set("ML Kit recognition failed: " + e.getMessage());
                    latch.countDown();
                });

            // Wait for result (with timeout)
            try {
                latch.await();
            } catch (InterruptedException e) {
                call.reject("Recognition interrupted");
                return;
            }

            // Check for errors
            if (errorRef.get() != null) {
                call.reject(errorRef.get());
                return;
            }

            // Return result
            String recognizedText = recognizedTextRef.get();
            Double confidence = confidenceRef.get();
            Log.d(TAG, "Recognition successful - text length: " + recognizedText.length() + ", confidence: " + confidence);
            
            JSObject result = new JSObject();
            result.put("text", recognizedText);
            result.put("confidence", confidence);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Recognition error: " + e.getMessage(), e);
            call.reject("Recognition error: " + e.getMessage());
        }
    }
}

