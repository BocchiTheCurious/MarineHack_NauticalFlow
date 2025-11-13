from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
from functools import wraps
import re
from decimal import Decimal
from optimization_solver import run_route_optimization
import requests
import time

from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- Database Configuration --- t
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'mysql+pymysql://u757241520_syed:Ccrg12345*@srv623.hstgr.io/u757241520_nauticalflow?charset=utf8mb4')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', os.urandom(32).hex())
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Add connection pool settings to prevent "MySQL server has gone away" errors
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_recycle': 280,  # Recycle connections after 280 seconds (less than MySQL's 300s timeout)
    'pool_pre_ping': True,  # Test connections before using them
    'pool_timeout': 30,
    'max_overflow': 5
}

db = SQLAlchemy(app)

# --- Database Models ---
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    optimization_results = db.relationship('OptimizationResult', backref='user', lazy=True, cascade="all, delete-orphan")

class Port(db.Model):
    __tablename__ = 'ports'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    unlocode = db.Column(db.String(5), unique=True, nullable=True)
    country = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    port_congestion_index = db.Column(db.Numeric(5, 2), nullable=False, default=0.0)
    congestion_last_updated = db.Column(db.DateTime, nullable=True)
    harbor_size = db.Column(db.String(1), nullable=True)
    harbor_type = db.Column(db.String(2), nullable=True)
    max_vessel_length = db.Column(db.Numeric(8, 2), nullable=True)
    max_vessel_beam = db.Column(db.Numeric(8, 2), nullable=True)
    max_vessel_draft = db.Column(db.Numeric(8, 2), nullable=True)
    first_port_of_entry = db.Column(db.Boolean, nullable=True, default=False)
    channel_depth = db.Column(db.Numeric(8, 2), nullable=True)
    anchorage_depth = db.Column(db.Numeric(8, 2), nullable=True)
    cargo_pier_depth = db.Column(db.Numeric(8, 2), nullable=True)
    shelter_afforded = db.Column(db.String(1), nullable=True)
    good_holding_ground = db.Column(db.Boolean, nullable=True)
    turning_area = db.Column(db.Boolean, nullable=True)
    facilities = db.Column(db.JSON, nullable=True)
    entrance_restrictions = db.Column(db.JSON, nullable=True)
    quarantine = db.Column(db.JSON, nullable=True)

class FuelType(db.Model):
    __tablename__ = 'fuel_types'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    co2_factor = db.Column(db.Numeric(10, 4), nullable=False)

class CruiseShip(db.Model):
    __tablename__ = 'cruise_ships'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # CORE IDENTIFICATION
    name = db.Column(db.String(100), nullable=False)
    operator = db.Column(db.String(100))  # Renamed from 'company'
    
    # CRITICAL SPECS (for fuel calculation)
    gross_tonnage = db.Column(db.Integer, nullable=False)
    propulsion_power = db.Column(db.Float, nullable=False)  # MW - REQUIRED
    cruising_speed = db.Column(db.Float, nullable=False)    # knots - REQUIRED
    max_speed = db.Column(db.Float, nullable=False)         # knots - REQUIRED
    length = db.Column(db.Float, nullable=False)            # meters - REQUIRED
    beam = db.Column(db.Float, nullable=False)              # meters - REQUIRED
    
    # FUEL TYPE
    fuel_type_id = db.Column(db.Integer, db.ForeignKey('fuel_types.id'), nullable=False)
    
    # ADDITIONAL INFO
    year_built = db.Column(db.Integer, nullable=True)
    passenger_capacity = db.Column(db.Integer, nullable=True)
    crew = db.Column(db.Integer, nullable=True)  # NEW - CruiseMapper has this
    engine_type = db.Column(db.String(100), nullable=True)
    builder = db.Column(db.String(100), nullable=True)  # NEW - CruiseMapper has this
    
    fuel_consumption_curve = db.Column(db.JSON, nullable=True)
    
    # REMOVED: fuel_consumption_curve (will be calculated on-the-fly)
    
    fuel_type = db.relationship('FuelType', backref='cruise_ships')

class WeatherCache(db.Model):
    __tablename__ = 'weather_cache'
    id = db.Column(db.Integer, primary_key=True)
    port_id = db.Column(db.Integer, db.ForeignKey('ports.id', ondelete='CASCADE'), unique=True)
    latitude = db.Column(db.Numeric(10, 6), nullable=False)
    longitude = db.Column(db.Numeric(10, 6), nullable=False)
    weather_data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    port = db.relationship('Port', backref='weather_cache')

class OptimizationResult(db.Model):
    __tablename__ = 'optimization_results'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    route = db.Column(db.String(500), nullable=False)
    vessel = db.Column(db.String(100), nullable=False)
    fuelSaved = db.Column(db.String(50), nullable=False)
    co2Reduced = db.Column(db.String(50), nullable=False)
    timeSaved = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
class PortReview(db.Model):
    __tablename__ = 'port_reviews'
    id = db.Column(db.Integer, primary_key=True)
    port_id = db.Column(db.Integer, db.ForeignKey('ports.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    port = db.relationship('Port', backref='reviews')
    user = db.relationship('User', backref='port_reviews')

class Feedback(db.Model):
    __tablename__ = 'feedback'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    question_1 = db.Column(db.String(20), nullable=False)  # positive/negative
    question_2 = db.Column(db.String(20), nullable=False)
    question_3 = db.Column(db.String(20), nullable=False)
    question_4 = db.Column(db.String(20), nullable=False)
    question_5 = db.Column(db.String(20), nullable=False)
    question_6 = db.Column(db.String(20), nullable=False)
    question_7 = db.Column(db.String(20), nullable=False)
    question_8 = db.Column(db.String(20), nullable=False)
    question_9 = db.Column(db.String(20), nullable=False)
    question_10 = db.Column(db.String(20), nullable=False)
    additional_comments = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='feedbacks')

# --- Database Initialization ---
with app.app_context():
    db.create_all()
    if not User.query.filter_by(username='admin').first():
        hashed_pw = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin_user = User(display_name='Admin User', username='admin', password=hashed_pw)
        db.session.add(admin_user)
        db.session.commit()

# --- Scheduled Weather Update ---
def scheduled_weather_update():
    """Background task to update weather cache daily at 2 AM"""
    with app.app_context():
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting scheduled weather update...")
        
        ports = Port.query.all()
        updated = 0
        failed = 0
        
        for port in ports:
            try:
                weather_params = "temperature_2m,weather_code,wind_speed_10m"
                marine_params = "wave_height,wave_direction,wave_period"
                weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={port.latitude}&longitude={port.longitude}&current={weather_params},weather_code&hourly={weather_params}&timezone=auto&forecast_days=2"
                marine_url = f"https://marine-api.open-meteo.com/v1/marine?latitude={port.latitude}&longitude={port.longitude}&current={marine_params}&hourly={marine_params}&timezone=auto&forecast_days=2"
                
                weather_resp = requests.get(weather_url, timeout=10)
                marine_resp = requests.get(marine_url, timeout=10)
                
                if weather_resp.ok and marine_resp.ok:
                    weather_data = weather_resp.json()
                    marine_data = marine_resp.json()
                    
                    combined_data = {
                        'latitude': weather_data.get('latitude'),
                        'longitude': weather_data.get('longitude'),
                        'timezone': weather_data.get('timezone'),
                        'timezone_abbreviation': weather_data.get('timezone_abbreviation'),
                        'elevation': weather_data.get('elevation'),
                        'current_units': {**weather_data.get('current_units', {}), **marine_data.get('current_units', {})},
                        'hourly_units': {**weather_data.get('hourly_units', {}), **marine_data.get('hourly_units', {})},
                        'current': {**weather_data.get('current', {}), **marine_data.get('current', {})},
                        'hourly': {
                            'time': weather_data.get('hourly', {}).get('time', []),
                            'temperature_2m': weather_data.get('hourly', {}).get('temperature_2m', []),
                            'weather_code': weather_data.get('hourly', {}).get('weather_code', []),
                            'wind_speed_10m': weather_data.get('hourly', {}).get('wind_speed_10m', []),
                            'wave_height': marine_data.get('hourly', {}).get('wave_height', []),
                            'wave_direction': marine_data.get('hourly', {}).get('wave_direction', []),
                            'wave_period': marine_data.get('hourly', {}).get('wave_period', []),
                        }
                    }
                    
                    cache = WeatherCache.query.filter_by(port_id=port.id).first()
                    if cache:
                        cache.weather_data = combined_data
                        cache.last_updated = datetime.utcnow()
                    else:
                        cache = WeatherCache(
                            port_id=port.id,
                            latitude=port.latitude,
                            longitude=port.longitude,
                            weather_data=combined_data,
                            last_updated=datetime.utcnow()
                        )
                        db.session.add(cache)
                    
                    db.session.commit()
                    updated += 1
                else:
                    failed += 1
                
                time.sleep(1)  # Rate limiting
                
            except Exception as e:
                print(f"Error updating {port.name}: {e}")
                failed += 1
        
        print(f"Weather update completed: {updated}/{len(ports)} ports updated, {failed} failed")

# --- Authentication Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
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
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# --- Password Validation Helper ---
def is_strong_password(password):
    if len(password) < 8: return False
    if not re.search("[a-z]", password): return False
    if not re.search("[A-Z]", password): return False
    if not re.search("[0-9]", password): return False
    if not re.search("[!@#$%^&*(),.?\":{}|<>]", password): return False
    return True

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

# --- Port Endpoints (Full CRUD) ---
@app.route('/api/ports', methods=['GET'])
@token_required
def get_ports(current_user):
    ports = Port.query.order_by(Port.name).all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'country': p.country,
        'latitude': f"{p.latitude:.4f}",
        'longitude': f"{p.longitude:.4f}",
        'portCongestionIndex': str(p.port_congestion_index),
        'congestionLastUpdated': p.congestion_last_updated.isoformat() if p.congestion_last_updated else None,
        'harborSize': p.harbor_size,
        'harborType': p.harbor_type,
        'maxVesselLength': float(p.max_vessel_length) if p.max_vessel_length else None,
        'maxVesselBeam': float(p.max_vessel_beam) if p.max_vessel_beam else None,
        'maxVesselDraft': float(p.max_vessel_draft) if p.max_vessel_draft else None,
        'firstPortOfEntry': p.first_port_of_entry,
        'channelDepth': float(p.channel_depth) if p.channel_depth else None,
        'anchorageDepth': float(p.anchorage_depth) if p.anchorage_depth else None,
        'cargoPierDepth': float(p.cargo_pier_depth) if p.cargo_pier_depth else None,
        'shelterAfforded': p.shelter_afforded,
        'goodHoldingGround': p.good_holding_ground,
        'turningArea': p.turning_area,
        'facilities': p.facilities if p.facilities else {},
        'entranceRestrictions': p.entrance_restrictions if p.entrance_restrictions else {},
        'quarantine': p.quarantine if p.quarantine else {}
    } for p in ports])

@app.route('/api/ports', methods=['POST'])
@token_required
def add_port(current_user):
    data = request.get_json()
    new_port = Port(
        name=data['name'],
        country=data['country'],
        latitude=data['latitude'],
        longitude=data['longitude'],
        port_congestion_index=data['portCongestionIndex'],
        congestion_last_updated=datetime.strptime(data['congestionLastUpdated'], '%Y-%m-%d') if data.get('congestionLastUpdated') else None,
        harbor_size=data.get('harborSize'),
        harbor_type=data.get('harborType'),
        max_vessel_length=data.get('maxVesselLength'),
        max_vessel_beam=data.get('maxVesselBeam'),
        max_vessel_draft=data.get('maxVesselDraft'),
        first_port_of_entry=data.get('firstPortOfEntry', False),
        channel_depth=data.get('channelDepth'),
        anchorage_depth=data.get('anchorageDepth'),
        cargo_pier_depth=data.get('cargoPierDepth'),
        shelter_afforded=data.get('shelterAfforded'),
        good_holding_ground=data.get('goodHoldingGround'),
        turning_area=data.get('turningArea'),
        facilities=data.get('facilities', {}),
        entrance_restrictions=data.get('entranceRestrictions', {}),
        quarantine=data.get('quarantine', {})
    )
    db.session.add(new_port)
    db.session.commit()
    return jsonify({'message': 'Port added successfully'}), 201

@app.route('/api/ports/<int:port_id>', methods=['PUT'])
@token_required
def update_port(current_user, port_id):
    port = Port.query.get_or_404(port_id)
    data = request.get_json()
    
    port.name = data['name']
    port.country = data['country']
    port.latitude = data['latitude']
    port.longitude = data['longitude']
    port.port_congestion_index = data['portCongestionIndex']
    port.congestion_last_updated = datetime.strptime(data['congestionLastUpdated'], '%Y-%m-%d') if data.get('congestionLastUpdated') else None
    port.harbor_size = data.get('harborSize')
    port.harbor_type = data.get('harborType')
    port.max_vessel_length = data.get('maxVesselLength')
    port.max_vessel_beam = data.get('maxVesselBeam')
    port.max_vessel_draft = data.get('maxVesselDraft')
    port.first_port_of_entry = data.get('firstPortOfEntry', False)
    port.channel_depth = data.get('channelDepth')
    port.anchorage_depth = data.get('anchorageDepth')
    port.cargo_pier_depth = data.get('cargoPierDepth')
    port.shelter_afforded = data.get('shelterAfforded')
    port.good_holding_ground = data.get('goodHoldingGround')
    port.turning_area = data.get('turningArea')
    port.facilities = data.get('facilities', {})
    port.entrance_restrictions = data.get('entranceRestrictions', {})
    port.quarantine = data.get('quarantine', {})
    
    db.session.commit()
    return jsonify({'message': 'Port updated successfully'})

@app.route('/api/ports/<int:port_id>', methods=['DELETE'])
@token_required
def delete_port(current_user, port_id):
    port = Port.query.get_or_404(port_id)
    db.session.delete(port)
    db.session.commit()
    return jsonify({'message': 'Port deleted successfully'})

# --- Cruise Ship Endpoints (CRUD) ---
@app.route('/api/cruise-ships', methods=['GET'])
@token_required
def get_cruise_ships(current_user):
    ships = CruiseShip.query.all()
    return jsonify([{
        'id': ship.id,
        'name': ship.name,
        'operator': ship.operator,  # Changed from 'company'
        'grossTonnage': ship.gross_tonnage,
        'fuelTypeId': ship.fuel_type_id,
        'fuelTypeName': ship.fuel_type.name if ship.fuel_type else 'Unknown',
        
        # NEW FIELDS
        'propulsionPower': ship.propulsion_power,
        'cruisingSpeed': ship.cruising_speed,
        'maxSpeed': ship.max_speed,
        'length': ship.length,
        'beam': ship.beam,
        'yearBuilt': ship.year_built,
        'passengerCapacity': ship.passenger_capacity,
        'crew': ship.crew,
        'engineType': ship.engine_type,
        'builder': ship.builder,
        
        'fuelConsumptionCurve': ship.fuel_consumption_curve
    } for ship in ships])

@app.route('/api/cruise-ships', methods=['POST'])
@token_required
def add_cruise_ship(current_user):
    try:
        data = request.get_json()
        
        new_ship = CruiseShip(
            name=data['name'],
            operator=data.get('operator'),
            gross_tonnage=data['grossTonnage'],
            fuel_type_id=data['fuelTypeId'],
            
            # NEW REQUIRED FIELDS
            propulsion_power=data['propulsionPower'],
            cruising_speed=data['cruisingSpeed'],
            max_speed=data['maxSpeed'],
            length=data['length'],
            beam=data['beam'],
            
            # NEW OPTIONAL FIELDS
            year_built=data.get('yearBuilt'),
            passenger_capacity=data.get('passengerCapacity'),
            crew=data.get('crew'),
            engine_type=data.get('engineType'),
            builder=data.get('builder'), 
            
            fuel_consumption_curve=data.get('fuelConsumptionCurve') or data.get('fuel_consumption_curve')

        )
        
        db.session.add(new_ship)
        db.session.commit()
        
        return jsonify({'message': 'Cruise ship added successfully', 'id': new_ship.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/cruise-ships/<int:ship_id>', methods=['DELETE'])
@token_required
def delete_cruise_ship(current_user, ship_id):
    ship = CruiseShip.query.get_or_404(ship_id)
    db.session.delete(ship)
    db.session.commit()
    return jsonify({'message': 'Cruise ship deleted successfully'})

@app.route('/api/cruise-ships/<int:ship_id>', methods=['PUT'])
@token_required
def update_cruise_ship(current_user, ship_id):
    try:
        ship = CruiseShip.query.get_or_404(ship_id)
        data = request.get_json()
        
        ship.name = data['name']
        ship.operator = data.get('operator')
        ship.gross_tonnage = data['grossTonnage']
        ship.fuel_type_id = data['fuelTypeId']
        
        # UPDATE NEW FIELDS
        ship.propulsion_power = data['propulsionPower']
        ship.cruising_speed = data['cruisingSpeed']
        ship.max_speed = data['maxSpeed']
        ship.length = data['length']
        ship.beam = data['beam']
        
        ship.year_built = data.get('yearBuilt')
        ship.passenger_capacity = data.get('passengerCapacity')
        ship.crew = data.get('crew')
        ship.engine_type = data.get('engineType')
        ship.builder = data.get('builder')
        
        ship.fuel_consumption_curve = data.get('fuelConsumptionCurve') or data.get('fuel_consumption_curve')
        
        db.session.commit()
        
        return jsonify({'message': 'Cruise ship updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

# --- Fuel Type Endpoints ---
@app.route('/api/fuel-types', methods=['GET'])
@token_required
def get_fuel_types(current_user):
    fuel_types = FuelType.query.order_by(FuelType.name).all()
    return jsonify([{
        'id': ft.id,
        'name': ft.name,
        'co2Factor': str(ft.co2_factor)
    } for ft in fuel_types])

@app.route('/api/fuel-types', methods=['POST'])
@token_required
def add_fuel_type(current_user):
    data = request.get_json()
    if FuelType.query.filter_by(name=data.get('name')).first():
        return jsonify({'error': f"A fuel type with the name '{data.get('name')}' already exists."}), 409
    
    new_fuel_type = FuelType(
        name=data.get('name'),
        co2_factor=data.get('co2Factor')
    )
    db.session.add(new_fuel_type)
    db.session.commit()
    return jsonify({'message': 'Fuel type added successfully'}), 201

@app.route('/api/fuel-types/<int:fuel_type_id>', methods=['PUT'])
@token_required
def update_fuel_type(current_user, fuel_type_id):
    fuel_type = FuelType.query.get_or_404(fuel_type_id)
    data = request.get_json()
    
    existing_fuel = FuelType.query.filter(FuelType.name == data.get('name'), FuelType.id != fuel_type_id).first()
    if existing_fuel:
        return jsonify({'error': f"Another fuel type with the name '{data.get('name')}' already exists."}), 409
    fuel_type.name = data.get('name')
    fuel_type.co2_factor = data.get('co2Factor')
    db.session.commit()
    return jsonify({'message': 'Fuel type updated successfully'})

@app.route('/api/fuel-types/<int:fuel_type_id>', methods=['DELETE'])
@token_required
def delete_fuel_type(current_user, fuel_type_id):
    fuel_type = FuelType.query.get_or_404(fuel_type_id)
    db.session.delete(fuel_type)
    db.session.commit()
    return jsonify({'message': 'Fuel type deleted successfully'})

# --- Profile Management Endpoints ---
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'displayName': current_user.display_name,
        'username': current_user.username
    })

@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    new_display_name = data.get('displayName')
    new_username = data.get('username')
    if not new_display_name or not new_username:
        return jsonify({'error': 'Display name and username are required'}), 400
    if new_username != current_user.username and User.query.filter_by(username=new_username).first():
        return jsonify({'error': 'Username already exists'}), 409
    
    current_user.display_name = new_display_name
    current_user.username = new_username
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully'})

@app.route('/api/profile/password', methods=['PUT'])
@token_required
def change_password(current_user):
    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    if not current_password or not new_password:
        return jsonify({'error': 'All password fields are required'}), 400
    
    if not bcrypt.checkpw(current_password.encode('utf-8'), current_user.password.encode('utf-8')):
        return jsonify({'error': 'Current password is incorrect'}), 403
    
    if not is_strong_password(new_password):
        return jsonify({
            'error': 'New password is not strong enough. It must be at least 8 characters and include uppercase, lowercase, a number, and a special character.'
        }), 400

    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    current_user.password = hashed_password
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'})

@app.route('/api/profile/stats', methods=['GET'])
@token_required
def get_profile_stats(current_user):
    stats = {
        'routesPlanned': Port.query.count() * 5,
        'routesOptimized': OptimizationResult.query.filter_by(user_id=current_user.id).count(),
        'vesselsManaged': CruiseShip.query.count(),
        'daysActive': (datetime.utcnow().date() - datetime(2025, 7, 15).date()).days
    }
    return jsonify(stats)

# --- Route Optimization Endpoint ---
# This is the function we corrected
@app.route('/api/optimize', methods=['POST'])
@token_required
def optimize_route(current_user):
    data = request.get_json()
    
    print(f"DEBUG: Received payload: {data}")

    try:
        coordinates = data.get('coords') 
        port_ids = data.get('portIds', [])
        ship_id = data.get('selectedShipId')
        start_datetime_str = data.get('start_datetime_str')
        port_stay_hours = data.get('port_stay_hours', 24)
        
        # Get weights
        weights = data.get('weights')
        
        if weights:
            print(f"✅ RECEIVED WEIGHTS: fuel={weights.get('fuel')}%, time={weights.get('time')}%, congestion={weights.get('congestion')}%")
        else:
            print(f"⚠️ NO WEIGHTS IN PAYLOAD - using defaults")
            weights = {'fuel': 50, 'time': 50, 'congestion': 50}

        if not all([coordinates, ship_id, start_datetime_str]):
            return jsonify({"error": "Invalid data: Route, shipId, and start time are required."}), 400
        
        ship = CruiseShip.query.get(ship_id)
        if not ship:
            return jsonify({"error": "Selected ship not found."}), 404

        # ✅ NEW: Prepare vessel specifications
        vessel_specs = {
            'gross_tonnage': ship.gross_tonnage,
            'propulsion_power': ship.propulsion_power,
            'cruising_speed': ship.cruising_speed,
            'name': ship.name
        }
        
        print(f"🚢 VESSEL SPECS:")
        print(f"   Name: {vessel_specs['name']}")
        print(f"   Gross Tonnage: {vessel_specs['gross_tonnage']} GT")
        print(f"   Propulsion Power: {vessel_specs['propulsion_power']} MW")

        # Fetch ports data with congestion
        ports_data = []
        if port_ids:
            for port_id in port_ids:
                port = Port.query.get(port_id)
                if port:
                    congestion_percentage = float(port.port_congestion_index)
                    
                    # Tiered conversion formula
                    if congestion_percentage <= 25:
                        congestion_hours = congestion_percentage * 0.04
                    elif congestion_percentage <= 50:
                        congestion_hours = 1 + (congestion_percentage - 25) * 0.08
                    elif congestion_percentage <= 75:
                        congestion_hours = 3 + (congestion_percentage - 50) * 0.16
                    else:
                        congestion_hours = 7 + (congestion_percentage - 75) * 0.32
                    
                    ports_data.append({
                        'id': port.id,
                        'name': port.name,
                        'country': port.country,
                        'congestion_hours': congestion_hours,
                        'congestion_percentage': congestion_percentage
                    })
        
        print(f"Port congestion data: {ports_data}")
        
        # ✅ PASS VESSEL SPECS TO OPTIMIZATION
        result = run_route_optimization(
            coords_list=coordinates,
            fuel_curve=ship.fuel_consumption_curve,
            co2_factor=ship.fuel_type.co2_factor,
            start_datetime_str=start_datetime_str,
            port_stay_hours=port_stay_hours,
            ports_data=ports_data,
            weights=weights,
            vessel_specs=vessel_specs  # ✅ ADD THIS
        )
        
        return jsonify(result)
    except Exception as e:
        print(f"An error occurred during optimization: {e}")
        return jsonify({"error": "An internal error occurred during the optimization process."}), 500

# --- Saved Optimization Endpoints ---
@app.route('/api/optimizations', methods=['GET'])
@token_required
def get_saved_optimizations(current_user):
    results = OptimizationResult.query.filter_by(user_id=current_user.id).order_by(OptimizationResult.timestamp.desc()).all()
    return jsonify([{
        'id': r.id, 'timestamp': r.timestamp.isoformat(), 'route': r.route,
        'vessel': r.vessel, 'fuelSaved': r.fuelSaved,
        'co2Reduced': r.co2Reduced, 'timeSaved': r.timeSaved
    } for r in results])

@app.route('/api/optimizations', methods=['POST'])
@token_required
def save_optimization(current_user):
    data = request.get_json()
    new_result = OptimizationResult(
        user_id=current_user.id, route=data['route'], vessel=data['vessel'],
        fuelSaved=data['fuelSaved'], co2Reduced=data['co2Reduced'],
        timeSaved=data['timeSaved']
    )
    db.session.add(new_result)
    db.session.commit()
    return jsonify({'message': 'Optimization result saved'}), 201

@app.route('/api/optimizations/<int:result_id>', methods=['DELETE'])
@token_required
def delete_optimization(current_user, result_id):
    result = OptimizationResult.query.filter_by(id=result_id, user_id=current_user.id).first_or_404()
    db.session.delete(result)
    db.session.commit()
    return jsonify({'message': 'Result deleted successfully'})

# --- Port Review Endpoints ---
@app.route('/api/ports/<int:port_id>/reviews', methods=['GET'])
@token_required
def get_port_reviews(current_user, port_id):
    """Get all reviews for a specific port"""
    reviews = PortReview.query.filter_by(port_id=port_id).order_by(PortReview.created_at.desc()).all()
    
    return jsonify([{
        'id': r.id,
        'portId': r.port_id,
        'userId': r.user_id,
        'username': r.user.display_name,
        'rating': r.rating,
        'comment': r.comment,
        'createdAt': r.created_at.isoformat(),
        'updatedAt': r.updated_at.isoformat(),
        'isOwner': r.user_id == current_user.id
    } for r in reviews])

@app.route('/api/ports/<int:port_id>/reviews/summary', methods=['GET'])
@token_required
def get_port_reviews_summary(current_user, port_id):
    """Get review summary statistics for a port"""
    from sqlalchemy import func
    
    summary = db.session.query(
        func.avg(PortReview.rating).label('average'),
        func.count(PortReview.id).label('total')
    ).filter_by(port_id=port_id).first()
    
    # Get rating distribution
    distribution = db.session.query(
        PortReview.rating,
        func.count(PortReview.id).label('count')
    ).filter_by(port_id=port_id).group_by(PortReview.rating).all()
    
    rating_dist = {i: 0 for i in range(1, 6)}
    for rating, count in distribution:
        rating_dist[rating] = count
    
    return jsonify({
        'averageRating': float(summary.average) if summary.average else 0,
        'totalReviews': summary.total or 0,
        'distribution': rating_dist
    })

@app.route('/api/ports/<int:port_id>/reviews', methods=['POST'])
@token_required
def add_port_review(current_user, port_id):
    """Add or update a review for a port"""
    data = request.get_json()
    rating = data.get('rating')
    comment = data.get('comment', '').strip()
    
    # Validation
    if not rating or rating < 1 or rating > 5:
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400
    
    # Check if port exists
    port = Port.query.get_or_404(port_id)
    
    # Check if user already reviewed this port
    existing_review = PortReview.query.filter_by(
        port_id=port_id, 
        user_id=current_user.id
    ).first()
    
    if existing_review:
        # Update existing review
        existing_review.rating = rating
        existing_review.comment = comment if comment else None
        existing_review.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Review updated successfully'}), 200
    
    # Create new review
    now = datetime.utcnow()
    new_review = PortReview(
        port_id=port_id,
        user_id=current_user.id,
        rating=rating,
        comment=comment if comment else None,
        created_at=now,
        updated_at=now 
    )
    db.session.add(new_review)
    db.session.commit()
    return jsonify({'message': 'Review added successfully'}), 201

@app.route('/api/ports/<int:port_id>/reviews/<int:review_id>', methods=['DELETE'])
@token_required
def delete_port_review(current_user, port_id, review_id):
    """Delete a review (only by owner)"""
    review = PortReview.query.filter_by(
        id=review_id, 
        port_id=port_id, 
        user_id=current_user.id
    ).first_or_404()
    
    db.session.delete(review)
    db.session.commit()
    return jsonify({'message': 'Review deleted successfully'})

@app.route('/api/ports/<int:port_id>/reviews/my-review', methods=['GET'])
@token_required
def get_my_port_review(current_user, port_id):
    """Get current user's review for a specific port"""
    review = PortReview.query.filter_by(
        port_id=port_id, 
        user_id=current_user.id
    ).first()
    
    if not review:
        return jsonify({'hasReview': False})
    
    return jsonify({
        'hasReview': True,
        'id': review.id,
        'rating': review.rating,
        'comment': review.comment,
        'createdAt': review.created_at.isoformat(),
        'updatedAt': review.updated_at.isoformat()
    })

# --- Weather Cache Endpoint ---
@app.route('/api/weather/<int:port_id>', methods=['GET'])
@token_required
def get_weather(current_user, port_id):
    """Get cached weather data for a specific port"""
    try:
        port = Port.query.get(port_id)
        if not port:
            return jsonify({'error': 'Port not found'}), 404
        
        # Get cached weather data
        cache = WeatherCache.query.filter_by(port_id=port_id).first()
        
        # ⭐ FETCH ON-DEMAND IF NO CACHE OR STALE (older than 24 hours)
        if not cache or (datetime.utcnow() - cache.last_updated).total_seconds() > 86400:
            try:
                print(f"Fetching fresh weather data for port {port.name}...")
                weather_params = "temperature_2m,weather_code,wind_speed_10m"
                marine_params = "wave_height,wave_direction,wave_period"
                weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={port.latitude}&longitude={port.longitude}&current={weather_params},weather_code&hourly={weather_params}&timezone=auto&forecast_days=3"
                marine_url = f"https://marine-api.open-meteo.com/v1/marine?latitude={port.latitude}&longitude={port.longitude}&current={marine_params}&hourly={marine_params}&timezone=auto&forecast_days=3"
                
                weather_resp = requests.get(weather_url, timeout=10)
                marine_resp = requests.get(marine_url, timeout=10)
                
                if weather_resp.ok and marine_resp.ok:
                    weather_data = weather_resp.json()
                    marine_data = marine_resp.json()
                    
                    combined_data = {
                        'latitude': weather_data.get('latitude'),
                        'longitude': weather_data.get('longitude'),
                        'timezone': weather_data.get('timezone'),
                        'timezone_abbreviation': weather_data.get('timezone_abbreviation'),
                        'elevation': weather_data.get('elevation'),
                        'current_units': {**weather_data.get('current_units', {}), **marine_data.get('current_units', {})},
                        'hourly_units': {**weather_data.get('hourly_units', {}), **marine_data.get('hourly_units', {})},
                        'current': {**weather_data.get('current', {}), **marine_data.get('current', {})},
                        'hourly': {
                            'time': weather_data.get('hourly', {}).get('time', []),
                            'temperature_2m': weather_data.get('hourly', {}).get('temperature_2m', []),
                            'weather_code': weather_data.get('hourly', {}).get('weather_code', []),
                            'wind_speed_10m': weather_data.get('hourly', {}).get('wind_speed_10m', []),
                            'wave_height': marine_data.get('hourly', {}).get('wave_height', []),
                            'wave_direction': marine_data.get('hourly', {}).get('wave_direction', []),
                            'wave_period': marine_data.get('hourly', {}).get('wave_period', []),
                        }
                    }
                    
                    if cache:
                        cache.weather_data = combined_data
                        cache.last_updated = datetime.utcnow()
                    else:
                        cache = WeatherCache(
                            port_id=port.id,
                            latitude=port.latitude,
                            longitude=port.longitude,
                            weather_data=combined_data,
                            last_updated=datetime.utcnow()
                        )
                        db.session.add(cache)
                    
                    db.session.commit()
                else:
                    return jsonify({
                        'error': 'Weather service temporarily unavailable',
                        'message': 'Unable to fetch weather data from external API'
                    }), 503
                    
            except Exception as e:
                print(f"Error fetching weather: {e}")
                return jsonify({
                    'error': 'Failed to fetch weather data',
                    'message': str(e)
                }), 503
        
        return jsonify({
            'data': cache.weather_data,
            'lastUpdated': cache.last_updated.isoformat(),
            'port': {
                'id': port.id,
                'name': port.name,
                'latitude': float(port.latitude),
                'longitude': float(port.longitude)
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Analytics Endpoints ---
@app.route('/api/analytics/summary', methods=['GET'])
@token_required
def get_analytics_summary(current_user):
    """Get overall analytics summary"""
    from sqlalchemy import func
    
    total_optimizations = OptimizationResult.query.filter_by(user_id=current_user.id).count()
    
    # Calculate total fuel and CO2 saved
    results = OptimizationResult.query.filter_by(user_id=current_user.id).all()
    
    total_fuel_saved = 0
    total_co2_reduced = 0
    
    for r in results:
        # Extract numeric value from strings like "2,340 L"
        fuel_str = r.fuelSaved.replace(',', '').replace(' L', '').strip()
        co2_str = r.co2Reduced.replace(' tons', '').strip()
        
        try:
            total_fuel_saved += float(fuel_str)
            total_co2_reduced += float(co2_str)
        except ValueError:
            continue
    
    return jsonify({
        'totalOptimizations': total_optimizations,
        'totalFuelSaved': f"{total_fuel_saved:,.0f} L",
        'totalCo2Reduced': f"{total_co2_reduced:.1f} tons"
    })
    
@app.route('/api/analytics/monthly-trends', methods=['GET'])
@token_required
def get_monthly_optimization_trends(current_user):
    """Get monthly optimization trends for the last N months"""
    from sqlalchemy import func, extract
    from calendar import month_abbr
    
    months = request.args.get('months', 12, type=int)
    cutoff_date = datetime.utcnow() - timedelta(days=months * 30)
    
    # Get monthly statistics
    monthly_stats = db.session.query(
        extract('year', OptimizationResult.timestamp).label('year'),
        extract('month', OptimizationResult.timestamp).label('month'),
        func.count(OptimizationResult.id).label('count')
    ).filter(
        OptimizationResult.user_id == current_user.id,
        OptimizationResult.timestamp >= cutoff_date
    ).group_by('year', 'month').order_by('year', 'month').all()
    
    # Create a complete list of months for the period
    labels = []
    counts = []
    
    # Get current month and year
    now = datetime.utcnow()
    
    # Generate labels for the last N months
    for i in range(months - 1, -1, -1):
        target_date = now - timedelta(days=i * 30)
        month_num = target_date.month
        year = target_date.year
        
        # Create label like "Jan 2025"
        label = f"{month_abbr[month_num]} {year}"
        labels.append(label)
        
        # Find matching count from database
        count = 0
        for stat in monthly_stats:
            if int(stat.year) == year and int(stat.month) == month_num:
                count = stat.count
                break
        counts.append(count)
    
    return jsonify({
        'labels': labels,
        'counts': counts
    })

@app.route('/api/analytics/recent', methods=['GET'])
@token_required
def get_recent_optimizations_analytics(current_user):
    """Get recent optimization results"""
    limit = request.args.get('limit', 10, type=int)
    
    results = OptimizationResult.query.filter_by(
        user_id=current_user.id
    ).order_by(
        OptimizationResult.timestamp.desc()
    ).limit(limit).all()
    
    return jsonify([{
        'timestamp': r.timestamp.isoformat(),
        'route': r.route,
        'vessel': r.vessel,
        'fuelSaved': r.fuelSaved,
        'co2Reduced': r.co2Reduced,
        'timeSaved': r.timeSaved
    } for r in results])

@app.route('/api/analytics/vessel-usage', methods=['GET'])
@token_required
def get_vessel_usage_stats(current_user):
    """Get most used vessels statistics"""
    from sqlalchemy import func
    
    vessel_stats = db.session.query(
        OptimizationResult.vessel,
        func.count(OptimizationResult.id).label('count')
    ).filter(
        OptimizationResult.user_id == current_user.id
    ).group_by(
        OptimizationResult.vessel
    ).order_by(
        func.count(OptimizationResult.id).desc()
    ).limit(5).all()
    
    return jsonify({
        'labels': [v[0] for v in vessel_stats],
        'counts': [v[1] for v in vessel_stats]
    })

@app.route('/api/analytics/fuel-distribution', methods=['GET'])
@token_required
def get_fuel_type_distribution(current_user):
    """Get fuel type distribution based on actual optimization usage"""
    from sqlalchemy import func
    
    # Join optimization results with cruise ships and fuel types
    # Count how many times each fuel type was used in optimizations
    fuel_distribution = db.session.query(
        FuelType.name,
        func.count(OptimizationResult.id).label('count')
    ).join(
        CruiseShip, CruiseShip.name == OptimizationResult.vessel
    ).join(
        FuelType, FuelType.id == CruiseShip.fuel_type_id
    ).filter(
        OptimizationResult.user_id == current_user.id
    ).group_by(
        FuelType.name
    ).all()
    
    # If no data, return empty arrays
    if not fuel_distribution:
        return jsonify({
            'labels': [],
            'counts': []
        })
    
    return jsonify({
        'labels': [f[0] for f in fuel_distribution],
        'counts': [f[1] for f in fuel_distribution]
    })

@app.route('/api/analytics/weekly-activity', methods=['GET'])
@token_required
def get_weekly_activity(current_user):
    """Get weekly activity for the last N weeks"""
    from sqlalchemy import func
    
    weeks = request.args.get('weeks', 8, type=int)
    cutoff_date = datetime.utcnow() - timedelta(weeks=weeks)
    
    # Calculate week number for grouping (MySQL compatible)
    weekly_stats = db.session.query(
        func.date_format(OptimizationResult.timestamp, '%Y-%u').label('week'),
        func.count(OptimizationResult.id).label('count')
    ).filter(
        OptimizationResult.user_id == current_user.id,
        OptimizationResult.timestamp >= cutoff_date
    ).group_by('week').order_by('week').all()
    
    labels = []
    counts = []
    for i, (week, count) in enumerate(weekly_stats, 1):
        labels.append(f'Week {i}')
        counts.append(count)
    
    # Fill in missing weeks with zeros if needed
    while len(labels) < weeks:
        labels.append(f'Week {len(labels) + 1}')
        counts.append(0)
    
    return jsonify({
        'labels': labels[:weeks],
        'counts': counts[:weeks]
    })
@app.route('/api/analytics/stats-summary', methods=['GET'])
@token_required
def get_stats_summary(current_user):
    """Get summary statistics for the dashboard stats cards"""
    from sqlalchemy import func
    
    # Count user's optimization results
    total_routes = OptimizationResult.query.filter_by(user_id=current_user.id).count()
    
    # Count total vessels (all vessels in system, not user-specific)
    total_vessels = CruiseShip.query.count()
    
    # Count total ports (all ports in system)
    total_ports = Port.query.count()
    
    # Count total fuel types (all fuel types in system)
    total_fuel_types = FuelType.query.count()
    
    return jsonify({
        'totalRoutes': total_routes,
        'totalVessels': total_vessels,
        'totalPorts': total_ports,
        'totalFuelTypes': total_fuel_types
    })
    
# --- Feedback Endpoints ---
@app.route('/api/feedback', methods=['POST'])
@token_required
def submit_feedback(current_user):
    """Submit user feedback"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = [
            'question_1', 'question_2', 'question_3', 'question_4', 'question_5',
            'question_6', 'question_7', 'question_8', 'question_9', 'question_10'
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
            if data[field] not in ['positive', 'negative']:
                return jsonify({'error': f'Invalid value for {field}. Must be "positive" or "negative"'}), 400
        
        # Create new feedback entry (user_id comes from authenticated user)
        new_feedback = Feedback(
            user_id=current_user.id,
            question_1=data['question_1'],
            question_2=data['question_2'],
            question_3=data['question_3'],
            question_4=data['question_4'],
            question_5=data['question_5'],
            question_6=data['question_6'],
            question_7=data['question_7'],
            question_8=data['question_8'],
            question_9=data['question_9'],
            question_10=data['question_10'],
            additional_comments=data.get('additional_comments')
        )
        
        db.session.add(new_feedback)
        db.session.commit()
        
        return jsonify({
            'message': 'Feedback submitted successfully',
            'feedback_id': new_feedback.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error submitting feedback: {str(e)}")  # For debugging
        return jsonify({'error': str(e)}), 500

@app.route('/api/feedback', methods=['GET'])
@token_required
def get_feedback(current_user):
    """Get all feedback (admin only) or user's own feedback"""
    try:
        # For now, return user's own feedback
        feedbacks = Feedback.query.filter_by(user_id=current_user.id).order_by(Feedback.created_at.desc()).all()
        
        feedback_list = []
        for fb in feedbacks:
            feedback_list.append({
                'id': fb.id,
                'question_1': fb.question_1,
                'question_2': fb.question_2,
                'question_3': fb.question_3,
                'question_4': fb.question_4,
                'question_5': fb.question_5,
                'question_6': fb.question_6,
                'question_7': fb.question_7,
                'question_8': fb.question_8,
                'question_9': fb.question_9,
                'question_10': fb.question_10,
                'additional_comments': fb.additional_comments,
                'created_at': fb.created_at.isoformat()
            })
        
        return jsonify(feedback_list), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)