"""
Simple in-memory cache with TTL support
Designed for HDF5 metadata caching with etag-based invalidation
"""
import time
import logging
from typing import Any, Optional, Tuple
from threading import Lock

logger = logging.getLogger(__name__)


class SimpleCache:
    """Thread-safe in-memory cache with TTL support"""
    
    def __init__(self, default_ttl: int = 30):
        """
        Initialize cache
        
        Args:
            default_ttl: Default time-to-live in seconds
        """
        self.default_ttl = default_ttl
        self._cache = {}
        self._lock = Lock()
        logger.info(f"Cache initialized with default TTL: {default_ttl}s")
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache if not expired
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if expired/not found
        """
        with self._lock:
            if key not in self._cache:
                logger.debug(f"Cache MISS: {key}")
                return None
            
            entry = self._cache[key]
            
            # Check if expired
            if time.time() > entry['expires_at']:
                logger.debug(f"Cache EXPIRED: {key}")
                del self._cache[key]
                return None
            
            logger.debug(f"Cache HIT: {key}")
            return entry['value']
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """
        Set value in cache with TTL
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        ttl = ttl if ttl is not None else self.default_ttl
        expires_at = time.time() + ttl
        
        with self._lock:
            self._cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': time.time()
            }
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
    
    def delete(self, key: str):
        """Delete specific key from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug(f"Cache DELETE: {key}")
    
    def clear(self):
        """Clear entire cache"""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"Cache CLEARED: {count} entries removed")
    
    def clear_pattern(self, pattern: str):
        """
        Clear all keys matching a pattern
        
        Args:
            pattern: String pattern to match (simple substring match)
        """
        with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_delete:
                del self._cache[key]
            logger.info(f"Cache CLEARED pattern '{pattern}': {len(keys_to_delete)} entries removed")
    
    def stats(self) -> dict:
        """Get cache statistics"""
        with self._lock:
            total = len(self._cache)
            expired = sum(1 for entry in self._cache.values() 
                         if time.time() > entry['expires_at'])
            active = total - expired
            
            return {
                'total_entries': total,
                'active_entries': active,
                'expired_entries': expired
            }


# Global cache instances
_files_cache = SimpleCache(default_ttl=30)  # 30 seconds for file list
_hdf5_cache = SimpleCache(default_ttl=300)  # 5 minutes for HDF5 metadata
_dataset_cache = SimpleCache(default_ttl=300)  # 5 minutes for dataset info
_data_cache = SimpleCache(default_ttl=120)  # 2 minutes for /data windows


def get_files_cache() -> SimpleCache:
    """Get the global files cache instance"""
    return _files_cache


def get_hdf5_cache() -> SimpleCache:
    """Get the global HDF5 metadata cache instance"""
    return _hdf5_cache


def get_dataset_cache() -> SimpleCache:
    """Get the global dataset info cache instance"""
    return _dataset_cache


def get_data_cache() -> SimpleCache:
    """Get the global /data response cache instance"""
    return _data_cache


def make_cache_key(*parts) -> str:
    """
    Create a cache key from multiple parts
    
    Args:
        *parts: Parts to join into cache key
        
    Returns:
        Cache key string
    """
    return ':'.join(str(p) for p in parts)
