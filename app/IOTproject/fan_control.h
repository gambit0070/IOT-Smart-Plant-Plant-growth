#ifndef FAN_CONTROL_H
#define FAN_CONTROL_H

#define FAN_RELAY_PIN 2  // IN1 on relay module

void initFan() {
  pinMode(FAN_RELAY_PIN, OUTPUT);
  digitalWrite(FAN_RELAY_PIN, HIGH); // OFF by default (LOW = ON)
}

void fanOn() {
  digitalWrite(FAN_RELAY_PIN, LOW);  // Relay ON
}

void fanOff() {
  digitalWrite(FAN_RELAY_PIN, HIGH); // Relay OFF
}

#endif
