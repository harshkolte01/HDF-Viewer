"""
HDF5 file reader with S3 support
Provides lazy tree navigation and metadata extraction
"""
import os
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
import h5py
import s3fs
import numpy as np

logger = logging.getLogger(__name__)

MAX_PREVIEW_ELEMENTS = 250_000
MAX_HEATMAP_SIZE = 512
MAX_HEATMAP_ELEMENTS = 200_000
MAX_LINE_POINTS = 5000
MIN_LINE_POINTS = 2000
TABLE_1D_MAX = 1000
TABLE_2D_MAX = 200
MAX_STATS_SAMPLE = 100_000


class HDF5Reader:
    """HDF5 file reader with S3 backend support"""
    
    def __init__(self):
        """Initialize HDF5 reader with S3 filesystem"""
        self.endpoint = os.getenv('S3_ENDPOINT')
        self.access_key = os.getenv('S3_ACCESS_KEY')
        self.secret_key = os.getenv('S3_SECRET_KEY')
        self.bucket = os.getenv('S3_BUCKET')
        
        # Initialize S3 filesystem
        self.s3 = s3fs.S3FileSystem(
            key=self.access_key,
            secret=self.secret_key,
            client_kwargs={'endpoint_url': self.endpoint}
        )
        
        logger.info(f"HDF5Reader initialized with S3 endpoint: {self.endpoint}")

    def _get_s3_path(self, key: str) -> str:
        """Convert object key to S3 path"""
        return f"{self.bucket}/{key}"

    def get_dataset_info(self, key: str, path: str) -> Dict[str, Any]:
        """Get lightweight dataset info (shape, dtype, ndim) without full reads."""
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Reading HDF5 dataset info from '{key}' at path '{path}'")

            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    if path not in hdf:
                        raise ValueError(f"Path '{path}' not found in '{key}'")

                    obj = hdf[path]
                    if not isinstance(obj, h5py.Dataset):
                        raise TypeError(f"Path '{path}' is not a dataset")

                    return {
                        'shape': list(obj.shape),
                        'ndim': obj.ndim,
                        'dtype': str(obj.dtype)
                    }
        except Exception as e:
            logger.error(f"Error reading HDF5 dataset info from '{key}' at '{path}': {e}")
            raise

    def normalize_preview_axes(
        self,
        shape: List[int],
        display_dims_param: Optional[str] = None,
        fixed_indices_param: Optional[str] = None
    ) -> Tuple[Tuple[int, int], Dict[int, int]]:
        """Normalize display dims and fixed indices for preview slicing."""
        ndim = len(shape)

        display_dims = self._parse_display_dims(display_dims_param, ndim)
        fixed_indices = self._parse_fixed_indices(fixed_indices_param, ndim)

        for dim in list(fixed_indices.keys()):
            if dim in display_dims:
                del fixed_indices[dim]

        for dim in range(ndim):
            if dim in display_dims:
                continue
            if dim not in fixed_indices:
                fixed_indices[dim] = self._default_index(shape, dim)
            else:
                fixed_indices[dim] = self._clamp_index(shape, dim, fixed_indices[dim])

        return display_dims, fixed_indices

    def get_preview(
        self,
        key: str,
        path: str,
        display_dims: Optional[Tuple[int, int]] = None,
        fixed_indices: Optional[Dict[int, int]] = None,
        mode: str = 'auto',
        max_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate a preview payload for a dataset."""
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Generating HDF5 preview from '{key}' at path '{path}'")

            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    if path not in hdf:
                        raise ValueError(f"Path '{path}' not found in '{key}'")

                    obj = hdf[path]
                    if not isinstance(obj, h5py.Dataset):
                        raise TypeError(f"Path '{path}' is not a dataset")

                    shape = list(obj.shape)
                    ndim = obj.ndim
                    dtype = obj.dtype
                    dtype_str = str(dtype)

                    preview_type = '1d' if ndim == 1 else '2d' if ndim == 2 else 'nd'
                    numeric = self._is_numeric_dtype(dtype)

                    stats = self._compute_stats(obj, shape, numeric)

                    if ndim == 1:
                        table, plot = self._preview_1d(obj, numeric)
                        profile = None
                        display_dims_out = None
                        fixed_indices_out = {}
                    else:
                        if display_dims is None or fixed_indices is None:
                            display_dims, fixed_indices = self.normalize_preview_axes(
                                shape,
                                None,
                                None
                            )

                        max_heatmap_size = min(max_size or MAX_HEATMAP_SIZE, MAX_HEATMAP_SIZE)
                        table, plot, profile = self._preview_2d(
                            obj,
                            shape,
                            display_dims,
                            fixed_indices,
                            max_heatmap_size,
                            numeric
                        )
                        display_dims_out = list(display_dims)
                        fixed_indices_out = fixed_indices

                    return {
                        'key': key,
                        'path': path,
                        'dtype': dtype_str,
                        'shape': shape,
                        'ndim': ndim,
                        'preview_type': preview_type,
                        'mode': mode,
                        'display_dims': display_dims_out,
                        'fixed_indices': fixed_indices_out,
                        'stats': stats,
                        'table': table,
                        'plot': plot,
                        'profile': profile,
                        'limits': {
                            'max_elements': MAX_PREVIEW_ELEMENTS,
                            'max_heatmap_size': min(max_size or MAX_HEATMAP_SIZE, MAX_HEATMAP_SIZE),
                            'max_line_points': MAX_LINE_POINTS,
                            'table_1d_max': TABLE_1D_MAX,
                            'table_2d_max': TABLE_2D_MAX
                        }
                    }
        except Exception as e:
            logger.error(f"Error generating HDF5 preview from '{key}' at '{path}': {e}")
            raise

    def get_matrix(
        self,
        key: str,
        path: str,
        display_dims: Tuple[int, int],
        fixed_indices: Dict[int, int],
        row_offset: int,
        row_limit: int,
        col_offset: int,
        col_limit: int,
        row_step: int = 1,
        col_step: int = 1
    ) -> Dict[str, Any]:
        """Extract a 2D matrix block from a dataset."""
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Reading HDF5 matrix from '{key}' at path '{path}'")

            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    if path not in hdf:
                        raise ValueError(f"Path '{path}' not found in '{key}'")

                    obj = hdf[path]
                    if not isinstance(obj, h5py.Dataset):
                        raise TypeError(f"Path '{path}' is not a dataset")

                    shape = list(obj.shape)
                    ndim = obj.ndim
                    if ndim < 2:
                        raise TypeError("Matrix mode requires a 2D or higher dataset")

                    row_dim, col_dim = display_dims
                    rows = int(shape[row_dim])
                    cols = int(shape[col_dim])
                    needs_transpose = row_dim > col_dim

                    row_offset = max(0, min(row_offset, rows))
                    col_offset = max(0, min(col_offset, cols))
                    row_limit = max(0, min(row_limit, rows - row_offset))
                    col_limit = max(0, min(col_limit, cols - col_offset))

                    out_rows = int(math.ceil(row_limit / row_step)) if row_limit > 0 else 0
                    out_cols = int(math.ceil(col_limit / col_step)) if col_limit > 0 else 0

                    if row_limit == 0 or col_limit == 0:
                        data = []
                    else:
                        row_slice = slice(row_offset, row_offset + row_limit, row_step)
                        col_slice = slice(col_offset, col_offset + col_limit, col_step)
                        indexer = self._build_indexer(
                            ndim,
                            display_dims,
                            fixed_indices,
                            {
                                row_dim: row_slice,
                                col_dim: col_slice
                            }
                        )
                        data = obj[tuple(indexer)]
                        if needs_transpose and hasattr(data, 'T'):
                            data = data.T
                        data = self._sanitize(data)

                    return {
                        'data': data,
                        'shape': [out_rows, out_cols],
                        'dtype': str(obj.dtype),
                        'row_offset': row_offset,
                        'col_offset': col_offset,
                        'downsample_info': {
                            'row_step': row_step,
                            'col_step': col_step
                        }
                    }
        except Exception as e:
            logger.error(f"Error reading HDF5 matrix from '{key}' at '{path}': {e}")
            raise

    def get_line(
        self,
        key: str,
        path: str,
        display_dims: Optional[Tuple[int, int]],
        fixed_indices: Dict[int, int],
        line_dim,
        line_index: Optional[int],
        line_offset: int,
        line_limit: int,
        line_step: int
    ) -> Dict[str, Any]:
        """Extract a 1D line profile from a dataset."""
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Reading HDF5 line from '{key}' at path '{path}'")

            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    if path not in hdf:
                        raise ValueError(f"Path '{path}' not found in '{key}'")

                    obj = hdf[path]
                    if not isinstance(obj, h5py.Dataset):
                        raise TypeError(f"Path '{path}' is not a dataset")

                    shape = list(obj.shape)
                    ndim = obj.ndim

                    axis = None
                    index = None
                    if ndim == 1:
                        vary_dim = 0
                        axis = 'dim'
                    elif isinstance(line_dim, int):
                        vary_dim = line_dim
                        axis = 'dim'
                    else:
                        if display_dims is None:
                            raise ValueError("display_dims required for row/col line")
                        row_dim, col_dim = display_dims
                        if line_dim == 'col':
                            vary_dim = row_dim
                            axis = 'col'
                            index = line_index
                        else:
                            vary_dim = col_dim
                            axis = 'row'
                            index = line_index

                    line_offset = max(0, line_offset)
                    line_limit = max(0, line_limit)

                    if line_limit == 0:
                        data = []
                        out_count = 0
                    else:
                        line_slice = slice(line_offset, line_offset + line_limit, line_step)
                        indexer = []
                        for dim in range(ndim):
                            if dim == vary_dim:
                                indexer.append(line_slice)
                                continue
                            if axis in ('row', 'col'):
                                if axis == 'row' and dim == display_dims[0]:
                                    indexer.append(index)
                                    continue
                                if axis == 'col' and dim == display_dims[1]:
                                    indexer.append(index)
                                    continue
                            indexer.append(fixed_indices.get(dim, 0))
                        data = obj[tuple(indexer)]
                        data = self._sanitize(data)
                        out_count = int(math.ceil(line_limit / line_step))

                    return {
                        'data': data,
                        'shape': [out_count],
                        'dtype': str(obj.dtype),
                        'axis': axis,
                        'index': index,
                        'downsample_info': {
                            'step': line_step
                        }
                    }
        except Exception as e:
            logger.error(f"Error reading HDF5 line from '{key}' at '{path}': {e}")
            raise

    def get_heatmap(
        self,
        key: str,
        path: str,
        display_dims: Tuple[int, int],
        fixed_indices: Dict[int, int],
        max_size: int
    ) -> Dict[str, Any]:
        """Extract a downsampled 2D heatmap plane from a dataset."""
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Reading HDF5 heatmap from '{key}' at path '{path}'")

            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    if path not in hdf:
                        raise ValueError(f"Path '{path}' not found in '{key}'")

                    obj = hdf[path]
                    if not isinstance(obj, h5py.Dataset):
                        raise TypeError(f"Path '{path}' is not a dataset")

                    shape = list(obj.shape)
                    ndim = obj.ndim
                    if ndim < 2:
                        raise TypeError("Heatmap mode requires a 2D or higher dataset")

                    row_dim, col_dim = display_dims
                    rows = int(shape[row_dim])
                    cols = int(shape[col_dim])
                    needs_transpose = row_dim > col_dim

                    target_rows = min(rows, max_size)
                    target_cols = min(cols, max_size)

                    step_r = max(1, int(math.ceil(rows / target_rows))) if target_rows > 0 else 1
                    step_c = max(1, int(math.ceil(cols / target_cols))) if target_cols > 0 else 1

                    row_slice = slice(0, rows, step_r)
                    col_slice = slice(0, cols, step_c)
                    indexer = self._build_indexer(
                        ndim,
                        display_dims,
                        fixed_indices,
                        {
                            row_dim: row_slice,
                            col_dim: col_slice
                        }
                    )
                    raw = obj[tuple(indexer)]
                    if needs_transpose and hasattr(raw, 'T'):
                        raw = raw.T
                    data = self._sanitize(raw)

                    sampled = step_r > 1 or step_c > 1
                    numeric = self._is_numeric_dtype(obj.dtype)
                    stats = {'min': None, 'max': None}
                    if numeric:
                        try:
                            arr = np.asarray(raw).astype(float, copy=False)
                            stats['min'] = self._safe_number(np.nanmin(arr)) if arr.size else None
                            stats['max'] = self._safe_number(np.nanmax(arr)) if arr.size else None
                        except Exception:
                            stats = {'min': None, 'max': None}

                    return {
                        'data': data,
                        'shape': [len(data), len(data[0]) if data and isinstance(data[0], list) else 0],
                        'dtype': str(obj.dtype),
                        'stats': stats,
                        'row_offset': 0,
                        'col_offset': 0,
                        'downsample_info': {
                            'row_step': step_r,
                            'col_step': step_c
                        },
                        'sampled': sampled
                    }
        except Exception as e:
            logger.error(f"Error reading HDF5 heatmap from '{key}' at '{path}': {e}")
            raise
    
    def get_children(self, key: str, path: str = '/') -> List[Dict[str, Any]]:
        """
        Get children (groups/datasets) at a specific path in HDF5 file
        
        Args:
            key: S3 object key (filename)
            path: HDF5 internal path (default: root '/')
            
        Returns:
            List of children with metadata
        """
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Reading HDF5 children from '{key}' at path '{path}'")
            
            children = []
            
            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    # Navigate to the specified path
                    if path == '/':
                        obj = hdf
                    else:
                        if path not in hdf:
                            logger.warning(f"Path '{path}' not found in '{key}'")
                            return []
                        obj = hdf[path]
                    
                    # List children
                    if hasattr(obj, 'keys'):
                        for child_name in obj.keys():
                            child = obj[child_name]
                            child_path = f"{path.rstrip('/')}/{child_name}"
                            
                            # Determine type
                            if isinstance(child, h5py.Group):
                                child_type = 'group'
                                child_info = {
                                    'name': child_name,
                                    'path': child_path,
                                    'type': child_type,
                                    'num_children': len(child.keys()) if hasattr(child, 'keys') else 0
                                }
                            elif isinstance(child, h5py.Dataset):
                                child_type = 'dataset'
                                child_info = {
                                    'name': child_name,
                                    'path': child_path,
                                    'type': child_type,
                                    'shape': list(child.shape),
                                    'dtype': str(child.dtype),
                                    'size': child.size,
                                    'ndim': child.ndim
                                }
                                
                                # Add chunk info if available
                                if child.chunks:
                                    child_info['chunks'] = list(child.chunks)
                                
                                # Add compression info if available
                                if child.compression:
                                    child_info['compression'] = child.compression
                                
                                # Add attributes (limit to 10 for performance)
                                if hasattr(child, 'attrs') and len(child.attrs) > 0:
                                    attrs = {}
                                    for attr_name in list(child.attrs.keys())[:10]:
                                        try:
                                            attr_value = child.attrs[attr_name]
                                            # Convert to JSON-serializable type
                                            if isinstance(attr_value, bytes):
                                                attr_value = attr_value.decode('utf-8', errors='ignore')
                                            elif hasattr(attr_value, 'tolist'):
                                                attr_value = attr_value.tolist()
                                            attrs[attr_name] = attr_value
                                        except Exception as e:
                                            logger.warning(f"Could not read attribute '{attr_name}': {e}")
                                            attrs[attr_name] = f"<unreadable>"
                                    
                                    child_info['attributes'] = attrs
                                    child_info['num_attributes'] = len(child.attrs)
                                    if len(child.attrs) > 10:
                                        child_info['attributes_truncated'] = True
                            else:
                                child_type = 'unknown'
                                child_info = {
                                    'name': child_name,
                                    'path': child_path,
                                    'type': child_type
                                }
                            
                            children.append(child_info)
            
            logger.info(f"Found {len(children)} children at '{path}' in '{key}'")
            return children
            
        except Exception as e:
            logger.error(f"Error reading HDF5 children from '{key}' at '{path}': {e}")
            raise
    
    def _get_type_info(self, dtype) -> Dict[str, Any]:
        """Extract detailed type information from h5py dtype"""
        type_info = {}
        
        # Determine type class
        if dtype.kind in ['i', 'u']:  # Integer types
            type_info['class'] = 'Integer'
            type_info['signed'] = dtype.kind == 'i'
        elif dtype.kind == 'f':  # Float types
            type_info['class'] = 'Float'
        elif dtype.kind in ['S', 'U', 'O']:  # String types
            type_info['class'] = 'String'
        elif dtype.kind == 'b':  # Boolean
            type_info['class'] = 'Boolean'
        else:
            type_info['class'] = 'Unknown'
        
        # Endianness
        if dtype.byteorder == '<':
            type_info['endianness'] = 'little-endian'
        elif dtype.byteorder == '>':
            type_info['endianness'] = 'big-endian'
        elif dtype.byteorder == '=':
            type_info['endianness'] = 'native'
        else:
            type_info['endianness'] = 'not-applicable'
        
        # Size in bits
        type_info['size'] = dtype.itemsize * 8
        
        return type_info
    
    def _get_raw_type_info(self, dtype) -> Dict[str, Any]:
        """Extract raw type information for advanced users"""
        raw_type = {
            'type': dtype.num,
            'size': dtype.itemsize,
            'littleEndian': dtype.byteorder in ['<', '='],
            'vlen': dtype.metadata is not None and 'vlen' in str(dtype.metadata),
            'total_size': dtype.itemsize
        }
        
        if dtype.kind in ['i', 'u']:
            raw_type['signed'] = dtype.kind == 'i'
        
        return raw_type
    
    def _get_filters_info(self, dataset) -> List[Dict[str, Any]]:
        """Extract filter/compression information"""
        filters = []
        
        # Check for compression
        if dataset.compression:
            filter_info = {
                'name': dataset.compression,
                'id': 0  # Default ID
            }
            
            if dataset.compression == 'gzip':
                filter_info['id'] = 1
                if dataset.compression_opts:
                    filter_info['level'] = dataset.compression_opts
            elif dataset.compression == 'lzf':
                filter_info['id'] = 32000
            elif dataset.compression == 'szip':
                filter_info['id'] = 4
            
            filters.append(filter_info)
        
        # Check for shuffle filter
        if hasattr(dataset, 'shuffle') and dataset.shuffle:
            filters.append({
                'name': 'shuffle',
                'id': 2
            })
        
        # Check for fletcher32 checksum
        if hasattr(dataset, 'fletcher32') and dataset.fletcher32:
            filters.append({
                'name': 'fletcher32',
                'id': 3
            })
        
        return filters

    def _parse_display_dims(self, param: Optional[str], ndim: int) -> Tuple[int, int]:
        if ndim <= 1:
            return (0, 0)
        if not param:
            return (ndim - 2, ndim - 1)

        dims = []
        for part in param.split(','):
            part = part.strip()
            if not part:
                continue
            try:
                dim = int(part)
            except ValueError:
                continue
            if dim < 0:
                dim = ndim + dim
            if dim < 0 or dim >= ndim:
                continue
            if dim not in dims:
                dims.append(dim)

        if len(dims) >= 2:
            return (dims[0], dims[1])
        return (ndim - 2, ndim - 1)

    def _parse_fixed_indices(self, param: Optional[str], ndim: int) -> Dict[int, int]:
        indices: Dict[int, int] = {}
        if not param:
            return indices
        for part in param.split(','):
            part = part.strip()
            if not part:
                continue
            if '=' in part:
                dim_str, idx_str = part.split('=', 1)
            elif ':' in part:
                dim_str, idx_str = part.split(':', 1)
            else:
                continue
            try:
                dim = int(dim_str.strip())
                idx = int(idx_str.strip())
            except ValueError:
                continue
            if dim < 0:
                dim = ndim + dim
            if dim < 0 or dim >= ndim:
                continue
            indices[dim] = idx
        return indices

    def _default_index(self, shape: List[int], dim: int) -> int:
        if shape[dim] <= 0:
            return 0
        return shape[dim] // 2

    def _clamp_index(self, shape: List[int], dim: int, index: int) -> int:
        if shape[dim] <= 0:
            return 0
        return max(0, min(index, shape[dim] - 1))

    def _is_numeric_dtype(self, dtype) -> bool:
        try:
            return np.issubdtype(dtype, np.number) or np.issubdtype(dtype, np.bool_)
        except Exception:
            return False

    def _total_elements(self, shape: List[int]) -> int:
        total = 1
        for dim in shape:
            total *= int(dim)
        return total

    def _compute_strides(self, shape: List[int], target: int) -> List[int]:
        total = self._total_elements(shape)
        if total == 0:
            return [1 for _ in shape]
        if total <= target:
            return [1 for _ in shape]
        ndim = len(shape)
        base = math.ceil((total / target) ** (1.0 / max(ndim, 1)))
        return [max(1, int(base)) for _ in shape]

    def _compute_stats(self, dataset, shape: List[int], numeric: bool) -> Dict[str, Any]:
        if not numeric:
            return {
                'supported': False,
                'reason': 'non-numeric'
            }

        total = self._total_elements(shape)
        if total == 0:
            return {
                'supported': False,
                'reason': 'empty'
            }

        strides = self._compute_strides(shape, MAX_STATS_SAMPLE)
        indexer = tuple(slice(None, None, stride) for stride in strides)
        sample = dataset[indexer]
        arr = np.asarray(sample).ravel()

        if arr.size == 0:
            return {
                'supported': False,
                'reason': 'empty'
            }

        if np.iscomplexobj(arr):
            return {
                'supported': False,
                'reason': 'complex'
            }

        if arr.size > MAX_STATS_SAMPLE:
            arr = arr[:MAX_STATS_SAMPLE]

        sampled = arr.size < total

        arr = arr.astype(float, copy=False)
        min_val = np.nanmin(arr)
        max_val = np.nanmax(arr)
        mean_val = np.nanmean(arr)
        std_val = np.nanstd(arr)

        return {
            'supported': True,
            'min': self._safe_number(min_val),
            'max': self._safe_number(max_val),
            'mean': self._safe_number(mean_val),
            'std': self._safe_number(std_val),
            'sample_size': int(arr.size),
            'sampled': sampled,
            'method': 'strided'
        }

    def _preview_1d(self, dataset, numeric: bool) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        length = int(dataset.shape[0]) if dataset.shape else 0

        table_n = min(TABLE_1D_MAX, length)
        table_values = dataset[:table_n] if table_n > 0 else []
        table_values = self._sanitize(table_values)

        table = {
            'kind': '1d',
            'values': table_values,
            'count': len(table_values),
            'start': 0,
            'step': 1
        }

        if not numeric:
            plot = {
                'supported': False,
                'reason': 'non-numeric'
            }
            return table, plot

        if length <= MAX_LINE_POINTS:
            step = 1
            y_values = dataset[:] if length > 0 else []
        else:
            target = min(MAX_LINE_POINTS, max(MIN_LINE_POINTS, 3000))
            step = max(1, int(math.ceil(length / target)))
            y_values = dataset[::step]
            if len(y_values) > MAX_LINE_POINTS:
                y_values = y_values[:MAX_LINE_POINTS]

        y_values = self._sanitize(y_values)
        x_values = list(range(0, step * len(y_values), step))

        plot = {
            'type': 'line',
            'x': x_values,
            'y': y_values,
            'count': len(y_values),
            'x_start': 0,
            'x_step': step
        }

        return table, plot

    def _preview_2d(
        self,
        dataset,
        shape: List[int],
        display_dims: Tuple[int, int],
        fixed_indices: Dict[int, int],
        max_heatmap_size: int,
        numeric: bool
    ) -> Tuple[Dict[str, Any], Dict[str, Any], Optional[Dict[str, Any]]]:
        dim_row, dim_col = display_dims
        rows = int(shape[dim_row])
        cols = int(shape[dim_col])
        needs_transpose = dim_row > dim_col

        table_rows = min(TABLE_2D_MAX, rows)
        table_cols = min(TABLE_2D_MAX, cols)
        table_indexer = self._build_indexer(
            len(shape),
            display_dims,
            fixed_indices,
            {
                dim_row: slice(0, table_rows, 1),
                dim_col: slice(0, table_cols, 1)
            }
        )
        table_data = dataset[tuple(table_indexer)] if table_rows > 0 and table_cols > 0 else []
        if needs_transpose and hasattr(table_data, 'T'):
            table_data = table_data.T
        table_data = self._sanitize(table_data)
        table = {
            'kind': '2d',
            'data': table_data,
            'shape': [table_rows, table_cols],
            'row_start': 0,
            'col_start': 0,
            'row_step': 1,
            'col_step': 1
        }

        if not numeric or rows == 0 or cols == 0:
            plot = {
                'supported': False,
                'reason': 'non-numeric' if not numeric else 'empty'
            }
            profile = None
            return table, plot, profile

        target_rows = min(rows, max_heatmap_size)
        target_cols = min(cols, max_heatmap_size)
        if target_rows * target_cols > MAX_HEATMAP_ELEMENTS:
            scale = math.sqrt((target_rows * target_cols) / MAX_HEATMAP_ELEMENTS)
            target_rows = max(1, int(math.floor(target_rows / scale)))
            target_cols = max(1, int(math.floor(target_cols / scale)))

        step_r = max(1, int(math.ceil(rows / target_rows)))
        step_c = max(1, int(math.ceil(cols / target_cols)))

        heatmap_indexer = self._build_indexer(
            len(shape),
            display_dims,
            fixed_indices,
            {
                dim_row: slice(0, rows, step_r),
                dim_col: slice(0, cols, step_c)
            }
        )
        heatmap = dataset[tuple(heatmap_indexer)]
        if needs_transpose and hasattr(heatmap, 'T'):
            heatmap = heatmap.T
        heatmap = self._sanitize(heatmap)

        plot = {
            'type': 'heatmap',
            'data': heatmap,
            'shape': [len(heatmap), len(heatmap[0]) if heatmap and isinstance(heatmap[0], list) else 0],
            'row_start': 0,
            'col_start': 0,
            'row_step': step_r,
            'col_step': step_c
        }

        row_index = rows // 2
        target_line = min(MAX_LINE_POINTS, max(MIN_LINE_POINTS, 3000))
        step_line = max(1, int(math.ceil(cols / target_line)))
        line_indexer = self._build_indexer(
            len(shape),
            display_dims,
            fixed_indices,
            {
                dim_row: row_index,
                dim_col: slice(0, cols, step_line)
            }
        )
        line_values = dataset[tuple(line_indexer)]
        if len(line_values) > MAX_LINE_POINTS:
            line_values = line_values[:MAX_LINE_POINTS]
        line_values = self._sanitize(line_values)
        line_x = list(range(0, step_line * len(line_values), step_line))

        profile = {
            'type': 'row',
            'index': row_index,
            'x': line_x,
            'y': line_values,
            'count': len(line_values),
            'x_start': 0,
            'x_step': step_line,
            'dim_row': dim_row,
            'dim_col': dim_col
        }

        return table, plot, profile

    def _build_indexer(
        self,
        ndim: int,
        display_dims: Tuple[int, int],
        fixed_indices: Dict[int, int],
        dim_slices: Dict[int, Any]
    ) -> List[Any]:
        indexer: List[Any] = []
        for dim in range(ndim):
            if dim in display_dims:
                indexer.append(dim_slices.get(dim, slice(None)))
            else:
                indexer.append(fixed_indices.get(dim, 0))
        return indexer

    def _safe_number(self, value: Any) -> Optional[float]:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if math.isfinite(number):
            return number
        return None

    def _sanitize(self, data: Any) -> Any:
        if isinstance(data, bytes):
            return data.decode('utf-8', errors='ignore')
        if isinstance(data, complex):
            return str(data)
        if isinstance(data, (np.generic,)):
            return self._sanitize(data.item())
        if isinstance(data, float):
            return self._safe_number(data)
        if isinstance(data, np.ndarray):
            return [self._sanitize(item) for item in data.tolist()]
        if isinstance(data, list):
            return [self._sanitize(item) for item in data]
        if isinstance(data, tuple):
            return [self._sanitize(item) for item in data]
        return data
    
    def get_metadata(self, key: str, path: str) -> Dict[str, Any]:
        """
        Get comprehensive metadata for a specific path in HDF5 file
        
        Args:
            key: S3 object key (filename)
            path: HDF5 internal path
            
        Returns:
            Comprehensive metadata dictionary with type info, filters, etc.
        """
        try:
            s3_path = self._get_s3_path(key)
            logger.info(f"Reading HDF5 metadata from '{key}' at path '{path}'")
            
            with self.s3.open(s3_path, 'rb') as f:
                with h5py.File(f, 'r') as hdf:
                    if path not in hdf:
                        raise ValueError(f"Path '{path}' not found in '{key}'")
                    
                    obj = hdf[path]
                    
                    # Base metadata
                    metadata = {
                        'name': path.split('/')[-1] if path != '/' else '',
                        'path': path,
                    }
                    
                    # Get attributes first (common to all types)
                    attrs = []
                    if hasattr(obj, 'attrs'):
                        for attr_name in list(obj.attrs.keys())[:20]:  # Limit to 20 attrs
                            try:
                                attr_value = obj.attrs[attr_name]
                                # Convert to JSON-serializable type
                                if isinstance(attr_value, bytes):
                                    attr_value = attr_value.decode('utf-8', errors='ignore')
                                elif hasattr(attr_value, 'tolist'):
                                    attr_value = attr_value.tolist()
                                attrs.append({
                                    'name': attr_name,
                                    'value': attr_value
                                })
                            except Exception as e:
                                logger.warning(f"Could not read attribute '{attr_name}': {e}")
                    
                    metadata['attributes'] = attrs
                    
                    # Type-specific metadata
                    if isinstance(obj, h5py.Group):
                        metadata['kind'] = 'group'
                        metadata['type'] = 'group'
                        metadata['num_children'] = len(obj.keys()) if hasattr(obj, 'keys') else 0
                        
                    elif isinstance(obj, h5py.Dataset):
                        metadata['kind'] = 'dataset'
                        metadata['type'] = 'dataset'
                        metadata['shape'] = list(obj.shape)
                        metadata['dtype'] = str(obj.dtype)
                        metadata['size'] = obj.size
                        metadata['ndim'] = obj.ndim
                        
                        # Detailed type information
                        metadata['type'] = self._get_type_info(obj.dtype)
                        metadata['rawType'] = self._get_raw_type_info(obj.dtype)
                        
                        # Filters (compression, shuffle, etc.)
                        metadata['filters'] = self._get_filters_info(obj)
                        
                        # Add chunk info if available
                        if obj.chunks:
                            metadata['chunks'] = list(obj.chunks)
                        
                        # Add compression info if available
                        if obj.compression:
                            metadata['compression'] = obj.compression
                            if obj.compression_opts:
                                metadata['compression_opts'] = obj.compression_opts
                    else:
                        metadata['kind'] = 'unknown'
                        metadata['type'] = 'unknown'
            
            logger.info(f"Retrieved metadata for '{path}' in '{key}'")
            return metadata
            
        except Exception as e:
            logger.error(f"Error reading HDF5 metadata from '{key}' at '{path}': {e}")
            raise


# Global HDF5 reader instance
_hdf5_reader: Optional[HDF5Reader] = None


def get_hdf5_reader() -> HDF5Reader:
    """Get or create the global HDF5 reader instance"""
    global _hdf5_reader
    
    if _hdf5_reader is None:
        _hdf5_reader = HDF5Reader()
    
    return _hdf5_reader
