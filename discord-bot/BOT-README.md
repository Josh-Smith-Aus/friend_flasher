## Discord Bot - Managing Users

### Quick Start: Adding a User

1. **Stop the bot** (if running):
```bash
   docker-compose stop
```

2. **Run the management script(exec into container to run users script)**:
```bash
   cd discord-bot
   docker exec -it discord-led-bot node manage-users.js
```

3. **Select option 2** (Add/Update user)

4. **Enter user details**:
   - **Discord User ID**: Right-click user in Discord → Copy User ID (enable Developer Mode in Discord settings first)
   - **Username**: Any friendly name (e.g., "Josh")
   - **Device topic**: `lights/josh183A/control` (replace with your device ID)
   - **LED index**: 0-9 (which LED this user controls)
   - **Color**: Hex color like `#00FFAA`
   - **Join effect**: `wakeup`, `pulse`, `breathe`, or `solid`
   - **Leave effect**: `sleep` (fade out) or `off` (instant off)

5. **Restart the bot**:
```bash
   docker-compose start
```

### Example Configuration
```
Discord User ID: 123456789012345678
Username: Josh
Device topic: lights/josh183A/control
LED index: 1
Color: #00FFAA
Join effect: wakeup
Duration (ms): 6000
Next effect: breathe
Leave effect: sleep
Sleep duration (ms): 4000
```

When Josh joins a voice channel, LED 1 will fade in cyan over 6 seconds, then begin breathing. When he leaves, it will fade out over 4 seconds.

---
