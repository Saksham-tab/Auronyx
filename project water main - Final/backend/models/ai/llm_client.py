import os
from dotenv import load_dotenv
from typing import Optional, Dict, Any
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

# Load environment variables
load_dotenv()

# Constants
MAX_TOKENS = 2000

# System prompt for the AI
SYSTEM_PROMPT = """You are a helpful AI Assistant with specialized expertise in water quality analysis. You can answer questions on any topic, but you excel at water quality topics including:
- Water testing and interpretation (pH, TDS, hardness, turbidity, chlorine, heavy metals, bacteria)
- Health & safety guidelines
- Filtration methods (RO, UV, UF, carbon, sediment filters)
- Water treatment and maintenance
- Environmental science and chemistry

For water quality questions, provide detailed, expert advice. For other topics, give helpful, accurate responses. Be concise but informative. Keep responses under 4 sentences unless complex analysis is needed."""

def get_api_token():
    """Get and validate API token"""
    token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
    return token if token and token != "your_huggingface_api_token_here" else None

def get_langchain_model():
    """Get LangChain HuggingFace model"""
    api_token = get_api_token()
    if not api_token:
        return None
    
    try:
        endpoint = HuggingFaceEndpoint(
            repo_id="meta-llama/Llama-3.1-8B-Instruct",
            task="text-generation",
            huggingfacehub_api_token=api_token,
        )
        llm = ChatHuggingFace(llm=endpoint)
        return llm
    except Exception as e:
        print(f"LangChain model error: {e}")
        return None

def call_huggingface_api(prompt: str) -> Optional[str]:
    """Call HuggingFace API using LangChain"""
    model = get_langchain_model()
    if not model:
        return None
    
    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]
        
        response = model.invoke(messages)
        return response.content.strip()
    except Exception as e:
        # Don't print to stdout as it contaminates JSON output
        return None

def generate_fallback_response(prompt: str) -> str:
    """Intelligent AI-like response system"""
    prompt_lower = prompt.lower()
    
    # Water quality specific responses with more context
    if 'ph' in prompt_lower or 'acidity' in prompt_lower:
        if 'test' in prompt_lower or 'measure' in prompt_lower:
            return "To test pH, use pH test strips or a digital pH meter. For drinking water, pH should be 6.5-8.5. Low pH (<6.5) can cause pipe corrosion and metallic taste. High pH (>8.5) may cause scaling and reduce disinfection effectiveness. Test strips are easy to use - just dip in water and compare colors."
        return "pH measures water acidity/alkalinity on a scale of 0-14. For drinking water, pH should be 6.5-8.5. Low pH (<6.5) can cause pipe corrosion and metallic taste. High pH (>8.5) may cause scaling and reduce disinfection effectiveness. Test with pH strips or digital meter."
    
    if 'tds' in prompt_lower or 'dissolved solids' in prompt_lower:
        if 'test' in prompt_lower or 'measure' in prompt_lower:
            return "To test TDS, use a TDS meter (Total Dissolved Solids meter). Simply turn it on, dip the probe in water, and read the display. TDS of 150-500 ppm is ideal for taste. Above 1000 ppm may indicate contamination or excessive minerals. High TDS can be reduced with RO filtration."
        return "TDS (Total Dissolved Solids) measures all dissolved minerals in water. 150-500 ppm is ideal for taste. Above 1000 ppm may indicate contamination or excessive minerals. Use TDS meter for testing. High TDS can be reduced with RO filtration."
    
    if 'turbidity' in prompt_lower or 'clarity' in prompt_lower:
        return "Turbidity measures water clarity/cloudiness. Should be <5 NTU for safe drinking. High turbidity indicates suspended particles that can harbor bacteria. Use sediment filters or coagulation/flocculation treatment. Clear water doesn't always mean safe water - test for other contaminants too."
    
    if any(word in prompt_lower for word in ['bacteria', 'coliform', 'microbe', 'e.coli', 'e coli']):
        return "Bacterial contamination is serious. Immediately stop drinking, boil water (rolling boil for 1 minute), or use certified disinfection. Test for total coliform and E. coli. Check source and plumbing integrity. Consider UV sterilization or chlorination for long-term treatment."
    
    if any(word in prompt_lower for word in ['filter', 'treatment', 'ro', 'uv', 'carbon', 'reverse osmosis']):
        if 'choose' in prompt_lower or 'which' in prompt_lower:
            return "Choose treatment based on your water test results: RO for high TDS/salts, UV for bacteria (requires low turbidity), activated carbon for taste/odor/chlorine, sediment filters for particles. For comprehensive treatment, combine multiple stages: sediment → carbon → RO → UV. Maintain and replace cartridges regularly."
        return "Choose treatment based on your water test results: RO for high TDS/salts, UV for bacteria (requires low turbidity), activated carbon for taste/odor/chlorine, sediment filters for particles. Maintain and replace cartridges regularly."
    
    if any(word in prompt_lower for word in ['hardness', 'scale', 'soft', 'softener']):
        return "Water hardness >120 mg/L as CaCO3 causes scale buildup. Ion-exchange water softeners or anti-scalant systems help. Balance softening with corrosion control and taste preferences. Hard water can cause soap scum, scale on appliances, and dry skin."
    
    if any(word in prompt_lower for word in ['chlorine', 'chlorine', 'disinfect']):
        return "Chlorine is used to disinfect water and kill bacteria. Free chlorine should be 0.2-4.0 mg/L. Too much causes taste/odor issues, too little won't disinfect properly. Activated carbon filters remove chlorine taste/odor. Test with chlorine test strips."
    
    if any(word in prompt_lower for word in ['lead', 'heavy metal', 'contaminant']):
        return "Heavy metals like lead are dangerous even in small amounts. Test for lead, copper, arsenic, and other metals. If detected, use certified lead removal filters or consider whole-house treatment. Lead can cause serious health problems, especially in children."
    
    # General responses
    if any(word in prompt_lower for word in ['hi', 'hello', 'hey', 'greet']):
        return "Hello! I'm your AI Water Quality Assistant. I can help with water testing, pH, TDS, filtration systems, and water safety. What would you like to know about water quality?"
    
    if 'help' in prompt_lower:
        return "I can help with water quality topics including: pH testing, TDS measurement, water hardness, turbidity, bacterial contamination, filtration systems (RO, UV, carbon), and water treatment. What specific water issue are you facing?"
    
    if 'safe' in prompt_lower and 'water' in prompt_lower:
        return "Safe drinking water should be clear, odorless, and tasteless. Test for pH (6.5-8.5), TDS (<500 ppm), bacteria (none), and heavy metals (none). If you suspect contamination, stop drinking and test immediately. When in doubt, boil water or use bottled water."
    
    if 'test' in prompt_lower and 'water' in prompt_lower:
        return "To test water quality, start with basic tests: pH strips, TDS meter, and bacteria test kit. For comprehensive testing, send samples to a certified lab. Test regularly if you have a private well or suspect contamination. Keep records of test results."
    
    if any(word in prompt_lower for word in ['taste', 'smell', 'odor', 'flavor']):
        return "Strange taste or smell in water can indicate contamination. Common causes: chlorine (municipal treatment), sulfur (well water), bacteria, or chemicals. Test for pH, TDS, and bacteria. If severe, stop drinking and test immediately. Activated carbon filters can remove taste/odor issues. Consider professional testing if problems persist."
    
    if any(word in prompt_lower for word in ['cloudy', 'murky', 'dirty', 'colored']):
        return "Cloudy or colored water indicates suspended particles or contamination. Stop drinking immediately and test for bacteria, pH, and turbidity. Use sediment filters or let water settle. If from well, check for source contamination. Consider UV treatment after filtration. Professional testing recommended for persistent issues."
    
    # Default intelligent response
    return "I'm here to help with water quality questions and general topics. I specialize in water testing, pH, TDS, filtration systems, and water safety. What would you like to know about water quality or any other topic?"

def get_response(prompt: str) -> str:
    """Get response from API or fallback"""
    # Try API first
    api_response = call_huggingface_api(prompt)
    if api_response:
        return api_response
    
    # Use fallback
    return generate_fallback_response(prompt)

def chat_with_model(message: str, context: Optional[str] = None, location: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Optimized chat function with minimal overhead"""
    try:
        # Build prompt efficiently
        prompt = message.strip()
        if context:
            prompt = f"Context: {context}\n\nUser question: {prompt}"
        if location:
            loc_name = location.get("name") or location.get("address") or "Unknown location"
            prompt = f"Location: {loc_name}\n\n{prompt}"
        
        response_text = get_response(prompt)
        
        return {
            "success": True,
            "data": {
                "response": response_text,
                "model": "huggingface-dialoGPT",
                "context_used": bool(context),
                "location_used": bool(location)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "data": {
                "response": "I'm experiencing technical difficulties. Please try again or contact support.",
                "error": str(e)
            }
        }

def health_check() -> Dict[str, Any]:
    """Optimized health check"""
    return {
        "status": "ok",
        "model": "huggingface-dialoGPT",
        "api_token_configured": bool(get_api_token()),
        "fallback_enabled": True,
        "capabilities": "general-purpose-ai-with-water-quality-expertise",
        "max_tokens": MAX_TOKENS
    }

# Legacy function for backward compatibility
def ask_model(prompt: str) -> str:
    """Legacy function for backward compatibility"""
    return get_response(prompt)

if __name__ == "_main_":
    print("AI Assistant - Type 'exit' to quit")
    while True:
        user_input = input("You: ")
        if user_input.lower() == "exit":
            break
        response = ask_model(user_input)
        print(f"Bot: {response}") 