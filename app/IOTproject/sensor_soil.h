#ifndef SENSOR_SOIL_H
#define SENSOR_SOIL_H

// Use readSoilPercent() to read from sen0193
// Soil sensor connected to analog pin A0
#define SOIL_PIN A0

// Initialize the sensor (optional for analog)
void initSoilSensor() {
  pinMode(SOIL_PIN, INPUT);
}

// Read raw analog value (0–4095 on ESP32)
int readSoilRaw() {
  return analogRead(SOIL_PIN);
}

// Convert raw value to estimated moisture % (0–100%)
int readSoilPercent() {
  int raw = readSoilRaw();

  // You can tweak these values based on calibration
  int percent = map(raw, 4095, 1500, 0, 100);
  if (percent > 100) percent = 100;
  if (percent < 0) percent = 0;

  return percent;
}

#endif