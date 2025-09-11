import os
import sys
import json
import pandas as pd
from dotenv import load_dotenv
from review_loader import load_reviews_from_mongo
from typing import Optional

from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.prompts import PromptTemplate

# -------------------------
# HuggingFace API Integration
# -------------------------
# Constants
MAX_TOKENS = 1000  # Increased for better responses
MAX_RETRIES = 5
RETRY_DELAY = 2  # seconds

# Global model instance and rate limiting
_global_model = None
_model_load_attempted = False
_last_api_call = 0
_min_call_interval = 1  # Reduced from 2 to 1 second between API calls
_api_failure_count = 0  # Track consecutive failures
_max_failures_before_reset = 3  # Reset model after 3 failures

# System prompt for the AI
SYSTEM_PROMPT = """You are a water quality expert providing detailed analysis based on community reviews and water parameters.

Your task: Analyze water quality data and provide a structured report with exactly these 4 sections:
1. Review Summary - What residents say about the water
2. Safety Assessment - Overall safety percentage and explanation
3. Potential Risks - 3 specific risks based on the data
4. Remedies - 4-5 actionable solutions

Be specific, practical, and focus on the actual location data provided."""

def get_api_token():
    """Get and validate API token"""
    token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
    if not token or token == "your_huggingface_api_token_here":
        print("Warning: HuggingFace API token not found or invalid", file=sys.stderr)
        return None
    return token

def get_langchain_model():
    """Get LangChain HuggingFace model with caching and better error handling"""
    global _global_model, _model_load_attempted, _api_failure_count
    
    # Return cached model if available
    if _global_model is not None:
        return _global_model
    
    # Reset model loading attempt if we've had too many failures
    if _api_failure_count >= _max_failures_before_reset:
        print(f"Resetting model after {_api_failure_count} failures", file=sys.stderr)
        _model_load_attempted = False
        _api_failure_count = 0
    
    # Don't retry if we already failed
    if _model_load_attempted:
        return None
    
    _model_load_attempted = True
    api_token = get_api_token()
    if not api_token:
        print("No valid API token found", file=sys.stderr)
        return None
    
    try:
        print("Loading HuggingFace model...", file=sys.stderr)
        endpoint = HuggingFaceEndpoint(
            repo_id="meta-llama/Llama-3.1-8B-Instruct",
            task="text-generation",
            huggingfacehub_api_token=api_token,
            max_new_tokens=MAX_TOKENS,
            temperature=0.7,
            repetition_penalty=1.1,
        )
        _global_model = ChatHuggingFace(llm=endpoint)
        print("HuggingFace model loaded successfully", file=sys.stderr)
        return _global_model
    except Exception as e:
        print(f"LangChain model error: {e}", file=sys.stderr)
        return None

def call_huggingface_api(prompt: str) -> Optional[str]:
    """Call HuggingFace API with retry logic and rate limiting"""
    import time
    global _last_api_call, _api_failure_count
    
    # Simple rate limiting
    current_time = time.time()
    time_since_last_call = current_time - _last_api_call
    if time_since_last_call < _min_call_interval:
        sleep_time = _min_call_interval - time_since_last_call
        print(f"Rate limiting: waiting {sleep_time:.1f}s", file=sys.stderr)
        time.sleep(sleep_time)
    
    _last_api_call = time.time()
    
    for attempt in range(MAX_RETRIES):
        try:
            model = get_langchain_model()
            if not model:
                print(f"No model available for attempt {attempt + 1}", file=sys.stderr)
                _api_failure_count += 1
                return None
            
            # Simplified prompt structure for better compatibility
            response = model.invoke(prompt)
            
            if hasattr(response, 'content'):
                content = response.content.strip()
            else:
                content = str(response).strip()
            
            if content and len(content) > 50:  # Minimum meaningful response
                print(f"HuggingFace API success on attempt {attempt + 1}", file=sys.stderr)
                _api_failure_count = 0  # Reset failure count on success
                return content
            else:
                print(f"Empty/short response on attempt {attempt + 1}: '{content}'", file=sys.stderr)
                
        except Exception as e:
            print(f"HuggingFace API error on attempt {attempt + 1}: {e}", file=sys.stderr)
            
            # Wait before retry (except on last attempt)
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
    
    print(f"HuggingFace API failed after {MAX_RETRIES} attempts", file=sys.stderr)
    _api_failure_count += 1
    return None

def generate_fallback_response(prompt: str) -> str:
    """Intelligent AI-like response system for water quality analysis"""
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
    
    # Default intelligent response for water quality analysis
    return "Based on the water quality data and community reviews provided, I recommend conducting proper water testing and following appropriate treatment methods for safe drinking water."

def ask_model(prompt: str) -> str:
    """Get response from HuggingFace API or fallback with detailed logging"""
    print(f"Processing request with prompt length: {len(prompt)}", file=sys.stderr)
    
    # Try API first
    api_response = call_huggingface_api(prompt)
    if api_response:
        print("Using HuggingFace API response", file=sys.stderr)
        return api_response
    
    # Use fallback
    print("Using fallback response - API failed or unavailable", file=sys.stderr)
    return generate_fallback_response(prompt)

# -------------------------
# Step 1: Load Environment Variables
# -------------------------
# Try to load from multiple locations
env_paths = [
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(__file__), '..', '..', '.env'),  # backend/.env
    os.path.join(os.path.dirname(__file__), '.env[1].env'),
    r"C:\Users\ms\Desktop\project water main\backend\models\ai\.env[1].env",
    r"C:\Users\ms\Desktop\project water main\backend\.env"
]

env_loaded = False
for env_path in env_paths:
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path)
        print(f"Loaded environment from: {env_path}", file=sys.stderr)
        env_loaded = True
        break

if not env_loaded:
    print("No .env file found, using system environment variables", file=sys.stderr)

# -------------------------
# Step 2: Load PDF Knowledge Base (Optional)
# -------------------------
retriever = None
try:
    # Try to find PDF in common locations
    pdf_paths = [
        os.path.join(os.path.dirname(__file__), "water_purity.pdf"),
        os.path.join(os.path.dirname(__file__), "water_purity (1).pdf"),
        r"C:\Users\Downloads\water purity (1).pdf"
    ]
    
    pdf_path = None
    for path in pdf_paths:
        if os.path.exists(path):
            pdf_path = path
            break
    
    if pdf_path:
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800, chunk_overlap=200
        )
        docs = text_splitter.split_documents(documents)
        
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        db = FAISS.from_documents(docs, embeddings)
        retriever = db.as_retriever(search_kwargs={"k": 3})
        pass  # Knowledge base loaded successfully
    else:
        pass  # No PDF knowledge base found, will use LLM-only mode
except Exception as e:
    pass  # Error loading knowledge base, will use LLM-only mode

# -------------------------
# Step 3: Prompts
# -------------------------
rag_prompt = PromptTemplate(
    input_variables=["review_summary", "safe_percentage", "parameters", "context"],
    template="""
You are a water quality expert.

Reviews Summary for this location:
{review_summary}

Overall Safe Percentage (based on reviews): {safe_percentage}%

Water parameters: {parameters}

Facts from the knowledge base:
{context}

Write:
1. A short summary paragraph of what people say about this location.
2. Safe percentage of the water quality.
3. A short 3 points on Potential Risks.
4. 4–5 Remedies.
""",
)

llm_only_prompt = PromptTemplate(
    input_variables=["review_summary", "safe_percentage", "parameters"],
    template="""
You are a water quality expert.

Reviews Summary for this location:
{review_summary}

Overall Safe Percentage (based on reviews): {safe_percentage}%

Water parameters: {parameters}

(No knowledge base available — rely on your expertise.)

Write:
1. A short summary paragraph of what people say about this location.
2. Safe percentage of the water quality.
3. A short 3 points on Potential Risks.
4. 4–5 Remedies.
""",
)

# -------------------------
# Step 4: Load Reviews + Parameters
# -------------------------
df = load_reviews_from_mongo()  # Load from MongoDB

# Load parameters from JSON file if it exists
try:
    parameters_file = os.path.join(os.path.dirname(__file__), "parameters.json")
    if os.path.exists(parameters_file):
        with open(parameters_file, "r") as f:
            parameters_data = json.load(f)
    else:
        # Default parameters if file doesn't exist - use Indian cities
        parameters_data = {
            "Bhind": "pH: 7.1, TDS: 480 ppm, Hardness: 280 mg/L, Turbidity: 2.8 NTU, Temperature: 24°C",
            "Bhopal": "pH: 7.3, TDS: 350 ppm, Hardness: 220 mg/L, Turbidity: 1.9 NTU, Temperature: 23°C",
            "Gwalior": "pH: 7.0, TDS: 420 ppm, Hardness: 310 mg/L, Turbidity: 2.5 NTU, Temperature: 25°C",
            "Hoshangabad": "pH: 6.9, TDS: 390 ppm, Hardness: 260 mg/L, Turbidity: 3.2 NTU, Temperature: 24°C",
            "Indore": "pH: 7.2, TDS: 320 ppm, Hardness: 180 mg/L, Turbidity: 2.1 NTU, Temperature: 22°C",
            "Morena": "pH: 7.4, TDS: 510 ppm, Hardness: 340 mg/L, Turbidity: 2.7 NTU, Temperature: 26°C"
        }
except Exception as e:
    pass  # Error loading parameters, using defaults
    parameters_data = {}


def classify_sentiment(rating):
    if rating <= 2:
        return "bad"
    elif rating >= 4:
        return "good"
    else:
        return "neutral"


if not df.empty:
    df["sentiment"] = df["rating"].apply(classify_sentiment)
else:
    pass  # No reviews found in database

# -------------------------
# Step 5: Per-Location Analysis
# -------------------------
def generate_fallback_analysis(location: str, safe_percentage: float, review_count: int) -> str:
    """Generate a structured fallback analysis when LLM fails"""
    if safe_percentage >= 70:
        return f"""1. Based on {review_count} community reviews for {location}, residents generally report good water quality with minimal issues.

2. The overall safe percentage for water quality is {safe_percentage}%.

3. Potential Risks:
   - Minor mineral buildup in pipes and appliances
   - Occasional taste variations during maintenance periods
   - Seasonal changes may affect clarity

4. Remedies:
   - Use basic carbon filters for taste improvement
   - Regular maintenance of household storage systems
   - Periodic testing to monitor quality changes
   - Keep emergency backup filtration available
   - Consider water softener if hardness becomes noticeable"""
    elif safe_percentage >= 40:
        return f"""1. Based on {review_count} community reviews for {location}, water quality shows mixed results with some concerns reported by residents.

2. The overall safe percentage for water quality is {safe_percentage}%.

3. Potential Risks:
   - Intermittent cloudiness or discoloration
   - Hard water causing scaling and taste issues
   - Possible bacterial contamination during seasonal changes

4. Remedies:
   - Install multi-stage filtration (sediment + carbon + UV)
   - Boil water during monsoon season or after supply disruptions
   - Regular testing for bacterial contamination
   - Use RO system for drinking water
   - Report persistent issues to water authorities"""
    else:
        return f"""1. Based on {review_count} community reviews for {location}, residents report significant water quality concerns requiring immediate attention.

2. The overall safe percentage for water quality is {safe_percentage}%.

3. Potential Risks:
   - High risk of waterborne diseases from bacterial contamination
   - Chemical contamination from industrial or sewage sources
   - Heavy metals or other toxic substances

4. Remedies:
   - Mandatory water treatment before any use
   - Install comprehensive RO + UV + multi-stage filtration
   - Use bottled water for drinking and cooking
   - Boil all water used for personal hygiene
   - Report to health authorities and demand infrastructure improvements"""

def analyze_water(location: str):
    if df.empty:
        return {
            "summary": f"No reviews found for {location}.",
            "safe_percentage": 0,
            "analysis": "No data available for analysis.",
            "review_count": 0,
            "sentiment_stats": {}
        }

    loc_reviews = df[df["location"].str.lower() == location.lower()]

    if loc_reviews.empty:
        return {
            "summary": f"No reviews found for {location}.",
            "safe_percentage": 0,
            "analysis": "No data available for analysis.",
            "review_count": 0,
            "sentiment_stats": {}
        }

    # Aggregate stats
    stats = loc_reviews["sentiment"].value_counts().to_dict()
    total = len(loc_reviews)

    # Safe % = percentage of good reviews
    # Weighted safe percentage
    safe_score = (
        stats.get("good", 0) * 1.0
        + stats.get("neutral", 0) * 0.5
        + stats.get("bad", 0) * 0.0
    )
    safe_percentage = round((safe_score / total) * 100, 2)

    review_summary = " | ".join(loc_reviews["review"].tolist()[:10])  # first 10 reviews

    parameters = parameters_data.get(location, "No water test data available.")
    
    # Try to get context from knowledge base
    context = ""
    if retriever:
        try:
            retrieved_docs = retriever.get_relevant_documents(f"{location} {parameters}")
            if retrieved_docs:
                context = "\n".join([doc.page_content for doc in retrieved_docs])
        except Exception as e:
            print(f"Error retrieving context: {e}", file=sys.stderr)

    # Choose prompt based on whether we have context
    if context:
        prompt = rag_prompt.format(
            review_summary=review_summary,
            safe_percentage=safe_percentage,
            parameters=parameters,
            context=context,
        )
    else:
        prompt = llm_only_prompt.format(
            review_summary=review_summary,
            safe_percentage=safe_percentage,
            parameters=parameters,
        )

    try:
        print(f"Requesting analysis for {location} with {total} reviews", file=sys.stderr)
        analysis = ask_model(prompt)
        
        # Check if the analysis looks valid and has reasonable content
        if not analysis or len(analysis.strip()) < 100:  # Increased minimum length
            raise Exception(f"LLM returned empty or too short response: {len(analysis.strip()) if analysis else 0} chars")
        
        # Check if it's a generic fallback response (more lenient check)
        generic_indicators = [
            "pH measures water acidity/alkalinity",
            "TDS (Total Dissolved Solids) measures",
            "I'm here to help with water quality",
            "Test with pH strips or digital meter",
        ]
        
        # Only trigger fallback if it's clearly a generic response AND doesn't mention the location
        is_generic = any(indicator in analysis for indicator in generic_indicators)
        mentions_location = location.lower() in analysis.lower()
        
        if is_generic and not mentions_location:
            raise Exception("LLM returned generic fallback response")
        
        # Check if response has the expected structure
        if not any(marker in analysis.lower() for marker in ['1.', '2.', '3.', '4.', 'summary', 'risk', 'remed']):
            raise Exception("LLM response doesn't have expected structure")
        
        print(f"Successfully got LLM analysis ({len(analysis)} chars)", file=sys.stderr)
            
    except Exception as e:
        print(f"Error getting LLM response: {e}, using structured fallback", file=sys.stderr)
        # Use structured fallback analysis
        analysis = generate_fallback_analysis(location, safe_percentage, total)

    return {
        "summary": f"Found {total} reviews for {location}",
        "safe_percentage": safe_percentage,
        "analysis": analysis,
        "review_count": total,
        "sentiment_stats": stats
    }


# -------------------------
# Example Run
# -------------------------
if __name__ == "__main__":
    import sys
    import json
    
    # Get location from command line argument or input
    if len(sys.argv) > 1:
        location = sys.argv[1]
    else:
        location = input("Enter your location: ")
    
    result = analyze_water(location)
    
    # Output as JSON for API consumption
    output = {
        "location": location,
        "safe_percentage": result['safe_percentage'],
        "analysis": result['analysis'],
        "summary": result['summary'],
        "review_count": result['review_count'],
        "sentiment_stats": result['sentiment_stats']
    }
    
    print(json.dumps(output, indent=2))

def test_api_connection():
    """Test HuggingFace API connection - for debugging"""
    print("=== HuggingFace API Test ===")
    token = get_api_token()
    if token:
        print(f"✓ API Token found: {token[:8]}...")
    else:
        print("✗ No API token found")
        return False
    
    try:
        model = get_langchain_model()
        if model:
            print("✓ Model loaded successfully")
            
            # Simple test prompt
            test_response = call_huggingface_api("What is water?")
            if test_response:
                print(f"✓ API call successful: {test_response[:100]}...")
                return True
            else:
                print("✗ API call failed")
                return False
        else:
            print("✗ Model loading failed")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

# Uncomment this line to test API connection when running directly
# if __name__ == "__main__" and len(sys.argv) == 1:
#     test_api_connection()
