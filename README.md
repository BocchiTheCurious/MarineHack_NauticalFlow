# NauticalFlow Dashboard

🌐 **Our website is now online!** Visit us at: **https://nauticalflow.fkifyp22.online/**

A modern, responsive maritime navigation dashboard built with Flask (Python), MySQL, Bootstrap 5, and JavaScript, designed for vessel route optimization and environmental impact analysis. 

## 🌟 Features

### Navigation Bar
- **Brand**: NauticalFlow logo with water icon
- **User Profile**: User menu with profile, settings, and logout options
- **Feedback**: Submit feedback and suggestions
- **User Manual**: Access comprehensive user documentation

### Sidebar Menu

#### Main Features
- **Dashboard Overview**: Main dashboard with vessel stats, weather, and quick actions
- **Route Planner**: Plan and optimize navigation routes using advanced TSP algorithms
- **Route Analytics**: Analyze route performance and efficiency
- **Live Data Feed**: Real-time vessel and environmental data
- **Data Visualization**: Interactive charts and analytics for route and vessel performance
- **Port Data Management**: Comprehensive port information and characteristics
- **Vessel Data Management**: Manage cruise ship specifications and fuel consumption data
- **Fuel Types Management**: Configure and manage fuel types and CO2 emission factors
- **AI Chatbot Assistant**: Provides 24/7 automated customer support to answer user questions

#### Support Features
- **Environmental Impact Analysis**: Comprehensive environmental metrics and optimization
- **Route History / Past Voyages**: Historical route data and voyage records
- **Profile Settings**: User profile and account management
- **Feedback System**: Submit and manage user feedback
- **User Manual**: Comprehensive documentation and guides

## 🚀 Getting Started

### Prerequisites
- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **Internet connection**

### Access the Application

1. Open your web browser
2. Navigate to: **https://nauticalflow.fkifyp22.online/**
3. Create an account or sign in with your credentials
4. Start optimizing your maritime routes!

## 📁 File Structure
```
NauticalFlow/
├── index.html                  # Main login/signup page
├── styles.css                  # Global CSS styles and theme support
├── requirements.txt            # Project dependencies list
├── README.md                   # This documentation file
├── LICENSE                     # Project license
├── .gitignore                  # Git ignore rules
├── admin/                      # Admin dashboard pages
│   ├── homepage.html           # Admin main dashboard
│   ├── chart-visualization.html # Data visualization dashboard
│   ├── live-data-feed.html     # Real-time data feed
│   ├── port-data.html          # Port management interface
│   ├── vessel-data.html        # Vessel management interface
│   ├── fuel-types.html         # Fuel types configuration
│   ├── feedback.html           # Feedback management
│   ├── user-manual.html        # User documentation
│   ├── profile.html            # User profile page
│   ├── components/             # Reusable HTML components
│   │   ├── _navbar.html        # Navigation bar component
│   │   └── _sidebar.html       # Sidebar menu component
│   └── js/                     # JavaScript modules
│       ├── optimized-route-planner.js
│       ├── analytics.js
│       ├── live-data-feed.js
│       ├── port-data.js
│       ├── vessel-data.js
│       ├── fuel-types.js
│       ├── feedback.js
│       ├── profile.js
│       ├── user-manual.js
│       └── modules/            # Core JavaScript modules
│           ├── api.js          # API client
│           ├── auth.js         # Authentication
│           ├── layout.js       # Layout management
│           └── utils.js        # Utility functions
├── backend/                    # Flask backend application
│   ├── app.py                  # Main Flask application
│   ├── optimization_solver.py # Route optimization algorithms
│   ├── requirements.txt        # Python dependencies
│   ├── data/                   # Backend data files
│   │   └── southeast_asia_boundaries.geojson
│   └── instance/               # Database files
│       └── nauticalflow.db
├── assets/                     # Static assets
│   └── img/                    # Images and icons
│       ├── loader-icon.svg
│       ├── pilotservice.webp
│       ├── tugboatservice.jpeg
│       └── [other service images...]
└── data/                       # Application data files
    ├── ais_processed.json      # Processed AIS data
    └── result.geojson          # Route results
```

## 🔐 User Credentials

Create an account on the website:
- Visit: **https://nauticalflow.fkifyp22.online/**
- Sign up with a new account or contact the administrator

## 🎯 Usage

### Authentication
1. **Sign Up**: Create a new account with display name, username, and password
2. **Sign In**: Log in with your credentials
3. **JWT Authentication**: Secure token-based authentication for API requests

### Navigation
- Use the **sidebar menu** to navigate between different sections
- Access **Feedback** and **User Manual** from the navigation bar
- The dashboard overview is the default landing page after login

### Route Planning & Optimization
1. **Select Origin Port**: Choose your starting port
2. **Add Destination Ports**: Select multiple ports to visit
3. **Select Vessel**: Choose from available cruise ships in the database
4. **Optimize Route**: The system uses TSP (Traveling Salesman Problem) algorithms to find the most efficient route
5. **View Results**: See optimized route on interactive map with distance and fuel calculations

### Data Visualization
- **Chart Visualization**: Interactive charts showing route analytics
- **Live Data Feed**: Real-time vessel tracking and environmental data
- **Performance Metrics**: View fuel consumption, CO2 emissions, and efficiency ratings

### Port & Vessel Management
- **Port Data**: View and manage comprehensive port information including:
  - Port characteristics (depth, size, facilities)
  - Entrance restrictions
  - Available services (pilot, tugboat, repairs, etc.)
  - Congestion index
- **Vessel Data**: Manage cruise ship specifications including:
  - Technical specifications (tonnage, dimensions, power)
  - Fuel consumption curves
  - Engine types and capabilities
  - Passenger and crew capacity

### Environmental Impact Analysis
- Track fuel consumption and CO2 emissions
- Compare different fuel types and their environmental impact
- View optimization suggestions for reducing environmental footprint
- Analyze route efficiency and sustainability metrics

## 🛠️ Development

### Backend Technologies
- **Flask 3.1.1**: Python web framework
- **MySQL**: Cloud-hosted relational database
- **SQLAlchemy 2.0.42**: ORM for database operations
- **Flask-CORS**: Cross-origin resource sharing
- **python-jose**: JWT token authentication
- **bcrypt**: Password hashing
- **APScheduler 3.10.4**: Background task scheduling
- **searoute**: Maritime route calculation
- **pygad**: Genetic algorithm for optimization
- **numpy**: Numerical computations

### Frontend Technologies
- **Bootstrap 5.3.0**: CSS framework
- **Bootstrap Icons 1.10.0**: Icon library
- **Leaflet 1.9.4**: Interactive maps
- **Chart.js**: Data visualization
- **Toastr**: Notification system
- **Botpress Cloud v3.3**: AI-powered chatbot for customer support
- **Vanilla JavaScript**: Client-side logic

### Key Features Implementation
- **Route Optimization**: Traveling Salesman Problem (TSP) solver with genetic algorithms
- **Real-time Data**: Weather API integration and vessel tracking
- **Authentication**: JWT-based secure authentication
- **Database**: MySQL with comprehensive maritime data models
- **Interactive Maps**: Leaflet with route visualization and port markers
- **AI Chatbot**: Botpress-powered intelligent assistant for 24/7 user support

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Useful Resources
- **Live Website**: https://nauticalflow.fkifyp22.online/
- **User Manual**: Available in-app after login
- **Feedback System**: Submit issues or suggestions through the in-app feedback feature
- **AI Chatbot**: Click the chat bubble icon for instant help

## 🌊 Key Technologies & Algorithms

### Route Optimization
The system implements sophisticated route optimization using:
- **Traveling Salesman Problem (TSP)**: Finding the optimal route through multiple ports
- **Genetic Algorithms (PyGAD)**: Evolutionary optimization for complex route scenarios
- **Searoute Library**: Accurate maritime distance calculation considering shipping lanes
- **Multi-objective Optimization**: Balancing distance, fuel consumption, and time

### Environmental Analysis
- **CO2 Emission Calculation**: Based on IMO guidelines and fuel-specific emission factors
- **Fuel Consumption Modeling**: Considers vessel characteristics, speed, and sea conditions
- **Efficiency Metrics**: Performance indicators for environmental impact assessment

### Data Management
- **MySQL Database**: Cloud-hosted robust relational database for maritime data
- **SQLAlchemy ORM**: Type-safe database operations
- **JSON Storage**: Flexible data structures for complex port and vessel characteristics

## 📝 Contributing
This is an active development project. For contributions:
- Fork the repository
- Create a feature branch
- Implement your changes with proper documentation
- Test thoroughly (backend and frontend)
- Submit a pull request with detailed description

## 📄 License
This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support
For questions, issues, or feedback:
1. Visit our website: **https://nauticalflow.fkifyp22.online/**
2. Use the **Feedback** feature in the application
3. Check the **User Manual** for comprehensive documentation
4. Review the troubleshooting section in this README
5. Check the browser console for error messages
6. Ensure all prerequisites are properly installed

## 📞 Contact
- Website: https://nauticalflow.fkifyp22.online/
- For technical support, use the in-app Feedback system

---

**NauticalFlow** - Optimizing Maritime Navigation for a Sustainable Future 🌊⚓ 