import os
import logging
from typing import List, Dict, Optional, BinaryIO
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
    
    def list_objects(self, prefix: str = '') -> List[Dict[str, any]]:
        """
        List all objects in the bucket with optional prefix filter
        
        Args:
            prefix: Optional prefix to filter objects
            
        Returns:
            List of dictionaries containing object metadata:
            - key: Object key/path
            - size: Size in bytes
            - last_modified: Last modification timestamp
            - etag: Entity tag
        """
        try:
            logger.info(f"Listing objects in bucket '{self.bucket}' with prefix '{prefix}'")
            
            objects = []
            paginator = self.client.get_paginator('list_objects_v2')
            
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        objects.append({
                            'key': obj['Key'],
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat(),
                            'etag': obj['ETag'].strip('"')
                        })
            
            logger.info(f"Found {len(objects)} objects")
            return objects
            
        except ClientError as e:
            logger.error(f"Error listing objects: {e}")
            raise
    
    def get_object_metadata(self, key: str) -> Dict[str, any]:
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
            logger.info(f"Getting metadata for object '{key}'")
            
            response = self.client.head_object(Bucket=self.bucket, Key=key)
            
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
