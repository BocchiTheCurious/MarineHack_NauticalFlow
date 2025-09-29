import math
import numpy as np
import pygad
from decimal import Decimal

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

def run_route_optimization(coords_list, fuel_curve, co2_factor):
    """
    Optimizes route using Genetic Algorithm only.
    Uses direct haversine distance between all ports.
    """
    port_coords = np.array(coords_list, dtype=float)
    customer_ids = np.arange(1, len(port_coords))

    # --- Calculate Direct Distance Matrix (No pathfinding) ---
    N = len(port_coords)
    dist = np.zeros((N, N), dtype=float)
    
    for i in range(N):
        for j in range(i + 1, N):
            # Direct haversine distance between ports
            direct_dist = haversine_distance(
                port_coords[i][0], port_coords[i][1],
                port_coords[j][0], port_coords[j][1]
            )
            dist[i, j] = dist[j, i] = direct_dist

    # --- Genetic Algorithm ---
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

    # --- Process and Return Results ---
    best_keys, _, _ = ga_instance.best_solution()
    optimized_indices = customer_ids[np.argsort(best_keys)].tolist()
    optimized_metrics = get_route_metrics(optimized_indices, dist, fuel_curve, co2_factor)
    
    original_indices = customer_ids.tolist()
    standard_metrics = get_route_metrics(original_indices, dist, fuel_curve, co2_factor)
    
    # Create simple route geometry (straight lines between ports)
    final_route_geometry = []
    full_optimized_path_indices = [0] + optimized_indices
    
    for i in range(len(full_optimized_path_indices)):
        port_idx = full_optimized_path_indices[i]
        final_route_geometry.append([
            float(port_coords[port_idx][0]), 
            float(port_coords[port_idx][1])
        ])

    return {
        "standard_metrics": standard_metrics,
        "optimized_metrics": optimized_metrics,
        "best_route_indices": optimized_indices,
        "route_geometry": final_route_geometry
    }