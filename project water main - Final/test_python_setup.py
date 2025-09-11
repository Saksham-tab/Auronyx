#!/usr/bin/env python3
import sys
import os

print("=== Python LLM Setup Test ===")
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")

# Test 1: Basic imports
try:
    import requests
    print("✓ requests module available")
except ImportError as e:
    print(f"✗ requests module missing: {e}")

try:
    from dotenv import load_dotenv
    print("✓ python-dotenv module available")
except ImportError as e:
    print(f"✗ python-dotenv module missing: {e}")

# Test 2: Environment variables
load_dotenv()
token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
if token and token != "your_huggingface_api_token_here":
    print(f"✓ HUGGINGFACEHUB_API_TOKEN found (length: {len(token)})")
else:
    print("✗ HUGGINGFACEHUB_API_TOKEN not set or placeholder")

# Test 3: LLM client
sys.path.append(os.path.join(os.getcwd(), 'backend', 'models', 'ai'))
try:
    from llm_client import ask_model
    response = ask_model("What is pH?")
    print(f"✓ LLM client works: {response[:100]}...")
except Exception as e:
    print(f"✗ LLM client failed: {e}")

print("\n=== Test Complete ===")
