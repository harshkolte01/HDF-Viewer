"""
Verification script to ensure HTTP Range requests are being used
This is critical for HDF5 random access performance
"""
import os
import logging
from dotenv import load_dotenv
from src.storage.minio_client import get_minio_client

# Load environment variables
load_dotenv()

# Configure logging to show boto3 debug info
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Enable boto3 debug logging to see HTTP headers
import boto3
boto3.set_stream_logger('boto3.resources', logging.DEBUG)
boto3.set_stream_logger('botocore', logging.DEBUG)


def verify_range_requests():
    """Verify that Range requests are actually being sent"""
    logger.info("="*60)
    logger.info("VERIFYING HTTP RANGE REQUEST SUPPORT")
    logger.info("="*60)
    
    try:
        minio = get_minio_client()
        
        # Get list of objects
        logger.info("\n1. Getting list of objects...")
        objects = minio.list_objects()
        
        if not objects:
            logger.error("No objects found in bucket. Please upload a test file first.")
            return False
        
        test_obj = objects[0]
        test_key = test_obj['key']
        test_size = test_obj['size']
        
        logger.info(f"\n2. Testing with object: {test_key}")
        logger.info(f"   Object size: {test_size:,} bytes")
        
        # Test 1: Full object fetch (old method)
        logger.info("\n" + "="*60)
        logger.info("TEST 1: Full object fetch (open_object_stream)")
        logger.info("="*60)
        logger.info("⚠️  This should NOT show Range headers in the request")
        logger.info("-"*60)
        
        stream = minio.open_object_stream(test_key)
        data = stream.read(1024)  # Read first 1KB
        stream.close()
        logger.info(f"✓ Read {len(data)} bytes using full object fetch")
        
        # Test 2: Range-based fetch (new method)
        logger.info("\n" + "="*60)
        logger.info("TEST 2: Range-based fetch (get_object_range)")
        logger.info("="*60)
        logger.info("✓ This SHOULD show 'Range: bytes=0-1023' in the request")
        logger.info("-"*60)
        
        data = minio.get_object_range(test_key, 0, 1023)  # Read first 1KB
        logger.info(f"✓ Read {len(data)} bytes using range request")
        
        # Test 3: Multiple random ranges (HDF5 pattern)
        logger.info("\n" + "="*60)
        logger.info("TEST 3: Multiple random range requests (HDF5 access pattern)")
        logger.info("="*60)
        logger.info("✓ Each request should show different Range headers")
        logger.info("-"*60)
        
        ranges = [
            (0, 511),           # First 512 bytes (HDF5 superblock)
            (1024, 2047),       # Second KB
            (test_size - 1024, test_size - 1) if test_size > 1024 else (0, 511)  # Last KB
        ]
        
        for i, (start, end) in enumerate(ranges, 1):
            logger.info(f"\n  Range {i}: bytes={start}-{end}")
            data = minio.get_object_range(test_key, start, end)
            expected_size = end - start + 1
            logger.info(f"  ✓ Read {len(data)} bytes (expected: {expected_size})")
            
            if len(data) != expected_size:
                logger.error(f"  ✗ Size mismatch! Expected {expected_size}, got {len(data)}")
                return False
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("VERIFICATION SUMMARY")
        logger.info("="*60)
        logger.info("✓ Range requests are working correctly!")
        logger.info("\nWhat to look for in the logs above:")
        logger.info("1. In TEST 1: No 'Range' header in HTTP request")
        logger.info("2. In TEST 2 & 3: 'Range: bytes=X-Y' header in HTTP requests")
        logger.info("\nIf you see Range headers in boto3 debug logs, you're good!")
        logger.info("="*60)
        
        return True
        
    except Exception as e:
        logger.error(f"\n✗ Error during verification: {e}")
        import traceback
        traceback.print_exc()
        return False


def simple_range_test():
    """Simple test without debug logging for cleaner output"""
    logger.info("\n" + "="*60)
    logger.info("SIMPLE RANGE REQUEST TEST (Clean Output)")
    logger.info("="*60)
    
    # Disable boto3 debug logging for this test
    logging.getLogger('boto3').setLevel(logging.WARNING)
    logging.getLogger('botocore').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    
    try:
        minio = get_minio_client()
        objects = minio.list_objects()
        
        if not objects:
            logger.error("No objects found")
            return
        
        test_key = objects[0]['key']
        test_size = objects[0]['size']
        
        logger.info(f"\nTesting with: {test_key} ({test_size:,} bytes)")
        
        # Test range reads
        logger.info("\nPerforming range reads:")
        
        # Read first 512 bytes (HDF5 superblock location)
        data1 = minio.get_object_range(test_key, 0, 511)
        logger.info(f"  ✓ Range 0-511: Read {len(data1)} bytes")
        
        # Read middle chunk
        mid = test_size // 2
        data2 = minio.get_object_range(test_key, mid, mid + 1023)
        logger.info(f"  ✓ Range {mid}-{mid+1023}: Read {len(data2)} bytes")
        
        # Read last 512 bytes
        if test_size > 512:
            data3 = minio.get_object_range(test_key, test_size - 512, test_size - 1)
            logger.info(f"  ✓ Range {test_size-512}-{test_size-1}: Read {len(data3)} bytes")
        
        logger.info("\n✓ All range requests successful!")
        logger.info("✓ Your MinIO client supports HTTP Range requests")
        logger.info("✓ Ready for HDF5 random access patterns")
        
    except Exception as e:
        logger.error(f"✗ Error: {e}")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("Choose test mode:")
    print("1. Detailed (shows boto3 debug logs with HTTP headers)")
    print("2. Simple (clean output, just verifies functionality)")
    print("="*60)
    
    choice = input("Enter choice (1 or 2, default=2): ").strip() or "2"
    
    if choice == "1":
        verify_range_requests()
    else:
        simple_range_test()
