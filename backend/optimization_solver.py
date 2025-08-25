import math
import numpy as np
import pygad
from decimal import Decimal

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculates the great-circle distance between two points on Earth.
    This is much more accurate for geographical coordinates.
    """
    R = 6371  # Radius of the Earth in kilometers
    
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# This function calculates all metrics for a given route order.
def get_route_metrics(route_indices, dist_matrix, fuel_curve, co2_factor):
    """Calculates distance, fuel, and CO2 for a specific port sequence."""
    
    # Calculate total distance
    total_distance = dist_matrix[0, route_indices[0]] # Start to first stop
    for i in range(len(route_indices) - 1):
        total_distance += dist_matrix[route_indices[i], route_indices[i+1]]
    total_distance += dist_matrix[route_indices[-1], 0] # Last stop back to start

    # Calculate fuel and CO2 based on distance
    mid_point = fuel_curve[len(fuel_curve) // 2]
    fuel_rate_per_km = mid_point['consumption'] / mid_point['speed']
    fuel_tons = total_distance * fuel_rate_per_km
    co2_tons = fuel_tons * float(co2_factor)

    # Convert to frontend units
    fuel_liters = fuel_tons * 1176.5
    co2_kg = co2_tons * 1000

    return {
        "distance_km": round(total_distance, 2),
        "fuel_liters": round(fuel_liters, 2),
        "co2_kg": round(co2_kg, 2)
    }


def run_route_optimization(coords_list, fuel_curve, co2_factor):
    """
    Runs the GA optimization and returns metrics for BOTH the original and optimized routes.
    """
    coords = np.array(coords_list, dtype=float)
    customer_ids = np.arange(1, len(coords))
    
    # Create distance matrix using Haversine formula
    N = len(coords)
    dist = np.zeros((N, N), dtype=float)
    for i in range(N):
        for j in range(N):
            dist[i, j] = haversine_distance(coords[i, 0], coords[i, 1], coords[j, 0], coords[j, 1])

    def decode_solution(keys):
        return customer_ids[np.argsort(keys)].tolist()

    def fitness_func(ga_instance, solution, solution_idx):
        route = decode_solution(solution)
        metrics = get_route_metrics(route, dist, fuel_curve, co2_factor)
        # Fitness is based on minimizing fuel consumption
        return -metrics["fuel_liters"]

    ga_instance = pygad.GA(
        num_generations=200, sol_per_pop=40, num_parents_mating=20,
        fitness_func=fitness_func, num_genes=len(customer_ids), gene_type=float,
        gene_space={'low': 0.0, 'high': 1.0}, parent_selection_type="tournament",
        K_tournament=3, crossover_type="single_point", mutation_type="random",
        mutation_percent_genes=20
    )
    ga_instance.run()

    # --- CALCULATE AND RETURN BOTH METRICS ---
    # 1. Get metrics for the OPTIMIZED route
    best_keys, _, _ = ga_instance.best_solution()
    optimized_indices = decode_solution(best_keys)
    optimized_metrics = get_route_metrics(optimized_indices, dist, fuel_curve, co2_factor)

    # 2. Get metrics for the ORIGINAL (as-entered) route
    original_indices = customer_ids.tolist()
    standard_metrics = get_route_metrics(original_indices, dist, fuel_curve, co2_factor)
    
    # 3. Return a single object containing both results
    return {
        "standard_metrics": standard_metrics,
        "optimized_metrics": optimized_metrics,
        "best_route_indices": optimized_indices # Keep this for drawing the map
    }