import csv
import os

def load_congestion_data():
    """
    Loads congestion data from US_PortCalls.csv.
    Filters for 2023 data and "All ships" category.
    Returns a dictionary mapping country names to median time in port (days).
    """
    congestion_map = {}
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'US_PortCalls.csv')
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                year = row.get('Year', '').strip()
                economy_label = row.get('Economy Label', '').strip()
                median_time = row.get('Median time in port (days)', '').strip()
                commercial_market = row.get('CommercialMarket Label', '').strip()
                
                # Filter for 2023 data and "All ships" category only
                if year == '2023' and economy_label and median_time and commercial_market == 'All ships':
                    try:
                        time_value = float(median_time)
                        # Store the congestion value per country (from 2023 data)
                        congestion_map[economy_label] = time_value
                    except ValueError:
                        continue
        
        print(f"Loaded 2023 congestion data for {len(congestion_map)} economies (All ships)")
        return congestion_map
    
    except Exception as e:
        print(f"Error loading congestion data: {e}")
        return {}

def get_port_congestion_hours(port_country, congestion_data):
    """
    Returns estimated congestion delay in hours for a given port country.
    Converts median days to hours.
    Falls back to "World" data if specific country not found.
    """
    if not congestion_data:
        return 0
    
    median_days = None
    
    # Try exact match first
    if port_country in congestion_data:
        median_days = congestion_data[port_country]
    else:
        # Try partial match (case-insensitive)
        port_country_lower = port_country.lower()
        for country_name, days in congestion_data.items():
            country_name_lower = country_name.lower()
            # Check if either string contains the other
            if port_country_lower in country_name_lower or country_name_lower in port_country_lower:
                median_days = days
                print(f"  Matched '{port_country}' with '{country_name}': {days} days")
                break
    
    # If still no match, use World data as default
    if median_days is None:
        median_days = congestion_data.get('World', 0)
        if median_days:
            print(f"  Using World default for '{port_country}': {median_days} days")
    
    if median_days:
        # Convert days to hours (median time represents avg waiting)
        return round(median_days * 24, 2)
    
    return 0  # Return 0 if no data available at all

def calculate_route_congestion_impact(ports_list, congestion_data):
    """
    Calculates total congestion delay for a route.
    
    Args:
        ports_list: List of port objects with 'country' attribute
        congestion_data: Dictionary from load_congestion_data()
    
    Returns:
        Dictionary with total hours and per-port breakdown
    """
    total_congestion_hours = 0
    port_congestion_details = []
    
    print(f"\n=== Calculating Congestion for {len(ports_list)} ports ===")
    
    for port in ports_list:
        country = port.get('country', 'Unknown')
        port_name = port.get('name', 'Unknown')
        print(f"Port: {port_name} ({country})")
        
        hours = get_port_congestion_hours(country, congestion_data)
        total_congestion_hours += hours
        
        port_congestion_details.append({
            'port_name': port_name,
            'country': country,
            'congestion_hours': hours,
            'congestion_days': round(hours / 24, 2)
        })
        print(f"  Congestion: {hours} hours ({round(hours / 24, 2)} days)\n")
    
    print(f"Total Route Congestion: {round(total_congestion_hours, 2)} hours ({round(total_congestion_hours / 24, 2)} days)")
    print(f"=== End Congestion Calculation ===\n")
    
    return {
        'total_hours': round(total_congestion_hours, 2),
        'total_days': round(total_congestion_hours / 24, 2),
        'port_details': port_congestion_details
    }
