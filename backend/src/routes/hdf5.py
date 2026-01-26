"""
HDF5 file navigation and metadata routes
"""
import logging
from flask import Blueprint, request, jsonify
from src.storage.minio_client import get_minio_client
from src.readers.hdf5_reader import get_hdf5_reader
from src.utils.cache import get_hdf5_cache, make_cache_key

logger = logging.getLogger(__name__)

hdf5_bp = Blueprint('hdf5', __name__)


@hdf5_bp.route('/<path:key>/children', methods=['GET'])
def get_children(key):
    """Get children at a specific path in an HDF5 file"""
    try:
        # Get query parameters
        hdf_path = request.args.get('path', '/')
        
        # Get file etag for cache invalidation
        minio = get_minio_client()
        metadata = minio.get_object_metadata(key)
        etag = metadata['etag']
        
        # Check cache
        cache = get_hdf5_cache()
        cache_key = make_cache_key('children', key, etag, hdf_path)
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"HDF5 children requested for '{key}' at '{hdf_path}' - CACHE HIT")
            return jsonify({
                'success': True,
                'key': key,
                'path': hdf_path,
                'children': cached_data,
                'cached': True
            }), 200
        
        # Cache miss - read from HDF5
        logger.info(f"HDF5 children requested for '{key}' at '{hdf_path}' - CACHE MISS")
        reader = get_hdf5_reader()
        children = reader.get_children(key, hdf_path)
        
        # Store in cache
        cache.set(cache_key, children)
        
        return jsonify({
            'success': True,
            'key': key,
            'path': hdf_path,
            'children': children,
            'cached': False
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting HDF5 children for '{key}' at '{hdf_path}': {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hdf5_bp.route('/<path:key>/meta', methods=['GET'])
def get_metadata(key):
    """Get metadata for a specific path in an HDF5 file"""
    try:
        # Get query parameters
        hdf_path = request.args.get('path')
        
        if not hdf_path:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: path'
            }), 400
        
        # Get file etag for cache invalidation
        minio = get_minio_client()
        metadata = minio.get_object_metadata(key)
        etag = metadata['etag']
        
        # Check cache
        cache = get_hdf5_cache()
        cache_key = make_cache_key('meta', key, etag, hdf_path)
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"HDF5 metadata requested for '{key}' at '{hdf_path}' - CACHE HIT")
            return jsonify({
                'success': True,
                'key': key,
                'metadata': cached_data,
                'cached': True
            }), 200
        
        # Cache miss - read from HDF5
        logger.info(f"HDF5 metadata requested for '{key}' at '{hdf_path}' - CACHE MISS")
        reader = get_hdf5_reader()
        meta = reader.get_metadata(key, hdf_path)
        
        # Store in cache
        cache.set(cache_key, meta)
        
        return jsonify({
            'success': True,
            'key': key,
            'metadata': meta,
            'cached': False
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting HDF5 metadata for '{key}' at '{hdf_path}': {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
