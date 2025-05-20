import React, { useState, useEffect } from "react";
import { format, parseISO, subDays } from "date-fns";

const API_BASE_URL = "http://127.0.0.1:5050";

// Device names mapping
const DeviceNames = {
  pump: "Water Pump",
  lamp: "Light",
  fan: "Fan"
};

// Status labels
const StatusLabels = {
  1: "ON",
  0: "OFF"
};

// Status colors
const StatusColors = {
  1: "bg-green-100 text-green-800",
  0: "bg-gray-100 text-gray-800"
};

const DeviceOperationHistory = () => {
  // Data and loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [deviceStatuses, setDeviceStatuses] = useState([]);
  const [sensorData, setSensorData] = useState(null);
  
  // Table filters
  const [filters, setFilters] = useState({
    device: "",
    status: "",
    startDate: "",
    endDate: "",
    reason: "",
    duration: ""
  });
  
  const [searchText, setSearchText] = useState("");
  const [tempFilters, setTempFilters] = useState({
    device: "",
    status: "",
    startDate: "",
    endDate: "",
    reason: "",
    duration: ""
  });
  
  // Sort states
  const [sortField, setSortField] = useState("start_time");
  const [sortDirection, setSortDirection] = useState("desc");
  
  // Modal states
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  
  // Initialize date inputs with default values (last 7 days)
  useEffect(() => {
    const end = new Date();
    const start = subDays(end, 7);
    
    setFilters(prev => ({
      ...prev,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd")
    }));
    
    setTempFilters(prev => ({
      ...prev,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd")
    }));
  }, []);

  // Load device history records with filters
  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filters.startDate && filters.endDate) {
        params.append("start_date", `${filters.startDate}T00:00:00`);
        params.append("end_date", `${filters.endDate}T23:59:59`);
      } else {
        // Default to last 7 days if no date range specified
        params.append("days", 7);
      }
      
      if (filters.device) params.append("device", filters.device);
      if (filters.status !== "") params.append("status", filters.status);
      if (filters.reason) params.append("reason", filters.reason);
      if (sortField) {
        params.append("sort", sortField);
        params.append("order", sortDirection);
      }
      
      const url = `${API_BASE_URL}/device-history?${params.toString()}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("📊 History data:", data);
      
      // Apply client-side duration filter if provided
      let filteredData = data;
      if (filters.duration) {
        const [operator, value] = parseDurationFilter(filters.duration);
        const seconds = parseInt(value) * 60; // Convert minutes to seconds
        
        filteredData = data.filter(record => {
          if (!record.duration && operator !== "=") return false;
          
          switch(operator) {
            case ">": return record.duration > seconds;
            case "<": return record.duration < seconds;
            case "=": return record.duration === seconds || (!record.duration && value === "0");
            case ">=": return record.duration >= seconds;
            case "<=": return record.duration <= seconds;
            default: return true;
          }
        });
      }
      
      // Apply local search if text is provided
      if (searchText) {
        const lowerSearch = searchText.toLowerCase();
        filteredData = filteredData.filter(record => {
          return (
            (record.device_name || "").toLowerCase().includes(lowerSearch) ||
            (record.reason || "").toLowerCase().includes(lowerSearch) ||
            formatTime(record.start_time).includes(lowerSearch) ||
            (record.end_time ? formatTime(record.end_time) : "Running").includes(lowerSearch)
          );
        });
      }
      
      setHistory(filteredData);
    } catch (err) {
      console.error("❌ Error fetching history:", err);
      setError(`Failed to load operation history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Parse duration filter input (e.g., ">5", "<10", "=15")
  const parseDurationFilter = (input) => {
    const operators = [">=", "<=", ">", "<", "="];
    let operator = "=";
    let value = input;
    
    for (const op of operators) {
      if (input.startsWith(op)) {
        operator = op;
        value = input.substring(op.length);
        break;
      }
    }
    
    return [operator, value];
  };

  // Load current device statuses
  const fetchDeviceStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/device-status`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch device status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.devices) {
        setDeviceStatuses(data.devices);
      }
      
      if (data.sensors) {
        setSensorData(data.sensors);
      }
    } catch (err) {
      console.error("❌ Error fetching device status:", err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchHistory();
    fetchDeviceStatus();
    
    // Refresh device status every 30 seconds
    const statusInterval = setInterval(fetchDeviceStatus, 30000);
    
    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  // Refresh when filters or sort change
  useEffect(() => {
    fetchHistory();
  }, [filters, sortField, sortDirection, searchText]);

  // Handle column sort
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Apply filters from modal
  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFiltersModal(false);
  };

  // Reset filters
  const resetFilters = () => {
    const end = new Date();
    const start = subDays(end, 7);
    
    const resetValues = {
      device: "",
      status: "",
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      reason: "",
      duration: ""
    };
    
    setTempFilters(resetValues);
    setFilters(resetValues);
    setShowFiltersModal(false);
  };

  // Manual device control
  const handleDeviceControl = async (device, status) => {
    try {
      const response = await fetch(`${API_BASE_URL}/control-device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device,
          status,
          reason: "Manual control from UI"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to control device: ${response.status}`);
      }
      
      // Refresh device status after successful update
      fetchDeviceStatus();
      
      // Short delay before refreshing history
      setTimeout(fetchHistory, 1000);
    } catch (err) {
      console.error(`❌ Error controlling ${device}:`, err);
      alert(`Device control failed: ${err.message}`);
    }
  };

  // Format time display
  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    try {
      return format(parseISO(timeStr), "yyyy-MM-dd HH:mm:ss");
    } catch (e) {
      return timeStr;
    }
  };
  
  // Format date for display
  const formatDate = (timeStr) => {
    if (!timeStr) return "N/A";
    try {
      return format(parseISO(timeStr), "MMM dd, yyyy");
    } catch (e) {
      return timeStr;
    }
  };

  // Format duration display
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return "Running";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = [];
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) result.push(`${remainingSeconds}s`);
    
    return result.join(" ");
  };

  // Get duration in minutes for filtering
  const getDurationMinutes = (seconds) => {
    if (!seconds && seconds !== 0) return "Running";
    return Math.ceil(seconds / 60);
  };

  // Sort indicator component
  const SortIndicator = ({ field }) => {
    if (sortField !== field) return null;
    
    return (
      <span className="ml-1 text-gray-500">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Device Operation History</h1>
      
      {/* Search and Filter Bar */}
      <div className="flex justify-between mb-4">
        <div className="relative flex-1 max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Type to Search ..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        
        <button 
          onClick={() => setShowFiltersModal(true)}
          className="ml-4 flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          FILTER
        </button>
      </div>
      
      
      {/* History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-grey-900 text-black">
                <th 
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort("device")}
                >
                  <div className="flex items-center">
                    Device <SortIndicator field="device" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status <SortIndicator field="status" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort("start_time")}
                >
                  <div className="flex items-center">
                    Start Time <SortIndicator field="start_time" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort("end_time")}
                >
                  <div className="flex items-center">
                    End Time <SortIndicator field="end_time" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort("duration")}
                >
                  <div className="flex items-center">
                    Duration <SortIndicator field="duration" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort("reason")}
                >
                  <div className="flex items-center">
                    Reason <SortIndicator field="reason" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-center text-gray-500">
                    No device operation records found
                  </td>
                </tr>
              ) : (
                history.map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span>{record.device_name || DeviceNames[record.device] || record.device}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${StatusColors[record.status]}`}>
                        {StatusLabels[record.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(record.start_time)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {record.end_time ? formatDate(record.end_time) : "Running"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDuration(record.duration)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {record.reason || "Unknown"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Filter Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Filter Options</h2>
              <button 
                onClick={() => setShowFiltersModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempFilters.startDate}
                  onChange={(e) => setTempFilters({...tempFilters, startDate: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={tempFilters.endDate}
                  onChange={(e) => setTempFilters({...tempFilters, endDate: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              {/* Device Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device
                </label>
                <select
                  value={tempFilters.device}
                  onChange={(e) => setTempFilters({...tempFilters, device: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="">All Devices</option>
                  <option value="pump">Water Pump</option>
                  <option value="lamp">Light</option>
                  <option value="fan">Fan</option>
                </select>
              </div>
              
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={tempFilters.status}
                  onChange={(e) => setTempFilters({...tempFilters, status: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="">All Status</option>
                  <option value="1">ON</option>
                  <option value="0">OFF</option>
                </select>
              </div>
              
              {/* Reason Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={tempFilters.reason}
                  onChange={(e) => setTempFilters({...tempFilters, reason: e.target.value})}
                  placeholder="Filter by reason..."
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              {/* Duration Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="text"
                  value={tempFilters.duration}
                  onChange={(e) => setTempFilters({...tempFilters, duration: e.target.value})}
                  placeholder="e.g. >5, <10, =15"
                  className="w-full p-2 border border-gray-300 rounded"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Use &gt;, &lt;, =, &gt;=, &lt;= operators
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceOperationHistory;