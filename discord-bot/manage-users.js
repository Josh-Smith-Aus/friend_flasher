import Database from "better-sqlite3";
import readline from "readline";

const db = new Database("/data/led-map.db");

// CREATE TABLE IF NOT EXISTS
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Prepared statements
const getAllUsers = db.prepare("SELECT * FROM user_leds ORDER BY created_at DESC");
const getUserById = db.prepare("SELECT * FROM user_leds WHERE user_id = ?");
const deleteUser = db.prepare("DELETE FROM user_leds WHERE user_id = ?");
const toggleUser = db.prepare("UPDATE user_leds SET enabled = ? WHERE user_id = ?");

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

function listUsers() {
  const users = getAllUsers.all();
  
  if (users.length === 0) {
    console.log("\n📋 No users configured yet.\n");
    return;
  }

  console.log("\n📋 Current Users:");
  console.log("═".repeat(100));
  
  users.forEach((user, i) => {
    const status = user.enabled ? "✅" : "❌";
    console.log(`\n${i + 1}. ${status} ${user.username || "Unknown"}`);
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Device: ${user.device} | LED: ${user.led}`);
    console.log(`   Join: ${user.effect} (${user.color}) | Leave: ${user.sleep_effect}`);
    console.log(`   Created: ${user.created_at}`);
  });
  
  console.log("\n" + "═".repeat(100) + "\n");
}

async function addUser() {
  console.log("\n➕ Add New User");
  console.log("─".repeat(50));
  
  const userId = await question("Discord User ID: ");
  const username = await question("Username (optional): ");
  const device = await question("Device topic (e.g., lights/josh183A/control): ");
  const led = parseInt(await question("LED index (0-9): "));
  const color = await question("Color (e.g., #FF0000): ");
  const effect = await question("Join effect (wakeup/pulse/breathe/solid) [wakeup]: ") || "wakeup";
  
  let duration = 6000;
  let next_effect = "breathe";
  let speed = "medium";
  
  if (effect === "wakeup") {
    duration = parseInt(await question("Duration (ms) [6000]: ") || "6000");
    next_effect = await question("Next effect (breathe/pulse/none) [breathe]: ") || "breathe";
  } else if (effect === "pulse" || effect === "breathe") {
    speed = await question("Speed (slow/medium/fast) [medium]: ") || "medium";
  }
  
  const brightness = parseInt(await question("Brightness (0-255) [255]: ") || "255");
  const sleep_effect = await question("Leave effect (sleep/off) [sleep]: ") || "sleep";
  const sleep_duration = parseInt(await question("Sleep duration (ms) [4000]: ") || "4000");
  
  try {
    upsertUser.run(
      userId, username, device, led, color, effect,
      duration, next_effect, speed, brightness,
      sleep_effect, sleep_duration
    );
    console.log("\n✅ User added successfully!\n");
  } catch (err) {
    console.error("\n❌ Error adding user:", err.message, "\n");
  }
}

async function removeUser() {
  const userId = await question("\nUser ID to remove: ");
  const user = getUserById.get(userId);
  
  if (!user) {
    console.log("❌ User not found\n");
    return;
  }
  
  console.log(`\nAre you sure you want to remove ${user.username || user.user_id}?`);
  const confirm = await question("Type 'yes' to confirm: ");
  
  if (confirm.toLowerCase() === 'yes') {
    deleteUser.run(userId);
    console.log("✅ User removed\n");
  } else {
    console.log("❌ Cancelled\n");
  }
}

async function toggleUserStatus() {
  const userId = await question("\nUser ID to enable/disable: ");
  const user = getUserById.get(userId);
  
  if (!user) {
    console.log("❌ User not found\n");
    return;
  }
  
  const newStatus = user.enabled ? 0 : 1;
  toggleUser.run(newStatus, userId);
  console.log(`✅ User ${newStatus ? 'enabled' : 'disabled'}\n`);
}

async function main() {
  console.log("\n🎮 LED User Manager");
  console.log("═".repeat(50));
  
  while (true) {
    console.log("\nOptions:");
    console.log("1. List all users");
    console.log("2. Add/Update user");
    console.log("3. Remove user");
    console.log("4. Enable/Disable user");
    console.log("5. Exit");
    
    const choice = await question("\nSelect option (1-5): ");
    
    switch (choice) {
      case "1":
        listUsers();
        break;
      case "2":
        await addUser();
        break;
      case "3":
        await removeUser();
        break;
      case "4":
        await toggleUserStatus();
        break;
      case "5":
        console.log("\n👋 Goodbye!\n");
        rl.close();
        db.close();
        process.exit(0);
      default:
        console.log("\n❌ Invalid option\n");
    }
  }
}

main();
