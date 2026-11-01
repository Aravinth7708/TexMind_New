import "dotenv/config";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "./client";
import { runMigrations } from "./migrations";

/** Create only factory administrator accounts. Business records start empty. */
export function seedAll() {
  runMigrations();
  const hasAdmin = db.prepare("SELECT 1 FROM users WHERE role IN ('admin','manager') LIMIT 1").get();
  if (hasAdmin) {
    console.log("Factory accounts already exist; no sample business data is seeded.");
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, title)
    VALUES (?, ?, ?, ?, 'admin', ?)
  `);
  insertUser.run(uuidv4(), "admin@texmind.in", bcrypt.hashSync("texmind@admin", 10), "Factory Administrator", "Administrator");
  insertUser.run(uuidv4(), "manager@texmind.in", bcrypt.hashSync("texmind", 10), "Factory Manager", "Factory Manager");

  console.log("Factory administrator accounts created. Business data tables are empty.");
}

seedAll();
