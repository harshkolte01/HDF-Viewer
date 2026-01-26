"""
Quick test script to verify MinIO connection and basic operations
"""
import sys
from dotenv import load_dotenv
from src.storage.minio_client import get_minio_client

load_dotenv()

def test_connection():
    """Test MinIO connection and basic operations"""
    print("Testing MinIO connection...")
    print("-" * 60)
    
    try:
        # Initialize client
        print("✓ Initializing MinIO client...")
        minio = get_minio_client()
        print(f"  Endpoint: {minio.endpoint}")
        print(f"  Bucket: {minio.bucket}")
        
        # Test list objects
        print("\n✓ Testing list_objects()...")
        objects = minio.list_objects()
        print(f"  Found {len(objects)} objects")
        
        if objects:
            print("\n  First 3 objects:")
            for obj in objects[:3]:
                print(f"    - {obj['key']} ({obj['size']} bytes)")
            
            # Test get metadata
            print(f"\n✓ Testing get_object_metadata() on '{objects[0]['key']}'...")
            metadata = minio.get_object_metadata(objects[0]['key'])
            print(f"  Size: {metadata['size']} bytes")
            print(f"  Content-Type: {metadata['content_type']}")
            print(f"  Last Modified: {metadata['last_modified']}")
            
            # Test open stream
            print(f"\n✓ Testing open_object_stream() on '{objects[0]['key']}'...")
            stream = minio.open_object_stream(objects[0]['key'])
            data = stream.read(100)  # Read first 100 bytes
            stream.close()
            print(f"  Successfully read {len(data)} bytes")
        else:
            print("\n  No objects found in bucket (this is okay if bucket is empty)")
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nPlease check your .env configuration:")
        print("  - S3_ENDPOINT")
        print("  - S3_ACCESS_KEY")
        print("  - S3_SECRET_KEY")
        print("  - S3_BUCKET")
        return False

if __name__ == '__main__':
    success = test_connection()
    sys.exit(0 if success else 1)
