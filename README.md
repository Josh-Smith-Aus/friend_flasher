# Friend_flasher (ESP8266 MQTT-Controlled LED Strip)

This project connects an **ESP8266** (or **ESP32**) to Wi-Fi and an MQTT broker to control a strip of WS2812/NeoPixel LEDs.  
It supports **JSON-based commands** to change the color and brightness of individual LEDs, includes **built-in lighting effects**, and features **HTTPS-based OTA updates** (ESP32 only).

It will initially open itself up as a Wi-Fi access point and serve a simple login page showing available Wi-Fi access points and asking for SSID password using the WiFiManager package. Once connected to the local Wi-Fi it will be able to receive MQTT messages. If Wi-Fi is lost for 2 minutes it will revert back to AP mode to reconnect and check saved credentials every 2 minutes. **The first LED acts as a status indicator** and shows different colors/patterns based on device state.

---

## Features

### Wi-Fi Setup via WiFiManager
- Automatically opens a configuration access point (`ESP_Config_AP`) if no saved Wi-Fi credentials are found.
- Allows easy network configuration through a web interface.

### MQTT Communication
- Connects to an MQTT broker over **TLS (port 8883)** for secure communication.
- Currently configured for HiveMQ Cloud (free tier), but easily adaptable to any MQTT broker.
- Listens for messages on topics:
  ```
  lights/<device_id>/control
  lights/all/control (broadcast to all devices)
  ```
  where `<device_id>` is generated from a hard-coded prefix (`josh`) + last 4 hex digits of the chip ID.

### LED Control

#### Basic Commands
Set all LEDs (except status LED 0):
```json
{"all":"#FF0000"}
{"all":"#FFFFFF","b":128}
```

Set individual LEDs:
```json
{"leds":[{"i":0,"c":"#FF0000"},{"i":5,"c":"#00FF00","b":200}]}
```
- `i` → LED index (0-9)
- `c` → HEX color (`#RRGGBB`)
- `b` (optional) → brightness (0–255)

#### Built-in Effects

**Rainbow** (all LEDs except status):
```json
{"effect":"rainbow","speed":"slow"}
{"effect":"rainbow","speed":"medium"}
{"effect":"rainbow","speed":"fast"}
```

**Pulse** (single LED - sine wave brightness):
```json
{"effect":"pulse","led":5,"color":"#FF0000","speed":"medium"}
```

**Breathe** (single LED - slower, smoother pulse):
```json
{"effect":"breathe","led":3,"color":"#0000FF","speed":"slow"}
```

**Wakeup** (gradually fade in, then transition to another effect):
```json
{"effect":"wakeup","led":5,"color":"#FF8800","duration":6000,"next":"breathe"}
{"effect":"wakeup","led":-1,"color":"#FF6600","duration":5000,"next":"none"}
```
- `led`: LED index (0-9) or `-1` for all LEDs
- `duration`: Fade time in milliseconds (default: 6000)
- `next`: Effect to transition to (`"breathe"`, `"pulse"`, or `"none"`)

**Sleep** (gradually fade all LEDs to black):
```json
{"effect":"sleep","duration":4000}
```

**Stop all effects**:
```json
{"effect":"none"}
```

### Status LED (LED 0)
The first LED provides visual feedback about device state:
- 🔵 **Blue** - Booting up
- 🟦 **Cyan** - WiFi connected, waiting for MQTT
- 🟢 **Green** - MQTT connected (normal operation)
- 🔴 **Red (blinking)** - WiFi disconnected
- 🟡 **Yellow (blinking)** - WiFi connected, MQTT disconnected
- 🟣 **Magenta** - Firmware update in progress (ESP32 only)

The status LED can still be controlled via MQTT using the `"leds"` command, but the `"all"` command skips it.

### Over-the-Air Updates
**ESP32 only** - HTTPS-based firmware updates triggered via MQTT:
```json
{"update":"now"}
```
Device will download firmware from configured URL, install it, and restart automatically.

*Note: ESP-01S has insufficient flash space for OTA and uses serial upload only.*

---

## Hardware

### ESP-01S (1MB Flash)
- **ESP8266** ESP-01S module
- WS2812/NeoPixel LED strip (change `NUM_LEDS` to match your setup)
- LED data pin connected to **GPIO 2**
- **No OTA support** - use serial upload only

### ESP32 (Recommended for production)
- **ESP32** development board (most variants work)
- WS2812/NeoPixel LED strip
- LED data pin connected to **GPIO 2** (configurable)
- **Full OTA support** via HTTPS

### Wiring
#### ESP01s:
##### Boards:
 - HW-373 TP4056 Battery management board (connects to usb-c and 3.7V battery, will charge battery or let battery power circuit) - https://www.aliexpress.com/item/1005006594439600.html?-spm=a2g0o.order_list.order_list_main.116.1cf918025B3GGt
 - NDO205MA 5V Boost Voltage Regulate Board (converts unstable TP4056 board output to regular 5V) - https://www.aliexpress.com/item/1005006167931077.html?spm=a2g0o.order_list.order_list_main.20.1cf918025B3GGt
 - ESP-01S WS2812 RGB LED Controller Module (Takes 5V power and distributes 3.3V to ESP01 and 5V to LEDs, also connects ESP01 GPIO2 to LED control pin) - https://www.aliexpress.com/item/1005008478902565.html?spm=a2g0o.order_list.order_list_main.26.1cf918025B3GGt

```
TP4056 B+ → Battery +
TP4056 B- → Battery -
TP4056 OUT+ → NDO205MA Vi
TP4056 OUT- → NDO205MA G

NDO205MA Vo → Controller Module VCC
NDO205MA G → Controller Module GND

Controller Module Red wire → LED +5V
Controller Module Yellow Wire → LED Din
Controller Module Black wire → LED GND
```

#### ESP32
```
ESP 5V  → LED Strip 5V
ESP GND → LED Strip GND
ESP GPIO2 → LED Strip DIN (data)
```

**Power considerations:**
- 10 LEDs at full white = ~600mA
- ESP dev board 5V pin can handle this from USB
- For more LEDs, use external 5V power supply

---

## MQTT Broker Configuration

### Current Setup (HiveMQ Cloud)
```cpp
const char* mqtt_server = "ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "esp01s";
const char* mqtt_pass = "YourPasswordHere";
```

### Alternative: test.mosquitto.org (Unencrypted)
```cpp
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;
// Set espClient.setInsecure() or remove TLS
```

### Self-Hosted (Recommended for Production)
See `mosquitto_server_setup.sh` in the repository for setting up your own secure MQTT broker.

---

## Libraries Used

- **ESP8266WiFi.h / WiFi.h**  
  Core library for connecting to Wi-Fi networks.
  
- **WiFiManager.h**  
  Simplifies Wi-Fi setup by creating a temporary configuration access point.
  
- **PubSubClient.h**  
  Lightweight MQTT client library for Arduino. Handles subscribing to topics and maintaining connections.
  
- **ArduinoJson.h**  
  Efficient JSON parsing library for embedded systems. Decodes LED control commands from MQTT messages.
  
- **Adafruit_NeoPixel.h**  
  Controls WS2812/NeoPixel LEDs. Provides functions to set colors, brightness, and update the LED strip.
  
- **HTTPUpdate.h** (ESP32 only)  
  Enables HTTPS-based firmware updates over the internet.

---

## Setup & Installation

### PlatformIO (Recommended)

1. Install PlatformIO extension in VS Code
2. Create new project with board `esp01_1m` or `esp32dev`
3. Update `platformio.ini`:

**For ESP-01S:**
```ini
[env:esp01_1m]
platform = espressif8266
board = esp01_1m
framework = arduino

upload_speed = 115200
monitor_speed = 115200

lib_deps = 
    adafruit/Adafruit NeoPixel@^1.12.0
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^6.21.3
    tzapu/WiFiManager@^2.0.16-rc.2
```

**For ESP32:**
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

upload_speed = 921600
monitor_speed = 115200

lib_deps = 
    adafruit/Adafruit NeoPixel@^1.12.0
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^6.21.3
    tzapu/WiFiManager@^2.0.16-rc.2
```

4. Copy code into `src/main.cpp`
5. Update MQTT credentials
6. Upload!

### Arduino IDE

1. Install required libraries via Library Manager:
   - Adafruit NeoPixel
   - PubSubClient
   - ArduinoJson
   - WiFiManager
   
2. Select your board (ESP8266 or ESP32)
3. Upload code

---

## Finding Your Device ID

The device ID is automatically generated from the prefix `josh` + the last 4 hex digits of the chip ID.

### Method 1: Serial Monitor
Add this to `setup()` before WiFi connection:
```cpp
Serial.begin(115200);
Serial.println(getDeviceID());
```

### Method 2: Check MQTT Connection
The device publishes its ID to the status topic when it connects:
```
lights/<device_id>/status
```

### Method 3: WiFi AP Name
When in config mode, the AP name will be the device ID.

---

## Testing Commands

### Linux/Raspberry Pi/WSL
Install mosquitto clients:
```bash
sudo apt install mosquitto-clients
```

### Basic Examples
Replace `josh183A` with your device ID and ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud with your mqtt broker:

```bash
# All LEDs red
mosquitto_pub -h ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud -p 8883 -u esp01s -P YourPassword -t "lights/josh183A/control" -m '{"all":"#FF0000"}'

# All LEDs off
mosquitto_pub -h ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud -p 8883 -u esp01s -P YourPassword -t "lights/josh183A/control" -m '{"all":"#000000"}'

# Rainbow effect
mosquitto_pub -h ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud -p 8883 -u esp01s -P YourPassword -t "lights/josh183A/control" -m '{"effect":"rainbow","speed":"medium"}'

# Wakeup effect
mosquitto_pub -h ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud -p 8883 -u esp01s -P YourPassword -t "lights/josh183A/control" -m '{"effect":"wakeup","led":5,"color":"#FF8800","duration":6000,"next":"breathe"}'

# Broadcast to all devices
mosquitto_pub -h ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud -p 8883 -u esp01s -P YourPassword -t "lights/all/control" -m '{"all":"#0000FF"}'
```

See `test codes.txt` for a complete list of all available commands.

---

## Flashing ESP-01S

1. Connect **IO0** and **RST** to **GND**
2. Remove **RST** just before clicking upload in Arduino IDE
3. Plug **RST** back in, remove **IO0**, then remove **RST** again
4. Device should now be running the flashed code

---

## Discord Bot Integration

Python and Node.js examples are provided in the `/bot` directory for controlling LEDs via Discord commands. See `bot/README.md` for setup instructions.

---

## TO DO

- [ ] Add web dashboard for device management
- [ ] Implement access control lists (ACL) for MQTT topics
- [ ] Create 3D printable enclosure designs

---

## Troubleshooting

### LEDs not lighting up
- Check GPIO pin (default is 2, may need to change for your board)
- Verify 5V power supply is adequate
- Check data line connection
- Try adding a 330Ω resistor in series with data line

### MQTT not connecting
- Verify broker URL and credentials
- Check firewall/network settings
- Ensure port 8883 is open
- Test with `mosquitto_pub` from command line

### WiFi constantly disconnecting
- Check signal strength
- Verify router compatibility with ESP8266/ESP32
- Try increasing `TIMEOUT_BEFORE_AP` value

### Effects not smooth
- Reduce `NUM_LEDS` if too many LEDs
- Check power supply quality
- Increase `currentEffect.speed` value for slower updates

---

## License

MIT License - See LICENSE file for details

## Contributing

Pull requests welcome! Please test thoroughly before submitting.
