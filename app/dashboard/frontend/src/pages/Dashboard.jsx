import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { 
  Droplets, 
  ThermometerSun, 
  Gauge, 
  Sun, 
  BarChart4, 
  Clock,
  CloudRain,
  Wind,
  Zap,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const API_LATEST = "http://127.0.0.1:5050/latest";
const API_HISTORY = "http://127.0.0.1:5050/history";
const API_STATS = "http://127.0.0.1:5050/stats";

function formatLocalTime(utcString) {
  if (!utcString || utcString === "--") return "--";
  const isoString = utcString.replace(" ", "T") + "Z";
  const date = new Date(isoString);
  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    hour12: false,
  });
}

function formatShortTime(utcString) {
  if (!utcString || utcString === "--") return "--";
  const isoString = utcString.replace(" ", "T") + "Z";
  const date = new Date(isoString);
  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Define gauge component
const GaugeChart = ({ value, min, max, title, unit, color }) => {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="text-lg font-semibold mb-2">{title}</div>
      <div className="relative w-32 h-32">
      <div
          className="absolute w-full h-full rounded-full"
          style={{
            background: `conic-gradient(${color} ${percent}%, #e5e7eb ${percent}%)`,
            boxShadow: `0 0 10px ${color}`,
          }}
        ></div>
        <div className="absolute inset-2 rounded-full bg-white"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-800">{value}{unit}</span>
        </div>
      </div>

      <div className="mt-2 flex justify-between w-full px-4 text-sm text-gray-500">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState({
    timestamp: "--",
    soil: "--",
    temp: "--",
    humidity: "--",
    light: "--",
    pressure: "--",
  });

  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    avg_soil: 0,
    avg_temp: 0,
    avg_humidity: 0,
    avg_light: 0,
    avg_pressure: 0,
    max_temp: 0,
    min_temp: 0,
    max_humidity: 0,
    min_humidity: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(API_LATEST);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("❌ get Flask latest data failed：", error);
      }
    };

    const fetchHistory = async () => {
      try {
        const res = await fetch(API_HISTORY);
        const json = await res.json();
        setHistory(json.reverse()); 
      } catch (error) {
        console.error("❌ get Flask Historical data failed：", error);
      }
    };
    
    const fetchStats = async () => {
      try {
        const res = await fetch(API_STATS);
        const json = await res.json();
        setStats(json);
      } catch (error) {
        console.error("❌ get Flask Stats data failed：", error);
      }
    };

    fetchData();
    fetchHistory();
    fetchStats();
    
    const interval = setInterval(() => {
      fetchData();
      fetchHistory();
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Calculate derived values
  const calculateStatus = () => {
    let status = "Optimal";
    let color = "bg-green-500";
    
    // Simple logic - you can customize this based on your plants' needs
    if (data.soil < 30) {
      status = "Needs Water";
      color = "bg-red-500";
    } else if (data.temp > 35) {
      status = "Too Hot";
      color = "bg-red-500";
    } else if (data.temp < 10) {
      status = "Too Cold";
      color = "bg-blue-500";
    } else if (data.humidity < 40) {
      status = "Low Humidity";
      color = "bg-yellow-500";
    }
    
    return { status, color };
  };
  
  const plantStatus = calculateStatus();

  // Configure doughnut chart data
  const soilMoistureData = {
    labels: ['Moisture', 'Dry'],
    datasets: [
      {
        data: [data.soil, 100 - data.soil],
        backgroundColor: ['rgba(34, 211, 238, 0.8)', 'rgba(226, 232, 240, 0.5)'],
        borderWidth: 0,
        cutout: '75%',
      },
    ],
  };
  
  // Recent temperature chart data
  const recentTempData = {
    labels: history.slice(-12).map((d) => formatShortTime(d.timestamp)),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: history.slice(-12).map((d) => d.temp),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };
  
  // Environmental trends chart
  const environmentalTrendsData = {
    labels: history.slice(-24).map((d) => formatShortTime(d.timestamp)),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: history.slice(-24).map((d) => d.temp),
        borderColor: '#ef4444', // red-500
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        yAxisID: 'y',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Humidity (%)',
        data: history.slice(-24).map((d) => d.humidity),
        borderColor: '#3b82f6', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Pressure (hPa)',
        data: history.slice(-24).map((d) => d.pressure),
        borderColor: '#8b5cf6', // purple-500
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        yAxisID: 'y1',
        tension: 0.4,
        fill: true,
      },
    ],
  };
  
  
  // Light vs Soil chart
  const lightVsSoilData = {
    labels: history.slice(-24).map((d) => formatShortTime(d.timestamp)),
    datasets: [
      {
        label: 'Light',
        data: history.slice(-24).map((d) => d.light),
        borderColor: '#f59e0b', // amber-500
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        yAxisID: 'y',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Soil Moisture (%)',
        data: history.slice(-24).map((d) => d.soil),
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        yAxisID: 'y1',
        tension: 0.4,
        fill: true,
      },
    ],
  };
  
  
  // Daily stats comparison chart
  const dayStatsData = {
    labels: ['Temperature', 'Humidity', 'Soil Moisture'],
    datasets: [
      {
        label: 'Current',
        data: [data.temp, data.humidity, data.soil],
        backgroundColor: ['#ef4444', '#3b82f6', '#10b981'], // red, blue, green
      },
      {
        label: '24h Average',
        data: [stats.avg_temp, stats.avg_humidity, stats.avg_soil],
        backgroundColor: ['rgba(239, 68, 68, 0.3)', 'rgba(59, 130, 246, 0.3)', 'rgba(16, 185, 129, 0.3)'],
      },
    ],
  };
  

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Smart Garden Dashboard</h1>
          <p className="text-sm text-gray-500">
            Last updated: {formatLocalTime(data.timestamp)}
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center">
          <div className={`w-3 h-3 rounded-full ${plantStatus.color} mr-2`}></div>
          <span className="text-sm font-medium">Status: {plantStatus.status}</span>
        </div>
      </header>
      
      {/* Current readings section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="rounded-xl shadow-sm transition-transform duration-300 hover:scale-105 motion-safe:animate-fade-in">
          <CardContent className="pt-6 px-3 pb-3">
            <GaugeChart 
              value={data.soil} 
              min={0} 
              max={100} 
              title="Soil Moisture" 
              unit="%" 
              color="#0ea5e9"
            />
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-6 px-3 pb-3">
            <GaugeChart 
              value={data.temp} 
              min={0} 
              max={50} 
              title="Temperature" 
              unit="°C" 
              color="#ef4444"
            />
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-6 px-3 pb-3">
            <GaugeChart 
              value={data.humidity} 
              min={0} 
              max={100} 
              title="Humidity" 
              unit="%" 
              color="#3b82f6"
            />
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-6 px-3 pb-3">
            <GaugeChart 
              value={data.light} 
              min={0} 
              max={500} 
              title="Light" 
              unit="" 
              color="#f59e0b"
            />
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-sm">
          <CardContent className="pt-6 px-3 pb-3">
            <GaugeChart 
              value={data.pressure} 
              min={1000} 
              max={1050} 
              title="Pressure" 
              unit="hPa" 
              color="#8b5cf6"
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Main dashboard content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Environmental trends */}
          <Card className="rounded-xl shadow-sm md:col-span-2 transition-all duration-500 motion-safe:animate-slide-up hover:scale-[1.01]">
            <CardContent className="p-4">
              <div className="flex items-center mb-4">
                <Wind className="w-5 h-5 text-indigo-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Environmental Trends</h2>
              </div>
              <div className="h-80">
                <Line 
                  data={environmentalTrendsData} 
                  options={{
                    responsive: true,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    plugins: {
                      legend: { position: 'top' },
                      tooltip: {
                        usePointStyle: true,
                      },
                    },
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                          display: true,
                          text: 'Temp (°C) / Humidity (%)'
                        }
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Pressure (hPa)'
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Light vs Soil Moisture */}
          <Card className="rounded-xl shadow-sm md:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center mb-4">
                <Sun className="w-5 h-5 text-amber-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Light vs Soil Moisture</h2>
              </div>
              <div className="h-80">
                <Line 
                  data={lightVsSoilData} 
                  options={{
                    responsive: true,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    plugins: {
                      legend: { position: 'top' },
                      tooltip: {
                        usePointStyle: true,
                      },
                    },
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                          display: true,
                          text: 'Light'
                        }
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Soil Moisture (%)'
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Daily comparison */}
          <Card className="rounded-xl shadow-sm md:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center mb-4">
                <BarChart4 className="w-5 h-5 text-purple-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Daily Comparison</h2>
              </div>
              <div className="h-72">
                <Bar 
                  data={dayStatsData} 
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      }
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column */}
        <div className="grid grid-cols-1 gap-6">
          {/* Quick stats */}
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center mb-4">
                <Zap className="w-5 h-5 text-amber-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Quick Stats</h2>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center">
                    <ThermometerSun className="w-4 h-4 text-red-500 mr-2" />
                    <span className="text-sm text-gray-600">Temperature Range</span>
                  </div>
                  <span className="text-sm font-medium">{stats.min_temp} - {stats.max_temp}°C</span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center">
                    <CloudRain className="w-4 h-4 text-blue-500 mr-2" />
                    <span className="text-sm text-gray-600">Humidity Range</span>
                  </div>
                  <span className="text-sm font-medium">{stats.min_humidity} - {stats.max_humidity}%</span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center">
                    <Droplets className="w-4 h-4 text-cyan-500 mr-2" />
                    <span className="text-sm text-gray-600">Avg Soil Moisture</span>
                  </div>
                  <span className="text-sm font-medium">{stats.avg_soil}%</span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center">
                    <Sun className="w-4 h-4 text-yellow-500 mr-2" />
                    <span className="text-sm text-gray-600">Avg Light Level</span>
                  </div>
                  <span className="text-sm font-medium">{stats.avg_light}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Gauge className="w-4 h-4 text-purple-500 mr-2" />
                    <span className="text-sm text-gray-600">Avg Pressure</span>
                  </div>
                  <span className="text-sm font-medium">{stats.avg_pressure} hPa</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Soil Moisture Doughnut */}
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center mb-4">
                <Droplets className="w-5 h-5 text-blue-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Soil Moisture</h2>
              </div>
              <div className="h-64 flex items-center justify-center">
                <div className="w-48">
                  <Doughnut 
                    data={soilMoistureData} 
                    options={{
                      responsive: true,
                      cutout: '75%',
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          enabled: true,
                        },
                      },
                    }}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-3xl font-bold text-cyan-500">{data.soil}%</p>
                    <p className="text-sm text-gray-500">Current Moisture</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Recent Temperature */}
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center mb-4">
                <Clock className="w-5 h-5 text-gray-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Recent Temperature</h2>
              </div>
              <div className="h-48">
                <Line 
                  data={recentTempData} 
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: false,
                      }
                    },
                    elements: {
                      point: {
                        radius: 2,
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}