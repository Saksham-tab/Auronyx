#!/usr/bin/env python3
"""
Simple test script to diagnose HuggingFace API issues
Run this to check if your API is working properly
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from llm_main import test_api_connection, get_api_token, call_huggingface_api

def main():
    print("🔍 Diagnosing HuggingFace API Issues...")
    print("=" * 50)
    
    # Test 1: Check environment
    print("1. Environment Check:")
    token = get_api_token()
    if token:
        print(f"   ✓ HuggingFace token found: {token[:8]}...")
    else:
        print("   ✗ No HuggingFace token found")
        print("   💡 Set HUGGINGFACEHUB_API_TOKEN in your .env file")
        return
    
    print("\n2. API Connection Test:")
    success = test_api_connection()
    
    if success:
        print("\n3. Multiple Request Test:")
        for i in range(5):
            print(f"   Request {i+1}:", end=" ")
            response = call_huggingface_api(f"Test request {i+1}: What is pH in water?")
            if response:
                print(f"✓ Success ({len(response)} chars)")
            else:
                print("✗ Failed")
    else:
        print("\n❌ API connection failed!")
        print("\n🔧 Possible solutions:")
        print("1. Check your HuggingFace API token")
        print("2. Verify your internet connection")
        print("3. Check if HuggingFace services are down")
        print("4. Try using a different model")

if __name__ == "__main__":
    main()
