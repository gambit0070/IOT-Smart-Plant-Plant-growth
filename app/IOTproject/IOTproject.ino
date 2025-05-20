
#define BLYNK_AUTH_TOKEN "upCmFhrusVTxhY0CqDYxOkeaoL90DeNZ"

#define BLYNK_TEMPLATE_ID "TMPL6p_m1QMn9"
#define BLYNK_TEMPLATE_NAME "Smart Garden"

#include <Wire.h>
#include <WiFi.h>
#include <BlynkSimpleEsp32.h>

#include "sensor_bme280.h"
#include "sensor_light.h"
#include "sensor_soil.h"
#include "fan_control.h"
#include "lamp_control.h"
#include "pump_control.h"

// WiFi credentials
char ssid[] = "iH";
char pass[] = "nihaonihao";

// Smart Control Settings
bool smartControlEnabled = false;                // V8
bool smartPumpEnabled = false;                   // V26
bool smartLampEnabled = false;                   // V27
bool smartFanEnabled = false;                    // V28

// Threshold Settings
int pumpOnThreshold = 40;                        // V20
int fanInterval = 10;                            // V21
int lampOnThreshold = 300;                       // V22
int pumpOffThreshold = 60;                       // V23
int lampOffThreshold = 500;                      // V24
int fanDuration = 5;                             // V25

// Smart Control Timing Variables
unsigned long lastFanRun = 0;
unsigned long fanStartTime = 0;
bool fanTimerRunning = false;

// Keeping track of manual control states
int manualPumpState = 0;
int manualLampState = 0;
int manualFanState = 0;

void setup() {
  Serial.begin(9600);
  
  // Start I2C on custom SDA/SCL pins
  Wire.begin(BME_SDA, BME_SCL);
  
  // Initialize sensors
  if (!initBME280()) {
    Serial.println("❌ BME280 initialization failed!");
    while (1);
  }
  
  if (!initLightSensor()) {
    Serial.println("❌ VEML6030 initialization failed!");
    while (1);
  }
  
  initSoilSensor();
  
  // Initialize actuators
  initFan();
  initLamp();
  initPump();
  
  // Connect to WiFi
  WiFi.begin(ssid, pass);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected");
  
  // Connect to Blynk
  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);

  // Synchronize the current state from Blynk server
  Blynk.syncAll();
}

void loop() {
  Blynk.run();
  
  // Read sensors
  float temp = readTemperatureC();
  float hum = readHumidity();
  float pres = readPressure();
  float lux = readLightLux();
  int soil = readSoilPercent();
  
  // Serial output
  Serial.println("📊 Sensor Readings:");
  Serial.printf("🌡 Temp: %.2f °C\n", temp);
  Serial.printf("💧 Hum: %.2f %%\n", hum);
  Serial.printf("🌬 Pres: %.2f hPa\n", pres);
  Serial.printf("🔆 Lux: %.2f\n", lux);
  Serial.printf("🌱 Soil Moisture: %d %%\n", soil);
  Serial.println("-----------------------------\n");
  
  // Send to Blynk
  Blynk.virtualWrite(V2, temp);
  Blynk.virtualWrite(V3, hum);
  Blynk.virtualWrite(V10, pres);
  Blynk.virtualWrite(V6, lux);
  Blynk.virtualWrite(V1, soil);

  // Smart Control Logic - only runs if manual control is not overriding
  if (smartControlEnabled) {
    // Smart Pump Control - only if manual control is not active
    if (smartPumpEnabled && manualPumpState == 0) {
      if (soil < pumpOnThreshold) {
        pumpOn();
        Blynk.virtualWrite(V4, 1);
        Serial.println("🤖 Smart Control: 💧 Pump ON (low soil moisture)");
      } else if (soil > pumpOffThreshold) {
        pumpOff();
        Blynk.virtualWrite(V4, 0);
        Serial.println("🤖 Smart Control: 💧 Pump OFF (sufficient soil moisture)");
      }
    }
    
    // Smart Lamp Control - only if manual control is not active
    if (smartLampEnabled && manualLampState == 0) {
      if (lux < lampOnThreshold) {
        lampOn();
        Blynk.virtualWrite(V11, 1);
        Serial.println("🤖 Smart Control: 💡 Lamp ON (low light)");
      } else if (lux > lampOffThreshold) {
        lampOff();
        Blynk.virtualWrite(V11, 0);
        Serial.println("🤖 Smart Control: 💡 Lamp OFF (sufficient light)");
      }
    }
    
    // Smart Fan Control (interval based) - only if manual control is not active
    if (smartFanEnabled && manualFanState == 0) {
      unsigned long currentTime = millis();
      
      // Check if fan is already running on a timer
      if (fanTimerRunning) {
        // Calculate how long the fan has been running
        unsigned long fanRunTime = (currentTime - fanStartTime) / 1000 / 60; // in minutes
        
        // Turn off fan if it has run for the set duration
        if (fanRunTime >= fanDuration) {
          fanOff();
          Blynk.virtualWrite(V7, 0);
          Serial.println("🤖 Smart Control: 🌀 Fan OFF (timer ended)");
          fanTimerRunning = false;
          lastFanRun = currentTime;
        }
      } 
      // Check if it's time to turn on the fan for its regular interval
      else if ((currentTime - lastFanRun) / 1000 / 60 >= fanInterval) {
        fanOn();
        Blynk.virtualWrite(V7, 1);
        Serial.println("🤖 Smart Control: 🌀 Fan ON (regular interval)");
        fanTimerRunning = true;
        fanStartTime = currentTime;
      }
    }
  }
  
  delay(2000);
}

// Global Smart Control
BLYNK_WRITE(V8) {
  bool previousSmartControl = smartControlEnabled;
  smartControlEnabled = param.asInt();
  Serial.println(smartControlEnabled ? "🤖 Smart Control: ENABLED" : "🤖 Smart Control: DISABLED");
  
  // If smart control is disabled, ensure all individual smart controls are also marked as disabled
  if (!smartControlEnabled) {
    // Only execute this when turning off, not during initialization
    if (previousSmartControl) {
      smartPumpEnabled = false;
      smartLampEnabled = false;
      smartFanEnabled = false;
      
      // Reset fan timer variables
      fanTimerRunning = false;
      
      // Update Blynk app to reflect these changes
      Blynk.virtualWrite(V26, 0);
      Blynk.virtualWrite(V27, 0);
      Blynk.virtualWrite(V28, 0);
      
      Serial.println("🔄 Switching to manual control mode");
      
      // Return to manual control states
      if (manualPumpState == 1) {
        pumpOn();
      } else {
        pumpOff();
      }
      
      if (manualLampState == 1) {
        lampOn();
      } else {
        lampOff();
      }
      
      if (manualFanState == 1) {
        fanOn();
      } else {
        fanOff();
      }
      
      // Make sure Blynk app shows correct states
      Blynk.virtualWrite(V4, manualPumpState);
      Blynk.virtualWrite(V11, manualLampState);
      Blynk.virtualWrite(V7, manualFanState);
    }
  }
}

// Smart Pump Control
BLYNK_WRITE(V26) {
  // Only allow enabling if global smart control is on
  if (param.asInt() == 1 && smartControlEnabled) {
    smartPumpEnabled = true;
    Serial.println("🤖 Smart Pump Control: ENABLED");
  } else {
    smartPumpEnabled = false;
    Serial.println("🤖 Smart Pump Control: DISABLED");
    
    // If smart control is enabled but this specific one is disabled, make sure Blynk shows correct state
    if (param.asInt() == 1 && !smartControlEnabled) {
      Blynk.virtualWrite(V26, 0);
    }
  }
}

// Smart Lamp Control
BLYNK_WRITE(V27) {
  // Only allow enabling if global smart control is on
  if (param.asInt() == 1 && smartControlEnabled) {
    smartLampEnabled = true;
    Serial.println("🤖 Smart Lamp Control: ENABLED");
  } else {
    smartLampEnabled = false;
    Serial.println("🤖 Smart Lamp Control: DISABLED");
    
    // If smart control is enabled but this specific one is disabled, make sure Blynk shows correct state
    if (param.asInt() == 1 && !smartControlEnabled) {
      Blynk.virtualWrite(V27, 0);
    }
  }
}

// Smart Fan Control
BLYNK_WRITE(V28) {
  // Only allow enabling if global smart control is on
  if (param.asInt() == 1 && smartControlEnabled) {
    smartFanEnabled = true;
    Serial.println("🤖 Smart Fan Control: ENABLED");
    
    // Initialize the fan timer variables
    lastFanRun = millis();
  } else {
    smartFanEnabled = false;
    Serial.println("🤖 Smart Fan Control: DISABLED");
    
    // If smart control is enabled but this specific one is disabled, make sure Blynk shows correct state
    if (param.asInt() == 1 && !smartControlEnabled) {
      Blynk.virtualWrite(V28, 0);
    }
  }
}

// Threshold Settings
BLYNK_WRITE(V20) {
  pumpOnThreshold = param.asInt();
  Serial.printf("🤖 Pump ON Threshold set to: %d%%\n", pumpOnThreshold);
}

BLYNK_WRITE(V21) {
  fanInterval = param.asInt();
  Serial.printf("🤖 Fan Interval set to: %d minutes\n", fanInterval);
}

BLYNK_WRITE(V22) {
  lampOnThreshold = param.asInt();
  Serial.printf("🤖 Lamp ON Threshold set to: %d lux\n", lampOnThreshold);
}

BLYNK_WRITE(V23) {
  pumpOffThreshold = param.asInt();
  Serial.printf("🤖 Pump OFF Threshold set to: %d%%\n", pumpOffThreshold);
}

BLYNK_WRITE(V24) {
  lampOffThreshold = param.asInt();
  Serial.printf("🤖 Lamp OFF Threshold set to: %d lux\n", lampOffThreshold);
}

BLYNK_WRITE(V25) {
  fanDuration = param.asInt();
  Serial.printf("🤖 Fan Duration set to: %d minutes\n", fanDuration);
}

// Fan control from Blynk
BLYNK_WRITE(V7) {
  int state = param.asInt();
  manualFanState = state; // Store manual control state
  
  if (state) {
    fanOn();
    
    // If smart control is running, disable its control over this device
    if (smartControlEnabled && smartFanEnabled) {
      Serial.println("⚠️ Manual control overriding smart fan control");
      // Stop the fan timer if it's running
      fanTimerRunning = false;
    }
  } else {
    fanOff();
  }
  
  Serial.println(state ? "🌀 Fan ON (manual)" : "🌀 Fan OFF (manual)");
}

// Lamp control from Blynk
BLYNK_WRITE(V11) {
  int state = param.asInt();
  manualLampState = state; // Store manual control state
  
  if (state) {
    lampOn();
    
    // If smart control is running, note that manual is overriding
    if (smartControlEnabled && smartLampEnabled) {
      Serial.println("⚠️ Manual control overriding smart lamp control");
    }
  } else {
    lampOff();
  }
  
  Serial.println(state ? "💡 Lamp ON (manual)" : "💡 Lamp OFF (manual)");
}

// Pump control from Blynk
BLYNK_WRITE(V4) {
  int state = param.asInt();
  manualPumpState = state; // Store manual control state
  
  if (state) {
    pumpOn();
    
    // If smart control is running, note that manual is overriding
    if (smartControlEnabled && smartPumpEnabled) {
      Serial.println("⚠️ Manual control overriding smart pump control");
    }
  } else {
    pumpOff();
  }
  
  Serial.println(state ? "💧 Pump ON (manual)" : "💧 Pump OFF (manual)");
}

// This function will run every time Blynk connects to the server
BLYNK_CONNECTED() {
  // Request the latest state from the server
  Blynk.syncVirtual(V8);  // Smart Control Status
  Blynk.syncVirtual(V26); // Smart Pump Control
  Blynk.syncVirtual(V27); // Smart Lamp Control
  Blynk.syncVirtual(V28); // Smart Fan Control
  
  // Threshold settings
  Blynk.syncVirtual(V20); // Pump ON Threshold
  Blynk.syncVirtual(V21); // Fan Interval
  Blynk.syncVirtual(V22); // Lamp ON Threshold
  Blynk.syncVirtual(V23); // Pump OFF Threshold
  Blynk.syncVirtual(V24); // Lamp OFF Threshold
  Blynk.syncVirtual(V25); // Fan Duration
  
  // Device status
  Blynk.syncVirtual(V4);  // Pump Status
  Blynk.syncVirtual(V7);  // Fan Status
  Blynk.syncVirtual(V11); // Lamp Status
}


// -------------last one working ------------------
// #define BLYNK_TEMPLATE_ID "TMPL6H5aW08du"
// #define BLYNK_TEMPLATE_NAME "smart garden"
// #define BLYNK_AUTH_TOKEN "FpQ6nvN9nATbU1E6qNbcfqU5XMmlYQI3"

// #include <Wire.h>
// #include <WiFi.h>
// #include <BlynkSimpleEsp32.h>

// #include "sensor_bme280.h"
// #include "sensor_light.h"
// #include "sensor_soil.h"
// #include "fan_control.h"
// #include "lamp_control.h"
// #include "pump_control.h"

// // WiFi credentials
// char ssid[] = "marrowbone";
// char pass[] = "xihuanmdl";

// // Smart Control Settings
// bool smartControlEnabled = false;                // V8
// bool smartPumpEnabled = false;                   // V26
// bool smartLampEnabled = false;                   // V27
// bool smartFanEnabled = false;                    // V28

// // Threshold Settings
// int pumpOnThreshold = 40;                        // V20
// int fanInterval = 10;                            // V21
// int lampOnThreshold = 300;                       // V22
// int pumpOffThreshold = 60;                       // V23
// int lampOffThreshold = 500;                      // V24
// int fanDuration = 5;                             // V25

// // Smart Control Timing Variables
// unsigned long lastFanRun = 0;
// unsigned long fanStartTime = 0;
// bool fanTimerRunning = false;

// // Keeping track of manual control states
// int manualPumpState = 0;
// int manualLampState = 0;
// int manualFanState = 0;

// void setup() {
//   Serial.begin(9600);
  
//   // Start I2C on custom SDA/SCL pins
//   Wire.begin(BME_SDA, BME_SCL);
  
//   // Initialize sensors
//   if (!initBME280()) {
//     Serial.println("❌ BME280 initialization failed!");
//     while (1);
//   }
  
//   if (!initLightSensor()) {
//     Serial.println("❌ VEML6030 initialization failed!");
//     while (1);
//   }
  
//   initSoilSensor();
  
//   // Initialize actuators
//   initFan();
//   initLamp();
//   initPump();
  
//   // Connect to WiFi
//   WiFi.begin(ssid, pass);
//   Serial.print("Connecting to WiFi");
//   while (WiFi.status() != WL_CONNECTED) {
//     delay(500);
//     Serial.print(".");
//   }
//   Serial.println("\n✅ WiFi connected");
  
//   // Connect to Blynk
//   Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);

//   // Synchronize the current state from Blynk server
//   Blynk.syncAll();
// }

// void loop() {
//   Blynk.run();
  
//   // Read sensors
//   float temp = readTemperatureC();
//   float hum = readHumidity();
//   float pres = readPressure();
//   float lux = readLightLux();
//   int soil = readSoilPercent();
  
//   // Serial output
//   Serial.println("📊 Sensor Readings:");
//   Serial.printf("🌡 Temp: %.2f °C\n", temp);
//   Serial.printf("💧 Hum: %.2f %%\n", hum);
//   Serial.printf("🌬 Pres: %.2f hPa\n", pres);
//   Serial.printf("🔆 Lux: %.2f\n", lux);
//   Serial.printf("🌱 Soil Moisture: %d %%\n", soil);
//   Serial.println("-----------------------------\n");
  
//   // Send to Blynk
//   Blynk.virtualWrite(V2, temp);
//   Blynk.virtualWrite(V3, hum);
//   Blynk.virtualWrite(V10, pres);
//   Blynk.virtualWrite(V6, lux);
//   Blynk.virtualWrite(V1, soil);

//   // Smart Control Logic
//   if (smartControlEnabled) {
//     // Smart Pump Control
//     if (smartPumpEnabled) {
//       if (soil < pumpOnThreshold) {
//         pumpOn();
//         Blynk.virtualWrite(V4, 1);
//         Serial.println("🤖 Smart Control: 💧 Pump ON (low soil moisture)");
//       } else if (soil > pumpOffThreshold) {
//         pumpOff();
//         Blynk.virtualWrite(V4, 0);
//         Serial.println("🤖 Smart Control: 💧 Pump OFF (sufficient soil moisture)");
//       }
//     }
    
//     // Smart Lamp Control
//     if (smartLampEnabled) {
//       if (lux < lampOnThreshold) {
//         lampOn();
//         Blynk.virtualWrite(V11, 1);
//         Serial.println("🤖 Smart Control: 💡 Lamp ON (low light)");
//       } else if (lux > lampOffThreshold) {
//         lampOff();
//         Blynk.virtualWrite(V11, 0);
//         Serial.println("🤖 Smart Control: 💡 Lamp OFF (sufficient light)");
//       }
//     }
    
//     // Smart Fan Control (interval based)
//     if (smartFanEnabled) {
//       unsigned long currentTime = millis();
      
//       // Check if fan is already running on a timer
//       if (fanTimerRunning) {
//         // Calculate how long the fan has been running
//         unsigned long fanRunTime = (currentTime - fanStartTime) / 1000 / 60; // in minutes
        
//         // Turn off fan if it has run for the set duration
//         if (fanRunTime >= fanDuration) {
//           fanOff();
//           Blynk.virtualWrite(V7, 0);
//           Serial.println("🤖 Smart Control: 🌀 Fan OFF (timer ended)");
//           fanTimerRunning = false;
//           lastFanRun = currentTime;
//         }
//       } 
//       // Check if it's time to turn on the fan for its regular interval
//       else if ((currentTime - lastFanRun) / 1000 / 60 >= fanInterval) {
//         fanOn();
//         Blynk.virtualWrite(V7, 1);
//         Serial.println("🤖 Smart Control: 🌀 Fan ON (regular interval)");
//         fanTimerRunning = true;
//         fanStartTime = currentTime;
//       }
//     }
//   }
  
//   delay(2000);
// }

// // Global Smart Control
// BLYNK_WRITE(V8) {
//   bool previousSmartControl = smartControlEnabled;
//   smartControlEnabled = param.asInt();
//   Serial.println(smartControlEnabled ? "🤖 Smart Control: ENABLED" : "🤖 Smart Control: DISABLED");
  
//   // If smart control is disabled, ensure all individual smart controls are also marked as disabled
//   if (!smartControlEnabled) {
//     // Only execute this when turning off, not during initialization
//     if (previousSmartControl) {
//       smartPumpEnabled = false;
//       smartLampEnabled = false;
//       smartFanEnabled = false;
      
//       // Reset fan timer variables
//       fanTimerRunning = false;
      
//       // Update Blynk app to reflect these changes
//       Blynk.virtualWrite(V26, 0);
//       Blynk.virtualWrite(V27, 0);
//       Blynk.virtualWrite(V28, 0);
      
//       Serial.println("🔄 Switching to manual control mode");
      
//       // Return to manual control states
//       if (manualPumpState == 1) {
//         pumpOn();
//       } else {
//         pumpOff();
//       }
      
//       if (manualLampState == 1) {
//         lampOn();
//       } else {
//         lampOff();
//       }
      
//       if (manualFanState == 1) {
//         fanOn();
//       } else {
//         fanOff();
//       }
      
//       // Make sure Blynk app shows correct states
//       Blynk.virtualWrite(V4, manualPumpState);
//       Blynk.virtualWrite(V11, manualLampState);
//       Blynk.virtualWrite(V7, manualFanState);
//     }
//   }
// }

// // Smart Pump Control
// BLYNK_WRITE(V26) {
//   // Only allow enabling if global smart control is on
//   if (param.asInt() == 1 && smartControlEnabled) {
//     smartPumpEnabled = true;
//     Serial.println("🤖 Smart Pump Control: ENABLED");
//   } else {
//     smartPumpEnabled = false;
//     Serial.println("🤖 Smart Pump Control: DISABLED");
    
//     // If smart control is enabled but this specific one is disabled, make sure Blynk shows correct state
//     if (param.asInt() == 1 && !smartControlEnabled) {
//       Blynk.virtualWrite(V26, 0);
//     }
//   }
// }

// // Smart Lamp Control
// BLYNK_WRITE(V27) {
//   // Only allow enabling if global smart control is on
//   if (param.asInt() == 1 && smartControlEnabled) {
//     smartLampEnabled = true;
//     Serial.println("🤖 Smart Lamp Control: ENABLED");
//   } else {
//     smartLampEnabled = false;
//     Serial.println("🤖 Smart Lamp Control: DISABLED");
    
//     // If smart control is enabled but this specific one is disabled, make sure Blynk shows correct state
//     if (param.asInt() == 1 && !smartControlEnabled) {
//       Blynk.virtualWrite(V27, 0);
//     }
//   }
// }

// // Smart Fan Control
// BLYNK_WRITE(V28) {
//   // Only allow enabling if global smart control is on
//   if (param.asInt() == 1 && smartControlEnabled) {
//     smartFanEnabled = true;
//     Serial.println("🤖 Smart Fan Control: ENABLED");
    
//     // Initialize the fan timer variables
//     lastFanRun = millis();
//   } else {
//     smartFanEnabled = false;
//     Serial.println("🤖 Smart Fan Control: DISABLED");
    
//     // If smart control is enabled but this specific one is disabled, make sure Blynk shows correct state
//     if (param.asInt() == 1 && !smartControlEnabled) {
//       Blynk.virtualWrite(V28, 0);
//     }
//   }
// }

// // Threshold Settings
// BLYNK_WRITE(V20) {
//   pumpOnThreshold = param.asInt();
//   Serial.printf("🤖 Pump ON Threshold set to: %d%%\n", pumpOnThreshold);
// }

// BLYNK_WRITE(V21) {
//   fanInterval = param.asInt();
//   Serial.printf("🤖 Fan Interval set to: %d minutes\n", fanInterval);
// }

// BLYNK_WRITE(V22) {
//   lampOnThreshold = param.asInt();
//   Serial.printf("🤖 Lamp ON Threshold set to: %d lux\n", lampOnThreshold);
// }

// BLYNK_WRITE(V23) {
//   pumpOffThreshold = param.asInt();
//   Serial.printf("🤖 Pump OFF Threshold set to: %d%%\n", pumpOffThreshold);
// }

// BLYNK_WRITE(V24) {
//   lampOffThreshold = param.asInt();
//   Serial.printf("🤖 Lamp OFF Threshold set to: %d lux\n", lampOffThreshold);
// }

// BLYNK_WRITE(V25) {
//   fanDuration = param.asInt();
//   Serial.printf("🤖 Fan Duration set to: %d minutes\n", fanDuration);
// }

// // Fan control from Blynk
// BLYNK_WRITE(V7) {
//   int state = param.asInt();
//   manualFanState = state; // Store manual control state
  
//   if (state) fanOn();
//   else fanOff();
//   Serial.println(state ? "🌀 Fan ON" : "🌀 Fan OFF");
  
//   // Reset smart fan timer when manually controlled
//   if (state) {
//     fanTimerRunning = false;
//   }
// }

// // Lamp control from Blynk
// BLYNK_WRITE(V11) {
//   int state = param.asInt();
//   manualLampState = state; // Store manual control state
  
//   if (state) lampOn();
//   else lampOff();
//   Serial.println(state ? "💡 Lamp ON" : "💡 Lamp OFF");
// }

// // Pump control from Blynk
// BLYNK_WRITE(V4) {
//   int state = param.asInt();
//   manualPumpState = state; // Store manual control state
  
//   if (state) pumpOn();
//   else pumpOff();
//   Serial.println(state ? "💧 Pump ON" : "💧 Pump OFF");
// }

// // This function will run every time Blynk connects to the server
// BLYNK_CONNECTED() {
//   // Request the latest state from the server
//   Blynk.syncVirtual(V8);  // Smart Control Status
//   Blynk.syncVirtual(V26); // Smart Pump Control
//   Blynk.syncVirtual(V27); // Smart Lamp Control
//   Blynk.syncVirtual(V28); // Smart Fan Control
  
//   // Threshold settings
//   Blynk.syncVirtual(V20); // Pump ON Threshold
//   Blynk.syncVirtual(V21); // Fan Interval
//   Blynk.syncVirtual(V22); // Lamp ON Threshold
//   Blynk.syncVirtual(V23); // Pump OFF Threshold
//   Blynk.syncVirtual(V24); // Lamp OFF Threshold
//   Blynk.syncVirtual(V25); // Fan Duration
  
//   // Device status
//   Blynk.syncVirtual(V4);  // Pump Status
//   Blynk.syncVirtual(V7);  // Fan Status
//   Blynk.syncVirtual(V11); // Lamp Status

// }

