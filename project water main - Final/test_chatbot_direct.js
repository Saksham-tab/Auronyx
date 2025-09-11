const axios = require('axios');

async function testChatbotDirect() {
  console.log('=== Testing Chatbot API Directly ===');
  
  const baseUrl = 'http://localhost:5001';
  
  // Test 1: Health check
  try {
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✓ Backend health check passed:', healthResponse.data.status);
  } catch (error) {
    console.log('✗ Backend health check failed:', error.message);
    return;
  }
  
  // Test 2: Chatbot status
  try {
    const statusResponse = await axios.get(`${baseUrl}/api/ai-enhanced/chatbot/status`);
    console.log('✓ Chatbot status:', statusResponse.data);
  } catch (error) {
    console.log('⚠ Chatbot status failed (expected if Python not running):', error.response?.data || error.message);
  }
  
  // Test 3: Chat message
  try {
    const chatResponse = await axios.post(`${baseUrl}/api/ai-enhanced/chatbot/chat`, {
      message: 'What is pH in water?',
      context: 'Test from direct API call',
      location: { address: 'Test City' }
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✓ Chat response received:');
    console.log('  Success:', chatResponse.data.success);
    console.log('  Response:', chatResponse.data.data?.response?.substring(0, 100) + '...');
  } catch (error) {
    console.log('✗ Chat request failed:', error.response?.data || error.message);
  }
  
  console.log('\n=== Test Complete ===');
}

testChatbotDirect().catch(console.error);
