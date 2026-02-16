"""
HDF Viewer Backend - Main Application
"""
import os
import logging
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure structured logging
logging.basicConfig(
    level=logging.DEBUG if os.getenv('DEBUG', 'False').lower() == 'true' else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)
APP_STARTED_AT = datetime.utcnow()
PUBLIC_URL_ENV_KEYS = (
    'BACKEND_PUBLIC_URL',
    'PUBLIC_BASE_URL',
    'API_BASE_URL',
    'BACKEND_URL'
)

ENDPOINT_CATALOG = [
    {
        'method': 'GET',
        'path': '/health',
        'summary': 'Health check endpoint.',
        'params': [],
        'example': "curl http://localhost:5000/health"
    },
    {
        'method': 'GET',
        'path': '/files/',
        'summary': 'List all files from MinIO/S3 bucket.',
        'params': [],
        'example': "curl http://localhost:5000/files/"
    },
    {
        'method': 'POST',
        'path': '/files/refresh',
        'summary': 'Clear file-list cache manually.',
        'params': [],
        'example': "curl -X POST http://localhost:5000/files/refresh"
    },
    {
        'method': 'GET',
        'path': '/files/<key>/children',
        'summary': 'List immediate HDF5 children for a given path.',
        'params': [
            {
                'name': 'path',
                'required': False,
                'type': 'string',
                'default': '/',
                'description': 'HDF5 internal path.'
            }
        ],
        'example': "curl \"http://localhost:5000/files/sample.h5/children?path=/\""
    },
    {
        'method': 'GET',
        'path': '/files/<key>/meta',
        'summary': 'Read metadata for a specific dataset/group path.',
        'params': [
            {
                'name': 'path',
                'required': True,
                'type': 'string',
                'default': None,
                'description': 'HDF5 internal path.'
            }
        ],
        'example': "curl \"http://localhost:5000/files/sample.h5/meta?path=/dataset\""
    },
    {
        'method': 'GET',
        'path': '/files/<key>/preview',
        'summary': 'Fast preview payload for table/plot/profile rendering.',
        'params': [
            {
                'name': 'path',
                'required': True,
                'type': 'string',
                'default': None,
                'description': 'HDF5 internal dataset path.'
            },
            {
                'name': 'mode',
                'required': False,
                'type': 'enum',
                'default': 'auto',
                'description': 'auto | line | table | heatmap'
            },
            {
                'name': 'detail',
                'required': False,
                'type': 'enum',
                'default': 'full',
                'description': 'fast | full'
            },
            {
                'name': 'include_stats',
                'required': False,
                'type': 'boolean',
                'default': True,
                'description': 'Include preview statistics.'
            },
            {
                'name': 'display_dims',
                'required': False,
                'type': 'string',
                'default': 'last two dims',
                'description': 'Comma separated dims, ex: 1,2'
            },
            {
                'name': 'fixed_indices',
                'required': False,
                'type': 'string',
                'default': 'middle indices',
                'description': 'dim=index pairs, ex: 0=5,3=10'
            },
            {
                'name': 'max_size',
                'required': False,
                'type': 'int',
                'default': 512,
                'description': 'Heatmap max axis size.'
            },
            {
                'name': 'etag',
                'required': False,
                'type': 'string',
                'default': 'ttl',
                'description': 'Optional cache-version hint.'
            }
        ],
        'example': (
            "curl "
            "\"http://localhost:5000/files/sample.h5/preview?path=/dataset&mode=heatmap&max_size=256\""
        )
    },
    {
        'method': 'GET',
        'path': '/files/<key>/data',
        'summary': 'Bounded matrix/heatmap/line data for viewer rendering.',
        'params': [
            {
                'name': 'path',
                'required': True,
                'type': 'string',
                'default': None,
                'description': 'HDF5 internal dataset path.'
            },
            {
                'name': 'mode',
                'required': True,
                'type': 'enum',
                'default': None,
                'description': 'matrix | heatmap | line'
            },
            {
                'name': 'display_dims',
                'required': False,
                'type': 'string',
                'default': 'last two dims',
                'description': 'Comma separated dims for 2D view.'
            },
            {
                'name': 'fixed_indices',
                'required': False,
                'type': 'string',
                'default': 'middle indices',
                'description': 'dim=index pairs for non-display dims.'
            },
            {
                'name': 'etag',
                'required': False,
                'type': 'string',
                'default': 'ttl',
                'description': 'Optional cache-version hint.'
            },
            {
                'name': 'matrix params',
                'required': False,
                'type': 'group',
                'default': None,
                'description': (
                    "row_offset,row_limit,col_offset,col_limit,row_step,col_step"
                )
            },
            {
                'name': 'heatmap params',
                'required': False,
                'type': 'group',
                'default': None,
                'description': "max_size,include_stats"
            },
            {
                'name': 'line params',
                'required': False,
                'type': 'group',
                'default': None,
                'description': (
                    "line_dim,line_index,line_offset,line_limit,quality,max_points"
                )
            }
        ],
        'example': (
            "curl "
            "\"http://localhost:5000/files/sample.h5/data?path=/dataset&mode=matrix&row_limit=50&col_limit=50\""
        )
    }
]


def _normalize_base_url(value):
    """Normalize base URL value into http(s)://host[:port] format."""
    if value is None:
        return None

    normalized = str(value).strip().rstrip('/')
    if not normalized:
        return None

    if not normalized.startswith(('http://', 'https://')):
        normalized = f"http://{normalized}"

    return normalized


def _resolve_public_base_url(req):
    """Resolve base URL from environment first, then request context."""
    for key in PUBLIC_URL_ENV_KEYS:
        env_value = _normalize_base_url(os.getenv(key))
        if env_value:
            return env_value, f"env:{key}"

    request_root = _normalize_base_url(getattr(req, 'url_root', None))
    if request_root:
        return request_root, 'request.url_root'

    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    return f"http://{host}:{port}", 'fallback:HOST_PORT'


def _build_catalog_for_base_url(base_url):
    """Return endpoint catalog with full URL and base-aware curl examples."""
    catalog = []
    for entry in ENDPOINT_CATALOG:
        item = dict(entry)
        item['params'] = [dict(param) for param in entry.get('params', [])]
        item['url'] = f"{base_url}{entry.get('path', '')}"

        example = entry.get('example')
        if isinstance(example, str):
            item['example'] = example.replace('http://localhost:5000', base_url)

        catalog.append(item)

    return catalog

# Initialize Flask app
app = Flask(__name__)
app.url_map.strict_slashes = False  # Prevent redirects that break CORS

# Configure CORS - Allow all origins for development
CORS(app, 
     resources={r"/*": {"origins": "*"}},
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])

logger.info("CORS configured to allow all origins")


@app.route('/', methods=['GET'])
def index():
    """Backend landing page with endpoint catalog and status UI."""
    base_url, base_url_source = _resolve_public_base_url(request)
    endpoints = _build_catalog_for_base_url(base_url)

    runtime = {
        'host': os.getenv('HOST', '0.0.0.0'),
        'port': int(os.getenv('PORT', 5000)),
        'debug': os.getenv('DEBUG', 'False').lower() == 'true',
        'started_at': APP_STARTED_AT.isoformat() + 'Z',
        'base_url': base_url,
        'base_url_source': base_url_source
    }

    return render_template(
        'index.html',
        service_name='HDF Viewer Backend',
        runtime=runtime,
        endpoints=endpoints
    )


# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    logger.info("Health check requested")
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'HDF Viewer Backend'
    }), 200


# Register blueprints
from src.routes.files import files_bp
from src.routes.hdf5 import hdf5_bp

app.register_blueprint(files_bp, url_prefix='/files')
app.register_blueprint(hdf5_bp, url_prefix='/files')

logger.info("Routes registered successfully")


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting server on {host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)
