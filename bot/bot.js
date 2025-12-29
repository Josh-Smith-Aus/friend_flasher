import { Client, GatewayIntentBits } from "discord.js";
import mqtt from "mqtt";
import fs from "fs";

// ---------- CONFIG ----------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MQTT_URL = "mqtts://ff0a9749ad4941c9b25358a360502dba.s1.eu.hivemq.cloud:8883";
const MQTT_USERNAME = "discord-bot";
const MQTT_PASSWORD = "YOUR_PASSWORD";

// Load LED mapping
const mapping = JSON.parse(fs.readFileSync("./led-map.json", "utf8"));

// ---------- MQTT ----------
const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
});

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT");
});

// ---------- DISCORD ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ---------- VOICE EVENTS ----------
client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;

  if (!mapping.users[userId]) return;

  const userConfig = mapping.users[userId];
  const topic = `lights/${userConfig.device}/control`;

  // JOIN voice
  if (!oldState.channelId && newState.channelId) {
    console.log(`${userConfig.name} joined voice`);

    mqttClient.publish(
      topic,
      JSON.stringify({
        effect: "wakeup",
        led: userConfig.led,
        color: userConfig.color,
        duration: 6000,
        next: "breathe",
      })
    );
  }

  // LEAVE voice
  if (oldState.channelId && !newState.channelId) {
    console.log(`${userConfig.name} left voice`);

    mqttClient.publish(
      topic,
      JSON.stringify({
        effect: "sleep",
        duration: 4000,
      })
    );
  }
});

client.login(DISCORD_TOKEN);
