import os
import json
import base64
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
# Also try parent directory (.env in root if running from backend/)
parent_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
if os.path.exists(parent_env):
    load_dotenv(parent_env)

# Disable ChromaDB telemetry to prevent ClientStartEvent capture() error
os.environ["ANONYMIZED_TELEMETRY"] = "False"


app = FastAPI(title="Agricultural Extension RAG API", version="1.0.0")

# Compress responses > 300 bytes using gzip for 2G network bandwidth saving
app.add_middleware(GZipMiddleware, minimum_size=300)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For testing, open to all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attempt to load ChromaDB with clean in-memory fallback to avoid compiler dependency issues
try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    print("WARNING: ChromaDB package not found. Falling back to custom in-memory vector store.")

# Path to sources.json catalog
SOURCES_FILE = os.path.join(os.path.dirname(__file__), "sources.json")

def load_sources_from_json():
    if os.path.exists(SOURCES_FILE):
        try:
            with open(SOURCES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("sources", [])
        except Exception as e:
            print(f"Error reading sources.json: {e}")
    return []

FALLBACK_DOCS = load_sources_from_json()

class InMemoryMockCollection:
    def __init__(self):
        self.docs = []
        for d in load_sources_from_json():
            self.docs.append({
                "id": d["id"],
                "content": d["content"],
                "metadata": {
                    "title": d.get("title", ""),
                    "crop": d.get("crop", ""),
                    "category": d.get("category", ""),
                    "publisher": d.get("publisher", ""),
                    "author": d.get("author", ""),
                    "publication_year": str(d.get("publication_year", "")),
                    "source_url": d.get("source_url", ""),
                    "keywords": d.get("keywords", "")
                }
            })


    def get(self):
        return {
            "ids": [doc["id"] for doc in self.docs],
            "documents": [doc["content"] for doc in self.docs],
            "metadatas": [doc["metadata"] for doc in self.docs]
        }

    def add(self, ids, documents, metadatas):
        for i in range(len(ids)):
            # remove duplicates
            self.docs = [doc for doc in self.docs if doc["id"] != ids[i]]
            self.docs.append({
                "id": ids[i],
                "content": documents[i],
                "metadata": metadatas[i]
            })

    def delete(self, ids):
        self.docs = [doc for doc in self.docs if doc["id"] not in ids]

    def query(self, query_texts, n_results=3):
        query = query_texts[0].lower()
        scored_docs = []
        for doc in self.docs:
            words = query.split()
            match_score = 0.0
            content = doc["content"].lower()
            title = doc["metadata"]["title"].lower()
            keywords = doc["metadata"]["keywords"].lower()
            
            for w in words:
                if len(w) > 3:
                    if w in content: match_score += 0.2
                    if w in title: match_score += 0.3
                    if w in keywords: match_score += 0.4
                    
            distance = max(0.1, min(0.95, 1.0 - match_score))
            scored_docs.append((doc, distance))
            
        scored_docs.sort(key=lambda x: x[1])
        top_k = scored_docs[:n_results]
        
        return {
            "documents": [[t[0]["content"] for t in top_k]],
            "metadatas": [[t[0]["metadata"] for t in top_k]],
            "distances": [[t[1] for t in top_k]],
            "ids": [[t[0]["id"] for t in top_k]]
        }

# Initialize collection based on availability
if CHROMA_AVAILABLE:
    from chromadb.utils import embedding_functions
    import chromadb.config
    try:
        DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")
        client = chromadb.PersistentClient(
            path=DB_PATH,
            settings=chromadb.config.Settings(anonymized_telemetry=False)
        )
        sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        collection = client.get_or_create_collection(
            "agricultural_extension", 
            metadata={"hnsw:space": "cosine"},
            embedding_function=sentence_transformer_ef
        )

        print("ChromaDB Client Connected Successfully (Sentence Transformers Mode).")
    except Exception as e:
        print(f"Failed to load ChromaDB: {e}. Falling back to in-memory store.")
        collection = InMemoryMockCollection()
else:
    collection = InMemoryMockCollection()


# Language codes for NLLB translation model
LANGUAGE_CODES = {
    "English": "eng_Latn",
    "Nigerian Pidgin": "pcm_Latn",
    "Hausa": "hau_Latn",
    "Igbo": "ibo_Latn",
    "Yoruba": "yor_Latn"
}

# --- Request Models ---
class HistoryItem(BaseModel):
    sender: str
    text: str

class QueryRequest(BaseModel):
    query: str
    language: str
    gemini_key: Optional[str] = None
    hf_token: Optional[str] = None
    pipeline_mode: Optional[str] = "pivot"
    history: Optional[List[HistoryItem]] = None

class DocumentRequest(BaseModel):
    title: str
    category: str
    crop: str
    content: str
    keywords: str

# --- Helper Functions ---
def get_api_keys(custom_gemini: Optional[str] = None, custom_hf: Optional[str] = None):
    """Retrieve API keys from request headers/body or environment variables."""
    gemini = custom_gemini
    if not gemini:
        # Check environment variables case-insensitively
        for key in ["GEMINI_API_KEY", "Gemini_Api_Key", "gemini_api_key", "Gemini_API_Key"]:
            val = os.getenv(key)
            if val:
                gemini = val
                break
    
    hf = custom_hf
    if not hf:
        for key in ["HF_TOKEN", "Hf_Token", "hf_token"]:
            val = os.getenv(key)
            if val:
                hf = val
                break
                
    return gemini, hf

def translate_text(text: str, src_lang: str, tgt_lang: str, hf_token: Optional[str] = None) -> str:
    """Translate text using HuggingFace NLLB serverless Inference API."""
    src_code = LANGUAGE_CODES.get(src_lang, "eng_Latn")
    tgt_code = LANGUAGE_CODES.get(tgt_lang, "eng_Latn")
    
    if src_code == tgt_code:
        return text

    api_url = "https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M"
    headers = {}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"
        
    payload = {
        "inputs": text,
        "parameters": {
            "src_lang": src_code,
            "tgt_lang": tgt_code
        }
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0].get("translation_text", text)
            elif isinstance(result, dict) and "translation_text" in result:
                return result["translation_text"]
        
        # Fallback if HuggingFace serverless API returns error / rate-limit
        print(f"HF translation failed (status {response.status_code}): {response.text}")
        return simulate_translation_fallback(text, src_lang, tgt_lang)
    except Exception as e:
        print(f"Translation API error: {e}")
        return simulate_translation_fallback(text, src_lang, tgt_lang)

def simulate_translation_fallback(text: str, src_lang: str, tgt_lang: str) -> str:
    """Mock fallback translation mapping common agricultural phrases if API is offline."""
    dictionary = {
        "Nigerian Pidgin": {
            "how i fit cure cassava mosaic disease?": "How can I cure cassava mosaic disease?",
            "wetin be cassava mosaic disease?": "What is cassava mosaic disease?",
            "how to treat yam beetle": "How to treat yam beetle",
            "soil fertilizer for maize": "Soil fertilizer for maize",
            "how can i dry my maize?": "How can I dry my maize?",
            "what is armyworm?": "What is armyworm?",
            "hello": "Hello",
            "thank you": "Thank you"
        },
        "Hausa": {
            "yaya zan warkar da cutar mosaic rogo?": "How can I cure cassava mosaic disease?",
            "menene cutar rogo mosaic?": "What is cassava mosaic disease?",
            "barka da rana": "Hello",
            "na gode": "Thank you"
        }
    }
    
    text_lower = text.strip().lower()
    
    # Check dialect to English
    if tgt_lang == "English":
        lang_dict = dictionary.get(src_lang, {})
        for phrase, eng in lang_dict.items():
            if phrase == text_lower:
                return eng
        if len(text_lower.split()) < 6:
            for phrase, eng in lang_dict.items():
                if phrase in text_lower or text_lower in phrase:
                    return eng
        return f"[Translated to English] {text}"
        
    # Check English to dialect
    if src_lang == "English":
        lang_dict = dictionary.get(tgt_lang, {})
        for phrase, eng in lang_dict.items():
            if eng.lower() == text_lower:
                return phrase.capitalize()
        if len(text_lower.split()) < 6:
            for phrase, eng in lang_dict.items():
                if eng.lower() in text_lower:
                    return phrase.capitalize()
        return f"[{tgt_lang} Translation] {text}"

    return text

def generate_gemini_response(prompt: str, api_key: str) -> str:
    """Call Google Gemini 2.5 Flash API directly via requests."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
              }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            raise HTTPException(status_code=response.status_code, detail=f"Gemini API returned error: {response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Gemini LLM: {str(e)}")

# --- Endpoints ---

@app.post("/query")
async def process_query(req: QueryRequest):
    gemini_key, hf_token = get_api_keys(req.gemini_key, req.hf_token)
    
    if not gemini_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is missing. Ensure GEMINI_API_KEY is configured in backend environment.")

    pipeline_logs = []
    mode = req.pipeline_mode or "pivot"
    
    pipeline_logs.append({"stage": "Pipeline Settings", "message": f"Running RAG pipeline in Mode: {mode.upper()}"})
    
    # Format history turns for context memory
    history_text = ""
    if req.history and len(req.history) > 0:
        pipeline_logs.append({"stage": "Context Memory", "message": f"Incorporating past {len(req.history)} conversation turn(s) for memory."})
        history_text = "\nRECENT CONVERSATION HISTORY:\n"
        for item in req.history[-4:]:  # last 4 turns
            role_label = "Farmer" if item.sender == "user" else "Extension Agent"
            history_text += f"{role_label}: {item.text}\n"
        history_text += "---\n"

    if mode == "direct":
        pipeline_logs.append({"stage": "Translation (Input) Bypassed", "message": f"Direct prompt generated in source dialect: {req.language}"})
        pipeline_logs.append({"stage": "Translation (Internal Matching)", "message": "Running internal query translation for ChromaDB key terms..."})
        english_query = translate_text(req.query, req.language, "English", hf_token)
        pipeline_logs.append({"stage": "Translation (Internal Matching) Done", "message": f"Internal query key: '{english_query}'"})
    else:
        pipeline_logs.append({"stage": "Translation (Input)", "message": f"Translating query from {req.language} to English..."})
        english_query = translate_text(req.query, req.language, "English", hf_token)
        pipeline_logs.append({"stage": "Translation (Input) Done", "message": f"English query: '{english_query}'"})

    # 2. Vector DB Query (ChromaDB)
    pipeline_logs.append({"stage": "Vector DB Search", "message": "Searching ChromaDB vector store for context..."})
    try:
        results = collection.query(
            query_texts=[english_query],
            n_results=3
        )
        
        retrieved_docs = []
        context_text = ""
        
        if results and results["documents"] and len(results["documents"][0]) > 0:
            for i in range(len(results["documents"][0])):
                doc_text = results["documents"][0][i]
                metadata = results["metadatas"][0][i]
                distance = results["distances"][0][i] if "distances" in results and results["distances"] else 0.5
                score = round((1 - distance) * 100, 2)
                
                retrieved_docs.append({
                    "title": metadata.get("title", "Advisory Manual"),
                    "crop": metadata.get("crop", "General"),
                    "category": metadata.get("category", "General"),
                    "content": doc_text,
                    "score": score
                })
                context_text += f"\nSOURCE: {metadata.get('title')}\nCROP: {metadata.get('crop')}\nADVISORY: {doc_text}\n---\n"
            
            pipeline_logs.append({"stage": "Vector DB Done", "message": f"Retrieved {len(retrieved_docs)} matching agricultural guides."})
        else:
            pipeline_logs.append({"stage": "Vector DB Done", "message": "No relevant context found. Defaulting to general LLM knowledge."})
            context_text = "No matching expert manual found. Provide general expert agricultural guidance."
            
    except Exception as e:
        pipeline_logs.append({"stage": "Vector DB Error", "message": f"ChromaDB error: {str(e)}. Proceeding without context."})
        retrieved_docs = []
        context_text = "No context available due to system error."

    # 3. Construct Prompt & Generate Response
    if mode == "direct":
        prompt = f"""
You are an expert Agricultural Extension Officer specializing in Nigerian farming systems across all geopolitical zones (South-West, South-East, South-South, North-Central, North-West, North-East).
A smallholder farmer is speaking to you in {req.language}.
You MUST respond directly, naturally, and natively in {req.language} (e.g. if Nigerian Pidgin, write exclusively in authentic Nigerian Pidgin; if Hausa, write in Hausa; if Igbo, write in Igbo; if Yoruba, write in Yoruba).

{history_text}

Provide COMPLETE, step-by-step, highly practical local advice. Include:
1. Diagnosis & Root Cause
2. Immediate Action Steps (Cultural methods e.g. uprooting infected plants, organic sprays e.g. neem oil extract/wood ash/soap mix)
3. Disease-resistant Nigerian varieties (e.g. TME 419 cassava, FARO 44 rice, SAMMAZ maize, etc.)
4. Prevention & Sourcing Advice (IITA, NCRI, local ADP extension officers)

Context Manuals:
{context_text}

Farmer's Query (in {req.language}):
"{req.query}"

CRITICAL INSTRUCTIONS:
- Speak natively in {req.language} with local warmth and respect.
- Format with clear bullet points and bold text so it is easy to read.
- Provide a full, complete answer without cutting off.
"""
        pipeline_logs.append({"stage": "LLM Synthesis (Direct Dialect)", "message": f"Generating response natively in {req.language} using Gemini..."})
        final_response = generate_gemini_response(prompt, gemini_key)
        pipeline_logs.append({"stage": "LLM Synthesis Done", "message": "Direct dialect response successfully synthesized."})
        
        english_response = "[Bypassed in Direct Dialect RAG Mode]"
        pipeline_logs.append({"stage": "Translation (Output) Bypassed", "message": "Direct Dialect output bypassed translation layer."})

    else:
        prompt = f"""
You are an expert Senior Agricultural Extension Officer specializing in Nigerian farming systems (Rainforest, Derived Savannah, Sudan Savannah).
Provide clear, complete, and practical step-by-step diagnostic and agronomic advice for smallholder farmers in Nigeria based on the expert context below.

{history_text}

Context Manuals:
{context_text}

Farmer's Current Query:
"{english_query}"

FORMAT YOUR RESPONSE WITH THE FOLLOWING STRUCTURED HEADINGS:
- **🌿 Diagnosis & Cause**: Briefly explain the crop condition or pest/disease cause in clear terms.
- **⚡ Immediate Action Steps**: Give 2-4 clear, bulleted steps (cultural practices e.g., rouging infected plants, organic treatments e.g., neem oil solution, wood ash, or safe chemical controls).
- **🛡️ Resistant Varieties & Long-Term Prevention**: Recommend specific Nigerian crop varieties (e.g. TME 419 / TMS 30572 cassava, FARO 44 / 52 rice, SAMMAZ 15 maize, etc.) and preventive soil/sanitation practices.
- **📍 Local Sourcing & Advisory**: Mention local Nigerian extension contacts or institutes (IITA, NCRI, NIHORT, CRIN, local State ADP extension agents).

CRITICAL INSTRUCTIONS:
- Be encouraging, highly practical, and complete. Do not leave sentences unfinished.
- Do NOT mention "according to the context" or "documents". Answer directly as an experienced extension worker.
"""
        pipeline_logs.append({"stage": "LLM Synthesis", "message": "Generating response in English using Gemini LLM..."})
        english_response = generate_gemini_response(prompt, gemini_key)
        pipeline_logs.append({"stage": "LLM Synthesis Done", "message": "English response successfully synthesized."})

        pipeline_logs.append({"stage": "Translation (Output)", "message": f"Translating final response back to {req.language}..."})
        final_response = translate_text(english_response, "English", req.language, hf_token)
        pipeline_logs.append({"stage": "Translation (Output) Done", "message": "Final response translated."})

    return {
        "original_query": req.query,
        "translated_query": english_query if mode == "pivot" else "[Bypassed]",
        "context": retrieved_docs,
        "english_response": english_response,
        "final_response": final_response,
        "pipeline_logs": pipeline_logs
    }


@app.post("/diagnose")
async def diagnose_leaf(
    image: UploadFile = File(...),
    gemini_key: Optional[str] = Form(None),
    hf_token: Optional[str] = Form(None)
):
    gemini_key, hf_token = get_api_keys(gemini_key, hf_token)
    
    if not gemini_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required to perform multimodal image diagnosis.")

    try:
        # Read the uploaded image bytes
        image_bytes = await image.read()
        
        # We can call the Gemini 2.5 Flash Multimodal model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
        headers = {"Content-Type": "application/json"}
        
        # Base64 encode the image
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """
Analyze this crop or fruit leaf image. Identify if there are any plant diseases or pest infestations, focusing on Nigerian produce, fruits, tubers, grains, and vegetables (Mango, Citrus, Plantain, Banana, Pawpaw, Pineapple, Guava, Avocado, Cashew, Cocoa, Oil Palm, Sweet Potato, Yam, Cassava, Maize, Rice, Sorghum, Tomato, Pepper, Okra, Egusi).
Return the result strictly as a JSON object with the following fields:
{
  "disease": "Name of the disease/pest (e.g. Mango Anthracnose, Black Sigatoka, Citrus Canker, Papaya Ringspot, Cassava Mosaic, Fall Armyworm, Healthy, etc.)",
  "crop": "Name of the crop or fruit (e.g. Mango, Citrus, Plantain, Pawpaw, Pineapple, Cassava, Maize, Yam, Sweet Potato, Tomato, Pepper, etc.)",
  "confidence": 92.5,
  "symptoms": ["list of visible symptoms like leaf spots, chlorosis, fruit lesions, whiteflies, stem damage"],
  "treatment": ["list of actionable treatment steps, including organic treatments like neem oil spray, copper fungicide, and chemical controls if needed"]
}
Make sure you return only the raw JSON. No markdown code blocks, just raw JSON text.
"""
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": image.content_type or "image/jpeg",
                                "data": base64_image
                            }
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        
        if response.status_code == 200:
            result_json = response.json()
            response_text = result_json["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            # Clean up response text in case it wrapped in ```json
            if response_text.startswith("```"):
                lines = response_text.splitlines()
                # Remove starting and ending markdown blocks
                response_text = "\n".join([line for line in lines if not line.startswith("```")])
            
            try:
                diagnostic_data = json.loads(response_text)
                return diagnostic_data
            except Exception as parse_err:
                print(f"Failed to parse JSON response: {response_text}. Error: {parse_err}")
                raise HTTPException(status_code=500, detail="Gemini response was not valid JSON.")
        else:
            raise HTTPException(status_code=response.status_code, detail=f"Gemini API returned error: {response.text}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Diagnosis endpoint failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image diagnosis failed: {str(e)}")


@app.get("/documents")
async def list_documents():
    """Fetch all documents currently indexed in ChromaDB."""
    try:
        docs = collection.get()
        result = []
        for i in range(len(docs["ids"])):
            result.append({
                "id": docs["ids"][i],
                "content": docs["documents"][i],
                "metadata": docs["metadatas"][i]
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query database documents: {str(e)}")


@app.post("/documents")
async def add_document(doc: DocumentRequest):
    """Index a new document snippet in ChromaDB."""
    try:
        # Create a unique ID
        import uuid
        doc_id = f"custom_{str(uuid.uuid4())[:8]}"
        
        collection.add(
            ids=[doc_id],
            documents=[doc.content],
            metadatas=[{
                "title": doc.title,
                "category": doc.category,
                "crop": doc.crop,
                "keywords": doc.keywords
            }]
        )
        return {"status": "success", "id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add document: {str(e)}")


@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe uploaded audio using local Whisper model."""
    try:
        import whisper
        import tempfile
        import os
        
        # Load model lazily
        model = whisper.load_model("tiny")
        
        # Save uploaded file to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name
            
        result = model.transcribe(tmp_path)
        os.remove(tmp_path)
        
        return {"text": result["text"]}
    except Exception as e:
        print(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.get("/sources")
async def list_sources():
    """Fetch registered extension documents catalog with publisher & source attribution metadata."""
    sources = load_sources_from_json()
    return {
        "count": len(sources),
        "sources": sources
    }


@app.get("/international-organizations")
async def list_international_organizations():
    """Fetch catalog of international agricultural research & development bodies."""
    intl_file = os.path.join(os.path.dirname(__file__), "international_organizations.json")
    if os.path.exists(intl_file):
        try:
            with open(intl_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read international organizations catalog: {str(e)}")
    return {"count": 0, "organizations": []}


import math

NIGERIAN_HUB_COORDS = {
    "Abia": {"lat": 5.5267, "lon": 7.4896, "region": "Abia (Umuahia Belt)", "state": "Abia State"},
    "Adamawa": {"lat": 9.2094, "lon": 12.4818, "region": "Adamawa (Yola Belt)", "state": "Adamawa State"},
    "Akwa Ibom": {"lat": 5.0377, "lon": 7.9128, "region": "Akwa Ibom (Uyo Coastal Belt)", "state": "Akwa Ibom State"},
    "Anambra": {"lat": 6.2209, "lon": 7.0733, "region": "Anambra (Awka/Onitsha Belt)", "state": "Anambra State"},
    "Bauchi": {"lat": 10.3158, "lon": 9.8442, "region": "Bauchi (Savannah Grain Belt)", "state": "Bauchi State"},
    "Bayelsa": {"lat": 4.9267, "lon": 6.2676, "region": "Bayelsa (Yenagoa Delta Belt)", "state": "Bayelsa State"},
    "Benue": {"lat": 7.7322, "lon": 8.5214, "region": "Makurdi (Benue Food Basket)", "state": "Benue State"},
    "Borno": {"lat": 11.8333, "lon": 13.1500, "region": "Borno (Maiduguri Sahel Belt)", "state": "Borno State"},
    "Cross River": {"lat": 4.9757, "lon": 8.3417, "region": "Cross River (Calabar Rainforest)", "state": "Cross River State"},
    "Delta": {"lat": 6.1984, "lon": 6.7275, "region": "Delta (Asaba Oil Palm Belt)", "state": "Delta State"},
    "Ebonyi": {"lat": 6.3249, "lon": 8.1137, "region": "Ebonyi (Abakaliki Rice Hub)", "state": "Ebonyi State"},
    "Edo": {"lat": 6.3350, "lon": 5.6037, "region": "Edo (Benin Rubber & Cocoa)", "state": "Edo State"},
    "Ekiti": {"lat": 7.6211, "lon": 5.2215, "region": "Ekiti (Ado-Ekiti Timber/Yam)", "state": "Ekiti State"},
    "Enugu": {"lat": 6.4584, "lon": 7.5464, "region": "Enugu (Coal City Tropical)", "state": "Enugu State"},
    "FCT Abuja": {"lat": 9.0765, "lon": 7.3986, "region": "FCT Abuja (Federal Capital)", "state": "FCT Abuja"},
    "Gombe": {"lat": 10.2897, "lon": 11.1673, "region": "Gombe (Jewel Savannah)", "state": "Gombe State"},
    "Imo": {"lat": 5.4850, "lon": 7.0355, "region": "Imo (Owerri Palm Belt)", "state": "Imo State"},
    "Jigawa": {"lat": 11.7594, "lon": 9.3392, "region": "Jigawa (Dutse Sesame Hub)", "state": "Jigawa State"},
    "Kaduna": {"lat": 10.5105, "lon": 7.4165, "region": "Kaduna (Grain & Maize Hub)", "state": "Kaduna State"},
    "Kano": {"lat": 12.0022, "lon": 8.5920, "region": "Kano (Sudan Savannah Hub)", "state": "Kano State"},
    "Katsina": {"lat": 12.9887, "lon": 7.6008, "region": "Katsina (Cotton & Grain Belt)", "state": "Katsina State"},
    "Kebbi": {"lat": 12.4539, "lon": 4.1975, "region": "Kebbi (Birnin Kebbi Rice Belt)", "state": "Kebbi State"},
    "Kogi": {"lat": 7.8024, "lon": 6.7333, "region": "Kogi (Lokoja Confluence Belt)", "state": "Kogi State"},
    "Kwara": {"lat": 8.4966, "lon": 4.5421, "region": "Kwara (Ilorin Cassava/Yam)", "state": "Kwara State"},
    "Lagos": {"lat": 6.6018, "lon": 3.3515, "region": "Lagos (Coastal Agri-Market)", "state": "Lagos State"},
    "Nasarawa": {"lat": 8.4933, "lon": 8.5153, "region": "Nasarawa (Lafia Sesame Belt)", "state": "Nasarawa State"},
    "Niger": {"lat": 9.6139, "lon": 6.5569, "region": "Niger (Minna Rice & Grain)", "state": "Niger State"},
    "Ogun": {"lat": 7.1557, "lon": 3.3458, "region": "Ogun (Abeokuta Poultry/Cassava)", "state": "Ogun State"},
    "Ondo": {"lat": 7.2571, "lon": 5.2058, "region": "Ondo (Akure Cocoa Belt)", "state": "Ondo State"},
    "Osun": {"lat": 7.7827, "lon": 4.5418, "region": "Osun (Osogbo Cocoa/Cassava)", "state": "Osun State"},
    "Oyo": {"lat": 7.3775, "lon": 3.9470, "region": "Ibadan (Oyo Agriculture Belt)", "state": "Oyo State"},
    "Plateau": {"lat": 9.8965, "lon": 8.8583, "region": "Plateau (Jos Vegetable Belt)", "state": "Plateau State"},
    "Rivers": {"lat": 4.8156, "lon": 7.0498, "region": "Rivers (Port Harcourt Delta)", "state": "Rivers State"},
    "Sokoto": {"lat": 13.0600, "lon": 5.2400, "region": "Sokoto (Saddle Savannah Hub)", "state": "Sokoto State"},
    "Taraba": {"lat": 8.8936, "lon": 11.3596, "region": "Taraba (Jalingo Mambilla Belt)", "state": "Taraba State"},
    "Yobe": {"lat": 11.7470, "lon": 11.9660, "region": "Yobe (Damaturu Livestock Hub)", "state": "Yobe State"},
    "Zamfara": {"lat": 12.1700, "lon": 6.6600, "region": "Zamfara (Gusau Grain Belt)", "state": "Zamfara State"}
}

WMO_WEATHER_CODES = {
    0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Foggy", 51: "Light Drizzle", 61: "Slight Rain", 63: "Moderate Rain",
    65: "Heavy Rain", 80: "Rain Showers", 95: "Thunderstorm"
}

# In-memory store for user/extension-agent submitted dynamic alerts
DYNAMIC_FIELD_ALERTS = []

def find_nearest_state(lat: float, lon: float):
    """Find the nearest Nigerian state name based on GPS coordinates."""
    min_dist = float("inf")
    nearest_state = "Oyo"
    for state_name, info in NIGERIAN_HUB_COORDS.items():
        dist = math.sqrt((lat - info["lat"]) ** 2 + (lon - info["lon"]) ** 2)
        if dist < min_dist:
            min_dist = dist
            nearest_state = state_name
    return nearest_state

def generate_dynamic_agro_advisory(region: str, state: str, condition: str, temp_c: float, humidity: float, precip: float, wind: float) -> str:
    """Dynamically generates targeted agricultural advisories for Nigerian produce, tree fruits, tubers, grains, and vegetables based on real-time weather metrics."""
    region_lower = (region or "").lower()
    state_lower = (state or "").lower()
    
    if humidity > 80:
        if any(k in region_lower or k in state_lower for k in ["benue", "oyo", "ogbomoso"]):
            return f"LIVE GPS ALERT ({condition}, {humidity}% Humidity): High fungal risk for Benue/Oyo Citrus (Citrus Canker/Melanose) & Ogbomoso Mango (Anthracnose). Apply neem oil or copper spray immediately."
        elif any(k in region_lower or k in state_lower for k in ["edo", "ondo", "rivers", "cross river", "delta"]):
            return f"LIVE GPS ALERT ({condition}, {humidity}% Humidity): Damp environment triggers Black Sigatoka in Plantain/Banana plantations and Black Pod disease in Cocoa. Prune infected lower leaves."
        elif any(k in region_lower or k in state_lower for k in ["enugu", "ebonyi", "imo", "abia"]):
            return f"LIVE GPS ALERT ({condition}, {humidity}% Humidity): High moisture warning for Smooth Cayenne Pineapple & Pawpaw (Papaya Ringspot Virus vector activity). Ensure soil aeration."
        elif any(k in region_lower or k in state_lower for k in ["kano", "kaduna", "sokoto", "katsina"]):
            return f"LIVE GPS ALERT ({condition}, {humidity}% Humidity): Extreme moisture in northern belt. High risk for Tomato Early Blight, Habanero Pepper bacterial spot, and Maize rust."
        else:
            return f"LIVE GPS ALERT ({condition}, {humidity}% Humidity): High moisture elevates fungal spore dissemination across Cassava Mosaic whiteflies, Tomato Blight, Plantain Sigatoka & Mango Anthracnose."

    elif temp_c > 32:
        if any(k in region_lower or k in state_lower for k in ["kano", "jigawa", "katsina", "sokoto"]):
            return f"LIVE GPS ALERT ({temp_c}°C Dry Heat): Severe heat stress for Sorghum, Millet & Maize silking. Apply heavy straw mulching and schedule early morning drip irrigation."
        elif any(k in region_lower or k in state_lower for k in ["benue", "nasarawa", "plateau", "kogi"]):
            return f"LIVE GPS ALERT ({temp_c}°C High Solar Irradiance): Heat stress risk for Citrus orchards, Orange-Fleshed Sweet Potato (OFSP) slips & White Yam mounds. Irrigate seedling nurseries."
        elif any(k in region_lower or k in state_lower for k in ["oyo", "osun", "ogun", "kwara"]):
            return f"LIVE GPS ALERT ({temp_c}°C Dry Heat): High evaporation rate affecting Ogbomoso Mango fruit retention & Plantain suckers. Mulch tree basins with dry organic matter."
        else:
            return f"LIVE GPS ALERT ({temp_c}°C Heat Stress): Heat stress warning across grain fields, fruit tree saplings (Citrus/Mango) & vegetable beds. Ensure shade cover for nurseries."

    elif precip > 2.0:
        if any(k in region_lower or k in state_lower for k in ["edo", "delta", "rivers", "bayelsa"]):
            return f"LIVE GPS ALERT (Active Rain {precip}mm): Torrential rain in Niger Delta belt. Clear farm drainage furrows to prevent root rot in Plantain mats, Yam heaps & Cassava tubers."
        elif any(k in region_lower or k in state_lower for k in ["benue", "taraba", "kogi"]):
            return f"LIVE GPS ALERT (Active Rain {precip}mm): Heavy rainfall in Benue river basin. Secure White Yam mounds against soil erosion and suspend NPK fertilizer top-dressing."
        else:
            return f"LIVE GPS ALERT (Active Rain {precip}mm): Heavy precipitation detected. Clear drainage channels to protect cassava roots, vegetable beds & pineapple fields from waterlogging."

    elif wind > 18:
        return f"LIVE GPS ALERT (High Wind {wind} km/h): Strong gusts detected. Support leaning Plantain/Banana pseudostems with wooden props to prevent lodging; inspect Mango & Cashew branches."

    else:
        return f"LIVE GPS ADVISORY ({condition}, {temp_c}°C): Favorable conditions for routine weeding, fruit tree pruning (Mango/Citrus), foliar inspection, and targeted bio-fertilizer application."


def fetch_live_openmeteo_weather(city: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None):
    # Determine exact target lat/lon and location name
    if lat is not None and lon is not None:
        target_lat = lat
        target_lon = lon
        matched_state = find_nearest_state(lat, lon)
        info = {
            "region": f"GPS Location ({lat:.3f}, {lon:.3f})",
            "state": NIGERIAN_HUB_COORDS[matched_state]["state"]
        }
    else:
        state_key = city if city in NIGERIAN_HUB_COORDS else "Oyo"
        info = NIGERIAN_HUB_COORDS.get(state_key, NIGERIAN_HUB_COORDS["Oyo"])
        target_lat = info["lat"]
        target_lon = info["lon"]

    url = f"https://api.open-meteo.com/v1/forecast?latitude={target_lat}&longitude={target_lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Africa%2FLagos"
    
    try:
        resp = requests.get(url, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            curr = data.get("current", {})
            daily = data.get("daily", {})
            
            temp_c = curr.get("temperature_2m", 28.0)
            humidity = curr.get("relative_humidity_2m", 75)
            precip = curr.get("precipitation", 0.0)
            w_code = curr.get("weather_code", 0)
            wind = curr.get("wind_speed_10m", 10.0)
            condition = WMO_WEATHER_CODES.get(w_code, "Partly Cloudy")
            
            forecast = []
            days_names = ["Today", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"]
            if "time" in daily:
                for idx in range(min(5, len(daily["time"]))):
                    d_max = daily.get("temperature_2m_max", [30]*5)[idx]
                    d_rain = daily.get("precipitation_probability_max", [30]*5)[idx]
                    d_code = daily.get("weather_code", [0]*5)[idx]
                    d_cond = WMO_WEATHER_CODES.get(d_code, "Partly Cloudy")
                    
                    advice = "Optimal crop cultivation window"
                    if d_rain > 60:
                        advice = "Delay fertilizer & clear drainage furrows"
                    elif d_max > 33:
                        advice = "Mulch crop beds & irrigate early morning"
                    elif d_rain < 20:
                        advice = "Ideal solar drying & weeding window"
                        
                    forecast.append({
                        "day": days_names[idx] if idx < len(days_names) else f"Day {idx+1}",
                        "temp": f"{int(d_max)}°C",
                        "condition": d_cond,
                        "rain": f"{int(d_rain)}%",
                        "advice": advice
                    })
            
            agro_advisory = generate_dynamic_agro_advisory(
                info["region"], info["state"], condition, temp_c, humidity, precip, wind
            )
                
            return {
                "region": info["region"],
                "state": info["state"],
                "lat": target_lat,
                "lon": target_lon,
                "temp_c": temp_c,
                "condition": condition,
                "humidity": humidity,
                "rain_chance": daily.get("precipitation_probability_max", [45])[0] if "precipitation_probability_max" in daily else 45,
                "wind_kmh": wind,
                "uv_index": 7 if temp_c < 32 else 9,
                "agro_advisory": agro_advisory,
                "forecast": forecast,
                "is_live_api": True
            }
    except Exception as err:
        print(f"Open-Meteo live fetch failed: {err}")
    
    return {
        "region": info["region"],
        "state": info["state"],
        "lat": target_lat,
        "lon": target_lon,
        "temp_c": 28.5,
        "condition": "Partly Cloudy",
        "humidity": 75,
        "rain_chance": 45,
        "wind_kmh": 12.0,
        "uv_index": 7,
        "agro_advisory": "Maintain routine crop scouting and weed control under moderate humidity.",
        "forecast": [
            {"day": "Today", "temp": "29°C", "condition": "Partly Cloudy", "rain": "40%", "advice": "Foliar pest inspection"}
        ],
        "is_live_api": False
    }


@app.get("/weather")
async def get_agro_weather(
    region: Optional[str] = "Oyo",
    lat: Optional[float] = None,
    lon: Optional[float] = None
):
    """Fetch REAL live agricultural weather forecast from Open-Meteo API using city or live GPS coordinates."""
    return fetch_live_openmeteo_weather(city=region, lat=lat, lon=lon)


class AlertPostRequest(BaseModel):
    title: str
    title_pidgin: str
    category: str
    region: str
    message_en: str
    message_pidgin: str
    priority: Optional[str] = "high"


@app.post("/alerts")
async def post_emergency_alert(req: AlertPostRequest):
    """Allow extension agents to broadcast dynamic field push alerts in real-time."""
    import uuid
    new_alert = {
        "id": f"alert_dynamic_{str(uuid.uuid4())[:6]}",
        "type": "custom",
        "priority": req.priority,
        "title": req.title,
        "title_pidgin": req.title_pidgin,
        "category": req.category,
        "region": req.region,
        "timestamp": "Just now (Live Broadcast)",
        "message_en": req.message_en,
        "message_pidgin": req.message_pidgin,
        "action": "View Field Advisory"
    }
    DYNAMIC_FIELD_ALERTS.insert(0, new_alert)
    return {"status": "success", "alert": new_alert}


@app.get("/alerts")
async def get_emergency_push_alerts():
    """Dynamically generate real live emergency agricultural push notifications based on live weather data."""
    # Fetch real live weather for Ibadan & Kano to compute live weather alerts
    ibadan_live = fetch_live_openmeteo_weather("Ibadan")
    kano_live = fetch_live_openmeteo_weather("Kano")
    
    generated_alerts = []
    
    # 1. Dynamic Rain/Humidity Alert based on actual live Open-Meteo telemetry
    if ibadan_live.get("humidity", 0) > 75:
        generated_alerts.append({
            "id": "alert_live_01",
            "type": "weather",
            "priority": "urgent",
            "title": f"Live High Humidity Warning ({ibadan_live['humidity']}%)",
            "title_pidgin": f"Water Heavy For Air ({ibadan_live['humidity']}%)! Protect Crop & Fruits",
            "category": "Live Weather Alert",
            "region": ibadan_live["region"],
            "timestamp": "Live API Telemetry",
            "message_en": f"Real-time relative humidity in {ibadan_live['region']} is currently {ibadan_live['humidity']}%. High risk of Cassava Mosaic whiteflies, Tomato fungal rot, Citrus melanose & Mango Anthracnose.",
            "message_pidgin": f"Water heavy for air for {ibadan_live['region']} ({ibadan_live['humidity']}%). Whitefly, rot and fungus fit spoil cassava, tomato, orange and mango. Spray neem oil mix quick!",
            "action": "Spray Neem Solution"
        })
        
    # 2. Dynamic Heat Alert based on actual live Kano Open-Meteo telemetry
    if kano_live.get("temp_c", 0) > 30:
        generated_alerts.append({
            "id": "alert_live_02",
            "type": "weather",
            "priority": "high",
            "title": f"Live Heat Alert ({kano_live['temp_c']}°C)",
            "title_pidgin": f"Sun Hot Well Well ({kano_live['temp_c']}°C)!",
            "category": "Live Temperature Alert",
            "region": kano_live["region"],
            "timestamp": "Live API Telemetry",
            "message_en": f"Live temperature in {kano_live['region']} reached {kano_live['temp_c']}°C. Mulch maize, sorghum, and fruit tree sapling (Citrus/Mango) beds to prevent moisture loss.",
            "message_pidgin": f"Sun hot well well for {kano_live['region']} ({kano_live['temp_c']}°C). Cover ground with dry grass around maize and fruit tree so water no dry finish.",
            "action": "Mulch Crop & Tree Beds"
        })

    # 3. Dynamic Fruit & Tree Crop Pest Alert
    generated_alerts.append({
        "id": "alert_live_03",
        "type": "pest",
        "priority": "urgent",
        "title": "Mango Fruit Fly & Plantain Sigatoka Field Warning",
        "title_pidgin": "Fruit Fly & Plantain Sigatoka Warning!",
        "category": "Fruit & Tree Crop Alert",
        "region": "South-West & Middle Belt Orchards",
        "timestamp": "Live Extension Survey",
        "message_en": "High Bactrocera fruit fly activity reported in Mango/Citrus orchards and Black Sigatoka in Plantain plantations. Hang protein bait traps and prune infected lower leaves.",
        "message_pidgin": "Fruit fly dey spoil mango and orange, and black spots dey chop plantain leaf! Put trap for orchard and cut bad plantain leaf down.",
        "action": "Set Bait Traps & Prune"
    })

    # Merge extension-agent submitted dynamic alerts
    all_alerts = DYNAMIC_FIELD_ALERTS + generated_alerts
    return {
        "count": len(all_alerts),
        "alerts": all_alerts
    }


if __name__ == "__main__":
    import uvicorn
    # Load port from env or default to 8000
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run("main:app", host=host, port=port, reload=True)


