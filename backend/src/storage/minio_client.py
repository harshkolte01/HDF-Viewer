import os
import logging
from typing import List, Dict, Optional, BinaryIO, Any, Set
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class MinIOClient:
    """MinIO client wrapper for S3-compatible operations"""
    
    def __init__(self):
        """Initialize MinIO client using environment variables"""
        self.endpoint = os.getenv('S3_ENDPOINT')
        self.region = os.getenv('S3_REGION', 'us-east-1')
        self.access_key = os.getenv('S3_ACCESS_KEY')
        self.secret_key = os.getenv('S3_SECRET_KEY')
        self.bucket = os.getenv('S3_BUCKET')
        
        # Validate required configuration
        if not all([self.endpoint, self.access_key, self.secret_key, self.bucket]):
            raise ValueError("Missing required S3/MinIO configuration in environment variables")
        
        # Initialize boto3 client
        self.client = boto3.client(
            's3',
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            config=Config(signature_version='s3v4')
        )
        
        logger.info(f"MinIO client initialized - Endpoint: {self.endpoint}, Bucket: {self.bucket}")
    
    def _normalize_prefix(self, prefix: str) -> str:
        """Normalize a logical folder prefix for S3 key matching."""
        return str(prefix or '').strip().lstrip('/')

    def _derive_parent_folders(self, key: str, normalized_prefix: str) -> Set[str]:
        """Return parent folder paths for a key (folder paths end with '/')."""
        folders: Set[str] = set()
        parts = [part for part in str(key).split('/') if part]
        if len(parts) <= 1:
            return folders

        running = []
        for part in parts[:-1]:
            running.append(part)
            folder = '/'.join(running) + '/'
            if normalized_prefix and not folder.startswith(normalized_prefix):
                continue
            folders.add(folder)

        return folders

    def list_objects(
        self,
        prefix: str = '',
        include_folders: bool = False,
        max_items: Optional[int] = None,
        bucket: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List all objects in the bucket with optional prefix filter
        
        Args:
            prefix: Optional prefix to filter objects
            include_folders: Include derived folder entries from object keys
            max_items: Optional maximum number of file entries to return
             
        Returns:
            List of dictionaries containing object and/or folder metadata:
            - key: Object key/path
            - size: Size in bytes
            - last_modified: Last modification timestamp
            - etag: Entity tag
            - type: file|folder
            - is_folder: boolean
        """
        try:
            normalized_prefix = self._normalize_prefix(prefix)
            normalized_max_items = None
            if max_items is not None:
                normalized_max_items = max(1, int(max_items))

            effective_bucket = bucket or self.bucket
            logger.info(
                "Listing objects in bucket '%s' with prefix '%s' (include_folders=%s, max_items=%s)",
                effective_bucket,
                normalized_prefix,
                include_folders,
                normalized_max_items if normalized_max_items is not None else 'all'
            )
             
            objects = []
            folders: Set[str] = set()
            paginator = self.client.get_paginator('list_objects_v2')
            reached_limit = False
             
            for page in paginator.paginate(Bucket=effective_bucket, Prefix=normalized_prefix):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj.get('Key')
                        if not key:
                            continue

                        if str(key).endswith('/'):
                            if include_folders:
                                folders.add(str(key))
                            continue

                        objects.append({
                            'key': key,
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat(),
                            'etag': obj['ETag'].strip('"'),
                            'type': 'file',
                            'is_folder': False
                        })

                        if include_folders:
                            folders.update(self._derive_parent_folders(key, normalized_prefix))

                        if normalized_max_items is not None and len(objects) >= normalized_max_items:
                            reached_limit = True
                            break

                if reached_limit:
                    break

            if include_folders and folders:
                folder_entries = [
                    {
                        'key': folder,
                        'size': 0,
                        'last_modified': None,
                        'etag': None,
                        'type': 'folder',
                        'is_folder': True
                    }
                    for folder in sorted(folders)
                ]
                objects.extend(folder_entries)
             
            logger.info(
                "Found %d entries (%d files, %d folders)%s",
                len(objects),
                len([entry for entry in objects if entry.get('type') == 'file']),
                len([entry for entry in objects if entry.get('type') == 'folder']),
                " [truncated]" if reached_limit else ""
            )
            return objects
             
        except ClientError as e:
            logger.error(f"Error listing objects: {e}")
            raise
    
    def get_object_metadata(self, key: str, bucket: Optional[str] = None) -> Dict[str, any]:
        """
        Get metadata for a specific object using HEAD request
        
        Args:
            key: Object key/path
            
        Returns:
            Dictionary containing object metadata:
            - key: Object key
            - size: Content length in bytes
            - last_modified: Last modification timestamp
            - etag: Entity tag
            - content_type: Content type
        """
        try:
            effective_bucket = bucket or self.bucket
            logger.info(f"Getting metadata for object '{key}' in bucket '{effective_bucket}'")
            
            response = self.client.head_object(Bucket=effective_bucket, Key=key)
            
            metadata = {
                'key': key,
                'size': response['ContentLength'],
                'last_modified': response['LastModified'].isoformat(),
                'etag': response['ETag'].strip('"'),
                'content_type': response.get('ContentType', 'application/octet-stream')
            }
            
            logger.info(f"Retrieved metadata for '{key}': {metadata['size']} bytes")
            return metadata
            
        except ClientError as e:
            logger.error(f"Error getting metadata for '{key}': {e}")
            raise
    
    def open_object_stream(self, key: str) -> BinaryIO:
        """
        Open an object as a file-like stream for reading
        
        WARNING: This fetches the ENTIRE object, not range-based.
        For HDF5 random access, use get_object_range() instead.
        
        Args:
            key: Object key/path
            
        Returns:
            File-like binary stream object
        """
        try:
            logger.info(f"Opening stream for object '{key}' (full object fetch)")
            
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            stream = response['Body']
            
            logger.info(f"Stream opened for '{key}'")
            return stream
            
        except ClientError as e:
            logger.error(f"Error opening stream for '{key}': {e}")
            raise
    
    def get_object_range(self, key: str, start: int, end: int) -> bytes:
        """
        Read a specific byte range from an object using HTTP Range requests
        
        This is the CORRECT method for HDF5 random access - it uses true
        HTTP Range GET requests, not full-object streaming.
        
        Args:
            key: Object key/path
            start: Starting byte position (inclusive, 0-indexed)
            end: Ending byte position (inclusive)
            
        Returns:
            Bytes read from the specified range
        """
        try:
            # HTTP Range header format: "bytes=start-end" (both inclusive)
            range_header = f"bytes={start}-{end}"
            logger.info(f"Reading range from '{key}': {range_header}")
            
            response = self.client.get_object(
                Bucket=self.bucket,
                Key=key,
                Range=range_header
            )
            
            data = response['Body'].read()
            logger.info(f"Read {len(data)} bytes from '{key}' (range: {start}-{end})")
            
            return data
            
        except ClientError as e:
            logger.error(f"Error reading range from '{key}': {e}")
            raise


# Global MinIO client instance
_minio_client: Optional[MinIOClient] = None


def get_minio_client() -> MinIOClient:
    """Get or create the global MinIO client instance"""
    global _minio_client
    
    if _minio_client is None:
        _minio_client = MinIOClient()
    
    return _minio_client
