"""
HDF Viewer Backend - Main Application
"""
import os
import logging
from datetime import datetime
from flask import Flask, jsonify
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

# Initialize Flask app
app = Flask(__name__)
app.url_map.strict_slashes = False  # Prevent redirects that break CORS

# Configure CORS - Allow all origins for development
CORS(app, 
     resources={r"/*": {"origins": "*"}},
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])

logger.info("CORS configured to allow all origins")


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
