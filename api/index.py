from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from dotenv import load_dotenv
from tqdm import tqdm
import pdfplumber
import io
import os
import json
import asyncio
import time

# 1. Configuration
load_dotenv(".env.local")
api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("❌ ERROR: No API Key found!")

# Initialize Gemini Client
client = genai.Client(api_key=api_key)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_valid_pages(file_content):
    """Extracts text from PDF and filters invalid pages."""
    valid_pages = []
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            print(f"📚 Total PDF Pages: {len(pdf.pages)}")
            
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text: 
                    continue
                
                # Basic cleaning of null characters
                text = text.replace('\x00', '') 
                
                # Log page size for monitoring
                char_count = len(text)
                
                # Flag unusually large pages (suspicious for bank statements)
                if char_count > 15000:
                    print(f"⚠️ WARNING Page {i+1}: Anomalous size ({char_count} chars). Possible hidden text.")
                
                valid_pages.append({"index": i + 1, "text": text, "size": char_count})
                
        return valid_pages
    except Exception as e:
        print(f"❌ PDF extraction error: {e}")
        return []

async def analyze_page_with_ai(page_num, text, char_count):
    """Sends page text to Gemini for transaction extraction."""
    # Using a stable model for production-like reliability
    model_name = "gemini-2.0-flash" 
    
    prompt = f"""
    Analyze this bank statement page. Return a JSON list of transactions.
    JSON Format: [{{"data": "DD/MM/YYYY", "descrizione": "string", "importo": float, "categoria": "Category"}}]
    Categories: Groceries, Dining, Transport, Utilities, Entertainment, Health, Transfers, Other.
    Use negative amounts for expenses.
    
    PAGE TEXT:
    {text}
    """
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model_name, 
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
            return json.loads(response.text)
            
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                wait_time = 10 * (attempt + 1)
                print(f"\n   ⏳ 429 Error on Page {page_num}. Rate Limit reached. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"\n   ❌ Technical Error on Page {page_num}: {error_str}")
                return [] 
                
    print(f"   💀 Page {page_num} skipped after {max_retries} failed attempts.")
    return []

@app.post("/api/analyze")
async def analyze_statement(file: UploadFile = File(...)):
    print("\n--- 🛠️ STARTING DIAGNOSTIC ANALYSIS (GEMINI STABLE) ---")
    
    content = await file.read()
    pages_to_analyze = extract_valid_pages(content)
    
    if not pages_to_analyze:
        raise HTTPException(status_code=400, detail="Unreadable or empty PDF")

    all_transactions = []
    
    # Progress Bar configuration
    with tqdm(total=len(pages_to_analyze), desc="Processing", unit="page") as pbar:
        for i, page in enumerate(pages_to_analyze):
            
            pbar.set_description(f"Page {page['index']} ({page['size']} chars)")
            
            data = await analyze_page_with_ai(page['index'], page['text'], page['size'])
            
            # Data normalization (handling both lists and wrapped dictionaries)
            if isinstance(data, dict):
                for val in data.values():
                    if isinstance(val, list):
                        data = val
                        break
                if isinstance(data, dict): 
                    data = []

            if data:
                all_transactions.extend(data)
            
            pbar.update(1)
            
            # Small safety delay to manage API quotas
            time.sleep(1)

    print(f"\n✅ ANALYSIS COMPLETE. Total transactions found: {len(all_transactions)}")
    print("--------------------------------------------------")
    
    return {"status": "success", "data": all_transactions}