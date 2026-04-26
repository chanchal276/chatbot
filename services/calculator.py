# services/calculator.py
import re
from utils.logger import get_logger

logger = get_logger(__name__)

def calculate(expression: str) -> str:
    """Safely evaluate mathematical expressions"""
    try:
        # Only allow numbers and basic math operators
        if not re.match(r'^[\d\s\+\-\*\/\.\(\)]+$', expression):
            return "Error: Invalid characters in expression"
        
        result = eval(expression)
        logger.info(f"✅ Calculated: {expression} = {result}")
        return str(result)
        
    except Exception as e:
        logger.error(f"❌ Calculation failed: {e}")
        return f"Error: {str(e)}"