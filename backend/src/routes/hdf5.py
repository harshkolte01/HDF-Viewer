"""
HDF5 file navigation and metadata routes
"""
import logging
from flask import Blueprint, request, jsonify
from src.storage.minio_client import get_minio_client
from src.readers.hdf5_reader import get_hdf5_reader
from src.utils.cache import get_hdf5_cache, get_dataset_cache, make_cache_key

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


@hdf5_bp.route('/<path:key>/preview', methods=['GET'])
def get_preview(key):
    """Get a preview payload for a specific dataset path"""
    try:
        hdf_path = request.args.get('path')
        if not hdf_path:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: path'
            }), 400

        mode = request.args.get('mode', 'auto')
        display_dims_param = request.args.get('display_dims')
        fixed_indices_param = request.args.get('fixed_indices')
        max_size_param = request.args.get('max_size')
        max_size = None
        if max_size_param:
            try:
                max_size = int(max_size_param)
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid max_size parameter'
                }), 400
            if max_size <= 0:
                return jsonify({
                    'success': False,
                    'error': 'max_size must be a positive integer'
                }), 400

        minio = get_minio_client()
        metadata = minio.get_object_metadata(key)
        etag = metadata['etag']

        reader = get_hdf5_reader()
        dataset_cache = get_dataset_cache()
        dataset_cache_key = make_cache_key('dataset', key, etag, hdf_path)
        dataset_info = dataset_cache.get(dataset_cache_key)
        if dataset_info is None:
            dataset_info = reader.get_dataset_info(key, hdf_path)
            dataset_cache.set(dataset_cache_key, dataset_info)

        shape = dataset_info['shape']
        ndim = dataset_info['ndim']
        preview_type = '1d' if ndim == 1 else '2d' if ndim == 2 else 'nd'

        display_dims = None
        fixed_indices = None
        if ndim > 1:
            display_dims, fixed_indices = reader.normalize_preview_axes(
                shape,
                display_dims_param,
                fixed_indices_param
            )

        display_dims_key = ','.join(str(dim) for dim in display_dims) if display_dims else 'none'
        fixed_indices_key = ','.join(
            f"{dim}={idx}" for dim, idx in sorted((fixed_indices or {}).items())
        ) or 'none'
        max_size_key = max_size if max_size is not None else 'default'

        cache = get_hdf5_cache()
        cache_key = make_cache_key(
            'preview',
            key,
            etag,
            hdf_path,
            preview_type,
            display_dims_key,
            fixed_indices_key,
            max_size_key,
            mode
        )

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"HDF5 preview requested for '{key}' at '{hdf_path}' - CACHE HIT")
            response = dict(cached_data)
            response['success'] = True
            response['cached'] = True
            return jsonify(response), 200

        logger.info(f"HDF5 preview requested for '{key}' at '{hdf_path}' - CACHE MISS")
        preview = reader.get_preview(
            key,
            hdf_path,
            display_dims=display_dims,
            fixed_indices=fixed_indices,
            mode=mode,
            max_size=max_size
        )

        cache.set(cache_key, preview)
        response = dict(preview)
        response['success'] = True
        response['cached'] = False
        return jsonify(response), 200

    except ValueError as e:
        logger.error(f"Error getting HDF5 preview for '{key}' at '{hdf_path}': {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 404
    except TypeError as e:
        logger.error(f"Error getting HDF5 preview for '{key}' at '{hdf_path}': {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error getting HDF5 preview for '{key}' at '{hdf_path}': {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
