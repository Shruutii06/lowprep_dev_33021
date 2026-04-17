"""
AI Service: Cognitive Anchor (Knowledge Graph)
Listens to session transcript text and extracts key concepts + relationships
using the Groq API (Llama 3.3 70B). Returns a graph-ready JSON structure.
"""
import json
import re
from groq import AsyncGroq
from app.config import get_settings

settings = get_settings()


SYSTEM_PROMPT = """You are an expert educational knowledge graph builder.
Given a snippet of a tutoring session transcript, extract key concepts and 
their relationships. Respond ONLY with valid JSON. No extra text, no markdown.

Output format:
{
  "nodes": [
    {"id": "concept_id", "label": "Concept Name", "type": "core|related|example"}
  ],
  "edges": [
    {"source": "concept_id_1", "target": "concept_id_2", "label": "relationship"}
  ]
}

Rules:
- 3 to 8 nodes maximum
- Node types: "core" (main topic), "related" (connected idea), "example" (concrete instance)
- Edge labels should be short verbs: "uses", "is part of", "leads to", "defines", "depends on"
- IDs should be snake_case strings
"""


async def extract_concept_graph(transcript: str) -> dict:
    """
    Call Groq API (Llama 3.3 70B) to extract a concept graph from a transcript snippet.
    Returns {"nodes": [...], "edges": [...]} or error dict.
    Falls back to a mock graph if GROQ_API_KEY is not set.
    """
    if not settings.GROQ_API_KEY:
        return _mock_graph(transcript)

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1024,
            temperature=0.2,          # Low temp for consistent JSON output
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Extract concepts from this tutoring session snippet:\n\n{transcript[:2000]}"
                }
            ]
        )

        raw = response.choices[0].message.content.strip()
        # Strip any accidental markdown fences the model might add
        raw = re.sub(r"```json|```", "", raw).strip()
        graph = json.loads(raw)

        # Validate structure
        if "nodes" not in graph or "edges" not in graph:
            raise ValueError("Unexpected graph structure from AI response")

        return graph

    except json.JSONDecodeError:
        return {"error": "Failed to parse AI response as JSON", "nodes": [], "edges": []}
    except Exception as e:
        return {"error": str(e), "nodes": [], "edges": []}


def _mock_graph(transcript: str) -> dict:
    """Returns a deterministic mock graph for development/testing when no API key is set."""
    words = [w.capitalize() for w in transcript.split() if len(w) > 4][:3]
    nodes = [
        {"id": "core_topic",  "label": words[0] if words else "Main Topic",       "type": "core"},
        {"id": "related_1",   "label": words[1] if len(words) > 1 else "Related", "type": "related"},
        {"id": "example_1",   "label": words[2] if len(words) > 2 else "Example", "type": "example"},
    ]
    edges = [
        {"source": "core_topic", "target": "related_1", "label": "leads to"},
        {"source": "core_topic", "target": "example_1", "label": "uses"},
    ]
    return {"nodes": nodes, "edges": edges, "mock": True}
