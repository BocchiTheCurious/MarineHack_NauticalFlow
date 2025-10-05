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

def get_route_metrics(route_indices, dist_matrix, fuel_curve, co2_factor):
    """Calculates all metrics for a given route order."""
    total_distance = dist_matrix[0, route_indices[0]]
    for i in range(len(route_indices) - 1):
        total_distance += dist_matrix[route_indices[i], route_indices[i+1]]

    mid_point = fuel_curve[len(fuel_curve) // 2]
    average_speed_kmh = mid_point.get('speed', 25)
    fuel_rate_per_km = mid_point.get('consumption', 1) / average_speed_kmh if average_speed_kmh > 0 else 0
    travel_time_hours = total_distance / average_speed_kmh if average_speed_kmh > 0 else float('inf')

    fuel_tons = total_distance * fuel_rate_per_km
    co2_tons = fuel_tons * float(co2_factor)
    fuel_liters = fuel_tons * 1176.5
    co2_kg = co2_tons * 1000
    
    return {
        "distance_km": round(total_distance, 2), 
        "fuel_liters": round(fuel_liters, 2),
        "co2_kg": round(co2_kg, 2), 
        "travel_time_hours": round(travel_time_hours, 2)
    }

def run_route_optimization(coords_list, fuel_curve, co2_factor, start_datetime_str, port_stay_hours=24):
    """
    Optimizes route using Genetic Algorithm with pre-calculated searoute distances.
    """
    port_coords = np.array(coords_list, dtype=float)
    customer_ids = np.arange(1, len(port_coords))
    N = len(port_coords)

    print(f"Pre-calculating maritime distances for {N} ports using searoute...")
    
    dist = np.zeros((N, N), dtype=float)
    
    for i in range(N):
        for j in range(i + 1, N):
            print(f"  Calculating route {i+1}/{N} to {j+1}/{N}...")
            
            origin = [port_coords[i][0], port_coords[i][1]]
            destination = [port_coords[j][0], port_coords[j][1]]
            
            maritime_dist = calculate_searoute_distance(origin, destination)
            
            dist[i, j] = dist[j, i] = maritime_dist
    
    print("Distance matrix pre-calculation complete. Starting genetic algorithm...")

    def fitness_func(ga_instance, solution, solution_idx):
        route_indices = customer_ids[np.argsort(solution)].tolist()
        metrics = get_route_metrics(route_indices, dist, fuel_curve, co2_factor)
        return 1.0 / (metrics["fuel_liters"] + 1e-6)

    ga_instance = pygad.GA(
        num_generations=200, 
        sol_per_pop=50, 
        num_parents_mating=25,
        fitness_func=fitness_func, 
        num_genes=len(customer_ids), 
        gene_type=float,
        gene_space={'low': 0.0, 'high': 1.0}, 
        parent_selection_type="tournament",
        K_tournament=3, 
        crossover_type="single_point", 
        mutation_type="random",
        mutation_percent_genes=20
    )
    ga_instance.run()

    print("Genetic algorithm optimization complete. Processing results...")

    best_keys, _, _ = ga_instance.best_solution()
    optimized_indices = customer_ids[np.argsort(best_keys)].tolist()
    optimized_metrics = get_route_metrics(optimized_indices, dist, fuel_curve, co2_factor)
    
    original_indices = customer_ids.tolist()
    standard_metrics = get_route_metrics(original_indices, dist, fuel_curve, co2_factor)

    try:
        start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError):
        print("Warning: Invalid start_datetime_str format or type. Using current time.")
        start_datetime = datetime.now()

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
    
    print("Fetching detailed route geometry for map display...")
    final_route_geometry = []
    full_optimized_path_indices = [0] + optimized_indices
    
    for i in range(len(full_optimized_path_indices) - 1):
        start_idx = full_optimized_path_indices[i]
        end_idx = full_optimized_path_indices[i + 1]
        
        origin = [port_coords[start_idx][0], port_coords[start_idx][1]]
        destination = [port_coords[end_idx][0], port_coords[end_idx][1]]
        
        segment_geometry = get_searoute_geometry(origin, destination)
        
        if not final_route_geometry:
            final_route_geometry.extend(segment_geometry)
        else:
            final_route_geometry.extend(segment_geometry[1:])
    
    print("Optimization complete!")

    return {
        "standard_metrics": standard_metrics,
        "optimized_metrics": optimized_metrics,
        "best_route_indices": optimized_indices,
        "route_geometry": final_route_geometry,
        "eta_details": eta_details
    }