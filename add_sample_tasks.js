// Simple script to add sample tasks via the Tauri API
// This can be run in the browser console when the app is running

async function addSampleTasks() {
  try {
    console.log('Adding sample tasks using the new Rust command...');

    // Import Tauri API
    const { invoke } = window.__TAURI__.core;

    // Use the new add_sample_tasks command
    try {
      const result = await invoke('add_sample_tasks');
      console.log('✅ Sample tasks result:', result);
    } catch (error) {
      console.error('❌ Failed to add sample tasks:', error);
    }

    // Now test getting all tasks to verify they were created
    try {
      const allTasks = await invoke('get_all_tasks', {
        status: null,
        projectId: null,
      });
      console.log('📋 All tasks:', allTasks);
      console.log(`📊 Total tasks in database: ${allTasks.length}`);

      if (allTasks.length > 0) {
        console.log(
          '🎉 Database now has tasks! You can test "list tasks" with the AI.'
        );
        console.log('💡 Try asking the AI: "list tasks" or "show me my tasks"');
      } else {
        console.log(
          '⚠️ No tasks found. There might be an issue with task creation.'
        );
      }
    } catch (error) {
      console.error('❌ Failed to get tasks:', error);
    }
  } catch (error) {
    console.error('❌ Error in addSampleTasks:', error);
  }
}

// Also create a function to test the AI directly
async function testAIWithTasks() {
  try {
    console.log('🤖 Testing AI with "list tasks" command...');

    const { invoke } = window.__TAURI__.core;

    const aiRequest = {
      message: 'list tasks',
      session_id: null,
      model_preference: null,
      context: {
        currentEnergy: 75,
        dayOfWeek: 6,
        timeOfDay: '08:30',
        focusMode: false,
        currentTask: null,
      },
    };

    const response = await invoke('process_ai_message', { request: aiRequest });
    console.log('🤖 AI Response:', response);
  } catch (error) {
    console.error('❌ Failed to test AI:', error);
  }
}

// Run both functions
console.log('🚀 Starting sample task setup and AI test...');
addSampleTasks().then(() => {
  console.log('⏳ Waiting 2 seconds before testing AI...');
  setTimeout(testAIWithTasks, 2000);
});
