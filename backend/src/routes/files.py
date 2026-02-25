"""
File listing and cache management routes
"""
import logging
from flask import Blueprint, jsonify, request
from src.storage.minio_client import get_minio_client
from src.utils.cache import get_files_cache

logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__)


def _parse_bool_param(name: str, default: bool) -> bool:
    raw = request.args.get(name)
    if raw is None:
        return default

    normalized = str(raw).strip().lower()
    if normalized in ('1', 'true', 'yes', 'on'):
        return True
    if normalized in ('0', 'false', 'no', 'off'):
        return False
    raise ValueError(f"Invalid {name} parameter")


def _parse_int_param(name: str, default: int, min_value: int, max_value: int) -> int:
    raw = request.args.get(name)
    if raw is None:
        return default

    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"Invalid {name} parameter") from exc

    if value < min_value or value > max_value:
        raise ValueError(f"{name} must be between {min_value} and {max_value}")

    return value


def _error_payload(status_code: int, message: str):
    return jsonify({
        'success': False,
        'error': message
    }), status_code


@files_bp.route('/', methods=['GET'])
def list_files():
    """List all files in the MinIO bucket with caching"""
    try:
        prefix = str(request.args.get('prefix', '') or '').strip()
        include_folders = _parse_bool_param('include_folders', True)
        max_items = _parse_int_param('max_items', 20000, 1, 50000)

        cache = get_files_cache()
        cache_key = f"files_list:{prefix}:{include_folders}:{max_items}"
        
        # Try to get from cache
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info("Files list requested - CACHE HIT")
            files_count = sum(1 for entry in cached_data if entry.get('type') == 'file')
            folders_count = sum(1 for entry in cached_data if entry.get('type') == 'folder')
            truncated = files_count >= max_items
            return jsonify({
                'success': True,
                'count': len(cached_data),
                'files': cached_data,
                'files_count': files_count,
                'folders_count': folders_count,
                'truncated': truncated,
                'prefix': prefix,
                'include_folders': include_folders,
                'max_items': max_items,
                'cached': True
            }), 200
        
        # Cache miss - fetch from MinIO
        logger.info("Files list requested - CACHE MISS")
        minio = get_minio_client()
        entries = minio.list_objects(
            prefix=prefix,
            include_folders=include_folders,
            max_items=max_items
        )
        files_count = sum(1 for entry in entries if entry.get('type') == 'file')
        folders_count = sum(1 for entry in entries if entry.get('type') == 'folder')
        truncated = files_count >= max_items
        
        # Store in cache
        cache.set(cache_key, entries)
        
        return jsonify({
            'success': True,
            'count': len(entries),
            'files': entries,
            'files_count': files_count,
            'folders_count': folders_count,
            'truncated': truncated,
            'prefix': prefix,
            'include_folders': include_folders,
            'max_items': max_items,
            'cached': False
        }), 200

    except ValueError as e:
        logger.error(f"Invalid files list request: {e}")
        return _error_payload(400, str(e))
    except Exception as e:
        logger.error(f"Error listing files: {e}")
        return _error_payload(500, 'Internal server error')


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
        return _error_payload(500, 'Internal server error')
