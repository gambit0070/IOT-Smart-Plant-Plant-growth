from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import threading
import requests
import time
import os
from datetime import datetime
from routes.notification_settings import bp_notification
from routes.alerts import bp_alerts


# ========================= 
# db init
# =========================
DB_FILE = "blynk_data.db"
BLYNK_TOKEN = "upCmFhrusVTxhY0CqDYxOkeaoL90DeNZ"
BLYNK_API = f"https://blynk.cloud/external/api/get?token={BLYNK_TOKEN}&v1&v2&v3&v6&v10"
BLYNK_WRITE_API = f"https://blynk.cloud/external/api/update?token={BLYNK_TOKEN}"

DEFAULT_SETTINGS = {
    "V8": 0,        # Smart Control default off
    "V26": 0,       # Smart Pump Control default off
    "V27": 0,       # Smart Lamp Control default off
    "V28": 0,       # Smart Fan Control default off
    "V20": 40,      # Pump ON Threshold
    "V21": 10,      # Fan Interval
    "V22": 300,     # Lamp ON Threshold
    "V23": 60,      # Pump OFF Threshold
    "V24": 500,     # Lamp OFF Threshold
    "V25": 5        # Fan Duration
}

def get_safe_connection():
    return sqlite3.connect(DB_FILE, check_same_thread=False)

def check_table_exists(conn, table_name):
    """Check if the specified table exists"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' AND name='{table_name}';
    """)
    return cursor.fetchone() is not None

def init_db():
    """
    Инициализация базы данных:
      1. sensor_data
      2. control_history
      3. current_settings
      4. notification_settings (с дефолтными значениями)
      5. alerts
    """
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    cursor = conn.cursor()

    # 1) sensor_data
    if not check_table_exists(conn, "sensor_data"):
        print("📊 Creating sensor_data table...")
        cursor.execute("""
            CREATE TABLE sensor_data (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                soil_moisture  REAL,
                temperature    REAL,
                humidity       REAL,
                light          REAL,
                pressure       REAL,
                timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ sensor_data table created")
    else:
        print("✅ sensor_data table already exists")
        # — если таблица есть, но в старом формате, переименуем колонки:
        #  soil    → soil_moisture
        try:
            cursor.execute("SELECT soil_moisture FROM sensor_data LIMIT 1")
        except sqlite3.OperationalError:
            print("⚠️ Renaming 'soil' → 'soil_moisture'")
            cursor.execute("ALTER TABLE sensor_data RENAME COLUMN soil TO soil_moisture")
            print("✅ soil → soil_moisture renamed")
        #  temp    → temperature
        try:
            cursor.execute("SELECT temperature FROM sensor_data LIMIT 1")
        except sqlite3.OperationalError:
            print("⚠️ Renaming 'temp' → 'temperature'")
            cursor.execute("ALTER TABLE sensor_data RENAME COLUMN temp TO temperature")
            print("✅ temp → temperature renamed")
        #  Pressure → pressure (если ещё не переименован)
        try:
            cursor.execute("SELECT Pressure FROM sensor_data LIMIT 1")
            print("⚠️ Renaming 'Pressure' → 'pressure'")
            cursor.execute("ALTER TABLE sensor_data RENAME COLUMN Pressure TO pressure")
            print("✅ Pressure → pressure renamed")
        except sqlite3.OperationalError:
            pass

    # 2) control_history
    if not check_table_exists(conn, "control_history"):
        print("📊 Creating control_history table...")
        cursor.execute('''
            CREATE TABLE control_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pin TEXT NOT NULL,
                value REAL NOT NULL,
                description TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("✅ control_history table created")
    else:
        print("✅ control_history table already exists")

    # 3) current_settings
    if not check_table_exists(conn, "current_settings"):
        print("📊 Creating current_settings table...")
        cursor.execute('''
            CREATE TABLE current_settings (
                pin TEXT PRIMARY KEY,
                value REAL NOT NULL,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert default settings
        for pin, value in DEFAULT_SETTINGS.items():
            pin_descriptions = {
                "V8": "Smart Control",
                "V9": "Smart Pump Control",
                "V10": "Smart Lamp Control",
                "V11": "Smart Fan Control",
                "V20": "Pump ON Threshold",
                "V21": "Fan Interval",
                "V22": "Lamp ON Threshold",
                "V23": "Pump OFF Threshold",
                "V24": "Lamp OFF Threshold",
                "V25": "Fan Duration"
            }
            description = pin_descriptions.get(pin, f"Unknown Pin {pin}")
            
            cursor.execute('''
                INSERT INTO current_settings (pin, value, description)
                VALUES (?, ?, ?)
            ''', (pin, value, description))
        
        print("✅ current_settings table created with default values")
    else:
        print("✅ current_settings table already exists")
        
        # Check if we need to add new pin descriptions for the individual smart controls
        pin_descriptions = {
            "V26": "Smart Pump Control",
            "V27": "Smart Lamp Control",
            "V28": "Smart Fan Control"
        }
        
        # Add new pins if they don't exist
        for pin, description in pin_descriptions.items():
            cursor.execute("SELECT COUNT(*) FROM current_settings WHERE pin = ?", (pin,))
            if cursor.fetchone()[0] == 0:
                print(f"📊 Adding new setting: {description} ({pin})")
                cursor.execute('''
                    INSERT INTO current_settings (pin, value, description)
                    VALUES (?, ?, ?)
                ''', (pin, 0, description))

    # 4) notification_settings
    if not check_table_exists(conn, "notification_settings"):
        print("📊 Creating notification_settings table...")
        cursor.execute("""
            CREATE TABLE notification_settings (
                id                 INTEGER PRIMARY KEY CHECK (id = 1),
                min_temp           INTEGER,
                max_temp           INTEGER,
                min_humid          INTEGER,
                max_humid          INTEGER,
                min_press          INTEGER,
                max_press          INTEGER,
                cold_alert         INTEGER,
                heat_alert         INTEGER,
                dry_alert          INTEGER,
                humid_alert        INTEGER,
                low_press_alert    INTEGER,
                high_press_alert   INTEGER
            )
        """)
        cursor.execute("INSERT INTO notification_settings (id) VALUES (1)")
        print("✅ notification_settings table created")

        # Инициализируем notification_settings дефолтными значениями
        print("🔧 Initializing notification_settings with defaults")
        cursor.execute("""
            UPDATE notification_settings
               SET min_temp         = 10,
                   max_temp         = 35,
                   min_humid        = 30,
                   max_humid        = 70,
                   min_press        = 980,
                   max_press        = 1020,
                   cold_alert       = 1,
                   heat_alert       = 1,
                   dry_alert        = 1,
                   humid_alert      = 1,
                   low_press_alert  = 1,
                   high_press_alert = 1
             WHERE id = 1
        """)

    # 5) alerts
    if not check_table_exists(conn, "alerts"):
        print("📊 Creating alerts table...")
        cursor.execute("""
            CREATE TABLE alerts (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                type      TEXT    NOT NULL,
                message   TEXT    NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_read   INTEGER DEFAULT 0
            )
        """)
        print("✅ alerts table created")
    
    if not check_table_exists(conn, "device_operation_history"):
        cursor.execute('''
            CREATE TABLE device_operation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device TEXT NOT NULL,
                status INTEGER NOT NULL,  -- 1 for on, 0 for off
                start_time DATETIME NOT NULL,
                end_time DATETIME,        -- NULL means device is still running
                duration INTEGER,         -- Runtime in seconds
                reason TEXT               -- Why the operation occurred (e.g., smart control, manual)
            )
        ''')
    
    if not check_table_exists(conn, "device_current_status"):
        cursor.execute('''
            CREATE TABLE device_current_status (
                device TEXT PRIMARY KEY,
                status INTEGER NOT NULL,  -- 1 for on, 0 for off
                since DATETIME NOT NULL,  -- When the current status started
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # Сохраняем все изменения и закрываем соединение

    
    conn.commit()
    conn.close()
    

# ========================= 
# save current data
# =========================
def save_to_db(soil, temp, hum, light, pressure):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensor_data (soil_moisture, temperature, humidity, light, pressure)
        VALUES (?, ?, ?, ?, ?)
    ''', (soil, temp, hum, light, pressure))
    print("✅ Inserted sensor data:", soil, temp, hum, light, pressure)
    conn.commit()
    conn.close()

def save_control_setting(pin, value):
    pin_descriptions = {
        "V8": "Smart Control",
        "V26": "Smart Pump Control",
        "V27": "Smart Lamp Control",
        "V28": "Smart Fan Control",
        "V20": "Pump ON Threshold",
        "V21": "Fan Interval",
        "V22": "Lamp ON Threshold",
        "V23": "Pump OFF Threshold",
        "V24": "Lamp OFF Threshold",
        "V25": "Fan Duration"
    }
    
    description = pin_descriptions.get(pin, f"Unknown Pin {pin}")
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Make sure tables exist
    if not check_table_exists(conn, "control_history"):
        cursor.execute('''
            CREATE TABLE control_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pin TEXT NOT NULL,
                value REAL NOT NULL,
                description TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    
    if not check_table_exists(conn, "current_settings"):
        cursor.execute('''
            CREATE TABLE current_settings (
                pin TEXT PRIMARY KEY,
                value REAL NOT NULL,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    
    if not check_table_exists(conn, "remembered_smart_controls"):
        cursor.execute('''
            CREATE TABLE remembered_smart_controls (
                pin TEXT PRIMARY KEY,
                value INTEGER NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Initialize with default values
        remembered_pins = ["V26", "V27", "V28"]
        for rpin in remembered_pins:
            cursor.execute('''
                INSERT INTO remembered_smart_controls (pin, value)
                VALUES (?, ?)
            ''', (rpin, 0))
    
    # Special case 1: Remember individual smart control settings when they change
    if pin in ["V26", "V27", "V28"] and value == 1:
        print(f"🔄 Remembering smart control state: {pin}={value}")
        cursor.execute('''
            REPLACE INTO remembered_smart_controls (pin, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        ''', (pin, value))
    
    # Special case 2: When V8 (global smart) is turned off, disable but remember individual settings
    if pin == "V8" and value == 0:
        print("🔄 Global smart control turned off, disabling individual smart controls...")
        
        # Insert into control history for the global smart control
        cursor.execute('''
            INSERT INTO control_history (pin, value, description)
            VALUES (?, ?, ?)
        ''', (pin, value, description))
        
        # Update current settings for the global smart control
        cursor.execute('''
            REPLACE INTO current_settings (pin, value, description, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ''', (pin, value, description))
        
        # Also turn off all individual smart controls
        individual_controls = [
            ("V26", "Smart Pump Control"),
            ("V27", "Smart Lamp Control"),
            ("V28", "Smart Fan Control")
        ]
        
        for ctrl_pin, ctrl_desc in individual_controls:
            # Insert into control history
            cursor.execute('''
                INSERT INTO control_history (pin, value, description)
                VALUES (?, ?, ?)
            ''', (ctrl_pin, 0, f"{ctrl_desc} (auto-disabled)"))
            
            # Update current settings
            cursor.execute('''
                REPLACE INTO current_settings (pin, value, description, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ''', (ctrl_pin, 0, ctrl_desc))
            
            # Send to Blynk
            blynk_url = f"{BLYNK_WRITE_API}&{ctrl_pin}=0"
            try:
                blynk_response = requests.get(blynk_url)
                print(f"📤 Auto-disabled {ctrl_desc}: {blynk_url}, Response: {blynk_response.status_code}")
            except Exception as e:
                print(f"❌ Failed to update Blynk for {ctrl_pin}: {e}")
        
        print("✅ All individual smart controls disabled")
    
    # Special case 3: When V8 (global smart) is turned on, restore individual settings
    elif pin == "V8" and value == 1:
        print("🔄 Global smart control turned on, restoring individual smart controls...")
        
        # Insert into control history for the global smart control
        cursor.execute('''
            INSERT INTO control_history (pin, value, description)
            VALUES (?, ?, ?)
        ''', (pin, value, description))
        
        # Update current settings for the global smart control
        cursor.execute('''
            REPLACE INTO current_settings (pin, value, description, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ''', (pin, value, description))
        
        # Restore remembered individual smart controls
        individual_controls = [
            ("V26", "Smart Pump Control"),
            ("V27", "Smart Lamp Control"),
            ("V28", "Smart Fan Control")
        ]
        
        for ctrl_pin, ctrl_desc in individual_controls:
            # Get remembered value
            cursor.execute('''
                SELECT value FROM remembered_smart_controls WHERE pin = ?
            ''', (ctrl_pin,))
            row = cursor.fetchone()
            remembered_value = row[0] if row else 0
            
            # Only restore if it was on
            if remembered_value == 1:
                # Insert into control history
                cursor.execute('''
                    INSERT INTO control_history (pin, value, description)
                    VALUES (?, ?, ?)
                ''', (ctrl_pin, remembered_value, f"{ctrl_desc} (auto-restored)"))
                
                # Update current settings
                cursor.execute('''
                    REPLACE INTO current_settings (pin, value, description, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ''', (ctrl_pin, remembered_value, ctrl_desc))
                
                # Send to Blynk
                blynk_url = f"{BLYNK_WRITE_API}&{ctrl_pin}={remembered_value}"
                try:
                    blynk_response = requests.get(blynk_url)
                    print(f"📤 Auto-restored {ctrl_desc}: {blynk_url}, Response: {blynk_response.status_code}")
                except Exception as e:
                    print(f"❌ Failed to update Blynk for {ctrl_pin}: {e}")
        
        print("✅ Restored individual smart controls")
    else:
        # Normal handling for other pins
        # Insert into control history
        cursor.execute('''
            INSERT INTO control_history (pin, value, description)
            VALUES (?, ?, ?)
        ''', (pin, value, description))
        
        # Update current settings
        cursor.execute('''
            REPLACE INTO current_settings (pin, value, description, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ''', (pin, value, description))
    
    print(f"✅ Saved control setting: {description} ({pin}) = {value}")
    conn.commit()
    conn.close()

# ========================= 
# Check if smart control is enabled for a device
# =========================
def is_smart_control_enabled_for_device(device):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Check if the current_settings table exists
    if not check_table_exists(conn, "current_settings"):
        conn.close()
        return False
    
    # Get global smart control status (V8)
    cursor.execute("SELECT value FROM current_settings WHERE pin = 'V8'")
    global_smart = cursor.fetchone()
    
    if not global_smart or global_smart[0] != 1:
        conn.close()
        return False
    
    # Device-specific smart control pins
    device_pins = {
        "pump": "V26",
        "lamp": "V27",
        "fan": "V28"
    }
    
    device_pin = device_pins.get(device)
    if not device_pin:
        conn.close()
        return False
    
    # Get device-specific smart control status
    cursor.execute("SELECT value FROM current_settings WHERE pin = ?", (device_pin,))
    device_smart = cursor.fetchone()
    
    conn.close()
    return device_smart and device_smart[0] == 1

# ========================= 
# updating from Blynk 
# =========================
def collect_loop():
    while True:
        try:
            res  = requests.get(BLYNK_API)
            data = res.json()
            if "error" in data:
                print("⛔ Blynk error:", data["error"].get("message"))
                time.sleep(10)
                continue

            # 1) Запись в sensor_data
            save_to_db(data["v1"], data["v2"], data["v3"], data["v6"], data["v10"])

            # 2) Вычисление нарушений порогов
            alerts = evaluate_thresholds(
                temp=data["v2"],
                humidity=data["v3"],
                pressure=data["v10"],
            )

            # 3) Запись каждого события в таблицу alerts
            for key, msg in alerts:
                conn = sqlite3.connect(DB_FILE)
                c    = conn.cursor()
                c.execute(
                    "INSERT INTO alerts(type, message) VALUES(?, ?)",
                    (key, msg)
                )
                conn.commit()
                conn.close()

        except Exception as e:
            print("❌ Error:", e)

        time.sleep(10000)

# ========================= 
#  Flask 
# =========================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.register_blueprint(bp_notification)
app.register_blueprint(bp_alerts)

@app.route("/latest", methods=["GET", "OPTIONS"])
def get_latest():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT timestamp, soil_moisture, temperature, humidity, light, pressure FROM sensor_data ORDER BY id DESC LIMIT 1")
    except sqlite3.OperationalError:
        # Try with capital P if lowercase didn't work
        cursor.execute("SELECT timestamp, soil_moisture, temperature, humidity, light, Pressure FROM sensor_data ORDER BY id DESC LIMIT 1")
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return jsonify({
            "timestamp": row[0],
            "soil": row[1],
            "temp": row[2],
            "humidity": row[3],
            "light": row[4],
            "pressure": row[5]  # Return as lowercase for consistency
        })
    return jsonify({"error": "No data"})

@app.route("/history", methods=["GET", "OPTIONS"])
def get_history():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT timestamp, soil_moisture, temperature, humidity, light, pressure FROM sensor_data ORDER BY id DESC LIMIT 50")
    except sqlite3.OperationalError:
        # Try with capital P if lowercase didn't work
        cursor.execute("SELECT timestamp, soil_moisture, temperature, humidity, light, Pressure FROM sensor_data ORDER BY id DESC LIMIT 50")
    
    rows = cursor.fetchall()
    conn.close()
    
    history = [
        {"timestamp": ts, "soil": s, "temp": t, "humidity": h, "light": l, "pressure": p}
        for ts, s, t, h, l, p in rows
    ]
    return jsonify(history)

@app.route("/stats", methods=["GET"])
def get_stats():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get averages - handle both pressure column names
    try:
        # Try with lowercase first
        cursor.execute("""
            SELECT 
                AVG(soil_moisture) as avg_soil,
                AVG(temperature) as avg_temp,
                AVG(humidity) as avg_humidity,
                AVG(light) as avg_light,
                AVG(pressure) as avg_pressure,
                MAX(temperature) as max_temp,
                MIN(temperature) as min_temp,
                MAX(humidity) as max_humidity,
                MIN(humidity) as min_humidity
            FROM sensor_data
            WHERE timestamp >= datetime('now', '-24 hours')
        """)
    except sqlite3.OperationalError:
        # Try with capital P
        cursor.execute("""
            SELECT 
                AVG(soil_moisture) as avg_soil,
                AVG(temperature) as avg_temp,
                AVG(humidity) as avg_humidity,
                AVG(light) as avg_light,
                AVG(Pressure) as avg_pressure,
                MAX(temperature) as max_temp,
                MIN(temperature) as min_temp,
                MAX(humidity) as max_humidity,
                MIN(humidity) as min_humidity
            FROM sensor_data
            WHERE timestamp >= datetime('now', '-24 hours')
        """)
    
    stats = cursor.fetchone()
    conn.close()
    
    if stats:
        return jsonify({
            "avg_soil": round(stats[0], 1) if stats[0] else 0,
            "avg_temp": round(stats[1], 1) if stats[1] else 0,
            "avg_humidity": round(stats[2], 1) if stats[2] else 0,
            "avg_light": round(stats[3], 1) if stats[3] else 0,
            "avg_pressure": round(stats[4], 1) if stats[4] else 0,
            "max_temp": round(stats[5], 1) if stats[5] else 0,
            "min_temp": round(stats[6], 1) if stats[6] else 0,
            "max_humidity": round(stats[7], 1) if stats[7] else 0,
            "min_humidity": round(stats[8], 1) if stats[8] else 0
        })
    
    return jsonify({"error": "No data"})

# Get current settings
@app.route("/current-settings", methods=["GET"])
def get_current_settings():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if not check_table_exists(conn, "current_settings"):
        conn.close()
        return jsonify(DEFAULT_SETTINGS)
    
    cursor.execute("SELECT pin, value FROM current_settings")
    rows = cursor.fetchall()
    conn.close()
    
    settings = {row["pin"]: row["value"] for row in rows}
    
    # Fill in any missing settings with defaults
    for pin, default_value in DEFAULT_SETTINGS.items():
        if pin not in settings:
            settings[pin] = default_value
    
    return jsonify(settings)

# Set smart control parameters
@app.route("/set-smart-param", methods=["POST", "OPTIONS"])
def set_smart_param():
    print(f"🔔 Received request at /set-smart-param, method: {request.method}")
    
    if request.method == "OPTIONS":
        print("🔔 Handling OPTIONS request")
        return "", 200
    
    try:
        print("🔔 Trying to parse JSON data...")
        data = request.json
        print(f"🔔 Parsed JSON: {data}")
        
        pin = data.get("pin")
        value = data.get("value")
        
        if not pin or value is None:
            print("❌ Missing pin or value in request")
            return jsonify({"error": "Missing pin or value"}), 400
        
        print(f"🔔 Processing pin={pin}, value={value}")
        
        # Save to database (handles special case for V8 turning off)
        save_control_setting(pin, value)
        
        # Send to Blynk (the one you're handling directly)
        url = f"{BLYNK_WRITE_API}&{pin}={value}"
        
        print(f"🔔 Sending request to Blynk: {url}")
        
        try:
            response = requests.get(url, timeout=10)  # Add timeout
            print(f"🔔 Blynk response status: {response.status_code}")
            print(f"🔔 Blynk response body: {response.text}")
            
            if response.status_code == 200:
                print(f"✅ Successfully set {pin} to {value}")
                return jsonify({
                    "status": "success", 
                    "blynk_status": response.status_code,
                    "blynk_response": response.text
                })
            else:
                print(f"❌ Failed to set {pin} to {value}: {response.text}")
                return jsonify({
                    "error": f"Blynk API error: {response.text}",
                    "blynk_status": response.status_code
                }), 500
        except requests.exceptions.RequestException as re:
            print(f"❌ Request to Blynk failed: {re}")
            return jsonify({
                "status": "partial_success", 
                "message": "Saved to local database but failed to update Blynk",
                "error": str(re)
            }), 207  # 207 Multi-Status
    except Exception as e:
        print(f"❌ Exception in set_smart_param: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Get control history
@app.route("/control-history", methods=["GET", "OPTIONS"])
def get_control_history():
    limit = request.args.get('limit', 50, type=int)
    
    conn = sqlite3.connect(DB_FILE)
    
    if not check_table_exists(conn, "control_history"):
        conn.close()
        return jsonify([])  
    
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, pin, value, description, timestamp FROM control_history ORDER BY id DESC LIMIT ?", 
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    
    history = [dict(row) for row in rows]
    return jsonify(history)

@app.route("/control-device", methods=["POST"])
def control_device():
    try:
        data = request.json
        device = data.get("device")
        status = int(data.get("status"))
        reason = data.get("reason", "Manual control")

        if device not in ["pump", "lamp", "fan"]:
            return jsonify({"error": "Invalid device"}), 400
        if status not in [0, 1]:
            return jsonify({"error": "Invalid status"}), 400

        now = datetime.now().isoformat()  # use ISO 8601 format

        with get_safe_connection() as conn:
            cursor = conn.cursor()

            # 1. Update current status
            cursor.execute('''
                INSERT OR REPLACE INTO device_current_status (device, status, since, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ''', (device, status, now))

            # 2. Update operation history
            if status == 1:
                cursor.execute('''
                    INSERT INTO device_operation_history (device, status, start_time, reason)
                    VALUES (?, ?, ?, ?)
                ''', (device, status, now, reason))
            else:
                cursor.execute('''
                    SELECT id, start_time FROM device_operation_history
                    WHERE device = ? AND status = 1 AND end_time IS NULL
                    ORDER BY id DESC LIMIT 1
                ''', (device,))
                row = cursor.fetchone()
                if row:
                    op_id, start_time = row
                    start_dt = datetime.fromisoformat(start_time)
                    now_dt = datetime.fromisoformat(now)
                    duration = int((now_dt - start_dt).total_seconds())
                    cursor.execute('''
                        UPDATE device_operation_history
                        SET end_time = ?, duration = ?
                        WHERE id = ?
                    ''', (now, duration, op_id))
            # send to Blynk
            device_to_pin = {
                "pump": "V4",
                "lamp": "V11",
                "fan":  "V7"
            }

            blynk_pin = device_to_pin.get(device)
            if blynk_pin:
                blynk_url = f"{BLYNK_WRITE_API}&{blynk_pin}={status}"
                try:
                    blynk_response = requests.get(blynk_url)
                    print(f"📤 Sent to Blynk: {blynk_url}, Response: {blynk_response.status_code}")
                except Exception as e:
                    print(f"❌ Failed to update Blynk pin {blynk_pin}: {e}")

            conn.commit()

        print(f"✅ Updated {device} status to {status}")
        return jsonify({"status": "success", "device": device, "new_status": status})

    except Exception as e:
        print(f"❌ Exception in control_device: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/device-history", methods=["GET"])
def get_device_history():
    try:
        device = request.args.get("device")
        status = request.args.get("status")
        reason = request.args.get("reason")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        sort = request.args.get("sort", "start_time")
        order = request.args.get("order", "desc")

        with get_safe_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = "SELECT * FROM device_operation_history WHERE 1=1"
            params = []

            if device:
                query += " AND device = ?"
                params.append(device)
            if status is not None and status != "":
                query += " AND status = ?"
                params.append(int(status))
            if reason:
                query += " AND reason LIKE ?"
                params.append(f"%{reason}%")
            if start_date and end_date:
                query += " AND start_time BETWEEN ? AND ?"
                params.append(start_date)
                params.append(end_date)

            if sort not in ["device", "status", "start_time", "end_time", "duration", "reason"]:
                sort = "start_time"
            if order.lower() not in ["asc", "desc"]:
                order = "desc"
            query += f" ORDER BY {sort} {order.upper()}"

            cursor.execute(query, params)
            rows = cursor.fetchall()
            result = [dict(row) for row in rows]
            return jsonify(result)

    except Exception as e:
        print("❌ Error in /device-history:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/device-status", methods=["GET"])
def get_device_status():
    try:
        with get_safe_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT device, status FROM device_current_status")
            rows = cursor.fetchall()
        devices = [{"device": row[0], "status": row[1]} for row in rows]
        return jsonify({"devices": devices})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Verify Blynk connectivity
@app.route("/test-blynk", methods=["GET"])
def test_blynk():
    try:
        # Test read API
        print("🔍 Testing Blynk read API...")
        read_url = BLYNK_API
        read_response = requests.get(read_url, timeout=10)
        
        # Test write API with a small value change to V0 (assuming V0 is not used)
        print("🔍 Testing Blynk write API...")
        test_pin = "V0"
        test_value = 0  # Neutral test value
        write_url = f"{BLYNK_WRITE_API}&{test_pin}={test_value}"
        write_response = requests.get(write_url, timeout=10)
        
        return jsonify({
            "status": "success",
            "blynk_read_status": read_response.status_code,
            "blynk_read_response": read_response.text if read_response.status_code == 200 else None,
            "blynk_write_status": write_response.status_code,
            "blynk_write_response": write_response.text if write_response.status_code == 200 else None,
            "blynk_token": BLYNK_TOKEN,
            "blynk_read_api": BLYNK_API,
            "blynk_write_api": BLYNK_WRITE_API
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "blynk_token": BLYNK_TOKEN,
            "blynk_read_api": BLYNK_API,
            "blynk_write_api": BLYNK_WRITE_API
        }), 500

@app.route("/")
def home():
    return "✅ Flask backend is running!"

# CORS
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response
# ========================= 
# notification logic
# =========================
def evaluate_thresholds(temp, humidity, pressure):
    """
    Compare temp/humidity/pressure against notification_settings
    and return a list of (key, message) tuples.
    """
    conn = sqlite3.connect(DB_FILE)
    cur  = conn.cursor()
    row = cur.execute("""
        SELECT min_temp, max_temp,
               min_humid, max_humid,
               min_press, max_press,
               cold_alert, heat_alert,
               dry_alert, humid_alert,
               low_press_alert, high_press_alert
        FROM notification_settings WHERE id=1
    """).fetchone()
    conn.close()
    if not row:
        return []

    (min_t, max_t,
     min_h, max_h,
     min_p, max_p,
     flag_cold, flag_heat,
     flag_dry, flag_humid,
     flag_lowp, flag_highp) = row

    alerts = []
    if flag_cold  and temp     < min_t: alerts.append(("cold",      f"Temperature too low: {temp}°C"))
    if flag_heat  and temp     > max_t: alerts.append(("heat",      f"Temperature too high: {temp}°C"))
    if flag_dry   and humidity < min_h: alerts.append(("dry",       f"Humidity too low: {humidity}%"))
    if flag_humid and humidity > max_h: alerts.append(("humid",     f"Humidity too high: {humidity}%"))
    if flag_lowp  and pressure < min_p: alerts.append(("low_press", f"Pressure too low: {pressure} hPa"))
    if flag_highp and pressure > max_p: alerts.append(("high_press",f"Pressure too high: {pressure} hPa"))

    return alerts
# ========================= 
# main app
# =========================
if __name__ == "__main__":
    init_db()
    
    collector_thread = threading.Thread(target=collect_loop, daemon=True)
    collector_thread.start()
    
    # start Flask
    print("🚀 Starting Flask server on http://localhost:5050")
    app.run(debug=True, port=5050, host="0.0.0.0")

