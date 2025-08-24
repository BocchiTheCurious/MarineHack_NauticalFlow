from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
from functools import wraps
import re # Imported for password validation
from decimal import Decimal # Import for numeric types
import requests

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
    unlocode = db.Column(db.String(5), unique=True, nullable=True)
    country = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    port_congestion_index = db.Column(db.Numeric(5, 2), nullable=False, default=0.0)

# NEW: FuelType Model
class FuelType(db.Model):
    __tablename__ = 'fuel_types'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    
    # This will now store the USD equivalent cost
    cost_per_ton = db.Column(db.Numeric(10, 2), nullable=False) 
    
    # Official IMO factor, populated automatically from the front-end
    co2_factor = db.Column(db.Numeric(10, 4), nullable=False) 

    # NEW: Fields for audit and traceability
    original_cost = db.Column(db.Numeric(10, 2), nullable=True)
    original_currency = db.Column(db.String(3), nullable=True) # e.g., "MYR"
    exchange_rate = db.Column(db.Numeric(12, 6), nullable=True)
    price_date = db.Column(db.Date, nullable=True)
    bunkering_port = db.Column(db.String(100), nullable=True)

# UPDATED: Replaced Vessel with CruiseShip
class CruiseShip(db.Model):
    __tablename__ = 'cruise_ships'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    
    # This stores the complex performance data
    fuel_consumption_curve = db.Column(db.JSON, nullable=True) 

    # Establish the relationship to FuelType
    fuel_type_id = db.Column(db.Integer, db.ForeignKey('fuel_types.id'), nullable=False)
    fuel_type = db.relationship('FuelType', backref='cruise_ships')


# --- Database Initialization ---
with app.app_context():
    db.create_all()
    # Create a default admin user if one doesn't exist
    if not User.query.filter_by(username='admin').first():
        hashed_pw = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin_user = User(display_name='Admin User', username='admin', password=hashed_pw)
        db.session.add(admin_user)
        db.session.commit()
    # Create default fuel types if they don't exist
    if not FuelType.query.first():
        fuel_types_data = [
            {'name': 'Marine Gas Oil (MGO)', 'cost_per_ton': Decimal('750.00'), 'co2_factor': Decimal('3.206')},
            {'name': 'Heavy Fuel Oil (HFO)', 'cost_per_ton': Decimal('550.00'), 'co2_factor': Decimal('3.114')},
            {'name': 'Liquefied Natural Gas (LNG)', 'cost_per_ton': Decimal('600.00'), 'co2_factor': Decimal('2.750')}
        ]
        for ft_data in fuel_types_data:
            db.session.add(FuelType(**ft_data))
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

# --- Password Validation Helper ---
def is_strong_password(password):
    """Checks if a password meets strength requirements."""
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
        'portCongestionIndex': str(p.port_congestion_index) # Add new field
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
        port_congestion_index=data['portCongestionIndex'] # Add new field
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
    port.port_congestion_index = data['portCongestionIndex'] # Add new field
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
            'fuelConsumptionCurve': ship.fuel_consumption_curve,
            'fuelTypeId': ship.fuel_type_id,
            'fuelTypeName': ship.fuel_type.name # Include the related fuel type name
        })
    return jsonify(results)

@app.route('/api/cruise-ships', methods=['POST'])
@token_required
def add_cruise_ship(current_user):
    data = request.get_json()
    new_ship = CruiseShip(
        name=data['name'],
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

    # Update fields from the request data
    ship.name = data['name']
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
        'id': ft.id, 'name': ft.name, 'costPerTon': str(ft.cost_per_ton), 
        'co2Factor': str(ft.co2_factor), 'originalCost': str(ft.original_cost) if ft.original_cost else None,
        'originalCurrency': ft.original_currency, 'exchangeRate': str(ft.exchange_rate) if ft.exchange_rate else None,
        'priceDate': ft.price_date.strftime('%Y-%m-%d') if ft.price_date else None,
        'bunkeringPort': ft.bunkering_port # UPDATED
    } for ft in fuel_types])

@app.route('/api/fuel-types', methods=['POST'])
@token_required
def add_fuel_type(current_user):
    data = request.get_json()
    
    # THE FIX: Check if a fuel with this name already exists
    if FuelType.query.filter_by(name=data.get('name')).first():
        return jsonify({'error': f"A fuel type with the name '{data.get('name')}' already exists."}), 409 # 409 Conflict is the correct status code

    # ... (the rest of the function is the same)
    new_fuel_type = FuelType(
        name=data.get('name'), cost_per_ton=data.get('costPerTon'),
        co2_factor=data.get('co2Factor'), original_cost=data.get('originalCost'),
        original_currency=data.get('originalCurrency'), exchange_rate=data.get('exchangeRate'),
        price_date=datetime.strptime(data.get('priceDate'), '%Y-%m-%d').date() if data.get('priceDate') else None,
        bunkering_port=data.get('bunkeringPort')
    )
    db.session.add(new_fuel_type)
    db.session.commit()
    return jsonify({'message': 'Fuel type added successfully'}), 201

@app.route('/api/fuel-types/<int:fuel_type_id>', methods=['PUT'])
@token_required
def update_fuel_type(current_user, fuel_type_id):
    fuel_type = FuelType.query.get_or_404(fuel_type_id)
    data = request.get_json()
    
    # THE FIX: Add a check here as well to prevent renaming to an existing name
    existing_fuel = FuelType.query.filter(FuelType.name == data.get('name'), FuelType.id != fuel_type_id).first()
    if existing_fuel:
        return jsonify({'error': f"Another fuel type with the name '{data.get('name')}' already exists."}), 409

    # ... (the rest of the function is the same)
    fuel_type.name = data.get('name')
    fuel_type.cost_per_ton = data.get('costPerTon')
    fuel_type.co2_factor = data.get('co2Factor')
    fuel_type.original_cost = data.get('originalCost')
    fuel_type.original_currency = data.get('originalCurrency')
    fuel_type.exchange_rate = data.get('exchangeRate')
    fuel_type.price_date = datetime.strptime(data.get('priceDate'), '%Y-%m-%d').date() if data.get('priceDate') else None
    fuel_type.bunkering_port = data.get('bunkeringPort')
    db.session.commit()
    return jsonify({'message': 'Fuel type updated successfully'})

@app.route('/api/fuel-types/<int:fuel_type_id>', methods=['DELETE'])
@token_required
def delete_fuel_type(current_user, fuel_type_id):
    fuel_type = FuelType.query.get_or_404(fuel_type_id)
    db.session.delete(fuel_type)
    db.session.commit()
    return jsonify({'message': 'Fuel type deleted successfully'})

@app.route('/api/exchange-rate', methods=['GET'])
@token_required
def get_exchange_rate(current_user):
    """
    Fetches the latest USD to MYR exchange rate from a live API.
    NOTE: The free ExchangeRate-API plan does not support historical data,
    so this will always return the LATEST rate, regardless of the date requested.
    """
    # Your free API key is included here.
    # In a production app, this should be stored securely as an environment variable.
    api_key = "d545249a3ffd92444428fb29"
    exchange_rate_url = f"https://v6.exchangerate-api.com/v6/{api_key}/latest/USD"

    try:
        response = requests.get(exchange_rate_url)
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
        data = response.json()

        # Check if the API call was successful and the rates are present
        if data.get('result') == 'success' and 'conversion_rates' in data:
            # Extract the specific rate for Malaysian Ringgit (MYR)
            myr_rate = data['conversion_rates'].get('MYR')
            if myr_rate is None:
                return jsonify({'error': 'MYR currency data not found in API response.'}), 500
            
            return jsonify({'rate': myr_rate})
        else:
            # Handle cases where the API returns an error
            error_message = data.get('error-type', 'Unknown API error')
            return jsonify({'error': f'Failed to fetch exchange rates: {error_message}'}), 502

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to connect to the exchange rate API: {e}'}), 502

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
    """Changes the current user's password with strength validation."""
    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return jsonify({'error': 'All password fields are required'}), 400
    
    # Verify the current password
    if not bcrypt.checkpw(current_password.encode('utf-8'), current_user.password.encode('utf-8')):
        return jsonify({'error': 'Current password is incorrect'}), 403
    
    # Server-side validation for the new password strength
    if not is_strong_password(new_password):
        return jsonify({
            'error': 'New password is not strong enough. It must be at least 8 characters and include uppercase, lowercase, a number, and a special character.'
        }), 400

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
        'routesOptimized': CruiseShip.query.count() * 2, # UPDATED
        'vesselsManaged': CruiseShip.query.count(), # UPDATED
        'daysActive': (datetime.utcnow().date() - datetime(2025, 7, 15).date()).days
    }
    return jsonify(stats)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
