from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)  # Allow frontend (e.g., Live Server) to call API

# Configure PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:syed@localhost/nauticalflow'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.urandom(32)  # For JWT signing
db = SQLAlchemy(app)

# User model
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)  # Store as string
    role = db.Column(db.String(20), nullable=False)  # e.g., 'admin', 'user'

# Create database tables (run once)
with app.app_context():
    db.create_all()
    # Seed demo users (run once, comment out after)
    if not User.query.first():
        # Store password hashes as strings
        hashed_admin = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        hashed_user = bcrypt.hashpw('user123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        db.session.add(User(username='admin', password=hashed_admin, role='admin'))
        db.session.add(User(username='user', password=hashed_user, role='user'))
        db.session.commit()

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        user = User.query.filter_by(username=username).first()
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            # Generate JWT
            token = jwt.encode({
                'username': user.username,
                'role': user.role,
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            return jsonify({'token': token, 'role': user.role}), 200
        else:
            return jsonify({'error': 'Invalid username or password'}), 401
            
    except Exception as e:
        print(f"Login error: {str(e)}")  # Debug logging
        return jsonify({'error': 'Internal server error'}), 500

# Add a simple test route
@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({'message': 'API is working'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)