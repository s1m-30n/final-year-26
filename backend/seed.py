import os
import chromadb
from dotenv import load_dotenv
from chromadb.utils import embedding_functions

def get_chroma_client():
    return chromadb.PersistentClient(path=DB_PATH)

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
    
    # Instantiate custom offline embedding function
    emb_fn = OfflineEmbeddingFunction()
    
    # Create or get collection with local embedding function
    collection = client.get_or_create_collection(
        name="agricultural_extension",
        metadata={"hnsw:space": "cosine"},
        embedding_function=emb_fn
    )
    
    # Check if database already has items
    existing = collection.get()
    if len(existing["ids"]) > 0:
        print(f"Database already contains {len(existing['ids'])} documents. Clearing old documents...")
        collection.delete(ids=existing["ids"])
        
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


