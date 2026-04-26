# graph/edges.py
from .state import ChatState

# graph/edges.py
def route_by_intent(state: ChatState) -> str:
    intent = state.get("intent", "unknown")
    
    if intent == "calculation":
        return "calculate"
    elif intent == "faq":
        # ✅ Enable web fallback for FAQ if Neo4j empty
        return "retrieve_with_fallback"
    elif intent == "research":
        return "retrieve_parallel"  # Both Neo4j + web
    else:
        return "retrieve_with_fallback"

def route_after_verification(state: ChatState) -> str:
    """Decide if answer is good enough or needs more context"""
    if state.get("needs_more_context", False):
        return "retrieve_more"
    return "format"