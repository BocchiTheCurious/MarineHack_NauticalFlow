# NauticalFlow Dashboard

A modern, responsive maritime navigation dashboard built with Bootstrap 5 and vanilla JavaScript, designed for vessel route optimization and environmental impact analysis.

## 🌟 Features

### Navigation Bar
- **Brand**: NauticalFlow logo with water icon
- **Current Location**: Displays current vessel location with dropdown for location management
- **Notifications**: Real-time alerts and notifications with badge counter
- **User Profile**: User menu with profile, settings, and logout options
- **Theme Toggle**: Switch between light and dark themes

### Sidebar Menu

#### Main Features
- **Dashboard Overview**: Main dashboard with vessel stats, weather, and quick actions
- **Route Planner**: Plan and optimize navigation routes
- **Route Analytics**: Analyze route performance and efficiency
- **Live Data Feed**: Real-time vessel and environmental data

#### Support Features
- **Environmental Impact Analysis**: Comprehensive environmental metrics and optimization
- **Marine Zones & Regulations**: Access to maritime zones and regulatory information
- **Route History / Past Voyages**: Historical route data and voyage records
- **Upload Vessel Data**: Interface for uploading vessel information and data
- **System Settings**: Dashboard configuration and preferences

## 🚀 Getting Started

### Prerequisites
- **WSL (Windows Subsystem for Linux)** - For Windows users
- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **Node.js** (for live-server)
- **Python 3** (alternative server option)

### Installation & Setup

#### Option 1: Using WSL (Recommended for Windows Users)

1. **Install WSL** (if not already installed):
   ```bash
   # Open PowerShell as Administrator and run:
   wsl --install
   ```

2. **Install Node.js in WSL**:
   ```bash
   # Update package list
   sudo apt update
   
   # Install Node.js and npm
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Verify installation
   node --version
   npm --version
   ```

3. **Clone or download the NauticalFlow folder**:
   ```bash
   # Navigate to your desired directory
   cd /home/your-username/
   
   # If using git (optional)
   git clone <repository-url>
   cd NauticalFlow
   ```

4. **Install dependencies**:
   ```bash
   # Install live-server globally
   npm install -g live-server
   
   # Or install from requirements.txt
   npm install -g live-server@1.2.2
   ```

5. **Start the development server**:
   ```bash
   # Navigate to the NauticalFlow directory
   cd /path/to/NauticalFlow
   
   # Start live-server
   live-server --port=8000
   ```

6. **Access the application**:
   - Open your browser and go to: `http://localhost:8000`
   - The dashboard will load with default settings

#### Option 2: Using Python HTTP Server (Alternative)

1. **Navigate to the NauticalFlow folder**:
   ```bash
   cd /path/to/NauticalFlow
   ```

2. **Start Python HTTP server**:
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Or Python 2 (if available)
   python -m SimpleHTTPServer 8000
   ```

3. **Access the application**:
   - Open your browser and go to: `http://localhost:8000`

#### Option 3: Direct Browser Access (Simplest)

1. **Navigate to the NauticalFlow folder**:
   ```bash
   cd /path/to/NauticalFlow
   ```

2. **Open the main file in your browser**:
   - Open your web browser
   - Navigate to: `file:///path/to/NauticalFlow/index.html`
   - Or simply double-click the `index.html` file from your file manager

## 📁 File Structure
```
NauticalFlow/
├── index.html              # Main login page
├── styles.css              # Custom CSS styles and theme support
├── script.js               # Main JavaScript functionality
├── login.js                # Login functionality
├── requirements.txt        # Project dependencies
├── README.md              # This documentation file
├── admin/
│   ├── homepage.html       # Admin dashboard
│   ├── environmental-impact.html
│   └── [other admin files...]
└── user/
    ├── user-dashboard.html # User dashboard
    ├── environmental-impact.html
    ├── reroute.html        # Route optimization
    ├── past-trips.html     # Trip history
    └── [other user files...]
```

## 🔐 Demo Credentials

Use these credentials to test the application:
- **Admin**: `admin` / `admin123`
- **User**: `user` / `user123`

## 🎯 Usage

### Navigation
- Click on sidebar menu items to navigate between different sections
- Use the top navigation bar for quick access to location, notifications, and user settings
- The dashboard overview is the default landing page

### Theme Switching
- Click the theme toggle button (moon/sun icon) in the top navigation bar
- Theme preference is saved in localStorage and persists between sessions
- Supports both light and dark themes

### Environmental Impact Analysis
- Access comprehensive environmental metrics and optimization suggestions
- View fuel consumption, CO₂ emissions, and efficiency ratings
- Compare performance with fleet averages and industry standards

### Route Optimization
- Plan and optimize navigation routes
- Compare different route options with fuel and time savings
- Access weather routing and safety recommendations

## 🛠️ Development

### Dependencies
This project uses CDN for external libraries:
- **Bootstrap 5.3.0**: CSS framework
- **Bootstrap Icons 1.10.0**: Icon library
- **Live Server**: Development server

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔧 Troubleshooting

### WSL Issues
- **Port Access**: If you can't access localhost:8000, try using `0.0.0.0:8000` instead
- **File Permissions**: Ensure you have read permissions for all files
- **Node.js Installation**: If npm commands fail, try reinstalling Node.js

### Browser Issues
- **CORS Errors**: Use a local server (live-server or Python) instead of direct file access
- **JavaScript Errors**: Check browser console for any script loading issues
- **Theme Issues**: Clear browser cache if theme switching doesn't work

### Common Commands
```bash
# Check if live-server is installed
which live-server

# Install live-server if missing
npm install -g live-server

# Start server on specific port
live-server --port=8000

# Start server with specific host
live-server --host=0.0.0.0 --port=8000
```

## 🚀 Future Enhancements
- Integration with real GPS and navigation APIs
- Live map integration (Google Maps, OpenSeaMap, etc.)
- Real-time weather API integration
- Vessel tracking and AIS data
- Route optimization algorithms
- User authentication system
- Database integration for persistent data

## 📝 Contributing
This is a frontend-only demonstration. For production use, consider:
- Adding backend API integration
- Implementing real-time data feeds
- Adding user authentication
- Integrating with maritime databases
- Adding offline capabilities

## 📄 License
This project is for demonstration purposes. Feel free to use and modify as needed.

## 🆘 Support
For questions or issues:
1. Check the troubleshooting section above
2. Verify all dependencies are installed correctly
3. Ensure you're using a supported browser
4. Check the browser console for error messages 