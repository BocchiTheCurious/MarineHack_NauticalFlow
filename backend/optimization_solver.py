# optimization_solver.py

import math
import numpy as np
import pygad

# NOTE: The plotting part (matplotlib) is removed because a server can't open a GUI window.
# We will return the data instead.

def run_route_optimization(coords_list):
    """
    Takes a list of [latitude, longitude] pairs, runs the GA optimization,
    and returns the results as a dictionary.
    """
    # 1. The hardcoded 'coords' is now replaced by the function argument
    coords = np.array(coords_list, dtype=float)

    # --- All of your existing optimization logic goes here ---

    # Ship fuel & emission parameters
    fuel_rate_per_km = 0.25  # liters/km
    emission_factor = 3.206  # kg CO₂ per liter
    customer_ids = np.arange(1, len(coords))

    # Distance matrix (using haversine for real-world distance would be better, but euclid is kept for now)
    def euclid(a, b):
        return math.hypot(a[0] - b[0], a[1] - b[1])

    N = len(coords)
    dist = np.zeros((N, N), dtype=float)
    for i in range(N):
        for j in range(N):
            dist[i, j] = euclid(coords[i], coords[j])

    # Decode GA solution into route order
    def decode_solution(keys):
        order = customer_ids[np.argsort(keys)]
        return order.tolist()

    # Route metrics
    def route_distance(route):
        if not route: return 0.0
        total = dist[0, route[0]]
        for i in range(len(route) - 1):
            total += dist[route[i], route[i+1]]
        total += dist[route[-1], 0]
        return total

    def route_cost(route):
        dist_km = route_distance(route)
        fuel = dist_km * fuel_rate_per_km
        co2 = fuel * emission_factor
        return dist_km, fuel, co2

    # Fitness function
    def fitness_func(ga_instance, solution, solution_idx):
        route = decode_solution(solution)
        _dist, fuel, _co2 = route_cost(route)
        return -fuel

    # GA config
    num_genes = len(customer_ids)
    ga_instance = pygad.GA(
        num_generations=200, sol_per_pop=40, num_parents_mating=20,
        fitness_func=fitness_func, num_genes=num_genes, gene_type=float,
        gene_space={'low': 0.0, 'high': 1.0}, parent_selection_type="tournament",
        K_tournament=3, crossover_type="single_point", mutation_type="random",
        mutation_percent_genes=20
    )

    ga_instance.run()

    # Best result
    best_keys, _, _ = ga_instance.best_solution()
    best_route_indices = decode_solution(best_keys)
    dist_km, fuel, co2 = route_cost(best_route_indices)

    # 2. Package the results into a dictionary to send back as JSON
    result = {
        "best_route_indices": best_route_indices,
        "distance_km": round(dist_km, 2),
        "fuel_liters": round(fuel, 2),
        "co2_kg": round(co2, 2)
    }
    return result