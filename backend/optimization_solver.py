import math
import numpy as np
import pygad
from decimal import Decimal
import searoute as sr
from datetime import datetime, timedelta

# --- Utility Functions ---

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates the great-circle distance between two points."""
    R = 6371  # Earth radius in kilometers
    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_searoute_distance(origin, destination):
    """
    Calculates maritime distance using searoute library.
    Returns distance in kilometers, avoiding land.
    Falls back to haversine if searoute fails.
    """
    try:
        # searoute expects [lon, lat] format
        origin_lonlat = [origin[1], origin[0]]
        dest_lonlat = [destination[1], destination[0]]
        
        # Get maritime route distance in kilometers
        route = sr.searoute(origin_lonlat, dest_lonlat, units="km")
        
        if route and hasattr(route, 'properties') and 'length' in route.properties:
            return route.properties['length']
        else:
            # Fallback to haversine if searoute returns unexpected format
            print(f"Warning: searoute returned unexpected format, using haversine fallback")
            return haversine_distance(origin[0], origin[1], destination[0], destination[1])
    except Exception as e:
        # Fallback to haversine on any error
        print(f"Warning: searoute failed ({str(e)}), using haversine fallback")
        return haversine_distance(origin[0], origin[1], destination[0], destination[1])

def get_searoute_geometry(origin, destination):
    """
    Gets the actual maritime route geometry for map display.
    Returns list of [lat, lon] coordinates.
    """
    try:
        origin_lonlat = [origin[1], origin[0]]
        dest_lonlat = [destination[1], destination[0]]
        
        route = sr.searoute(origin_lonlat, dest_lonlat, units="km", append_orig_dest=True)
        
        if route and hasattr(route, 'geometry') and hasattr(route.geometry, 'coordinates'):
            # Convert from [lon, lat] to [lat, lon] for Leaflet
            coords = [[coord[1], coord[0]] for coord in route.geometry.coordinates]
            return coords
        else:
            # Fallback to straight line
            return [origin, destination]
    except Exception as e:
        print(f"Warning: Could not get route geometry ({str(e)}), using straight line")
        return [origin, destination]

def calculate_idle_fuel_rate(gross_tonnage, propulsion_power):
    """
    Calculate vessel-specific idle fuel consumption rate based on vessel characteristics.
    
    Idle fuel consumption varies significantly by vessel size:
    - Small vessels (< 25,000 GT): 20-50 L/hour
    - Medium vessels (25,000-100,000 GT): 50-200 L/hour
    - Large vessels (100,000-200,000 GT): 200-500 L/hour
    - Ultra-large vessels (> 200,000 GT): 500-1,500 L/hour
    
    Args:
        gross_tonnage: Vessel gross tonnage (GT)
        propulsion_power: Vessel propulsion power (MW)
    
    Returns:
        Idle fuel rate in liters per hour
    """
    
    # Base rate calculation from gross tonnage (primary factor - 80% weight)
    if gross_tonnage < 25000:
        # Small vessels: linear scale from 20 to 50 L/h
        base_rate = 20 + (gross_tonnage / 25000) * 30
    elif gross_tonnage < 100000:
        # Medium vessels: linear scale from 50 to 200 L/h
        base_rate = 50 + ((gross_tonnage - 25000) / 75000) * 150
    elif gross_tonnage < 200000:
        # Large vessels: linear scale from 200 to 500 L/h
        base_rate = 200 + ((gross_tonnage - 100000) / 100000) * 300
    else:
        # Ultra-large vessels: linear scale from 500 to 1500 L/h
        base_rate = 500 + ((gross_tonnage - 200000) / 200000) * 1000
    
    # Power-based adjustment (secondary factor - 20% weight)
    # Typical: 10-15 L/hour per MW of installed power
    power_adjustment = propulsion_power * 12  # 12 L/hour per MW
    
    # Weighted combination (80% from GT, 20% from power)
    idle_rate = (base_rate * 0.8) + (power_adjustment * 0.2)
    
    # Apply safety bounds (minimum 20 L/h, maximum 2000 L/h)
    idle_rate = max(20, min(idle_rate, 2000))
    
    return round(idle_rate, 2)

# --- ETA Calculation Function ---

def calculate_detailed_eta(route_indices, dist_matrix, port_coords, average_speed_kmh, start_datetime, port_stay_hours):
    """
    Calculates the detailed ETA for each port in the optimized route.
    """
    eta_details = []
    current_time = start_datetime
    full_route = [0] + route_indices # Prepend the origin port (index 0)

    for i in range(len(full_route) - 1):
        start_idx = full_route[i]
        end_idx = full_route[i+1]
        
        # Calculate time for this leg of the journey
        leg_distance = dist_matrix[start_idx, end_idx]
        leg_travel_time_hours = leg_distance / average_speed_kmh if average_speed_kmh > 0 else 0
        
        # Update current time to get ETA at the destination port
        current_time += timedelta(hours=leg_travel_time_hours)
        
        # Store details for this stop
        eta_details.append({
            "port_index": end_idx,
            "port_coords": port_coords[end_idx].tolist(),
            "leg_distance_km": round(leg_distance, 2),
            "leg_travel_hours": round(leg_travel_time_hours, 2),
            "eta": current_time.strftime('%Y-%m-%d %H:%M:%S') # Format ETA as a string
        })
        
        # Add port stay time to calculate ETD for the next leg
        current_time += timedelta(hours=port_stay_hours)
        
    return eta_details

# --- Main Optimization Logic ---

def get_route_metrics(route_indices, dist_matrix, fuel_curve, co2_factor, ports_data=None, vessel_specs=None):
    """
    Calculates all metrics for a given route order including congestion.
    
    UPDATED to use Simonsen et al. (2018) methodology for fuel calculations.
    
    Args:
        route_indices: Ordered list of port indices (excluding origin)
        dist_matrix: Pre-calculated distance matrix between all ports
        fuel_curve: Vessel fuel consumption curve (from calculateFuelConsumptionCurve)
        co2_factor: CO2 emission factor for the fuel type
        ports_data: List of port dictionaries with congestion data
        vessel_specs: Dictionary with vessel specifications
    
    Returns:
        Dictionary with route metrics (distance, fuel, CO2, time, congestion)
    """
    # Calculate total distance
    total_distance = dist_matrix[0, route_indices[0]]
    for i in range(len(route_indices) - 1):
        total_distance += dist_matrix[route_indices[i], route_indices[i+1]]

    # Get cruising speed and fuel consumption from fuel curve
    if vessel_specs and 'cruising_speed' in vessel_specs:
        cruising_speed_knots = vessel_specs['cruising_speed']
        
        # Find the closest point in fuel curve to cruising speed
        closest_point = min(fuel_curve, key=lambda x: abs(x['speed'] - cruising_speed_knots))
        
        print(f"   🚢 Using fuel curve point: {closest_point['speed']} knots = {closest_point['consumption']} tons/hour")
        
        # Convert speed from knots to km/h
        average_speed_kmh = closest_point['speed'] * 1.852
        
        # Fuel consumption rate: tons/hour ÷ km/hour = tons/km
        # This is correct! No division by efficiency needed.
        fuel_rate_per_km = closest_point['consumption'] / average_speed_kmh
        
    else:
        # Fallback to middle point
        mid_point = fuel_curve[len(fuel_curve) // 2]
        average_speed_kmh = mid_point.get('speed', 25) * 1.852  # Convert knots to km/h
        fuel_rate_per_km = mid_point.get('consumption', 1) / average_speed_kmh
    
    # Calculate travel time
    travel_time_hours = total_distance / average_speed_kmh if average_speed_kmh > 0 else float('inf')

    # Calculate congestion delays across all ports
    congestion_hours = calculate_route_congestion(route_indices, ports_data) if ports_data else 0
    
    # Calculate vessel-specific idle fuel rate
    if vessel_specs and 'gross_tonnage' in vessel_specs and 'propulsion_power' in vessel_specs:
        idle_fuel_rate = calculate_idle_fuel_rate(
            vessel_specs['gross_tonnage'],
            vessel_specs['propulsion_power']
        )
        vessel_name = vessel_specs.get('name', 'Unknown')
        print(f"   💡 {vessel_name} idle consumption: {idle_fuel_rate} L/hour")
    else:
        idle_fuel_rate = 150  # Default fallback
        print(f"   ⚠️ Using default idle rate: {idle_fuel_rate} L/hour")
    
    # Calculate fuel consumed during congestion (idle at ports)
    congestion_fuel_liters = congestion_hours * idle_fuel_rate
    
    # Calculate travel fuel consumption
    fuel_tons = total_distance * fuel_rate_per_km
    travel_fuel_liters = fuel_tons * 1176.5  # Convert tons to liters (HFO density)
    
    # Total fuel includes both travel and idle consumption
    total_fuel_liters = travel_fuel_liters + congestion_fuel_liters
    
    # CO2 emissions calculation (based on total fuel consumed)
    total_fuel_tons = total_fuel_liters / 1176.5
    co2_tons = total_fuel_tons * float(co2_factor)
    co2_kg = co2_tons * 1000
    
    # Total time = sailing time + congestion delays
    total_time_hours = travel_time_hours + congestion_hours
    
    return {
        "distance_km": round(total_distance, 2), 
        "fuel_liters": round(total_fuel_liters, 2),
        "co2_kg": round(co2_kg, 2), 
        "travel_time_hours": round(total_time_hours, 2),
        "congestion_hours": round(congestion_hours, 2),
        "idle_fuel_rate": round(idle_fuel_rate, 2),
        "travel_fuel_liters": round(travel_fuel_liters, 2),
        "congestion_fuel_liters": round(congestion_fuel_liters, 2)
    }

def calculate_route_congestion(route_indices, ports_data):
    """
    Calculates total congestion delay for a route.
    
    Args:
        route_indices: List of port indices in the route order (excluding origin)
        ports_data: List of port dictionaries with congestion_hours
    
    Returns:
        Total congestion hours for the route
    """
    if not ports_data:
        return 0
    
    total_congestion_hours = 0
    
    # Include origin port (index 0) in congestion calculation
    full_route = [0] + route_indices
    
    for idx in full_route:
        if idx < len(ports_data):
            port = ports_data[idx]
            congestion_hours = port.get('congestion_hours', 0)
            total_congestion_hours += congestion_hours
    
    return total_congestion_hours

def run_route_optimization(coords_list, fuel_curve, co2_factor, start_datetime_str, port_stay_hours=24, ports_data=None, weights=None, vessel_specs=None):
    """
    Optimizes route using Genetic Algorithm with user-defined priority weights.
    
    This function uses a genetic algorithm to find the optimal port visitation order
    that minimizes a weighted combination of fuel consumption, travel time, and
    congestion delays based on user-defined priorities.
    
    Args:
        coords_list: List of port coordinates [[lat1, lon1], [lat2, lon2], ...]
        fuel_curve: Vessel fuel consumption curve (list of dicts with 'speed' and 'consumption')
        co2_factor: CO2 emission factor for fuel type (tons CO2 per ton of fuel)
        start_datetime_str: Starting datetime string (format: 'YYYY-MM-DD HH:MM:SS')
        port_stay_hours: Hours to stay at each port (default: 24)
        ports_data: List of port dictionaries with congestion data
        weights: Dictionary with 'fuel', 'time', 'congestion' weights (0-100 each)
        vessel_specs: Dictionary with 'gross_tonnage', 'propulsion_power', 'name'
    
    Returns:
        Dictionary containing:
            - standard_metrics: Metrics for original route order
            - optimized_metrics: Metrics for optimized route order
            - best_route_indices: Optimized port visitation order
            - route_geometry: Geographic coordinates for map display
            - eta_details: Estimated arrival times for each port
    """
    
    # Set default weights if not provided (balanced approach)
    if weights is None:
        weights = {'fuel': 50, 'time': 50, 'congestion': 50}
    
    # Normalize weights to sum to 1.0 for proper weighting in fitness function
    weight_sum = weights['fuel'] + weights['time'] + weights['congestion']
    
    if weight_sum == 0:
        # All weights are zero - use balanced default
        print("⚠️ All weights are zero. Using balanced defaults.")
        fuel_weight = 0.33
        time_weight = 0.33
        congestion_weight = 0.33
    else:
        fuel_weight = weights['fuel'] / weight_sum
        time_weight = weights['time'] / weight_sum
        congestion_weight = weights['congestion'] / weight_sum
    
    print(f"")
    print(f"⚙️ OPTIMIZATION CONFIGURATION:")
    print(f"   Weights (normalized): Fuel={fuel_weight:.2f}, Time={time_weight:.2f}, Congestion={congestion_weight:.2f}")
    print(f"   Raw priorities: Fuel={weights['fuel']}%, Time={weights['time']}%, Congestion={weights['congestion']}%")
    
    # Prepare port coordinates and indices
    port_coords = np.array(coords_list, dtype=float)
    customer_ids = np.arange(1, len(port_coords))  # Exclude origin (index 0)
    N = len(port_coords)

    print(f"")
    print(f"🗺️ PRE-CALCULATING MARITIME DISTANCES:")
    print(f"   Total ports: {N}")
    print(f"   Using: searoute library (real maritime routes)")
    
    # Pre-calculate all pairwise distances using maritime routes
    dist = np.zeros((N, N), dtype=float)
    
    for i in range(N):
        for j in range(i + 1, N):
            print(f"   ↔️ Port {i+1}/{N} to Port {j+1}/{N}...", end=' ')
            
            origin = [port_coords[i][0], port_coords[i][1]]
            destination = [port_coords[j][0], port_coords[j][1]]
            
            maritime_dist = calculate_searoute_distance(origin, destination)
            
            dist[i, j] = dist[j, i] = maritime_dist
            print(f"✓ {maritime_dist:.2f} km")
    
    print(f"")
    print(f"✅ Distance matrix calculation complete!")
    print(f"")
    print(f"🧬 STARTING GENETIC ALGORITHM OPTIMIZATION:")
    print(f"   Population size: 50")
    print(f"   Generations: 200")
    print(f"   Selection: Tournament (K=3)")

    # Define fitness function for genetic algorithm
    def fitness_func(ga_instance, solution, solution_idx):
        """
        Multi-objective fitness function with user-defined weights.
        
        Higher fitness score = better solution
        Uses reciprocal of metrics since lower values are better for all objectives.
        """
        # Decode solution to get port visitation order
        route_indices = customer_ids[np.argsort(solution)].tolist()
        
        # Calculate all metrics for this route
        metrics = get_route_metrics(route_indices, dist, fuel_curve, co2_factor, ports_data, vessel_specs)
        
        # Normalize each objective (lower is better, so use reciprocal for "higher is better")
        fuel_score = 1.0 / (metrics["fuel_liters"] + 1e-6)
        time_score = 1.0 / (metrics["travel_time_hours"] + 1e-6)
        congestion_score = 1.0 / (metrics["congestion_hours"] + 1e-6)
        
        # Weighted combination based on user preferences
        combined_score = (
            fuel_weight * fuel_score +
            time_weight * time_score +
            congestion_weight * congestion_score
        )
        
        return combined_score

    # Initialize and run genetic algorithm
    ga_instance = pygad.GA(
        num_generations=200,  # Number of iterations
        sol_per_pop=50,  # Population size
        num_parents_mating=25,  # Parents selected for crossover
        fitness_func=fitness_func,  # Our custom fitness function
        num_genes=len(customer_ids),  # One gene per port (excluding origin)
        gene_type=float,  # Genes are floating point numbers
        gene_space={'low': 0.0, 'high': 1.0},  # Gene value range
        parent_selection_type="tournament",  # Selection method
        K_tournament=3,  # Tournament size
        crossover_type="single_point",  # Crossover method
        mutation_type="random",  # Mutation method
        mutation_percent_genes=20  # 20% of genes may mutate
    )
    
    ga_instance.run()

    print(f"")
    print(f"✅ Genetic algorithm optimization complete!")
    print(f"   Processing results...")

    # Extract best solution
    best_keys, best_fitness, _ = ga_instance.best_solution()
    optimized_indices = customer_ids[np.argsort(best_keys)].tolist()
    optimized_metrics = get_route_metrics(optimized_indices, dist, fuel_curve, co2_factor, ports_data, vessel_specs)

    # Calculate metrics for original (unoptimized) route
    original_indices = customer_ids.tolist()
    standard_metrics = get_route_metrics(original_indices, dist, fuel_curve, co2_factor, ports_data, vessel_specs)

    # Log optimization results
    print(f"")
    print(f"📊 OPTIMIZATION RESULTS:")
    print(f"   Best fitness score: {best_fitness:.6f}")
    print(f"")
    print(f"   STANDARD ROUTE:")
    print(f"      Distance: {standard_metrics['distance_km']} km")
    print(f"      Fuel: {standard_metrics['fuel_liters']} L (Travel: {standard_metrics['travel_fuel_liters']} L + Idle: {standard_metrics['congestion_fuel_liters']} L)")
    print(f"      Time: {standard_metrics['travel_time_hours']} hours (Sailing + {standard_metrics['congestion_hours']} hours congestion)")
    print(f"")
    print(f"   OPTIMIZED ROUTE:")
    print(f"      Distance: {optimized_metrics['distance_km']} km")
    print(f"      Fuel: {optimized_metrics['fuel_liters']} L (Travel: {optimized_metrics['travel_fuel_liters']} L + Idle: {optimized_metrics['congestion_fuel_liters']} L)")
    print(f"      Time: {optimized_metrics['travel_time_hours']} hours (Sailing + {optimized_metrics['congestion_hours']} hours congestion)")
    print(f"")
    
    # Calculate improvements
    fuel_saved = standard_metrics['fuel_liters'] - optimized_metrics['fuel_liters']
    time_saved = standard_metrics['travel_time_hours'] - optimized_metrics['travel_time_hours']
    distance_saved = standard_metrics['distance_km'] - optimized_metrics['distance_km']
    
    print(f"   IMPROVEMENTS:")
    print(f"      Fuel: {fuel_saved:+.2f} L ({(fuel_saved/standard_metrics['fuel_liters']*100):+.1f}%)")
    print(f"      Time: {time_saved:+.2f} hours ({(time_saved/standard_metrics['travel_time_hours']*100):+.1f}%)")
    print(f"      Distance: {distance_saved:+.2f} km ({(distance_saved/standard_metrics['distance_km']*100):+.1f}%)")

    # Parse start datetime
    try:
        start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError):
        print("")
        print("⚠️ Warning: Invalid start_datetime_str format. Using current time.")
        start_datetime = datetime.now()

    # Calculate ETA details for each port stop
    mid_point = fuel_curve[len(fuel_curve) // 2]
    average_speed_kmh = mid_point.get('speed', 25)

    eta_details = calculate_detailed_eta(
        route_indices=optimized_indices,
        dist_matrix=dist,
        port_coords=port_coords,
        average_speed_kmh=average_speed_kmh,
        start_datetime=start_datetime,
        port_stay_hours=port_stay_hours
    )
    
    print(f"")
    print(f"🗺️ FETCHING ROUTE GEOMETRY:")
    print(f"   Generating detailed maritime route path for map display...")
    
    # Get detailed route geometry for map visualization
    final_route_geometry = []
    full_optimized_path_indices = [0] + optimized_indices
    
    for i in range(len(full_optimized_path_indices) - 1):
        start_idx = full_optimized_path_indices[i]
        end_idx = full_optimized_path_indices[i + 1]
        
        origin = [port_coords[start_idx][0], port_coords[start_idx][1]]
        destination = [port_coords[end_idx][0], port_coords[end_idx][1]]
        
        segment_geometry = get_searoute_geometry(origin, destination)
        
        # Append segment to route (avoid duplicating connection points)
        if not final_route_geometry:
            final_route_geometry.extend(segment_geometry)
        else:
            final_route_geometry.extend(segment_geometry[1:])
    
    print(f"   ✓ Route geometry complete ({len(final_route_geometry)} coordinates)")
    print(f"")
    print(f"✅ OPTIMIZATION COMPLETE!")
    print(f"")

    # Return all optimization results
    return {
        "standard_metrics": standard_metrics,
        "optimized_metrics": optimized_metrics,
        "best_route_indices": optimized_indices,
        "route_geometry": final_route_geometry,
        "eta_details": eta_details
    }