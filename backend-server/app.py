from flask import Flask, render_template, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

# load environment variables
load_dotenv()

API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
PORT = int(os.getenv('FLASK_PORT', 8000))

app = Flask(__name__, static_folder='static', template_folder='templates')
cors = CORS(app, origins=["*"], supports_credentials=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    app.run(debug=True, host='0.0.0.0', port=PORT)