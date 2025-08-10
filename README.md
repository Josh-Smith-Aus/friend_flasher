# Friend_flasher (ESP8266 MQTT-Controlled LED Strip)

This project connects an **ESP8266** to Wi-Fi and an MQTT broker to control a strip of WS2812/NeoPixel LEDs.  
It supports **JSON-based commands** to change the color and brightness of individual LEDs and includes **over-the-air (OTA) updates** for easy firmware changes.

### Features
- **Wi-Fi Setup via WiFiManager**  
  Automatically opens a configuration access point if no saved Wi-Fi credentials are found.
  
- **MQTT Communication**  
  - Connects to an MQTT broker (`test.mosquitto.org` by default).  
  - Listens for messages on topic:  
    ```
    lights/<device_id>/control
    ```
    where `<device_id>` is generated from a hard-coded prefix (`josh`) + last 4 hex digits of the chip ID.
  
- **LED Control**  
  - Expects JSON payloads with a `"leds"` array containing objects in the following format:  
    ```json
    {
      "leds": [
        { "i": 0, "c": "#FF0000", "b": 128 },
        { "i": 5, "c": "#00FF00" }
      ]
    }
    ```
    - `i` → LED index  
    - `c` → HEX color (`#RRGGBB`)  
    - `b` (optional) → brightness (0–255)

- **Status Feedback**  
  - If Wi-Fi is disconnected, the **first LED blinks red**.
  
- **Over-the-Air Updates (ArduinoOTA)**  
  - After the first flash, enables future updates over Wi-Fi.
  - OTA enabled with hostname = device ID  
  - OTA password = `"josh"`

### Hardware
- **ESP8266** (NodeMCU, Wemos D1 Mini, etc.)
- WS2812/NeoPixel LED strip (change `NUM_LEDS` to match your setup)
- LED data pin connected to **GPIO 2**

### Default MQTT Broker
- **Server:** `test.mosquitto.org`
- **Port:** `1883`

### Libraries Used
- **ESP8266WiFi.h**  
  Core library for connecting the ESP8266 to Wi-Fi networks.
- **WiFiManager.h**  
  Simplifies Wi-Fi setup by creating a temporary configuration access point if no saved credentials are found.
- **PubSubClient.h**  
  Lightweight MQTT client library for Arduino.  
  Handles subscribing to topics, publishing messages, and maintaining an MQTT connection.
- **ArduinoJson.h**  
  Efficient JSON parsing and serialization library for embedded systems.  
  Used here to decode LED control commands from incoming MQTT messages.
- **Adafruit_NeoPixel.h**  
  Controls WS2812/NeoPixel LEDs.  
  Provides functions to set colors, brightness, and update the LED strip.
- **ArduinoOTA.h**  
  Enables Over-the-Air firmware updates, allowing you to upload new code without physically connecting the ESP8266 via USB.

### Finding Your Device ID
The device ID is automatically generated from the prefix `josh` (hardcoded for each person) + the last 4 hex digits of the ESP8266 chip ID.  
To find it there are two options:
1. As OTA is enabled after the first flash, in the Arduino IDE go to **Tools → Port COM → Device OTA**. After a few seconds to load up and connect to Wi-Fi, your device will appear here with its device ID and IP.
2. Alternatively, add the below line to your `setup()` function before connecting to Wi-Fi and after flashing open the Arduino Serial Monitor before resetting:
    ```cpp
    Serial.begin(115200);
    Serial.println(getDeviceID());
    ```

### Test Messages
In Linux (e.g., Raspberry Pi):  
Install mosquitto:
```bash
sudo apt install mosquitto-clients
```
Replace `<device_id>` with your ESP8266’s generated device ID (e.g., `josh1A2B`) and send example package:
```bash
mosquitto_pub -h test.mosquitto.org -p 1883 -t "lights/<device_id>/control" -m '{"leds":[{"i":0,"c":"#FF0000"},{"i":1,"c":"#00FF00"}]}'
```
This example:
- Turns LED 0 fully red at max brightness.
- Turns LED 5 blue at half brightness.

### To Flash ESP
- Connect `io0` and `RST` to GND
- Remove `RST` just before flashing in Arduino IDE
- Plug `RST` back in, remove `io0`, then remove `io0` again
- Device should now be running flashed file

### TO DO
- Get resistor and step up/down boards so signal is passed cleanly to LEDs

### Notes
- ChatGPT page - Breadboard wiring setup
