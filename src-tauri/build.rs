fn main() {
    // Configure llama-cpp build for better compatibility
    if cfg!(target_os = "macos") {
        // Set environment variables for macOS builds
        std::env::set_var("GGML_METAL", "1");
        
        // For ARM64 macOS, disable problematic features
        if cfg!(target_arch = "aarch64") {
            std::env::set_var("GGML_NO_I8MM", "1");
            std::env::set_var("GGML_NO_SVE", "1");
            std::env::set_var("GGML_NO_SME", "1");
        }
        
        // Suppress CMake warnings by setting build type
        std::env::set_var("CMAKE_BUILD_TYPE", "Release");
        std::env::set_var("CMAKE_BUILD_PARALLEL_LEVEL", "4");
    }
    
    tauri_build::build()
}
