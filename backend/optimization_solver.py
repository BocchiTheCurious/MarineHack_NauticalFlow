import math
import numpy as np
import pygad
import heapq
from decimal import Decimal

# --- Waypoint Graph Navigation System (ASEAN Focus) ---

# Define key navigational waypoints within the ASEAN region.
waypoints = {
    # Strait of Malacca
    'malacca_strait_west': (5.8, 98.5),
    'malacca_strait_east': (1.2, 104.0),
    # Core South China Sea
    'south_china_sea_south': (6.0, 108.0),
    'south_china_sea_central': (10.0, 112.0),
    # Passages around Borneo & Indonesia
    'karimata_strait': (-2.5, 109.0),
    'java_sea': (-5.5, 112.0),
    'sunda_strait': (-6.0, 105.5),
    'makassar_strait_south': (-4.5, 117.5),
    'makassar_strait_north': (1.0, 119.5),
    # Philippines Area
    'sulu_sea': (8.0, 120.0),
    'celebes_sea': (4.0, 123.0),
    # Gulf of Thailand
    'gulf_of_thailand': (10.5, 101.5)
}

# Create a mapping from waypoint name to an integer index and vice-versa
waypoint_names = list(waypoints.keys())
waypoint_coords = np.array(list(waypoints.values()))
name_to_idx = {name: i for i, name in enumerate(waypoint_names)}

# Define the connections (edges) for the ASEAN "sea highway".
graph_edges = [
    ('malacca_strait_west', 'gulf_of_thailand'),
    ('malacca_strait_west', 'malacca_strait_east'),
    ('malacca_strait_east', 'south_china_sea_south'),
    ('malacca_strait_east', 'karimata_strait'),
    ('malacca_strait_east', 'sunda_strait'),
    ('sunda_strait', 'java_sea'),
    ('java_sea', 'karimata_strait'),
    ('java_sea', 'makassar_strait_south'),
    ('karimata_strait', 'south_china_sea_south'),
    ('south_china_sea_south', 'south_china_sea_central'),
    ('south_china_sea_central', 'gulf_of_thailand'),
    ('south_china_sea_central', 'sulu_sea'),
    ('makassar_strait_south', 'makassar_strait_north'),
    ('makassar_strait_north', 'celebes_sea'),
    ('makassar_strait_north', 'sulu_sea'),
    ('sulu_sea', 'celebes_sea')
]

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

# --- A* for Graph Navigation (Robust Implementation) ---

def astar_path(start_node, end_node, graph, all_coords):
    """
    A more robust A* implementation to find the shortest path in a graph.
    'graph' is an adjacency list. 'all_coords' contains coordinates for all nodes.
    Nodes can be integer indices (waypoints) or strings (ports).
    """
    open_list = [(0, start_node, [])]  # (f_cost, current_node, path)
    g_costs = {start_node: 0}
    
    while open_list:
        f_cost, current_node, path = heapq.heappop(open_list)
        path = path + [current_node]

        if current_node == end_node:
            # Reconstruct final path coordinates
            final_path_coords = [all_coords[node] for node in path]
            return g_costs[end_node], final_path_coords

        neighbors = graph.get(current_node, [])
        for neighbor in neighbors:
            # Calculate cost to move from current to neighbor
            start_coords = all_coords[current_node]
            neighbor_coords = all_coords[neighbor]
            move_cost = haversine_distance(start_coords[0], start_coords[1], neighbor_coords[0], neighbor_coords[1])
            
            new_g_cost = g_costs.get(current_node, float('inf')) + move_cost

            if neighbor not in g_costs or new_g_cost < g_costs[neighbor]:
                g_costs[neighbor] = new_g_cost
                end_coords = all_coords[end_node]
                h_cost = haversine_distance(neighbor_coords[0], neighbor_coords[1], end_coords[0], end_coords[1])
                new_f_cost = new_g_cost + h_cost
                heapq.heappush(open_list, (new_f_cost, neighbor, path))

    return float('inf'), [] # No path found

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
        "distance_km": round(total_distance, 2), "fuel_liters": round(fuel_liters, 2),
        "co2_kg": round(co2_kg, 2), "travel_time_hours": round(travel_time_hours, 2)
    }

def run_route_optimization(coords_list, fuel_curve, co2_factor):
    port_coords = np.array(coords_list, dtype=float)
    customer_ids = np.arange(1, len(port_coords))

    # --- Build STATIC Adjacency List for the main waypoint graph ---
    main_graph = {}
    for start_name, end_name in graph_edges:
        start_idx, end_idx = name_to_idx[start_name], name_to_idx[end_name]
        main_graph.setdefault(start_idx, []).append(end_idx)
        main_graph.setdefault(end_idx, []).append(start_idx)

    # --- Pre-calculate Distance and Geometry Matrix ---
    N = len(port_coords)
    dist = np.zeros((N, N), dtype=float)
    geom_cache = {}

    for i in range(N):
        for j in range(i + 1, N):
            start_port_coords = tuple(port_coords[i])
            end_port_coords = tuple(port_coords[j])

            # If ports are very close, use a direct line and skip complex graphing
            direct_dist = haversine_distance(start_port_coords[0], start_port_coords[1], end_port_coords[0], end_port_coords[1])
            if direct_dist < 250:
                dist[i, j] = dist[j, i] = direct_dist
                geom_cache[(i, j)] = geom_cache[(j, i)] = [start_port_coords, end_port_coords]
                continue

            # --- DYNAMIC GRAPH CONSTRUCTION ---
            temp_graph = {node: list(neighbors) for node, neighbors in main_graph.items()}
            all_coords = {idx: tuple(coord) for idx, coord in enumerate(waypoint_coords)}
            all_coords['start_port'] = start_port_coords
            all_coords['end_port'] = end_port_coords

            start_port_dists = sorted([(haversine_distance(start_port_coords[0], start_port_coords[1], wc[0], wc[1]), idx) for idx, wc in enumerate(waypoint_coords)])
            temp_graph['start_port'] = [idx for dist, idx in start_port_dists[:3]]

            end_port_dists = sorted([(haversine_distance(end_port_coords[0], end_port_coords[1], wc[0], wc[1]), idx) for idx, wc in enumerate(waypoint_coords)])
            # CORRECTED: Create two-way connections for the end port
            end_port_on_ramps = [idx for dist, idx in end_port_dists[:3]]
            temp_graph['end_port'] = end_port_on_ramps
            for ramp_idx in end_port_on_ramps:
                temp_graph.setdefault(ramp_idx, []).append('end_port')
            
            # --- Run A* on the dynamic graph ---
            total_dist, full_path_coords = astar_path('start_port', 'end_port', temp_graph, all_coords)
            
            # Add a fallback in case A* still fails
            if total_dist == float('inf'):
                print(f"Warning: A* failed for ports {i}-{j}. Falling back to direct line.")
                total_dist = direct_dist
                full_path_coords = [start_port_coords, end_port_coords]

            dist[i, j] = dist[j, i] = total_dist
            geom_cache[(i, j)] = geom_cache[(j, i)] = full_path_coords

    # --- Genetic Algorithm ---
    def fitness_func(ga_instance, solution, solution_idx):
        route_indices = customer_ids[np.argsort(solution)].tolist()
        metrics = get_route_metrics(route_indices, dist, fuel_curve, co2_factor)
        return 1.0 / (metrics["fuel_liters"] + 1e-6)

    ga_instance = pygad.GA(
        num_generations=200, sol_per_pop=50, num_parents_mating=25,
        fitness_func=fitness_func, num_genes=len(customer_ids), gene_type=float,
        gene_space={'low': 0.0, 'high': 1.0}, parent_selection_type="tournament",
        K_tournament=3, crossover_type="single_point", mutation_type="random",
        mutation_percent_genes=20
    )
    ga_instance.run()

    # --- Process and Return Results ---
    best_keys, _, _ = ga_instance.best_solution()
    optimized_indices = customer_ids[np.argsort(best_keys)].tolist()
    optimized_metrics = get_route_metrics(optimized_indices, dist, fuel_curve, co2_factor)
    
    original_indices = customer_ids.tolist()
    standard_metrics = get_route_metrics(original_indices, dist, fuel_curve, co2_factor)
    
    final_route_geometry = []
    full_optimized_path_indices = [0] + optimized_indices
    for i in range(len(full_optimized_path_indices) - 1):
        start_node_idx, end_node_idx = full_optimized_path_indices[i], full_optimized_path_indices[i+1]
        
        # Ensure the key for the cache is always in sorted order (min_idx, max_idx)
        # This was a potential source of error if not handled carefully
        cache_key = tuple(sorted((start_node_idx, end_node_idx)))
        segment_geometry = geom_cache.get(cache_key, [])
        
        # If the route is backwards, reverse the geometry segment
        if start_node_idx > end_node_idx and segment_geometry:
            segment_geometry = segment_geometry[::-1]

        final_route_geometry.extend(segment_geometry if not final_route_geometry else segment_geometry[1:])

    return {
        "standard_metrics": standard_metrics,
        "optimized_metrics": optimized_metrics,
        "best_route_indices": optimized_indices,
        "route_geometry": final_route_geometry
    }

