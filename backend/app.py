from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
from functools import wraps

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:syed@localhost/nauticalflow'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.urandom(32)
db = SQLAlchemy(app)


# --- Database Models ---
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

class Port(db.Model):
    __tablename__ = 'ports'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)

class Vessel(db.Model):
    __tablename__ = 'vessels'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    max_speed = db.Column(db.Float, nullable=False)
    fuel_consumption = db.Column(db.Float, nullable=False)


# --- Database Initialization ---
with app.app_context():
    db.create_all()
    if not User.query.filter_by(username='admin').first():
        hashed_pw = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin_user = User(display_name='Admin User', username='admin', password=hashed_pw)
        db.session.add(admin_user)
        db.session.commit()


# --- Authentication Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.filter_by(username=data['username']).first()
            if not current_user:
                 return jsonify({'message': 'User not found!'}), 401
        except JWTError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': 'An error occurred', 'error': str(e)}), 500

        return f(current_user, *args, **kwargs)
    return decorated


# --- User Management Endpoints ---

@app.route('/api/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        display_name = data.get('displayName')
        username = data.get('username')
        password = data.get('password')

        if not all([display_name, username, password]):
            return jsonify({'error': 'All fields are required'}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        new_user = User(
            display_name=display_name,
            username=username,
            password=hashed_password
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': f'User {username} created successfully'}), 201

    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    
    if user and bcrypt.checkpw(data.get('password').encode('utf-8'), user.password.encode('utf-8')):
        token = jwt.encode({
            'username': user.username,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        return jsonify({'token': token, 'displayName': user.display_name}), 200
    
    return jsonify({'error': 'Invalid username or password'}), 401


# --- Port Endpoints ---

@app.route('/api/ports', methods=['GET'])
@token_required
def get_ports(current_user):
    ports = Port.query.order_by(Port.name).all()
    return jsonify([{
        'id': port.id, 'name': port.name, 'country': port.country, 
        'latitude': port.latitude, 'longitude': port.longitude
    } for port in ports])

@app.route('/api/ports', methods=['POST'])
@token_required
def add_port(current_user):
    data = request.get_json()
    new_port = Port(
        name=data['name'], country=data['country'],
        latitude=data['latitude'], longitude=data['longitude']
    )
    db.session.add(new_port)
    db.session.commit()
    return jsonify({'message': 'Port added successfully', 'id': new_port.id}), 201

@app.route('/api/ports/<int:port_id>', methods=['DELETE'])
@token_required
def delete_port(current_user, port_id):
    port = Port.query.get_or_404(port_id)
    db.session.delete(port)
    db.session.commit()
    return jsonify({'message': 'Port deleted successfully'})


# --- Vessel Endpoints ---

@app.route('/api/vessels', methods=['GET'])
@token_required
def get_vessels(current_user):
    vessels = Vessel.query.order_by(Vessel.name).all()
    return jsonify([{
        'id': v.id, 'name': v.name, 'type': v.type, 
        'maxSpeed': v.max_speed, 'fuelConsumption': v.fuel_consumption
    } for v in vessels])

@app.route('/api/vessels', methods=['POST'])
@token_required
def add_vessel(current_user):
    data = request.get_json()
    new_vessel = Vessel(
        name=data['name'], type=data['type'],
        max_speed=data['maxSpeed'], fuel_consumption=data['fuelConsumption']
    )
    db.session.add(new_vessel)
    db.session.commit()
    return jsonify({'message': 'Vessel added successfully', 'id': new_vessel.id}), 201

@app.route('/api/vessels/<int:vessel_id>', methods=['DELETE'])
@token_required
def delete_vessel(current_user, vessel_id):
    vessel = Vessel.query.get_or_404(vessel_id)
    db.session.delete(vessel)
    db.session.commit()
    return jsonify({'message': 'Vessel deleted successfully'})

# --- Profile Management Endpoints ---

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    """Returns the current logged-in user's profile information."""
    return jsonify({
        'displayName': current_user.display_name,
        'username': current_user.username
    })

@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    """Updates the current user's display name and username."""
    data = request.get_json()
    new_display_name = data.get('displayName')
    new_username = data.get('username')

    # Basic validation
    if not new_display_name or not new_username:
        return jsonify({'error': 'Display name and username are required'}), 400

    # Check if the new username is already taken by another user
    if new_username != current_user.username and User.query.filter_by(username=new_username).first():
        return jsonify({'error': 'Username already exists'}), 409
    
    current_user.display_name = new_display_name
    current_user.username = new_username
    db.session.commit()

    return jsonify({'message': 'Profile updated successfully'})

@app.route('/api/profile/password', methods=['PUT'])
@token_required
def change_password(current_user):
    """Changes the current user's password."""
    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return jsonify({'error': 'All password fields are required'}), 400
    
    # Verify the current password
    if not bcrypt.checkpw(current_password.encode('utf-8'), current_user.password.encode('utf-8')):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Hash and save the new password
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    current_user.password = hashed_password
    db.session.commit()

    return jsonify({'message': 'Password changed successfully'})


@app.route('/api/profile/stats', methods=['GET'])
@token_required
def get_profile_stats(current_user):
    """Returns mock statistics for the profile page."""
    # In a real app, you would calculate these values from the database
    stats = {
        'routesPlanned': Port.query.count() * 5, # Example calculation
        'routesOptimized': Vessel.query.count() * 2, # Example calculation
        'vesselsManaged': Vessel.query.count(),
        'daysActive': (datetime.utcnow().date() - datetime(2025, 7, 15).date()).days
    }
    return jsonify(stats)

if __name__ == '__main__':
    app.run(debug=True, port=5000)