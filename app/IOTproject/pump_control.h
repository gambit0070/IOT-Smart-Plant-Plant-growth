#ifndef PUMP_CONTROL_H
#define PUMP_CONTROL_H

#define PUMP_PIN 3  // GPIO pin controlling the pump relay (active LOW)

bool pumpIsOn = false;  // Track pump state

void initPump() {
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, HIGH);  // Start with pump OFF (HIGH = OFF for active LOW)
  pumpIsOn = false;
}

// Turn the pump ON
void pumpOn() {
  digitalWrite(PUMP_PIN, LOW);   // LOW = ON
  pumpIsOn = true;
}

// Turn the pump OFF
void pumpOff() {
  digitalWrite(PUMP_PIN, HIGH);  // HIGH = OFF
  pumpIsOn = false;
}

// Check pump status
bool isPumpRunning() {
  return pumpIsOn;
}

#endif
