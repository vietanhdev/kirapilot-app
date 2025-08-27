fn main() {
    // Configure llama-cpp build for ARM64 compatibility
    if cfg!(target_arch = "aarch64") && cfg!(target_os = "macos") {
        // Set environment variables to disable problematic ARM features
        std::env::set_var("GGML_NO_I8MM", "1");
        std::env::set_var("GGML_NO_SVE", "1");
        std::env::set_var("GGML_NO_SME", "1");
        std::env::set_var("GGML_METAL", "1");
    }
    
    tauri_build::build()
}
