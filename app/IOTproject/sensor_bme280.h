
#ifndef SENSOR_BME280_H
#define SENSOR_BME280_H

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

// Define SDA and SCL pins (adjust if yours are different)
#define BME_SDA 5
#define BME_SCL 6
#define BME_ADDRESS 0x77  // Use 0x77 since your scanner found this

Adafruit_BME280 bme;

bool initBME280() {
  Wire.begin(BME_SDA, BME_SCL);
  return bme.begin(BME_ADDRESS);
}

float readTemperatureC() {
  return bme.readTemperature();
}

float readHumidity() {
  return bme.readHumidity();
}

float readPressure() {
  return bme.readPressure() / 100.0F; // convert Pa to hPa
}

#endif

