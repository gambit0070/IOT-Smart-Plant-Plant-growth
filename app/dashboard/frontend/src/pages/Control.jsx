import { useState, useEffect } from "react";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";

const BLYNK_CONTROL_API = "http://127.0.0.1:5050/set-smart-param";
const SETTINGS_API = "http://127.0.0.1:5050/current-settings";
const DEVICE_STATUS_API = "http://127.0.0.1:5050/device-status";
const CONTROL_DEVICE_API = "http://127.0.0.1:5050/control-device";

const Control = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [smartEnabled, setSmartEnabled] = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState([]);
  
  // Individual smart controls
  const [deviceSmartControls, setDeviceSmartControls] = useState({
    pump: false,
    lamp: false,
    fan: false
  });

  // defaults
  const [thresholds, setThresholds] = useState({
    pump: [40, 60],      // 
    lamp: [300, 500],    // 
    fan_interval: 10,    // 
    fan_duration: 5      // 
  });
  
  // load current
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("📡 Fetching current settings...");
        const response = await fetch(SETTINGS_API);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("📥 Received settings:", data);
        
        // update state
        setSmartEnabled(data.V8 === 1);
        
        // Update individual smart controls
        setDeviceSmartControls({
          pump: data.V26 === 1,
          lamp: data.V27 === 1,
          fan: data.V28 === 1
        });
        
        setThresholds({
          pump: [data.V20, data.V23],
          lamp: [data.V22, data.V24],
          fan_interval: data.V21,
          fan_duration: data.V25
        });
        
        console.log("✅ Settings applied successfully");
      } catch (err) {
        console.error("❌ Error fetching settings:", err);
        setError("Failed to load settings. Using defaults.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
    
    // Also fetch device statuses
    fetchDeviceStatus();
    
    // Set up polling for device status updates
    const intervalId = setInterval(fetchDeviceStatus, 10000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Fetch device statuses
  const fetchDeviceStatus = async () => {
    try {
      const response = await fetch(DEVICE_STATUS_API);
      
      if (!response.ok) {
        console.error("Failed to fetch device status");
        return;
      }
      
      const data = await response.json();
      
      if (data.devices) {
        setDeviceStatuses(data.devices);
      }
    } catch (err) {
      console.error("❌ Error fetching device status:", err);
    }
  };
  
  const sendToBackend = (pin, value) => {
    console.log(`📤 Sending to backend: pin=${pin}, value=${value}`);
    fetch(BLYNK_CONTROL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, value }),
    })
    .then(response => {
      console.log(`✅ Backend response status:`, response.status);
      return response.json();
    })
    .then(data => {
      console.log(`📥 Backend response data:`, data);
    })
    .catch((err) => {
      console.error(`❌ Failed to set ${pin}:`, err);
    });
  };
  
  const toggleSmartControl = () => {
    const newState = !smartEnabled;
    setSmartEnabled(newState);
    sendToBackend("V8", newState ? 1 : 0);
  };
  
  const toggleDeviceSmartControl = (device, pin) => {
    const newState = !deviceSmartControls[device];
    setDeviceSmartControls(prev => ({
      ...prev,
      [device]: newState
    }));
    sendToBackend(pin, newState ? 1 : 0);
  };
  
  const handleDualSliderChange = (key, pins) => (vals) => {
    setThresholds((prev) => ({ ...prev, [key]: vals }));
    sendToBackend(pins[0], vals[0]); // on thresh
    sendToBackend(pins[1], vals[1]); // off thresh
  };
  
  const handleFanIntervalChange = (e) => {
    const value = Number(e.target.value);
    if (isNaN(value) || value < 1) return;
    
    setThresholds((prev) => ({ ...prev, fan_interval: value }));
    sendToBackend("V21", value);
  };
  
  const handleFanDurationChange = (e) => {
    const value = Number(e.target.value);
    if (isNaN(value) || value < 1) return;
    
    setThresholds((prev) => ({ ...prev, fan_duration: value }));
    sendToBackend("V25", value);
  };
  
  // Manual device control
  const toggleDevice = (device, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    
    fetch(CONTROL_DEVICE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        device, 
        status: newStatus,
        reason: "Manual toggle from UI"
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to control device: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Device control success:", data);
      // Update local state
      setDeviceStatuses(prev => 
        prev.map(d => d.device === device ? {...d, status: newStatus} : d)
      );
    })
    .catch(err => {
      console.error("Failed to control device:", err);
    });
  };
  
  // Get device status
  const getDeviceStatus = (deviceId) => {
    const device = deviceStatuses.find(d => d.device === deviceId);
    return device ? device.status : 0; // Default to OFF
  };
  
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {/* Manual Device Controls */}
      <div className="bg-white shadow p-4 rounded space-y-4">
        <h2 className="text-lg font-semibold">Manual Device Control</h2>
        
        {/* Water Pump */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Water Pump</h3>
          <button
            onClick={() => toggleDevice("pump", getDeviceStatus("pump"))}
            className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
              getDeviceStatus("pump") === 1 ? "bg-blue-500" : "bg-gray-400"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
                getDeviceStatus("pump") === 1 ? "translate-x-6" : ""
              }`}
            ></div>
          </button>
        </div>
        
        {/* Grow Light */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Light</h3>
          <button
            onClick={() => toggleDevice("lamp", getDeviceStatus("lamp"))}
            className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
              getDeviceStatus("lamp") === 1 ? "bg-blue-500" : "bg-gray-400"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
                getDeviceStatus("lamp") === 1 ? "translate-x-6" : ""
              }`}
            ></div>
          </button>
        </div>
        
        {/* Ventilation Fan */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Fan</h3>
          <button
            onClick={() => toggleDevice("fan", getDeviceStatus("fan"))}
            className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
              getDeviceStatus("fan") === 1 ? "bg-blue-500" : "bg-gray-400"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
                getDeviceStatus("fan") === 1 ? "translate-x-6" : ""
              }`}
            ></div>
          </button>
        </div>
      </div>
      
      {/* Smart Control Toggle */}
      <div className="bg-white shadow p-4 rounded flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enable Smart Control</h2>
        <button
          onClick={toggleSmartControl}
          className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
            smartEnabled ? "bg-blue-500" : "bg-gray-400"
          }`}
        >
          <div
            className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
              smartEnabled ? "translate-x-6" : ""
            }`}
          ></div>
        </button>
      </div>
      
      {/* Individual Smart Control Toggles */}
      {smartEnabled && (
        <div className="bg-white shadow p-4 rounded space-y-4">
          <h2 className="text-lg font-semibold">Device Smart Control Settings</h2>
          
          {/* Smart Water Pump Toggle */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Smart Pump Control</h3>
            <button
              onClick={() => toggleDeviceSmartControl("pump", "V26")}
              className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
                deviceSmartControls.pump ? "bg-blue-500" : "bg-gray-400"
              }`}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
                  deviceSmartControls.pump ? "translate-x-6" : ""
                }`}
              ></div>
            </button>
          </div>
          
          {/* Smart Light Toggle */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Smart Light Control</h3>
            <button
              onClick={() => toggleDeviceSmartControl("lamp", "V27")}
              className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
                deviceSmartControls.lamp ? "bg-blue-500" : "bg-gray-400"
              }`}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
                  deviceSmartControls.lamp ? "translate-x-6" : ""
                }`}
              ></div>
            </button>
          </div>
          
          {/* Smart Fan Toggle */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Smart Fan Control</h3>
            <button
              onClick={() => toggleDeviceSmartControl("fan", "V28")}
              className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
                deviceSmartControls.fan ? "bg-blue-500" : "bg-gray-400"
              }`}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
                  deviceSmartControls.fan ? "translate-x-6" : ""
                }`}
              ></div>
            </button>
          </div>
        </div>
      )}
      
      {/* Smart Control Settings */}
      {smartEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* pump settings - only show if smart pump is enabled */}
          {deviceSmartControls.pump && (
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-4">Pump Moisture Settings</h3>
              <Slider
                range
                min={0}
                max={100}
                step={1}
                value={thresholds.pump}
                onChange={handleDualSliderChange("pump", ["V20", "V23"])}
              />
              <div className="flex justify-between text-sm mt-2 text-gray-600">
                <span>Turn ON if soil &lt; {thresholds.pump[0]}</span>
                <span>Turn OFF if soil &gt; {thresholds.pump[1]}</span>
              </div>
            </div>
          )}
          
          {/* lamp settings - only show if smart lamp is enabled */}
          {deviceSmartControls.lamp && (
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-4">Lamp Light Settings</h3>
              <Slider
                range
                min={0}
                max={500}
                step={10}
                value={thresholds.lamp}
                onChange={handleDualSliderChange("lamp", ["V22", "V24"])}
              />
              <div className="flex justify-between text-sm mt-2 text-gray-600">
                <span>Turn ON if light &lt; {thresholds.lamp[0]}</span>
                <span>Turn OFF if light &gt; {thresholds.lamp[1]}</span>
              </div>
            </div>
          )}
          
          {/* fan settings - only show if smart fan is enabled */}
          {deviceSmartControls.fan && (
            <div className="bg-white p-4 rounded shadow md:col-span-2">
              <h3 className="font-semibold mb-4">🌬 Fan Control Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Run fan every (seconds):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={thresholds.fan_interval}
                    onChange={handleFanIntervalChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Fan duration (seconds):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={thresholds.fan_duration}
                    onChange={handleFanDurationChange}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Control;


// import { useState, useEffect } from "react";
// import Slider from "rc-slider";
// import "rc-slider/assets/index.css";

// const BLYNK_CONTROL_API = "http://127.0.0.1:5050/set-smart-param";
// const SETTINGS_API = "http://127.0.0.1:5050/current-settings";
// const DEVICE_STATUS_API = "http://127.0.0.1:5050/device-status";
// const CONTROL_DEVICE_API = "http://127.0.0.1:5050/control-device";

// const Control = () => {
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [smartEnabled, setSmartEnabled] = useState(false);
//   const [deviceStatuses, setDeviceStatuses] = useState([]);
  

//   // defaults
//   const [thresholds, setThresholds] = useState({
//     pump: [40, 60],      // 
//     lamp: [300, 500],    // 
//     fan_interval: 10,    // 
//     fan_duration: 5      // 
//   });
  
//   // load current
//   useEffect(() => {
//     const fetchSettings = async () => {
//       try {
//         setLoading(true);
//         setError(null);
        
//         console.log("📡 Fetching current settings...");
//         const response = await fetch(SETTINGS_API);
        
//         if (!response.ok) {
//           throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
//         }
        
//         const data = await response.json();
//         console.log("📥 Received settings:", data);
        
//         // 更新状态
//         setSmartEnabled(data.V8 === 1);
        
//         setThresholds({
//           pump: [data.V20, data.V23],
//           lamp: [data.V22, data.V24],
//           fan_interval: data.V21,
//           fan_duration: data.V25
//         });
        
//         console.log("✅ Settings applied successfully");
//       } catch (err) {
//         console.error("❌ Error fetching settings:", err);
//         setError("Failed to load settings. Using defaults.");
//       } finally {
//         setLoading(false);
//       }
//     };
    
//     fetchSettings();
    
//     // Also fetch device statuses
//     fetchDeviceStatus();
    
//     // Set up polling for device status updates
//     const intervalId = setInterval(fetchDeviceStatus, 10000);
    
//     // Clean up on unmount
//     return () => clearInterval(intervalId);
//   }, []);
  
//   // Fetch device statuses
//   const fetchDeviceStatus = async () => {
//     try {
//       const response = await fetch(DEVICE_STATUS_API);
      
//       if (!response.ok) {
//         console.error("Failed to fetch device status");
//         return;
//       }
      
//       const data = await response.json();
      
//       if (data.devices) {
//         setDeviceStatuses(data.devices);
//       }
//     } catch (err) {
//       console.error("❌ Error fetching device status:", err);
//     }
//   };
  
//   const sendToBackend = (pin, value) => {
//     console.log(`📤 Sending to backend: pin=${pin}, value=${value}`);
//     fetch(BLYNK_CONTROL_API, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ pin, value }),
//     })
//     .then(response => {
//       console.log(`✅ Backend response status:`, response.status);
//       return response.json();
//     })
//     .then(data => {
//       console.log(`📥 Backend response data:`, data);
//     })
//     .catch((err) => {
//       console.error(`❌ Failed to set ${pin}:`, err);
//     });
//   };
  
//   const toggleSmartControl = () => {
//     const newState = !smartEnabled;
//     setSmartEnabled(newState);
//     sendToBackend("V8", newState ? 1 : 0);
//   };
  
//   const handleDualSliderChange = (key, pins) => (vals) => {
//     setThresholds((prev) => ({ ...prev, [key]: vals }));
//     sendToBackend(pins[0], vals[0]); // o thresh
//     sendToBackend(pins[1], vals[1]); // off thresh
//   };
  
//   const handleFanIntervalChange = (e) => {
//     const value = Number(e.target.value);
//     if (isNaN(value) || value < 1) return;
    
//     setThresholds((prev) => ({ ...prev, fan_interval: value }));
//     sendToBackend("V21", value);
//   };
  
//   const handleFanDurationChange = (e) => {
//     const value = Number(e.target.value);
//     if (isNaN(value) || value < 1) return;
    
//     setThresholds((prev) => ({ ...prev, fan_duration: value }));
//     sendToBackend("V25", value);
//   };
  
//   // Manual device control
//   const toggleDevice = (device, currentStatus) => {
//     const newStatus = currentStatus === 1 ? 0 : 1;
    
//     fetch(CONTROL_DEVICE_API, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ 
//         device, 
//         status: newStatus,
//         reason: "Manual toggle from UI"
//       }),
//     })
//     .then(response => {
//       if (!response.ok) {
//         throw new Error(`Failed to control device: ${response.status}`);
//       }
//       return response.json();
//     })
//     .then(data => {
//       console.log("Device control success:", data);
//       // Update local state
//       setDeviceStatuses(prev => 
//         prev.map(d => d.device === device ? {...d, status: newStatus} : d)
//       );
//     })
//     .catch(err => {
//       console.error("Failed to control device:", err);
//     });
//   };
  
//   // Get device status
//   const getDeviceStatus = (deviceId) => {
//     const device = deviceStatuses.find(d => d.device === deviceId);
//     return device ? device.status : 0; // Default to OFF
//   };
  
//   if (loading) {
//     return (
//       <div className="p-6 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
//           <p className="mt-2 text-gray-600">Loading settings...</p>
//         </div>
//       </div>
//     );
//   }
  
//   return (
//     <div className="p-6 space-y-8">
//       {error && (
//         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
//           <span className="block sm:inline">{error}</span>
//         </div>
//       )}
      
//       {/* Manual Device Controls */}
//       <div className="bg-white shadow p-4 rounded space-y-4">
//         <h2 className="text-lg font-semibold">Manual Device Control</h2>
        
//         {/* Water Pump */}
//         <div className="flex items-center justify-between">
//           <h3 className="font-semibold">Water Pump</h3>
//           <button
//             onClick={() => toggleDevice("pump", getDeviceStatus("pump"))}
//             className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
//               getDeviceStatus("pump") === 1 ? "bg-blue-500" : "bg-gray-400"
//             }`}
//           >
//             <div
//               className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
//                 getDeviceStatus("pump") === 1 ? "translate-x-6" : ""
//               }`}
//             ></div>
//           </button>
//         </div>
        
//         {/* Grow Light */}
//         <div className="flex items-center justify-between">
//           <h3 className="font-semibold">Light</h3>
//           <button
//             onClick={() => toggleDevice("lamp", getDeviceStatus("lamp"))}
//             className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
//               getDeviceStatus("lamp") === 1 ? "bg-blue-500" : "bg-gray-400"
//             }`}
//           >
//             <div
//               className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
//                 getDeviceStatus("lamp") === 1 ? "translate-x-6" : ""
//               }`}
//             ></div>
//           </button>
//         </div>
        
//         {/* Ventilation Fan */}
//         <div className="flex items-center justify-between">
//           <h3 className="font-semibold">Fan</h3>
//           <button
//             onClick={() => toggleDevice("fan", getDeviceStatus("fan"))}
//             className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
//               getDeviceStatus("fan") === 1 ? "bg-blue-500" : "bg-gray-400"
//             }`}
//           >
//             <div
//               className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
//                 getDeviceStatus("fan") === 1 ? "translate-x-6" : ""
//               }`}
//             ></div>
//           </button>
//         </div>
//       </div>
      
//       {/* Smart Control Toggle */}
//       <div className="bg-white shadow p-4 rounded flex items-center justify-between">
//         <h2 className="text-lg font-semibold">Enable Smart Control</h2>
//         <button
//           onClick={toggleSmartControl}
//           className={`w-14 h-8 flex items-center rounded-full px-1 transition ${
//             smartEnabled ? "bg-blue-500" : "bg-gray-400"
//           }`}
//         >
//           <div
//             className={`bg-white w-6 h-6 rounded-full shadow transform transition-transform duration-300 ${
//               smartEnabled ? "translate-x-6" : ""
//             }`}
//           ></div>
//         </button>
//       </div>
      
//       {/* Smart Control Settings */}
//       {smartEnabled && (
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {/* pump settings */}
//           <div className="bg-white p-4 rounded shadow">
//             <h3 className="font-semibold mb-4">Pump Moisture Settings</h3>
//             <Slider
//               range
//               min={0}
//               max={100}
//               step={1}
//               value={thresholds.pump}
//               onChange={handleDualSliderChange("pump", ["V20", "V23"])}
//             />
//             <div className="flex justify-between text-sm mt-2 text-gray-600">
//               <span>Turn ON if soil &lt; {thresholds.pump[0]}</span>
//               <span>Turn OFF if soil &gt; {thresholds.pump[1]}</span>
//             </div>
//           </div>
          
//           {/* lamp settings */}
//           <div className="bg-white p-4 rounded shadow">
//             <h3 className="font-semibold mb-4">Lamp Light Settings</h3>
//             <Slider
//               range
//               min={0}
//               max={1000}
//               step={10}
//               value={thresholds.lamp}
//               onChange={handleDualSliderChange("lamp", ["V22", "V24"])}
//             />
//             <div className="flex justify-between text-sm mt-2 text-gray-600">
//               <span>Turn ON if light &lt; {thresholds.lamp[0]}</span>
//               <span>Turn OFF if light &gt; {thresholds.lamp[1]}</span>
//             </div>
//           </div>
          
//           {/* fan settings*/}
//           <div className="bg-white p-4 rounded shadow md:col-span-2">
//             <h3 className="font-semibold mb-4">🌬 Fan Control Settings</h3>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-sm text-gray-600 mb-2">
//                   Run fan every (minutes):
//                 </label>
//                 <input
//                   type="number"
//                   min="1"
//                   max="60"
//                   value={thresholds.fan_interval}
//                   onChange={handleFanIntervalChange}
//                   className="w-full p-2 border border-gray-300 rounded"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm text-gray-600 mb-2">
//                   Fan duration (minutes):
//                 </label>
//                 <input
//                   type="number"
//                   min="1"
//                   max="30"
//                   value={thresholds.fan_duration}
//                   onChange={handleFanDurationChange}
//                   className="w-full p-2 border border-gray-300 rounded"
//                 />
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Control;