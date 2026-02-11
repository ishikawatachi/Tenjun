"""
Response Cache

In-memory LRU cache for LLM responses to avoid redundant API calls.
"""

import hashlib
import time
from typing import Optional, Dict, Any
from collections import OrderedDict
import threading


class ResponseCache:
    """
    LRU cache for LLM responses
    
    Caches responses based on prompt hash to avoid redundant API calls.
    Thread-safe with automatic expiration.
    """
    
    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        """
        Initialize response cache
        
        Args:
            max_size: Maximum number of cached responses
            ttl: Time-to-live in seconds (default: 1 hour)
        """
        self.max_size = max_size
        self.ttl = ttl
        self.cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self.lock = threading.Lock()
        
        # Statistics
        self.hits = 0
        self.misses = 0
    
    def _generate_key(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generate cache key from prompt
        
        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
        
        Returns:
            Cache key (hash string)
        """
        combined = f"{system_prompt or ''}|||{prompt}"
        return hashlib.sha256(combined.encode('utf-8')).hexdigest()
    
    def get(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
        """
        Get cached response
        
        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
        
        Returns:
            Cached response or None if not found/expired
        """
        key = self._generate_key(prompt, system_prompt)
        
        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return None
            
            entry = self.cache[key]
            
            # Check expiration
            if time.time() - entry['timestamp'] > self.ttl:
                del self.cache[key]
                self.misses += 1
                return None
            
            # Move to end (LRU)
            self.cache.move_to_end(key)
            
            self.hits += 1
            return entry['response']
    
    def set(self, prompt: str, response: str, system_prompt: Optional[str] = None):
        """
        Cache a response
        
        Args:
            prompt: User prompt
            response: LLM response
            system_prompt: System prompt (optional)
        """
        key = self._generate_key(prompt, system_prompt)
        
        with self.lock:
            # Remove oldest if at capacity
            if key not in self.cache and len(self.cache) >= self.max_size:
                self.cache.popitem(last=False)
            
            # Add/update entry
            self.cache[key] = {
                'response': response,
                'timestamp': time.time()
            }
            
            # Move to end (most recently used)
            self.cache.move_to_end(key)
    
    def clear(self):
        """Clear all cached responses"""
        with self.lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache stats
        """
        with self.lock:
            total = self.hits + self.misses
            hit_rate = (self.hits / total * 100) if total > 0 else 0
            
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': hit_rate,
                'ttl': self.ttl
            }
    
    def remove_expired(self):
        """Remove all expired entries"""
        now = time.time()
        
        with self.lock:
            expired_keys = [
                key for key, entry in self.cache.items()
                if now - entry['timestamp'] > self.ttl
            ]
            
            for key in expired_keys:
                del self.cache[key]
            
            return len(expired_keys)


# Global cache instance
_global_cache: Optional[ResponseCache] = None


def get_cache(max_size: int = 1000, ttl: int = 3600) -> ResponseCache:
    """
    Get global cache instance
    
    Args:
        max_size: Maximum cache size
        ttl: Time-to-live in seconds
    
    Returns:
        ResponseCache instance
    """
    global _global_cache
    
    if _global_cache is None:
        _global_cache = ResponseCache(max_size=max_size, ttl=ttl)
    
    return _global_cache
