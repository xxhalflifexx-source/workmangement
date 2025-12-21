import Foundation
import Capacitor
import Vision
import UIKit

/**
 * Text Recognition Plugin for iOS using Vision Framework
 */
@objc(TextRecognitionPlugin)
public class TextRecognitionPlugin: CAPPlugin {
    
    @objc func recognize(_ call: CAPPluginCall) {
        guard let imageBase64 = call.getString("image") else {
            call.reject("Image data is required")
            return
        }
        
        let imageFormat = call.getString("imageFormat", "jpeg")
        
        // Remove data URL prefix if present
        let base64String = imageBase64.contains(",") 
            ? String(imageBase64.split(separator: ",")[1])
            : imageBase64
        
        // Decode base64 to UIImage
        guard let imageData = Data(base64Encoded: base64String),
              let image = UIImage(data: imageData) else {
            call.reject("Failed to decode image")
            return
        }
        
        // Convert UIImage to CIImage for Vision
        guard let ciImage = CIImage(image: image) else {
            call.reject("Failed to create CIImage")
            return
        }
        
        // Create text recognition request
        let request = VNRecognizeTextRequest { (request, error) in
            if let error = error {
                call.reject("Vision recognition error: \(error.localizedDescription)")
                return
            }
            
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.reject("No text observations found")
                return
            }
            
            // Extract text from observations
            var fullText = ""
            var totalConfidence: Float = 0.0
            var observationCount = 0
            
            for observation in observations {
                guard let topCandidate = observation.topCandidates(1).first else {
                    continue
                }
                
                let text = topCandidate.string
                let confidence = topCandidate.confidence
                
                fullText += text + "\n"
                totalConfidence += confidence
                observationCount += 1
            }
            
            let text = fullText.trimmingCharacters(in: .whitespacesAndNewlines)
            let avgConfidence = observationCount > 0 
                ? Double(totalConfidence / Float(observationCount)) * 100.0 
                : 0.0
            
            // Return result
            call.resolve([
                "text": text,
                "confidence": avgConfidence
            ])
        }
        
        // Configure request for better accuracy
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        
        // Perform request
        let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                call.reject("Failed to perform recognition: \(error.localizedDescription)")
            }
        }
    }
}

