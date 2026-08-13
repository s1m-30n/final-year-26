import os
import chromadb
from dotenv import load_dotenv
from chromadb.utils import embedding_functions

DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")

def get_chroma_client():
    import chromadb.config
    return chromadb.PersistentClient(
        path=DB_PATH,
        settings=chromadb.config.Settings(anonymized_telemetry=False)
    )

import json

# Path to sources.json catalog
SOURCES_FILE = os.path.join(os.path.dirname(__file__), "sources.json")

def load_sources():
    if os.path.exists(SOURCES_FILE):
        with open(SOURCES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("sources", [])
    return []

AGRICULTURAL_DOCUMENTS = load_sources()

def seed_database():
    print("Connecting to ChromaDB database...")
    client = get_chroma_client()
    
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    
    # Reset collection to match 384 embedding dimensions
    try:
        client.delete_collection(name="agricultural_extension")
        print("Cleared existing collection to update embedding dimensionality.")
    except Exception:
        pass

    collection = client.create_collection(
        name="agricultural_extension",
        metadata={"hnsw:space": "cosine"},
        embedding_function=emb_fn
    )
        
    documents_list = load_sources()
    print(f"Seeding {len(documents_list)} expert-verified extension documents from sources.json...")
    
    ids = [doc["id"] for doc in documents_list]
    documents = [doc["content"] for doc in documents_list]
    metadatas = [
        {
            "title": doc.get("title", ""),
            "category": doc.get("category", ""),
            "crop": doc.get("crop", ""),
            "publisher": doc.get("publisher", ""),
            "author": doc.get("author", ""),
            "publication_year": str(doc.get("publication_year", "")),
            "source_url": doc.get("source_url", ""),
            "keywords": doc.get("keywords", "")
        } 
        for doc in documents_list
    ]
    
    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    
    print("ChromaDB Seeding Completed Successfully with Full Source Attribution Metadata!")

if __name__ == "__main__":
    seed_database()


