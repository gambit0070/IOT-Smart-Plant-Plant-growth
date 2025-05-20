// src/pages/NotificationSettings.jsx
import React, { useState, useEffect } from "react";
import RangeSlider  from "../components/ui/RangeSlider";
import ToggleSwitch from "../components/ui/ToggleSwitch";

export default function NotificationSettings() {
  const API = process.env.REACT_APP_API_URL;

  const [tempRange, setTempRange]   = useState([10, 35]);
  const [humidRange, setHumidRange] = useState([30, 70]);
  const [pressRange, setPressRange] = useState([980, 1020]);

  const [alerts, setAlerts] = useState({
    cold: true, heat: true,
    dry:  true, humid: true,
    lowPress:  true, highPress: true,
  });
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    fetch(`${API}/notification-settings`)
      .then(res => res.json())
      .then(data => {
        setTempRange([data.min_temp, data.max_temp]);
        setHumidRange([data.min_humid, data.max_humid]);
        setPressRange([data.min_press, data.max_press]);
        setAlerts({
          cold:      Boolean(data.cold_alert),
          heat:      Boolean(data.heat_alert),
          dry:       Boolean(data.dry_alert),
          humid:     Boolean(data.humid_alert),
          lowPress:  Boolean(data.low_press_alert),
          highPress: Boolean(data.high_press_alert),
        });
      })
      .catch(err => console.error("Error fetching notification settings:", err));
  }, [API]);

  const toggle = key => val =>
    setAlerts(s => ({ ...s, [key]: val }));

  const saveSettings = async () => {
    const payload = {
      min_temp:        tempRange[0],
      max_temp:        tempRange[1],
      min_humid:       humidRange[0],
      max_humid:       humidRange[1],
      min_press:       pressRange[0],
      max_press:       pressRange[1],
      cold_alert:      alerts.cold      ? 1 : 0,
      heat_alert:      alerts.heat      ? 1 : 0,
      dry_alert:       alerts.dry       ? 1 : 0,
      humid_alert:     alerts.humid     ? 1 : 0,
      low_press_alert: alerts.lowPress  ? 1 : 0,
      high_press_alert:alerts.highPress ? 1 : 0,
    };

    try {
      const res = await fetch(`${API}/notification-settings`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === "ok") {
        setSaveStatus("Settings saved successfully!");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        throw new Error("Bad response");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setSaveStatus("Error saving settings.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Notification Settings</h1>
      <div className="space-y-8">

        {/* Temperature */}
        <div className="grid grid-cols-[1fr_12rem] gap-6 items-stretch">
          <RangeSlider
            label="Air Temperature (°C)"
            min={0} max={50} step={1}
            values={tempRange}
            onChange={setTempRange}
          />
          <div className="bg-white rounded shadow p-4 flex flex-col justify-between gap-4 h-full">
            <ToggleSwitch
              label="Cold alert"
              checked={alerts.cold}
              onChange={toggle("cold")}
            />
            <ToggleSwitch
              label="Heat alert"
              checked={alerts.heat}
              onChange={toggle("heat")}
            />
          </div>
        </div>

        {/* Humidity */}
        <div className="grid grid-cols-[1fr_12rem] gap-6 items-stretch">
          <RangeSlider
            label="Air Humidity (%)"
            min={0} max={100} step={1}
            values={humidRange}
            onChange={setHumidRange}
          />
          <div className="bg-white rounded shadow p-4 flex flex-col justify-between gap-4 h-full">
            <ToggleSwitch
              label="Dry air alert"
              checked={alerts.dry}
              onChange={toggle("dry")}
            />
            <ToggleSwitch
              label="Humid air alert"
              checked={alerts.humid}
              onChange={toggle("humid")}
            />
          </div>
        </div>

        {/* Pressure */}
        <div className="grid grid-cols-[1fr_12rem] gap-6 items-stretch">
          <RangeSlider
            label="Atmospheric Pressure (hPa)"
            min={930} max={1060} step={1}
            values={pressRange}
            onChange={setPressRange}
          />
          <div className="bg-white rounded shadow p-4 flex flex-col justify-between gap-4 h-full">
            <ToggleSwitch
              label="Low pressure"
              checked={alerts.lowPress}
              onChange={toggle("lowPress")}
            />
            <ToggleSwitch
              label="High pressure"
              checked={alerts.highPress}
              onChange={toggle("highPress")}
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end mt-6">
          {saveStatus && (
            <span className={saveStatus.includes("Error")
              ? "text-red-500" : "text-green-500"
            }>
              {saveStatus}
            </span>
          )}
          <button
            onClick={saveSettings}
            className="ml-4 bg-blue-600 hover:bg-blue-700 text-white
                       font-medium py-2 px-4 rounded transition"
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}