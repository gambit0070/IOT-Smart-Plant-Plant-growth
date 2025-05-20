import React from "react";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";

/**
 * RangeSlider - double slider for min/max values.
 */
export default function RangeSlider({ label, min, max, step, values, onChange }) {
  const [low, high] = values;

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-4">{label}</h3>

      <Slider
        range
        min={min}
        max={max}
        step={step}
        value={values}
        onChange={onChange}
        allowCross={false}
        trackStyle={[{ backgroundColor: "#3b82f6" }]}
        handleStyle={[
          { borderColor: "#3b82f6" },
          { borderColor: "#3b82f6" },
        ]}
        railStyle={{ backgroundColor: "#e5e7eb" }}
      />

      <div className="flex justify-between text-sm mt-2 text-gray-600">
        <span>
          Min&nbsp;<span className="font-medium">{low}</span>
        </span>
        <span>
          Max&nbsp;<span className="font-medium">{high}</span>
        </span>
      </div>
    </div>
  );
}