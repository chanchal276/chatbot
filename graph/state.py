# graph/state.py
from typing import TypedDict, List, Optional, Literal

class ChatState(TypedDict):
    """State schema for the research chatbot"""
    
    # Input
    question: str
    conversation_history: List[dict]
    user_id: Optional[str]
    
    # Classification
    intent: Literal["faq", "research", "calculation", "unknown"]
    intent_confidence: float
    
    # Retrieval
    retrieved_docs: List[dict]  # {content, source, score, chunk_id}
    web_results: List[dict]     # {content, url, title}
    
    # Generation
    draft_answer: str
    sources: List[str]
    citations: List[dict]
    
    # Control
    retry_count: int
    needs_more_context: bool
    error: Optional[str]
    
    # Output
    final_response: str
    confidence: float
    follow_up_suggestions: List[str]