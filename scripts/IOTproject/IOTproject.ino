#include "wifi_http_client.h"
#include "sensor_bme280.h"
#include "sensor_soil.h"

void setup() {
  Serial.begin(115200);
  connectToWiFi();

  // Initialize sensors
  if (!initBME280()) {
    Serial.println("❌ BME280 init failed.");
    while (1); // Stop if sensor not found
  }

  initSoilSensor();
}

void loop() {
  // Get live sensor data
  float temp = readTemperatureC();
  float hum = readHumidity();
  float press = readPressure();
  int soil = readSoilPercent();

  // Send data
  sendSensorData(temp, hum, press, soil);
  delay(5000);  // every 5 seconds
}
