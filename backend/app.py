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
from congestion_processor import load_congestion_data, calculate_route_congestion_impact

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:chen@localhost/nauticalflow'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.urandom(32)
db = SQLAlchemy(app)

# Load congestion data at startup
CONGESTION_DATA = load_congestion_data()

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
    name = db.Column(db.String(100), nullable=False)
    company = db.Column(db.String(100), nullable=True)
    gross_tonnage = db.Column(db.Integer, nullable=False)
    fuel_consumption_curve = db.Column(db.JSON, nullable=True)
    fuel_type_id = db.Column(db.Integer, db.ForeignKey('fuel_types.id'), nullable=False)
    fuel_type = db.relationship('FuelType', backref='cruise_ships')

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
    ships = CruiseShip.query.order_by(CruiseShip.name).all()
    results = []
    for ship in ships:
        results.append({
            'id': ship.id,
            'name': ship.name,
            'company': ship.company,
            'grossTonnage': ship.gross_tonnage,
            'fuelConsumptionCurve': ship.fuel_consumption_curve,
            'fuelTypeId': ship.fuel_type_id,
            'fuelTypeName': ship.fuel_type.name
        })
    return jsonify(results)

@app.route('/api/cruise-ships', methods=['POST'])
@token_required
def add_cruise_ship(current_user):
    data = request.get_json()
    new_ship = CruiseShip(
        name=data['name'],
        company=data.get('company'),
        gross_tonnage=data['grossTonnage'],
        fuel_consumption_curve=data['fuelConsumptionCurve'],
        fuel_type_id=data['fuelTypeId']
    )
    db.session.add(new_ship)
    db.session.commit()
    return jsonify({'message': 'Cruise ship added successfully'}), 201

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
    ship = CruiseShip.query.get_or_404(ship_id)
    data = request.get_json()
    ship.name = data['name']
    ship.company = data.get('company')
    ship.gross_tonnage = data['grossTonnage']
    ship.fuel_type_id = data['fuelTypeId']
    ship.fuel_consumption_curve = data['fuelConsumptionCurve']
    db.session.commit()
    return jsonify({'message': 'Cruise ship updated successfully'})

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

# --- Congestion Data Endpoint ---
@app.route('/api/congestion-data', methods=['GET'])
@token_required
def get_congestion_data(current_user):
    """
    Returns the loaded congestion data (2023, All ships) as a JSON object.
    Includes country names and their median time in port (in days and hours).
    """
    congestion_response = []
    for country, days in CONGESTION_DATA.items():
        congestion_response.append({
            'country': country,
            'median_days': round(days, 4),
            'median_hours': round(days * 24, 2)
        })
    
    # Sort by congestion level (highest first)
    congestion_response.sort(key=lambda x: x['median_days'], reverse=True)
    
    return jsonify({
        'year': 2023,
        'category': 'All ships',
        'total_economies': len(congestion_response),
        'data': congestion_response
    })

# --- Route Optimization Endpoint ---
# This is the function we corrected
@app.route('/api/optimize', methods=['POST'])
@token_required
def optimize_route(current_user):
    data = request.get_json()
    
    print(f"DEBUG: Received payload: {data}")

    try:
        coordinates = data.get('coords') 
        ship_id = data.get('selectedShipId')
        start_datetime_str = data.get('start_datetime_str')
        port_stay_hours = data.get('port_stay_hours', 24)
        port_names = data.get('port_names', [])  # NEW: Get port names and countries
        port_countries = data.get('port_countries', [])  # NEW

        if not all([coordinates, ship_id, start_datetime_str]):
            return jsonify({"error": "Invalid data: Route, shipId, and start time are required."}), 400
        
        ship = CruiseShip.query.get(ship_id)
        if not ship:
            return jsonify({"error": "Selected ship not found."}), 404

        result = run_route_optimization(
            coords_list=coordinates,
            fuel_curve=ship.fuel_consumption_curve,
            co2_factor=ship.fuel_type.co2_factor,
            start_datetime_str=start_datetime_str,
            port_stay_hours=port_stay_hours
        )
        
        # NEW: Calculate congestion impact for both routes
        standard_ports = [{'name': port_names[i], 'country': port_countries[i]} 
                         for i in range(len(port_names))]
        
        optimized_order = [0] + result['best_route_indices']
        optimized_ports = [{'name': port_names[i], 'country': port_countries[i]} 
                          for i in optimized_order]
        
        standard_congestion = calculate_route_congestion_impact(standard_ports, CONGESTION_DATA)
        optimized_congestion = calculate_route_congestion_impact(optimized_ports, CONGESTION_DATA)
        
        result['standard_congestion'] = standard_congestion
        result['optimized_congestion'] = optimized_congestion
        
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)