# services/web_search.py
from config import TAVILY_API_KEY, USE_TAVILY
from utils.logger import get_logger

logger = get_logger(__name__)

def search_web(query: str, k: int = 2) -> list:
    """Search web using Tavily API"""
    if not USE_TAVILY:
        logger.warning("⚠️ Tavily not configured, skipping web search")
        return []
    
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=TAVILY_API_KEY)
        
        response = client.search(query, max_results=k)
        
        results = [
            {
                "content": r["content"],
                "url": r["url"],
                "title": r["title"]
            }
            for r in response.get("results", [])
        ]
        
        logger.info(f"✅ Web search returned {len(results)} results")
        return results
        
    except Exception as e:
        logger.error(f"❌ Web search failed: {e}")
        return []