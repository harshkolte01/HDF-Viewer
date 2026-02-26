"""
H5API - HDF5 File Browser Backend
==================================
A lightweight Flask microservice that connects to a MinIO/S3-compatible
object store and exposes:

  GET /              → HTML file-browser UI (served from templates/index.html)
  GET /api/browse    → JSON API: list folders & HDF5 files at a given prefix
  GET /health        → Liveness probe

The HTML template is fully client-side (vanilla JS). It fetches data from
/api/browse and renders the UI dynamically — no server-side template rendering
is needed for the UI to work.

Configuration is loaded from a .env file in the same directory as this script.

Dependencies:
  flask, flask-cors, python-dotenv, boto3
"""

import os
import logging
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

# Load .env from the same directory as this script, not from CWD.
# This ensures the server works regardless of where it is launched from.
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------

app = Flask(__name__)

# Allow cross-origin requests to all /api/* endpoints.
# This lets the HTML UI call the API even when served from a different port
# (e.g. python -m http.server 3000 in the templates/ folder).
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ---------------------------------------------------------------------------
# MinIO / S3 client  (lazy singleton)
# ---------------------------------------------------------------------------

_minio = None  # Module-level singleton; created on first use.


def get_minio():
    """
    Return the boto3 S3 client, creating it on first call.

    The client is initialised lazily so that startup does not fail when MinIO
    is temporarily unreachable.  Any connection error will surface on the first
    real API request instead.

    Reads credentials from environment variables (populated from .env):
      S3_ENDPOINT   - Full URL of the MinIO/S3 endpoint, e.g. http://host:9200
      S3_ACCESS_KEY - MinIO access key
      S3_SECRET_KEY - MinIO secret key
      S3_REGION     - AWS/MinIO region (default: us-east-1)

    Returns:
        botocore.client.S3 — configured boto3 S3 client
    """
    global _minio
    if _minio is None:
        import boto3
        from botocore.client import Config

        logger.info("Initialising MinIO/S3 client (endpoint=%s)", os.getenv('S3_ENDPOINT'))
        _minio = boto3.client(
            's3',
            endpoint_url=os.getenv('S3_ENDPOINT'),
            aws_access_key_id=os.getenv('S3_ACCESS_KEY'),
            aws_secret_access_key=os.getenv('S3_SECRET_KEY'),
            region_name=os.getenv('S3_REGION', 'us-east-1'),
            # Use Signature V4 — required by MinIO
            config=Config(signature_version='s3v4')
        )

    return _minio


# Read bucket name once at module load time.
BUCKET = os.getenv('S3_BUCKET', 'hdf5files')

# Extensions that are shown in the file browser.
HDF5_EXTENSIONS = ('.h5', '.hdf5', '.hdf')

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def list_prefix(prefix: str):
    """
    List the immediate children (virtual folders + HDF5 files) at `prefix`
    inside the configured MinIO bucket.

    Uses S3's ``list_objects_v2`` with ``Delimiter='/'`` so only one level of
    the virtual directory tree is returned per call — identical to how a real
    filesystem directory listing works.

    MinIO/S3 returns two kinds of results:
      - ``CommonPrefixes`` → virtual sub-folders (keys grouped by the next '/')
      - ``Contents``       → actual objects (files) at this level

    Only files whose names end with one of the HDF5_EXTENSIONS are included.
    All other objects (README, JSON, CSV, …) are silently skipped.

    Args:
        prefix (str): Virtual folder path within the bucket, e.g.
                      ``"experiments/run1"``.  Leading/trailing slashes are
                      normalised internally.

    Returns:
        tuple[list[dict], list[dict]]:
            folders — sorted list of folder dicts:
                { key: str, name: str, type: "folder" }
            files   — sorted list of file dicts:
                { key: str, name: str, type: "file", size: int,
                  last_modified: str (ISO 8601) }
    """
    s3 = get_minio()

    # Normalise prefix: strip surrounding slashes, then re-append a trailing
    # slash only for non-root prefixes (S3 API requirement).
    prefix = prefix.strip('/')
    if prefix:
        prefix = prefix + '/'

    logger.info("Listing prefix='%s' in bucket='%s'", prefix or '(root)', BUCKET)

    paginator = s3.get_paginator('list_objects_v2')
    folders = []
    files = []

    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix, Delimiter='/'):

        # CommonPrefixes → virtual sub-folders (one level deeper than prefix)
        for cp in page.get('CommonPrefixes') or []:
            folder_key = cp['Prefix']                          # e.g. "a/b/sub/"
            folder_name = folder_key.rstrip('/').split('/')[-1]  # e.g. "sub"
            folders.append({
                'key':  folder_key,
                'name': folder_name,
                'type': 'folder',
            })

        # Contents → actual objects at this prefix level
        for obj in page.get('Contents') or []:
            key = obj['Key']

            # Skip the "directory placeholder" object that some tools create
            # (a zero-byte object whose key equals the prefix itself).
            if key == prefix or key.endswith('/'):
                continue

            name = key.split('/')[-1]  # filename only

            # Filter: show only HDF5 files
            if not name.lower().endswith(HDF5_EXTENSIONS):
                continue

            files.append({
                'key':           key,
                'name':          name,
                'type':          'file',
                'size':          obj['Size'],                        # bytes
                'last_modified': obj['LastModified'].isoformat(),    # ISO 8601
            })

    # Sort both lists alphabetically (case-insensitive) for consistent UI order
    folders.sort(key=lambda x: x['name'].lower())
    files.sort(key=lambda x: x['name'].lower())

    logger.info("Found %d folder(s) and %d file(s) at prefix='%s'",
                len(folders), len(files), prefix or '(root)')

    return folders, files


def make_breadcrumbs(prefix: str) -> list:
    """
    Build a navigation breadcrumb trail from a prefix string.

    Example:
        Input:  "experiments/run1/trial3"
        Output: [
            { "name": "Root",        "prefix": "" },
            { "name": "experiments", "prefix": "experiments" },
            { "name": "run1",        "prefix": "experiments/run1" },
            { "name": "trial3",      "prefix": "experiments/run1/trial3" },
        ]

    The ``prefix`` field in each breadcrumb is ready to be passed directly as
    the ``?prefix=`` query parameter to ``/api/browse``.

    Args:
        prefix (str): Current virtual folder path (no leading/trailing slash).

    Returns:
        list[dict]: Ordered breadcrumb entries from root to current prefix.
    """
    prefix = prefix.strip('/')
    breadcrumbs = [{'name': 'Root', 'prefix': ''}]

    if not prefix:
        return breadcrumbs

    parts = prefix.split('/')
    running = ''
    for part in parts:
        running = (running + '/' + part).lstrip('/')
        breadcrumbs.append({'name': part, 'prefix': running})

    return breadcrumbs


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    """
    Serve the HDF5 file browser HTML page.

    The page is a fully client-side single-page application stored in
    templates/index.html.  It fetches data from /api/browse via JavaScript
    and renders the folder/file UI dynamically — Jinja2 template variables
    are NOT used by the HTML page; Flask simply serves the static HTML file.

    Method:  GET
    URL:     /
    Params:  none (navigation is handled client-side via JS + History API)
    Returns: text/html  — the file browser UI
    """
    # Pass minimal context; the template ignores it (client-side rendering).
    return render_template('index.html')


@app.route('/api/browse')
def api_browse():
    """
    JSON API — list the contents of a virtual folder in the MinIO bucket.

    Returns all immediate sub-folders and HDF5 files at the given prefix,
    along with a breadcrumb trail for navigation.

    Method:  GET
    URL:     /api/browse
    CORS:    Allowed from all origins (configured at app level)

    Query Parameters:
        prefix (str, optional):
            Virtual folder path within the bucket, e.g. "experiments/run1".
            Defaults to "" (root of the bucket).
            Do NOT include leading or trailing slashes.

    Success Response — 200 OK:
        {
            "success":     true,
            "prefix":      "experiments/run1",
            "total":       5,
            "breadcrumbs": [
                { "name": "Root",        "prefix": "" },
                { "name": "experiments", "prefix": "experiments" },
                { "name": "run1",        "prefix": "experiments/run1" }
            ],
            "folders": [
                { "key": "experiments/run1/sub/", "name": "sub", "type": "folder" }
            ],
            "files": [
                {
                    "key":           "experiments/run1/data.h5",
                    "name":          "data.h5",
                    "type":          "file",
                    "size":          10485760,
                    "last_modified": "2026-02-25T06:32:10+00:00"
                }
            ]
        }

    Error Response — 500 Internal Server Error:
        {
            "success": false,
            "error":   "<error message>"
        }
    """
    prefix = request.args.get('prefix', '').strip('/')

    try:
        folders, files = list_prefix(prefix)
        breadcrumbs = make_breadcrumbs(prefix)

        return jsonify({
            'success':     True,
            'prefix':      prefix,
            'total':       len(folders) + len(files),
            'breadcrumbs': breadcrumbs,
            'folders':     folders,
            'files':       files,
            'bucket':      BUCKET,       # exposed so the UI can display it
        })

    except Exception as exc:
        logger.exception("Error in /api/browse (prefix='%s')", prefix)
        return jsonify({'success': False, 'error': str(exc)}), 500


@app.route('/health')
def health():
    """
    Liveness probe — confirms the Flask process is running.

    Does NOT check MinIO connectivity.  Use /api/browse to validate the
    full data path.

    Method:  GET
    URL:     /health
    Returns: 200 OK  { "status": "ok", "service": "H5API" }
    """
    return jsonify({'status': 'ok', 'service': 'H5API'})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    host  = os.getenv('HOST', '0.0.0.0')
    port  = int(os.getenv('PORT', 5100))
    debug = os.getenv('DEBUG', 'false').lower() == 'true'

    logger.info("H5API starting → http://%s:%d  (debug=%s, bucket=%s)",
                host, port, debug, BUCKET)
    app.run(host=host, port=port, debug=debug)
