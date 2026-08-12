import os
import json
import glob
from dotenv import load_dotenv

load_dotenv()

# Directories
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(BACKEND_DIR, "data", "pdfs")
SOURCES_FILE = os.path.join(BACKEND_DIR, "sources.json")

os.makedirs(PDF_DIR, exist_ok=True)

def chunk_text(text, chunk_size=800, overlap=100):
    """Splits long document text into overlapping semantic chunks for RAG vector search."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += (chunk_size - overlap)
    return chunks

def ingest_pdf_files():
    """Scans backend/data/pdfs/ for PDF manuals, parses text, and appends chunks to sources.json."""
    pdf_files = glob.glob(os.path.join(PDF_DIR, "*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {PDF_DIR}. Drop PDF manuals into this folder to automatically ingest them!")
        return

    print(f"Found {len(pdf_files)} PDF file(s) in {PDF_DIR} for automated ingestion.")
    
    # Try importing PyPDF2 or pypdf
    try:
        import pypdf
        reader_cls = pypdf.PdfReader
    except ImportError:
        try:
            import PyPDF2
            reader_cls = PyPDF2.PdfReader
        except ImportError:
            print("Notice: 'pypdf' or 'PyPDF2' package not installed. Install with `pip install pypdf` for automated PDF text extraction.")
            return

    new_sources = []
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        doc_title = os.path.splitext(filename)[0].replace("_", " ").title()
        print(f"Extracting text from: {filename}...")
        
        try:
            reader = reader_cls(pdf_path)
            full_text = ""
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    full_text += f"\n--- Page {i+1} ---\n" + text
            
            if not full_text.strip():
                print(f"Warning: No readable text extracted from {filename} (might be scanned image PDF).")
                continue

            chunks = chunk_text(full_text)
            for idx, chunk in enumerate(chunks):
                chunk_id = f"pdf_{doc_title.lower().replace(' ', '_')[:15]}_{idx+1}"
                new_sources.append({
                    "id": chunk_id,
                    "title": f"{doc_title} (Part {idx+1})",
                    "crop": "General",
                    "category": "PDF Extension Manual",
                    "publisher": "Agricultural Extension Service / Research Institute",
                    "author": "Agricultural Extension Team",
                    "publication_year": 2024,
                    "source_url": f"local://backend/data/pdfs/{filename}",
                    "keywords": doc_title.lower().replace(" ", ", "),
                    "content": chunk
                })
        except Exception as e:
            print(f"Error parsing {filename}: {e}")

    if new_sources:
        # Load existing sources
        existing_sources = []
        if os.path.exists(SOURCES_FILE):
            with open(SOURCES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_sources = data.get("sources", [])

        # Merge without duplicate IDs
        existing_ids = {s["id"] for s in existing_sources}
        added_count = 0
        for src in new_sources:
            if src["id"] not in existing_ids:
                existing_sources.append(src)
                added_count += 1

        # Save back to sources.json
        output_data = {
            "project": "Agricultural Extension Services Multimodal RAG System",
            "country_focus": "Nigeria",
            "version": "1.0.0",
            "last_updated": "2026-07-24",
            "sources": existing_sources
        }

        with open(SOURCES_FILE, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)

        print(f"Successfully ingested {added_count} PDF chunks into sources.json!")
        
        # Trigger re-seeding of ChromaDB
        from seed import seed_database
        seed_database()

if __name__ == "__main__":
    ingest_pdf_files()
