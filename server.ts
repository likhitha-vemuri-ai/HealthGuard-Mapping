import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("healthguard.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    role TEXT CHECK(role IN ('citizen', 'asha', 'government')),
    street_name TEXT,
    house_number TEXT,
    ward_no TEXT,
    age INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    role TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS symptom_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    symptoms TEXT,
    problem_type TEXT CHECK(problem_type IN ('disease', 'drainage', 'other')),
    severity INTEGER,
    latitude REAL,
    longitude REAL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'solved')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS vital_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    temperature REAL,
    heart_rate INTEGER,
    blood_pressure TEXT,
    oxygen_level INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ai_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symptom_log_id INTEGER,
    predicted_disease TEXT,
    confidence REAL,
    risk_level TEXT,
    recommended_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(symptom_log_id) REFERENCES symptom_logs(id)
  );

  CREATE TABLE IF NOT EXISTS geo_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT,
    entity_id INTEGER,
    latitude REAL,
    longitude REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS infrastructure_layers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    name TEXT,
    latitude REAL,
    longitude REAL,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS emergency_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    message TEXT,
    latitude REAL,
    longitude REAL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS government_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    author_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    user_id INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/signup", (req, res) => {
    const { email, password, fullName, role, streetName, houseNumber, wardNo, age } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (email, password, full_name, role, street_name, house_number, ward_no, age) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        email, password, fullName, role, streetName, houseNumber, wardNo, age
      );
      res.json({ id: info.lastInsertRowid, email, fullName, role, streetName, houseNumber, wardNo, age });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/symptoms", async (req, res) => {
    const { userId, symptoms, severity, latitude, longitude, problemType } = req.body;
    const info = db.prepare("INSERT INTO symptom_logs (user_id, symptoms, severity, latitude, longitude, problem_type) VALUES (?, ?, ?, ?, ?, ?)").run(userId, symptoms, severity, latitude, longitude, problemType);
    const symptomLogId = info.lastInsertRowid;

    // AI Prediction using Gemini
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const currentTime = new Date().toLocaleString();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze these symptoms: ${symptoms}. Severity: ${severity}/10. Problem Type: ${problemType}. Reported at: ${currentTime}. Predict the likely disease, confidence (0-1), risk level (Low, Medium, High, Critical), and recommended action. Return JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              predicted_disease: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              risk_level: { type: Type.STRING },
              recommended_action: { type: Type.STRING }
            },
            required: ["predicted_disease", "confidence", "risk_level", "recommended_action"]
          }
        }
      });

      const prediction = JSON.parse(response.text);
      db.prepare("INSERT INTO ai_predictions (symptom_log_id, predicted_disease, confidence, risk_level, recommended_action) VALUES (?, ?, ?, ?, ?)").run(
        symptomLogId,
        prediction.predicted_disease,
        prediction.confidence,
        prediction.risk_level,
        prediction.recommended_action
      );

      if (prediction.risk_level === "Critical" || prediction.risk_level === "High") {
        db.prepare("INSERT INTO emergency_alerts (type, message, latitude, longitude) VALUES (?, ?, ?, ?)").run(
          "Disease Outbreak",
          `High risk of ${prediction.predicted_disease} detected in your area.`,
          latitude,
          longitude
        );
      }

      res.json({ symptomLogId, prediction });
    } catch (e) {
      console.error("AI Error:", e);
      res.json({ symptomLogId, prediction: null });
    }
  });

  app.post("/api/problems/:id/solve", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE symptom_logs SET status = 'solved' WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.get("/api/map-data", (req, res) => {
    const symptoms = db.prepare(`
      SELECT s.*, p.predicted_disease, p.risk_level, u.full_name, u.street_name, u.house_number, u.ward_no, u.age
      FROM symptom_logs s 
      LEFT JOIN ai_predictions p ON s.id = p.symptom_log_id
      LEFT JOIN users u ON s.user_id = u.id
    `).all();
    const infrastructure = db.prepare("SELECT * FROM infrastructure_layers").all();
    const alerts = db.prepare("SELECT * FROM emergency_alerts WHERE status = 'active'").all();
    res.json({ symptoms, infrastructure, alerts });
  });

  app.get("/api/user-stats/:userId", (req, res) => {
    const logs = db.prepare("SELECT * FROM symptom_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").all(req.params.userId);
    const vitals = db.prepare("SELECT * FROM vital_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(req.params.userId);
    res.json({ logs, vitals });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
