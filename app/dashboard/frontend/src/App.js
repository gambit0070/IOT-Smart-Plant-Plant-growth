import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import Control from "./pages/Control";
import DeviceOperationHistory from "./pages/OpHistory";
import NotificationSettings from "./pages/NotificationSettings";
import useAlerts from "./hooks/useAlerts";  // Using our improved hook

export default function App() {
  // Get alert notification component
  const { AlertNotification } = useAlerts(10000);  // Poll every 10 seconds

  return (
    <Router>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 bg-gray-50 min-h-screen">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/control"    element={<Control />} />
            <Route path="/ophistory"  element={<DeviceOperationHistory />} />
            <Route path="/notifications" element={<NotificationSettings />} />
          </Routes>
        </main>
      </div>
      
      {/* Render alert notifications */}
      <AlertNotification />
    </Router>
  );
}