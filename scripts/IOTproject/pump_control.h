#ifndef PUMP_CONTROL_H
#define PUMP_CONTROL_H

#define PUMP_PIN 3  // GPIO pin controlling the pump relay

bool pumpIsOn = false;  // Track pump state

void initPump() {
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);  // Start with pump OFF
  pumpIsOn = false;
}

// Turn the pump ON
void pumpOn() {
  digitalWrite(PUMP_PIN, HIGH);  // If your relay is active LOW, change to LOW
  pumpIsOn = true;
}

// Turn the pump OFF
void pumpOff() {
  digitalWrite(PUMP_PIN, LOW);   // If your relay is active LOW, change to HIGH
  pumpIsOn = false;
}

// Check pump status
bool isPumpRunning() {
  return pumpIsOn;
}

#endif
