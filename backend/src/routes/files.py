"""
File listing and cache management routes
"""
import logging
from flask import Blueprint, jsonify
from src.storage.minio_client import get_minio_client
from src.utils.cache import get_files_cache

logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__)


@files_bp.route('/', methods=['GET'])
def list_files():
    """List all files in the MinIO bucket with caching"""
    try:
        cache = get_files_cache()
        cache_key = 'files_list'
        
        # Try to get from cache
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info("Files list requested - CACHE HIT")
            return jsonify({
                'success': True,
                'count': len(cached_data),
                'files': cached_data,
                'cached': True
            }), 200
        
        # Cache miss - fetch from MinIO
        logger.info("Files list requested - CACHE MISS")
        minio = get_minio_client()
        files = minio.list_objects()
        
        # Store in cache
        cache.set(cache_key, files)
        
        return jsonify({
            'success': True,
            'count': len(files),
            'files': files,
            'cached': False
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing files: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@files_bp.route('/refresh', methods=['POST'])
def refresh_files():
    """Manually refresh the files cache"""
    try:
        cache = get_files_cache()
        cache.clear()
        
        logger.info("Files cache manually refreshed")
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error refreshing cache: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
