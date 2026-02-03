"""
HDF5 file navigation and metadata routes
"""
import logging
import math
from flask import Blueprint, request, jsonify
from src.storage.minio_client import get_minio_client
from src.readers.hdf5_reader import get_hdf5_reader
from src.utils.cache import get_hdf5_cache, get_dataset_cache, make_cache_key

logger = logging.getLogger(__name__)

hdf5_bp = Blueprint('hdf5', __name__)

MAX_ELEMENTS = 1_000_000
MAX_JSON_ELEMENTS = 500_000
MAX_MATRIX_ROWS = 2000
MAX_MATRIX_COLS = 2000
MAX_LINE_POINTS = 5000
MAX_HEATMAP_SIZE = 1024
DEFAULT_ROW_LIMIT = 100
DEFAULT_COL_LIMIT = 100
DEFAULT_MAX_SIZE = 512


def _parse_int_param(name, default=None, min_value=None):
    value = request.args.get(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"Invalid {name} parameter") from exc
    if min_value is not None and parsed < min_value:
        raise ValueError(f"{name} must be >= {min_value}")
    return parsed


def _parse_display_dims(param, ndim):
    if ndim < 2:
        return None
    if not param:
        return (ndim - 2, ndim - 1)
    parts = [part.strip() for part in param.split(',') if part.strip()]
    if len(parts) != 2:
        raise ValueError("display_dims must include two distinct dims")
    dims = []
    for part in parts:
        try:
            dim = int(part)
        except ValueError as exc:
            raise ValueError("Invalid display_dims parameter") from exc
        if dim < 0:
            dim = ndim + dim
        if dim < 0 or dim >= ndim:
            raise ValueError("display_dims out of range")
        dims.append(dim)
    if dims[0] == dims[1]:
        raise ValueError("display_dims must include two distinct dims")
    return (dims[0], dims[1])


def _parse_fixed_indices(param, ndim):
    indices = {}
    if not param:
        return indices
    parts = [part.strip() for part in param.split(',') if part.strip()]
    for part in parts:
        if '=' in part:
            dim_str, idx_str = part.split('=', 1)
        elif ':' in part:
            dim_str, idx_str = part.split(':', 1)
        else:
            raise ValueError("Invalid fixed_indices parameter")
        try:
            dim = int(dim_str.strip())
            idx = int(idx_str.strip())
        except ValueError as exc:
            raise ValueError("Invalid fixed_indices parameter") from exc
        if dim < 0:
            dim = ndim + dim
        if dim < 0 or dim >= ndim:
            raise ValueError("fixed_indices dim out of range")
        indices[dim] = idx
    return indices


def _fill_fixed_indices(fixed_indices, shape, display_dims):
    for dim in range(len(shape)):
        if display_dims and dim in display_dims:
            continue
        if dim not in fixed_indices:
            size = shape[dim]
            fixed_indices[dim] = size // 2 if size > 0 else 0
    return fixed_indices


def _parse_line_dim(param, ndim):
    if not param:
        return None
    lowered = param.strip().lower()
    if lowered in ('row', 'col'):
        return lowered
    try:
        dim = int(lowered)
    except ValueError as exc:
        raise ValueError("Invalid line_dim parameter") from exc
    if dim < 0:
        dim = ndim + dim
    if dim < 0 or dim >= ndim:
        raise ValueError("line_dim out of range")
    return dim


def _enforce_element_limits(count):
    if count > MAX_JSON_ELEMENTS:
        raise ValueError(
            f"Selection too large for JSON ({count} > {MAX_JSON_ELEMENTS} elements)"
        )
    if count > MAX_ELEMENTS:
        raise ValueError(
            f"Selection exceeds max_elements ({count} > {MAX_ELEMENTS} elements)"
        )

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


@hdf5_bp.route('/<path:key>/data', methods=['GET'])
def get_data(key):
    """Validate /data selections against hard limits before any data reads."""
    try:
        hdf_path = request.args.get('path')
        mode = request.args.get('mode')
        if not hdf_path:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: path'
            }), 400
        if not mode:
            return jsonify({
                'success': False,
                'error': 'Missing required parameter: mode'
            }), 400

        mode = mode.lower()
        if mode not in ('matrix', 'heatmap', 'line'):
            return jsonify({
                'success': False,
                'error': 'Invalid mode parameter'
            }), 400

        reader = get_hdf5_reader()
        dataset_info = reader.get_dataset_info(key, hdf_path)
        shape = dataset_info['shape']
        ndim = dataset_info['ndim']

        display_dims = _parse_display_dims(request.args.get('display_dims'), ndim)
        fixed_indices = _parse_fixed_indices(request.args.get('fixed_indices'), ndim)
        fixed_indices = _fill_fixed_indices(fixed_indices, shape, display_dims)

        if mode in ('matrix', 'heatmap') and (display_dims is None or ndim < 2):
            return jsonify({
                'success': False,
                'error': 'Mode requires a 2D or higher dataset'
            }), 400

        if mode == 'matrix':
            row_offset = _parse_int_param('row_offset', 0, 0)
            col_offset = _parse_int_param('col_offset', 0, 0)
            row_limit = _parse_int_param('row_limit', DEFAULT_ROW_LIMIT, 1)
            col_limit = _parse_int_param('col_limit', DEFAULT_COL_LIMIT, 1)
            row_step = _parse_int_param('row_step', 1, 1)
            col_step = _parse_int_param('col_step', 1, 1)

            row_dim, col_dim = display_dims
            rows = shape[row_dim]
            cols = shape[col_dim]
            row_limit = min(row_limit, max(0, rows - row_offset))
            col_limit = min(col_limit, max(0, cols - col_offset))

            if row_limit > MAX_MATRIX_ROWS or col_limit > MAX_MATRIX_COLS:
                raise ValueError(
                    f"Matrix limits exceed {MAX_MATRIX_ROWS}x{MAX_MATRIX_COLS}"
                )

            out_rows = int(math.ceil(row_limit / row_step))
            out_cols = int(math.ceil(col_limit / col_step))
            element_count = out_rows * out_cols
            _enforce_element_limits(element_count)

            matrix = reader.get_matrix(
                key,
                hdf_path,
                display_dims,
                fixed_indices,
                row_offset,
                row_limit,
                col_offset,
                col_limit,
                row_step=row_step,
                col_step=col_step
            )

            return jsonify({
                'success': True,
                'key': key,
                'path': hdf_path,
                'mode': 'matrix',
                'dtype': matrix['dtype'],
                'data': matrix['data'],
                'shape': matrix['shape'],
                'source_shape': shape,
                'source_ndim': ndim,
                'display_dims': list(display_dims) if display_dims else None,
                'fixed_indices': {str(k): v for k, v in fixed_indices.items()},
                'row_offset': matrix['row_offset'],
                'col_offset': matrix['col_offset'],
                'downsample_info': matrix['downsample_info']
            }), 200

        elif mode == 'heatmap':
            max_size = _parse_int_param('max_size', DEFAULT_MAX_SIZE, 1)
            if max_size > MAX_HEATMAP_SIZE:
                raise ValueError(f"max_size exceeds {MAX_HEATMAP_SIZE}")

            row_dim, col_dim = display_dims
            rows = shape[row_dim]
            cols = shape[col_dim]
            target_rows = min(rows, max_size)
            target_cols = min(cols, max_size)
            element_count = target_rows * target_cols
            _enforce_element_limits(element_count)

            heatmap = reader.get_heatmap(
                key,
                hdf_path,
                display_dims,
                fixed_indices,
                max_size
            )

            return jsonify({
                'success': True,
                'key': key,
                'path': hdf_path,
                'mode': 'heatmap',
                'dtype': heatmap['dtype'],
                'data': heatmap['data'],
                'shape': heatmap['shape'],
                'source_shape': shape,
                'source_ndim': ndim,
                'display_dims': list(display_dims) if display_dims else None,
                'fixed_indices': {str(k): v for k, v in fixed_indices.items()},
                'stats': heatmap['stats'],
                'row_offset': heatmap['row_offset'],
                'col_offset': heatmap['col_offset'],
                'downsample_info': heatmap['downsample_info'],
                'sampled': heatmap['sampled']
            }), 200

        elif mode == 'line':
            line_dim_param = request.args.get('line_dim')
            line_dim = _parse_line_dim(line_dim_param, ndim) if line_dim_param else None
            line_index = _parse_int_param('line_index', None, 0)
            line_offset = _parse_int_param('line_offset', 0, 0)
            line_limit_param = request.args.get('line_limit')
            line_limit = _parse_int_param('line_limit', None, 1) if line_limit_param else None

            if isinstance(line_dim, int):
                for dim in range(ndim):
                    if dim == line_dim:
                        continue
                    if dim not in fixed_indices:
                        size = shape[dim]
                        fixed_indices[dim] = size // 2 if size > 0 else 0

            if ndim == 1:
                line_length = shape[0]
                axis = 'dim'
            elif isinstance(line_dim, int):
                line_length = shape[line_dim]
                axis = 'dim'
            else:
                if display_dims is None:
                    display_dims = (ndim - 2, ndim - 1)
                row_dim, col_dim = display_dims
                rows = shape[row_dim]
                cols = shape[col_dim]
                axis = line_dim or 'row'
                if axis == 'row':
                    line_length = cols
                    if line_index is None:
                        line_index = rows // 2 if rows > 0 else 0
                    if line_index < 0 or line_index >= rows:
                        raise ValueError("line_index out of range")
                else:
                    line_length = rows
                    if line_index is None:
                        line_index = cols // 2 if cols > 0 else 0
                    if line_index < 0 or line_index >= cols:
                        raise ValueError("line_index out of range")

            if line_limit is None:
                line_limit = max(0, line_length - line_offset)
            else:
                line_limit = min(line_limit, max(0, line_length - line_offset))

            if line_limit > MAX_ELEMENTS:
                raise ValueError(
                    f"Selection exceeds max_elements ({line_limit} > {MAX_ELEMENTS} elements)"
                )

            line_step = 1
            if line_limit > 0:
                line_step = max(1, int(math.ceil(line_limit / MAX_LINE_POINTS)))

            line = reader.get_line(
                key,
                hdf_path,
                display_dims,
                fixed_indices,
                line_dim,
                line_index,
                line_offset,
                line_limit,
                line_step
            )

            return jsonify({
                'success': True,
                'key': key,
                'path': hdf_path,
                'mode': 'line',
                'dtype': line['dtype'],
                'data': line['data'],
                'shape': line['shape'],
                'source_shape': shape,
                'source_ndim': ndim,
                'display_dims': list(display_dims) if display_dims else None,
                'fixed_indices': {str(k): v for k, v in fixed_indices.items()},
                'axis': line['axis'],
                'index': line['index'],
                'line_offset': line_offset,
                'downsample_info': line['downsample_info']
            }), 200

        return jsonify({
            'success': False,
            'error': 'Data endpoint not implemented yet'
        }), 501

    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error validating /data for '{key}' at '{hdf_path}': {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
