#ifndef SENSOR_LIGHT_H
#define SENSOR_LIGHT_H

#include <Wire.h>
#include "SparkFun_VEML6030_Ambient_Light_Sensor.h"

#define VEML6030_ADDR 0x10  // Update if your I2C scanner shows a different address

SparkFun_Ambient_Light lightSensor(VEML6030_ADDR);

bool initLightSensor() {
  if (!lightSensor.begin()) {
    return false;
  }

  lightSensor.setGain(0.125);        // Set gain (options: 0.125, 0.25, 1, 2)
  lightSensor.setIntegTime(100);     // Integration time in ms (25–800)

  return true;
}

float readLightLux() {
  return lightSensor.readLight();
}

#endif  // SENSOR_LIGHT_H
