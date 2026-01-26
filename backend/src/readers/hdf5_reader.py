"""
HDF5 file reader with S3 support
Provides lazy tree navigation and metadata extraction
"""
import os
import logging
import h5py
import s3fs
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


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
        import numpy as np
        
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
