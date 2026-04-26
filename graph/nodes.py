# graph/nodes.py
from .state import ChatState
from config import get_llm, USE_TAVILY
from services.vector_db import neo4j_service
from services.web_search import search_web
from services.calculator import calculate
from utils.logger import get_logger
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
import re
import json
import tavily

logger = get_logger(__name__)

def classify_intent_node(state: ChatState) -> dict:
    """Classify user question intent"""
    logger.info("🔍 Classifying intent...")
    
    # ✅ FIXED: Double curly braces {{ }} for literal JSON in prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Classify the user question into one of these intents:
        - faq: Simple factual question about uploaded documents
        - research: Complex question needing external information
        - calculation: Math calculation request
        - unknown: Unclear or greeting
        
        Return ONLY valid JSON with keys: intent, confidence
        Example: {{"intent": "research", "confidence": 0.9}}"""),
        ("human", "{question}")
    ])
    
    llm = get_llm()
    chain = prompt | llm
    result = chain.invoke({"question": state["question"]})
    
    try:
        # Parse JSON response
        content = result.content.strip()
        # Handle markdown code blocks if present
        if "```" in content:
            content = content.split("```")[1].strip()
        # Extract JSON
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            classification = json.loads(json_match.group())
        else:
            classification = {"intent": "unknown", "confidence": 0.5}
        
        logger.info(f"✅ Intent: {classification['intent']} (confidence: {classification['confidence']})")
        
        return {
            "intent": classification["intent"],
            "intent_confidence": classification["confidence"]
        }
    except Exception as e:
        logger.error(f"❌ Intent classification failed: {e}")
        return {"intent": "unknown", "intent_confidence": 0.3}

def retrieve_neo4j_node(state: ChatState) -> dict:
    """Retrieve from Neo4j vector database"""
    logger.info("🔍 Searching Neo4j...")
    
    results = neo4j_service.search_chunks(state["question"], k=3)
    
    logger.info(f"✅ Found {len(results)} chunks")
    
    return {
        "retrieved_docs": results,
        "sources": list(set([doc["source"] for doc in results if doc["source"]]))
    }

def retrieve_web_node(state: ChatState) -> dict:
    """Retrieve from web search (Tavily)"""
    logger.info("🌐 Searching web...")
    
    results = search_web(state["question"], k=2)
    
    logger.info(f"✅ Found {len(results)} web results")
    
    return {
        "web_results": results
    }

def generate_answer_node(state: ChatState) -> dict:
    """Generate answer from retrieved context"""
    logger.info("🤖 Generating answer...")
    
    # Combine all context
    contexts = []
    sources = state.get("sources", []).copy()
    
    # Add Neo4j results
    for doc in state.get("retrieved_docs", []):
        contexts.append(f"[Source: {doc['source']}]\n{doc['content']}")
    
    # Add web results
    for result in state.get("web_results", []):
        contexts.append(f"[Source: {result['url']}]\n{result['content']}")
        sources.append(result['url'])
    
    context_text = "\n\n".join(contexts) if contexts else "No context available"
    # In generate_answer_node(), replace the prompt with:

    prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a research assistant. 
    - If context is provided, use it to answer and cite sources like [Source: filename.pdf]
    - If context is empty or insufficient, answer from your general knowledge but note "Based on general knowledge"
    - Be concise and accurate
    - Include confidence: high (from docs), medium (general knowledge), low (uncertain)"""),
    ("human", "Context:\n{context}\n\nQuestion: {question}")
    ])
    
    
    llm = get_llm()
    chain = prompt | llm
    response = chain.invoke({"context": context_text, "question": state["question"]})
    
    # Determine confidence based on context availability
    confidence = 0.9 if len(contexts) >= 2 else 0.6 if len(contexts) >= 1 else 0.3
    
    logger.info(f"✅ Answer generated (confidence: {confidence})")
    
    return {
        "draft_answer": response.content,
        "confidence": confidence,
        "sources": list(set(sources))
    }

def verify_confidence_node(state: ChatState) -> dict:
    """Verify answer confidence and decide if more context needed"""
    logger.info("✅ Verifying confidence...")
    
    confidence = state.get("confidence", 0.5)
    needs_more = confidence < 0.5 and state.get("retry_count", 0) < 2
    
    logger.info(f"✅ Confidence: {confidence}, Needs more context: {needs_more}")
    
    return {
        "needs_more_context": needs_more,
        "retry_count": state.get("retry_count", 0) + (1 if needs_more else 0)
    }

def format_response_node(state: ChatState) -> dict:
    """Format final response with citations and suggestions"""
    logger.info("📝 Formatting response...")
    
    # Build final response
    final = f"{state.get('draft_answer', '')}\n\n"
    final += f"**Confidence:** {state.get('confidence', 0):.0%}\n"
    
    if state.get("sources"):
        final += f"**Sources:** {', '.join(state['sources'][:3])}\n"
    
    # Generate follow-up suggestions
    suggestions = [
        "Can you elaborate on this?",
        "What are the implications?",
        "Show me related information"
    ]
    
    logger.info("✅ Response formatted")
    
    return {
        "final_response": final,
        "follow_up_suggestions": suggestions
    }


# graph/nodes.py - Add this new node:
def retrieve_with_fallback_node(state: ChatState) -> dict:
    """Retrieve from Neo4j, fallback to Tavily if no results"""
    logger.info("🔍 Searching Neo4j with Tavily fallback...")
    
    # Try Neo4j first
    neo4j_results = neo4j_service.search_chunks(state["question"], k=3)
    
    if neo4j_results:
        logger.info("✅ Found results in Neo4j")
        return {
            "retrieved_docs": neo4j_results,
            "web_results": [],
            "sources": list(set([doc["source"] for doc in neo4j_results if doc["source"]]))
        }
    
    # Fallback to Tavily web search
    if USE_TAVILY:
        logger.info("⚠️ No Neo4j results, trying Tavily web search...")
        from services.web_search import search_web
        web_results = search_web(state["question"], k=2)
        
        return {
            "retrieved_docs": [],
            "web_results": web_results,
            "sources": list(set([result["url"] for result in web_results]))
        }
    
    # No results from either source
    logger.warning("⚠️ No results from Neo4j or Tavily")
    return {
        "retrieved_docs": [],
        "web_results": [],
        "sources": []
    }