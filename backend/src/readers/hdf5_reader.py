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
    
    def get_metadata(self, key: str, path: str) -> Dict[str, Any]:
        """
        Get metadata for a specific path in HDF5 file
        
        Args:
            key: S3 object key (filename)
            path: HDF5 internal path
            
        Returns:
            Metadata dictionary
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
                        'name': path.split('/')[-1],
                        'path': path,
                    }
                    
                    # Type-specific metadata
                    if isinstance(obj, h5py.Group):
                        metadata['type'] = 'group'
                        metadata['num_children'] = len(obj.keys()) if hasattr(obj, 'keys') else 0
                    elif isinstance(obj, h5py.Dataset):
                        metadata['type'] = 'dataset'
                        metadata['shape'] = list(obj.shape)
                        metadata['dtype'] = str(obj.dtype)
                        metadata['size'] = obj.size
                        metadata['ndim'] = obj.ndim
                        
                        # Add chunk info if available
                        if obj.chunks:
                            metadata['chunks'] = list(obj.chunks)
                        
                        # Add compression info if available
                        if obj.compression:
                            metadata['compression'] = obj.compression
                    else:
                        metadata['type'] = 'unknown'
                    
                    # Get attributes (truncate if too many)
                    attrs = {}
                    if hasattr(obj, 'attrs'):
                        for attr_name in list(obj.attrs.keys())[:20]:  # Limit to 20 attrs
                            try:
                                attr_value = obj.attrs[attr_name]
                                # Convert to JSON-serializable type
                                if isinstance(attr_value, bytes):
                                    attr_value = attr_value.decode('utf-8', errors='ignore')
                                elif hasattr(attr_value, 'tolist'):
                                    attr_value = attr_value.tolist()
                                attrs[attr_name] = attr_value
                            except Exception as e:
                                logger.warning(f"Could not read attribute '{attr_name}': {e}")
                                attrs[attr_name] = f"<unreadable: {type(attr_value).__name__}>"
                    
                    metadata['attributes'] = attrs
                    metadata['num_attributes'] = len(obj.attrs) if hasattr(obj, 'attrs') else 0
                    
                    if metadata['num_attributes'] > 20:
                        metadata['attributes_truncated'] = True
            
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
