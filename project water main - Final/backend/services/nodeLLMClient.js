const axios = require('axios');
const { logger } = require('../utils/logger');

class NodeLLMClient {
  constructor() {
    this.huggingfaceToken = process.env.HUGGINGFACEHUB_API_TOKEN;
    this.apiUrl = 'https://api-inference.huggingface.co/models/gpt2';
    this.timeout = 15000;
  }

  get isValidToken() {
    return this.huggingfaceToken && this.huggingfaceToken !== 'your_huggingface_api_token_here';
  }

  async generateResponse(prompt) {
    // Use fallback if no valid token
    if (!this.isValidToken) {
      logger.warn('No valid HuggingFace token, using expert fallback');
      return this.generateExpertFallback(prompt);
    }

    try {
      const systemPrompt = `You are a Water Quality Assistant. Be concise, clear and practical.
Focus on water quality topics: testing, interpretation (pH, TDS, hardness, turbidity, residual chlorine, heavy metals, microbes), health & safety, filtration methods (RO, UV, UF, carbon), maintenance.
Keep responses under 4 sentences.`;

      const response = await axios.post(this.apiUrl, {
        inputs: `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`,
        parameters: {
          max_new_tokens: 120,
          temperature: 0.7,
          return_full_text: false
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.huggingfaceToken}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      if (response.status === 200 && response.data) {
        const result = response.data;
        if (Array.isArray(result) && result.length > 0) {
          return result[0].generated_text?.trim() || this.generateExpertFallback(prompt);
        } else if (result.generated_text) {
          return result.generated_text.trim();
        }
      }

      logger.warn(`HuggingFace API returned status ${response.status}`);
      return this.generateExpertFallback(prompt);

    } catch (error) {
      logger.error('HuggingFace API error:', error.message);
      return this.generateExpertFallback(prompt);
    }
  }

  generateExpertFallback(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Water quality specific responses
    if (promptLower.includes('ph') || promptLower.includes('acidity')) {
      return "pH measures water acidity/alkalinity on a scale of 0-14. For drinking water, pH should be 6.5-8.5. Low pH (<6.5) can cause pipe corrosion and metallic taste. High pH (>8.5) may cause scaling and reduce disinfection effectiveness. Test with pH strips or digital meter.";
    }
    
    if (promptLower.includes('tds') || promptLower.includes('dissolved solids')) {
      return "TDS (Total Dissolved Solids) measures all dissolved minerals in water. 150-500 ppm is ideal for taste. Above 1000 ppm may indicate contamination or excessive minerals. Use TDS meter for testing. High TDS can be reduced with RO filtration.";
    }
    
    if (promptLower.includes('turbidity') || promptLower.includes('clarity')) {
      return "Turbidity measures water clarity/cloudiness. Should be <5 NTU for safe drinking. High turbidity indicates suspended particles that can harbor bacteria. Use sediment filters or coagulation/flocculation treatment.";
    }
    
    if (promptLower.includes('bacteria') || promptLower.includes('coliform') || promptLower.includes('microbe')) {
      return "Bacterial contamination is serious. Immediately stop drinking, boil water (rolling boil for 1 minute), or use certified disinfection. Test for total coliform and E. coli. Check source and plumbing integrity.";
    }
    
    if (promptLower.includes('filter') || promptLower.includes('treatment') || promptLower.includes('ro') || promptLower.includes('uv')) {
      return "Choose treatment based on your water test results: RO for high TDS/salts, UV for bacteria (requires low turbidity), activated carbon for taste/odor/chlorine, sediment filters for particles. Maintain and replace cartridges regularly.";
    }
    
    if (promptLower.includes('hardness') || promptLower.includes('scale')) {
      return "Water hardness >120 mg/L as CaCO3 causes scale buildup. Ion-exchange water softeners or anti-scalant systems help. Balance softening with corrosion control and taste preferences.";
    }
    
    // General responses
    if (promptLower.includes('hi') || promptLower.includes('hello') || promptLower.includes('hey')) {
      return "Hello! I'm your AI Water Quality Assistant. I can help with water testing, pH, TDS, filtration systems, and water safety. What would you like to know about water quality?";
    }
    
    if (promptLower.includes('help')) {
      return "I can help with water quality topics including: pH testing, TDS measurement, water hardness, turbidity, bacterial contamination, filtration systems (RO, UV, carbon), and water treatment. What specific water issue are you facing?";
    }
    
    // Default intelligent response
    return "I'm here to help with water quality questions and general topics. I specialize in water testing, pH, TDS, filtration systems, and water safety. What would you like to know about water quality or any other topic?";
  }
}

module.exports = NodeLLMClient;