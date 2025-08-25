//! Standalone LLM Chat Binary
//! 
//! This binary provides a standalone chat interface for testing the LLM service
//! without needing the full Tauri application.

use kirapilot_app_lib::llama::service::LlamaService;
use std::process;

#[tokio::main]
async fn main() {
    // Set up logging
    env_logger::init();
    
    println!("🚀 Starting KiraPilot LLM Chat Test...\n");
    
    match run_simple_llm_test().await {
        Ok(()) => {
            println!("✅ Chat test completed successfully");
        }
        Err(e) => {
            eprintln!("❌ Chat test failed: {}", e);
            process::exit(1);
        }
    }
}

async fn run_simple_llm_test() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔧 Initializing LLM service...");
    
    let mut service = LlamaService::new()?;
    println!("✅ LLM service initialized successfully");
    
    println!("📊 Service Status: {:?}", service.get_status());
    
    println!("🧪 Testing basic generation...");
    let test_prompt = "Hello, this is a test.";
    
    match service.generate(test_prompt, Default::default()).await {
        Ok(response) => {
            println!("✅ Generation successful: {}", response);
        }
        Err(e) => {
            println!("⚠️ Generation failed (this is expected without a loaded model): {}", e);
        }
    }
    
    Ok(())
}