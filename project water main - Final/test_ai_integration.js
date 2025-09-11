const axios = require('axios');

async function testAIIntegration() {
  const baseURL = 'http://localhost:5001';
  
  console.log('Testing AI Analysis Integration...\n');
  
  // Test districts from the predefined list
  const testDistricts = ['Gwalior', 'Bhind', 'Morena', 'Bhopal', 'Indore'];
  
  for (const district of testDistricts) {
    console.log(`\n=== Testing AI Analysis for ${district} ===`);
    
    try {
      const response = await axios.post(`${baseURL}/api/ai/analyze-location`, {
        location: district
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Response structure:`, {
        success: response.data.success,
        location: response.data.location,
        safe_percentage: response.data.safe_percentage,
        review_count: response.data.review_count,
        has_analysis: !!response.data.analysis,
        has_summary: !!response.data.summary
      });
      
      if (response.data.review_count > 0) {
        console.log(`📊 Found ${response.data.review_count} reviews`);
        console.log(`🛡️ Safety: ${response.data.safe_percentage}%`);
        console.log(`📝 Summary: ${response.data.summary.substring(0, 100)}...`);
      } else {
        console.log(`⚠️ No reviews found for ${district}`);
      }
      
    } catch (error) {
      console.log(`❌ Error for ${district}:`, {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data
      });
    }
  }
  
  console.log('\n=== Integration Test Complete ===');
}

// Test if server is running first
async function checkServerHealth() {
  try {
    const response = await axios.get('http://localhost:5001/health');
    console.log('✅ Server is running:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Server not running. Please start the backend server first.');
    console.log('Run: npm start in the backend directory');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServerHealth();
  if (serverRunning) {
    await testAIIntegration();
  }
}

main().catch(console.error);
