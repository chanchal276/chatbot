# graph/graph.py
import os
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from .state import ChatState
from .nodes import (
    classify_intent_node,
    retrieve_neo4j_node,
    retrieve_web_node,
    generate_answer_node,
    verify_confidence_node,
    format_response_node
)
from .edges import route_by_intent, route_after_verification
from utils.logger import get_logger
from services.calculator import calculate

USE_TAVILY = os.getenv('USE_TAVILY', 'False').lower() in ('true', '1', 'yes')

logger = get_logger(__name__)



def create_research_graph():
    """Build and compile the LangGraph workflow"""
    logger.info("🔧 Building LangGraph workflow...")
    
    # Initialize graph with state schema
    workflow = StateGraph(ChatState)
    
    # Add all nodes
    workflow.add_node("classify", classify_intent_node)
    workflow.add_node("retrieve_neo4j", retrieve_neo4j_node)
    workflow.add_node("retrieve_web", retrieve_web_node)
    workflow.add_node("generate", generate_answer_node)
    workflow.add_node("verify", verify_confidence_node)
    workflow.add_node("format", format_response_node)
    
    # Add calculator node (for calculation intent)
    def calculate_node(state: ChatState) -> dict:
        from services.calculator import calculate
        # Extract numbers from question
        import re
        numbers = re.findall(r'\d+', state["question"])
        if len(numbers) >= 2:
            # Simple addition for demo
            result = int(numbers[0]) + int(numbers[1])
            return {
                "draft_answer": f"The answer is {result}",
                "confidence": 1.0,
                "sources": ["calculator"],
                "final_response": f"The answer is {result}\n\n**Confidence:** 100%\n**Sources:** calculator"
            }
        return {
            "draft_answer": "Could not extract calculation",
            "confidence": 0.3,
            "final_response": "Could not extract calculation from question"
        }
    
    workflow.add_node("calculate", calculate_node)
    
    # Fixed edges
    workflow.add_edge(START, "classify")
    
    # Conditional routing based on intent
    workflow.add_conditional_edges(
        "classify",
        route_by_intent,
        {
            "calculate": "calculate",
            "retrieve_neo4j": "retrieve_neo4j",
            "retrieve_parallel": "retrieve_neo4j"  # Will add web after
        }
    )
    
    # After Neo4j retrieval, optionally add web search
    workflow.add_edge("retrieve_neo4j", "generate")
    
    # For research intent, add web search in parallel (simplified: sequential here)
    workflow.add_edge("retrieve_web", "generate")
    
    # Add web retrieval for research intent
    def should_search_web(state: ChatState) -> str:
        if state.get("intent") == "research":
            return "retrieve_web"
        return "generate"
    
    workflow.add_conditional_edges(
        "retrieve_neo4j",
        should_search_web,
        {"retrieve_web": "retrieve_web", "generate": "generate"}
    )
    
    # Verification and retry loop
    workflow.add_edge("generate", "verify")
    
    workflow.add_conditional_edges(
        "verify",
        route_after_verification,
        {
            "retrieve_more": "retrieve_neo4j",
            "format": "format"
        }
    )
    
    # Final edge
    workflow.add_edge("format", END)
    workflow.add_edge("calculate", END)
    
    # Compile with memory for conversation persistence
    memory = MemorySaver()
    agent = workflow.compile(checkpointer=memory)
    
    logger.info("✅ LangGraph workflow compiled successfully!")
    return agent

# Create global instance
research_agent = create_research_graph()