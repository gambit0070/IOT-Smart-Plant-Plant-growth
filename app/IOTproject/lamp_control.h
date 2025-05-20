#ifndef LAMP_CONTROL_H
#define LAMP_CONTROL_H

#define LAMP_RELAY_PIN 4  // IN2 on relay module

void initLamp() {
  pinMode(LAMP_RELAY_PIN, OUTPUT);
  digitalWrite(LAMP_RELAY_PIN, HIGH); // OFF by default
}

void lampOn() {
  digitalWrite(LAMP_RELAY_PIN, LOW);  // Relay ON
}

void lampOff() {
  digitalWrite(LAMP_RELAY_PIN, HIGH); // Relay OFF
}

#endif
