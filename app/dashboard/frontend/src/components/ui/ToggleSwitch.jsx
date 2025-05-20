import React from "react";

/**
 * ToggleSwitch
 *  • label     - left side label
 *  • checked   - bool
 *  • onChange  - (bool) => void
 */

export default function ToggleSwitch({ label, checked, onChange }) {
  return (
    <div className="flex justify-between items-center w-full">
      <span className="text-sm text-gray-700 select-none">{label}</span>

      <label className="relative inline-block w-10 h-6 cursor-pointer">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {/* track */}
        <span
          className="block w-full h-full rounded-full
                     bg-gray-400 peer-checked:bg-blue-500
                     transition-colors"
        />
        {/* slider */}
        <span
          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white
                     transition-transform
                     peer-checked:translate-x-4"
        />
      </label>
    </div>
  );
}