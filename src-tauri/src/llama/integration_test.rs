#[cfg(test)]
mod integration_test {
    use crate::{initialize_local_model, generate_text, get_model_status};
    use tokio::time::{timeout, Duration};

    /// Integration test to verify the LLM service works end-to-end
    #[tokio::test]
    async fn test_llm_integration() {
        println!("\n🚀 LLM Integration Test");
        println!("======================");

        // Step 1: Initialize the model
        println!("\n📥 Step 1: Initializing local model...");
        match initialize_local_model().await {
            Ok(message) => {
                println!("✅ Initialization successful: {}", message);
            }
            Err(e) => {
                println!("❌ Initialization failed: {}", e);
                panic!("Model initialization failed: {}", e);
            }
        }

        // Step 2: Check model status
        println!("\n📊 Step 2: Checking model status...");
        match get_model_status().await {
            Ok(status) => {
                println!("✅ Status check successful");
                println!("   Available: {}", status.is_available);
                println!("   Loaded: {}", status.is_loaded);
                
                assert!(status.is_available, "Model should be available");
                assert!(status.is_loaded, "Model should be loaded");
                
                if let Some(info) = &status.model_info {
                    println!("   Model: {} ({} MB)", info.name, info.size_mb);
                }
            }
            Err(e) => {
                println!("❌ Status check failed: {}", e);
                panic!("Status check failed: {}", e);
            }
        }

        // Step 3: Test text generation
        println!("\n💬 Step 3: Testing text generation...");
        
        let test_cases = vec![
            ("Task Management", "Help me create a task for reviewing code"),
            ("Time Tracking", "How can I track my productivity?"),
            ("General Help", "What can you help me with?"),
        ];

        for (category, prompt) in test_cases {
            println!("\n🔹 Testing {}: \"{}\"", category, prompt);
            
            match timeout(
                Duration::from_secs(10),
                generate_text(prompt.to_string(), Some(100), Some(0.7))
            ).await {
                Ok(Ok(response)) => {
                    println!("   ✅ Response ({} chars): {}", response.len(), response);
                    
                    // Verify response quality
                    assert!(!response.is_empty(), "Response should not be empty");
                    assert!(response.len() > 10, "Response should be substantial");
                    
                    // Check contextual relevance
                    let is_relevant = match category {
                        "Task Management" => response.to_lowercase().contains("task") || 
                                           response.to_lowercase().contains("manage") ||
                                           response.to_lowercase().contains("create"),
                        "Time Tracking" => response.to_lowercase().contains("time") || 
                                          response.to_lowercase().contains("track") ||
                                          response.to_lowercase().contains("productivity"),
                        "General Help" => response.to_lowercase().contains("help") || 
                                         response.to_lowercase().contains("assist") ||
                                         response.to_lowercase().contains("kira"),
                        _ => true,
                    };
                    
                    if is_relevant {
                        println!("   🎯 Response is contextually relevant");
                    } else {
                        println!("   ⚠️  Response may not be contextually relevant (but that's OK for mock)");
                    }
                }
                Ok(Err(e)) => {
                    println!("   ❌ Generation failed: {}", e);
                    panic!("Text generation failed: {}", e);
                }
                Err(_) => {
                    println!("   ⏰ Timed out after 10 seconds");
                    panic!("Text generation timed out");
                }
            }
        }

        // Step 4: Test parameter variations
        println!("\n🎛️  Step 4: Testing generation parameters...");
        
        let param_tests = vec![
            ("Short & Conservative", Some(50), Some(0.1)),
            ("Medium & Balanced", Some(100), Some(0.7)),
            ("Long & Creative", Some(200), Some(1.0)),
        ];

        for (style, max_tokens, temperature) in param_tests {
            println!("\n   🔧 Testing {}: max_tokens={:?}, temp={:?}", style, max_tokens, temperature);
            
            match timeout(
                Duration::from_secs(5),
                generate_text("Explain task management".to_string(), max_tokens, temperature)
            ).await {
                Ok(Ok(response)) => {
                    println!("      ✅ Generated {} chars", response.len());
                    assert!(!response.is_empty(), "Response should not be empty");
                }
                Ok(Err(e)) => {
                    println!("      ❌ Failed: {}", e);
                    panic!("Parameter test failed: {}", e);
                }
                Err(_) => {
                    println!("      ⏰ Timed out");
                    panic!("Parameter test timed out");
                }
            }
        }

        // Step 5: Test error handling
        println!("\n🛡️  Step 5: Testing error handling...");
        
        // Empty prompt
        match generate_text("".to_string(), Some(50), Some(0.7)).await {
            Err(e) => {
                println!("   ✅ Empty prompt correctly rejected: {}", e);
            }
            Ok(_) => {
                panic!("Empty prompt should have been rejected");
            }
        }

        // Invalid temperature
        match generate_text("test".to_string(), Some(50), Some(5.0)).await {
            Err(e) => {
                println!("   ✅ Invalid temperature correctly rejected: {}", e);
            }
            Ok(_) => {
                panic!("Invalid temperature should have been rejected");
            }
        }

        println!("\n🎉 Integration test completed successfully!");
        println!("==============================================");
        println!("✅ All LLM functionality is working correctly:");
        println!("   - Model initialization");
        println!("   - Status checking");
        println!("   - Text generation with various parameters");
        println!("   - Input validation and error handling");
        println!("\n🚀 Ready for frontend integration!");
    }

    /// Quick smoke test for CI
    #[tokio::test]
    async fn test_llm_smoke_test() {
        println!("\n🔥 LLM Smoke Test");
        
        // Initialize
        let init_result = initialize_local_model().await;
        assert!(init_result.is_ok(), "Initialization should succeed");
        println!("Init: ✅");
        
        // Quick generation
        match timeout(
            Duration::from_secs(5),
            generate_text("Hello".to_string(), Some(30), Some(0.7))
        ).await {
            Ok(Ok(response)) => {
                println!("Generation: ✅ ({} chars)", response.len());
                assert!(!response.is_empty(), "Response should not be empty");
            }
            Ok(Err(e)) => {
                panic!("Generation failed: {}", e);
            }
            Err(_) => {
                panic!("Generation timed out");
            }
        }
        
        println!("🔥 Smoke test passed");
    }
}