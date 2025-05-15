#ifndef WIFI_HTTP_CLIENT_H
#define WIFI_HTTP_CLIENT_H

#include <WiFi.h>
#include <HTTPClient.h>

// ✏️ Replace with your actual Wi-Fi credentials
const char* ssid = "iH";
const char* password = "nihaonihao";

// ✏️ Replace with your server endpoint
const char* serverURL = "http://172.20.10.2:5050/api/data";  // Example: local IP or domain

void connectToWiFi() {
  Serial.print("🔌 Connecting to WiFi");
  WiFi.begin(ssid, password);
  

  Serial.println();
  Serial.print("WiFi status: ");
  Serial.println(WiFi.status());


  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("📶 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Failed to connect to WiFi.");
  }
}

// Send JSON data to server
void sendSensorData(float temperature, float humidity, float pressure, int soilMoisture) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi not connected. Reconnecting...");
    connectToWiFi();
    return;
  }

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON body
  String jsonData = "{";
  jsonData += "\"temperature\":" + String(temperature, 2) + ",";
  jsonData += "\"humidity\":" + String(humidity, 2) + ",";
  jsonData += "\"pressure\":" + String(pressure, 2) + ",";
  jsonData += "\"soil\":" + String(soilMoisture);
  jsonData += "}";

  Serial.println("📤 Sending JSON:");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  if (httpResponseCode > 0) {
    Serial.print("✅ Server responded with code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("❌ Failed to send data. Error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

#endif