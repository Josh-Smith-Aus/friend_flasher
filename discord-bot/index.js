import { Client, GatewayIntentBits } from "discord.js";
import mqtt from "mqtt";
import Database from "better-sqlite3";

// ---------- ENV ----------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtts://ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud:8883";

if (!DISCORD_TOKEN || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error("❌ Missing required environment variables!");
  console.error("Required: DISCORD_TOKEN, MQTT_USERNAME, MQTT_PASSWORD");
  process.exit(1);
}

// ---------- DATABASE ----------
const db = new Database("/data/led-map.db");
db.pragma("journal_mode = WAL"); // Better concurrency

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_leds (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    device TEXT NOT NULL,
    led INTEGER NOT NULL,
    color TEXT DEFAULT '#00FFAA',
    effect TEXT DEFAULT 'wakeup',
    duration INTEGER DEFAULT 6000,
    next_effect TEXT DEFAULT 'breathe',
    speed TEXT DEFAULT 'medium',
    brightness INTEGER DEFAULT 255,
    sleep_effect TEXT DEFAULT 'sleep',
    sleep_duration INTEGER DEFAULT 4000,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Prepared statements
const getUserConfig = db.prepare(`
  SELECT * FROM user_leds 
  WHERE user_id = ? AND enabled = 1
`);

const getAllConfigs = db.prepare(`
  SELECT * FROM user_leds 
  WHERE enabled = 1
`);

const upsertUser = db.prepare(`
  INSERT INTO user_leds (
    user_id, username, device, led, color, effect, 
    duration, next_effect, speed, brightness, 
    sleep_effect, sleep_duration
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    username = excluded.username,
    device = excluded.device,
    led = excluded.led,
    color = excluded.color,
    effect = excluded.effect,
    duration = excluded.duration,
    next_effect = excluded.next_effect,
    speed = excluded.speed,
    brightness = excluded.brightness,
    sleep_effect = excluded.sleep_effect,
    sleep_duration = excluded.sleep_duration,
    updated_at = CURRENT_TIMESTAMP
`);

const toggleUser = db.prepare(`
  UPDATE user_leds 
  SET enabled = ?, updated_at = CURRENT_TIMESTAMP 
  WHERE user_id = ?
`);

const deleteUser = db.prepare(`
  DELETE FROM user_leds WHERE user_id = ?
`);

// Database helper functions
function addOrUpdateUser(userId, username, config) {
  try {
    upsertUser.run(
      userId,
      username,
      config.device,
      config.led,
      config.color || '#00FFAA',
      config.effect || 'wakeup',
      config.duration || 6000,
      config.next_effect || 'breathe',
      config.speed || 'medium',
      config.brightness || 255,
      config.sleep_effect || 'sleep',
      config.sleep_duration || 4000
    );
    console.log(`✅ Added/Updated user: ${username} (${userId})`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to add user ${username}:`, err);
    return false;
  }
}

function listUsers() {
  const users = getAllConfigs.all();
  console.log("\n📋 Current user mappings:");
  console.log("─".repeat(80));
  users.forEach(user => {
    console.log(`👤 ${user.username || user.user_id}`);
    console.log(`   LED: ${user.led} | Color: ${user.color} | Effect: ${user.effect}`);
    console.log(`   Device: ${user.device}`);
  });
  console.log("─".repeat(80));
  console.log(`Total: ${users.length} users\n`);
}

// ---------- MQTT ----------
const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  rejectUnauthorized: false,
  reconnectPeriod: 5000,
});

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
});

mqttClient.on("error", (err) => {
  console.error("❌ MQTT Error:", err);
});

mqttClient.on("offline", () => {
  console.warn("⚠️  MQTT client offline, will retry...");
});

mqttClient.on("reconnect", () => {
  console.log("🔄 Reconnecting to MQTT...");
});

function publishLedCommand(deviceId, command, username = "unknown") {
  if (!mqttClient.connected) {
    console.warn(`⚠️ MQTT not connected, skipping publish for ${username}`);
    return;
  }

  const topic = `lights/${deviceId}/control`;
  const payload = JSON.stringify(command);

  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ MQTT publish failed for ${username}:`, err);
    } else {
      console.log(`📤 ${username} → ${topic}: ${command.effect || 'json'}`);
    }
  });
}

function buildCommand(cfg, isJoin) {
  if (isJoin) {
    // User joined voice
    if (cfg.effect === "wakeup") {
      return {
        effect: "wakeup",
        led: cfg.led,
        color: cfg.color,
        duration: cfg.duration,
        next: cfg.next_effect,
      };
    } else if (cfg.effect === "pulse" || cfg.effect === "breathe") {
      return {
        effect: cfg.effect,
        led: cfg.led,
        color: cfg.color,
        speed: cfg.speed,
      };
    } else if (cfg.effect === "solid") {
      return {
        leds: [{ i: cfg.led, c: cfg.color, b: cfg.brightness }],
      };
    } else {
      return {
        leds: [{ i: cfg.led, c: cfg.color }],
      };
    }
  } else {
    // User left voice
    if (cfg.sleep_effect === "sleep") {
      return {
        effect: "sleep",
	led: cfg.led,
        duration: cfg.sleep_duration,
      };
    } else {
      return {
        leds: [{ i: cfg.led, c: "#000000" }],
      };
    }
  }
}

// ---------- DISCORD ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", () => {
  console.log(`\n🤖 Bot logged in as ${client.user.tag}\n`);
  listUsers();
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;
  const username = newState.member?.user?.username || userId;

  const cfg = getUserConfig.get(userId);
  if (!cfg) return;

  // Joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    const channelName = newState.channel?.name || "unknown";
    console.log(`🔊 ${username} joined ${channelName}`);
    
    const command = buildCommand(cfg, true);
    publishLedCommand(cfg.device, command, username);
  }

  // Left voice channel
  if (oldState.channelId && !newState.channelId) {
    const channelName = oldState.channel?.name || "unknown";
    console.log(`🔇 ${username} left ${channelName}`);
    
    const command = buildCommand(cfg, false);
    publishLedCommand(cfg.device, command, username);
  }

  // Moved between channels
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    console.log(`🔄 ${username} moved channels`);
    // Optional: trigger a quick color change
  }
});

// ---------- GRACEFUL SHUTDOWN ----------
function shutdown() {
  console.log("\n👋 Shutting down gracefully...");
  db.close();
  mqttClient.end();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ---------- START ----------
console.log("🚀 Starting Discord LED Bot...");
console.log(`📡 MQTT Broker: ${MQTT_BROKER}`);
console.log(`👤 MQTT User: ${MQTT_USERNAME}\n`);

client.login(DISCORD_TOKEN);

// ---------- EXAMPLE: Add users programmatically ----------
// Uncomment and modify these to add users:

/*
addOrUpdateUser("123456789012345678", "User1", {
  device: "lights/josh183A/control",
  led: 1,
  color: "#00FFAA",
  effect: "wakeup",
  duration: 6000,
  next_effect: "breathe",
  sleep_effect: "sleep",
  sleep_duration: 4000
});

addOrUpdateUser("987654321098765432", "User2", {
  device: "lights/josh183A/control",
  led: 2,
  color: "#FF4400",
  effect: "pulse",
  speed: "medium",
  sleep_effect: "sleep"
});
*/
