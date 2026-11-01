import db from "./client";

export function runMigrations() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','supervisor','viewer','buyer','process')),
      stage TEXT,
      buyer_id TEXT REFERENCES buyers(id),
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Buyers table
    CREATE TABLE IF NOT EXISTS buyers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      country TEXT NOT NULL,
      contact TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      delayed INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      last_order TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES buyers(id),
      buyer TEXT NOT NULL,
      product TEXT NOT NULL,
      category TEXT NOT NULL,
      style_no TEXT NOT NULL,
      po_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      fabric TEXT NOT NULL,
      color TEXT NOT NULL,
      start_date TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('High','Medium','Low')),
      status TEXT NOT NULL CHECK(status IN ('On Track','Delayed','Completed','At Risk')),
      current_stage TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Order Stages table
    CREATE TABLE IF NOT EXISTS order_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      stage_key TEXT NOT NULL,
      label TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('completed','current','pending','delayed')),
      target INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      pending INTEGER NOT NULL DEFAULT 0,
      rejected INTEGER NOT NULL DEFAULT 0,
      progress INTEGER NOT NULL DEFAULT 0,
      rate INTEGER NOT NULL DEFAULT 0,
      manager TEXT NOT NULL,
      expected TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Order costing: detailed internal costs and the buyer-facing order total
    CREATE TABLE IF NOT EXISTS order_costs (
      order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      stage_costs_json TEXT NOT NULL DEFAULT '{}',
      material_cost REAL NOT NULL DEFAULT 0,
      packaging_cost REAL NOT NULL DEFAULT 0,
      logistics_cost REAL NOT NULL DEFAULT 0,
      other_cost REAL NOT NULL DEFAULT 0,
      buyer_order_total REAL NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Materials / Inventory
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      stock REAL NOT NULL DEFAULT 0,
      reserved REAL NOT NULL DEFAULT 0,
      min REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Admin Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      time TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      tone TEXT NOT NULL DEFAULT 'info',
      target_role TEXT NOT NULL DEFAULT 'admin',
      buyer_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Production Events (audit ledger)
    CREATE TABLE IF NOT EXISTS production_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      stage TEXT NOT NULL,
      completed_delta INTEGER NOT NULL DEFAULT 0,
      rejected_delta INTEGER NOT NULL DEFAULT 0,
      line_no TEXT,
      shift TEXT,
      photo_url TEXT,
      voice_transcript TEXT,
      note TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Proposals
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      title TEXT NOT NULL,
      action_type TEXT NOT NULL,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','dismissed')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_by TEXT,
      decided_at TEXT,
      decision_note TEXT
    );

    -- Document Intelligence / OCR table
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Tech-Pack', 'Purchase Order (PO)', 'Goods Receipt Note (GRN)')),
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      confidence_score REAL NOT NULL DEFAULT 95.0,
      status TEXT NOT NULL DEFAULT 'Needs Review' CHECK(status IN ('Verified', 'Needs Review', 'Processed')),
      buyer_name TEXT NOT NULL,
      po_number TEXT NOT NULL,
      style_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      fabric TEXT NOT NULL,
      gsm INTEGER NOT NULL DEFAULT 180,
      total_quantity INTEGER NOT NULL DEFAULT 0,
      delivery_date TEXT NOT NULL,
      size_breakdown TEXT NOT NULL,
      colorways TEXT NOT NULL,
      special_instructions TEXT,
      created_order_id TEXT REFERENCES orders(id),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Vision QC Inspections table
    CREATE TABLE IF NOT EXISTS vision_inspections (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      stage TEXT NOT NULL,
      item_name TEXT NOT NULL,
      inspection_time TEXT NOT NULL DEFAULT (datetime('now')),
      overall_result TEXT NOT NULL CHECK(overall_result IN ('PASS', 'FAIL', 'REWORK')),
      confidence REAL NOT NULL DEFAULT 95.0,
      image_url TEXT NOT NULL DEFAULT '/placeholder.svg',
      disposition TEXT CHECK(disposition IN ('ACCEPT', 'REWORK', 'SCRAP', 'PASS', 'FAIL')),
      disposition_by TEXT,
      disposition_at TEXT,
      disposition_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Vision Defect Bounding Boxes
    CREATE TABLE IF NOT EXISTS vision_defects (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL REFERENCES vision_inspections(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Stitch', 'Fabric', 'Color', 'Stain', 'Dimension', 'Other')),
      confidence REAL NOT NULL DEFAULT 90.0,
      coord_x REAL NOT NULL DEFAULT 0,
      coord_y REAL NOT NULL DEFAULT 0,
      coord_width REAL NOT NULL DEFAULT 0,
      coord_height REAL NOT NULL DEFAULT 0,
      severity TEXT NOT NULL CHECK(severity IN ('High', 'Medium', 'Low')),
      recommended_action TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Production Lines & Capacity
    CREATE TABLE IF NOT EXISTS production_lines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stage TEXT NOT NULL,
      operators_assigned INTEGER NOT NULL DEFAULT 0,
      operators_optimal INTEGER NOT NULL DEFAULT 26,
      efficiency REAL NOT NULL DEFAULT 85.0,
      target_hourly INTEGER NOT NULL DEFAULT 200,
      actual_hourly INTEGER NOT NULL DEFAULT 180,
      active_style TEXT,
      active_order_id TEXT REFERENCES orders(id),
      status TEXT NOT NULL CHECK(status IN ('Optimal', 'Underloaded', 'Bottleneck')),
      skill_coverage TEXT NOT NULL DEFAULT '{}',
      ai_recommendation TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Line Rebalance Logs
    CREATE TABLE IF NOT EXISTS line_rebalance_logs (
      id TEXT PRIMARY KEY,
      from_line_id TEXT NOT NULL,
      to_line_id TEXT NOT NULL,
      operators_moved INTEGER NOT NULL,
      reason TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      approved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Factory Multi-Agents
    CREATE TABLE IF NOT EXISTS factory_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      icon TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'awaiting_approval', 'idle')),
      last_active TEXT NOT NULL,
      current_task TEXT NOT NULL,
      key_finding TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 90.0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Agent Proposals & Actions
    CREATE TABLE IF NOT EXISTS agent_proposals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES factory_agents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      action TEXT NOT NULL,
      impact TEXT NOT NULL,
      urgency TEXT NOT NULL CHECK(urgency IN ('HIGH', 'MEDIUM', 'LOW')),
      approved INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      decided_by TEXT,
      decided_at TEXT,
      decision_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Factory Settings & Preferences
    CREATE TABLE IF NOT EXISTS factory_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      factory_name TEXT NOT NULL DEFAULT 'Your Factory',
      location TEXT NOT NULL DEFAULT '',
      gst_number TEXT NOT NULL DEFAULT '',
      daily_capacity INTEGER NOT NULL DEFAULT 0,
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      stages_config TEXT NOT NULL DEFAULT '{"yarn":true,"knitting":true,"dyeing":true,"compacting":true,"cutting":true,"printing":true,"sewing":true,"ironing":true,"packing":true}',
      alerts_config TEXT NOT NULL DEFAULT '{"delayAlerts":true,"stageCompletion":true,"lowStockWarnings":true,"buyerMessages":true,"aiDailyDigest":false}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Scenario Simulations Log
    CREATE TABLE IF NOT EXISTS scenario_simulations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      overtime_hours REAL NOT NULL DEFAULT 0,
      added_operators INTEGER NOT NULL DEFAULT 0,
      subcontract_qty INTEGER NOT NULL DEFAULT 0,
      projected_delivery TEXT NOT NULL,
      days_saved INTEGER NOT NULL DEFAULT 0,
      added_cost REAL NOT NULL DEFAULT 0,
      feasibility_risk TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Production Work-Order Assignments
    CREATE TABLE IF NOT EXISTS production_assignments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      buyer TEXT NOT NULL,
      pieces INTEGER NOT NULL,
      kg REAL NOT NULL,
      start_stage TEXT NOT NULL,
      due_date TEXT NOT NULL,
      note TEXT,
      plan_json TEXT NOT NULL DEFAULT '[]',
      assigned_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Inventory Reorder Purchase Orders
    CREATE TABLE IF NOT EXISTS inventory_reorders (
      id TEXT PRIMARY KEY,
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      supplier TEXT NOT NULL,
      estimated_cost TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ORDERED', 'RECEIVED')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Buyer-originated enquiries are deliberately distinct from accepted factory orders.
    CREATE TABLE IF NOT EXISTS order_requests (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES buyers(id),
      product TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      color TEXT NOT NULL,
      required_delivery_date TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','accepted','rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_current_stage ON orders(current_stage);
    CREATE INDEX IF NOT EXISTS idx_order_stages_order_id ON order_stages(order_id);
    CREATE INDEX IF NOT EXISTS idx_production_events_order_id ON production_events(order_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_order_id ON proposals(order_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
    CREATE INDEX IF NOT EXISTS idx_vision_inspections_order ON vision_inspections(order_id);
    CREATE INDEX IF NOT EXISTS idx_vision_inspections_result ON vision_inspections(overall_result);
    CREATE INDEX IF NOT EXISTS idx_vision_defects_inspection ON vision_defects(inspection_id);
    CREATE INDEX IF NOT EXISTS idx_production_lines_stage ON production_lines(stage);
    CREATE INDEX IF NOT EXISTS idx_production_lines_status ON production_lines(status);
    CREATE INDEX IF NOT EXISTS idx_agent_proposals_agent ON agent_proposals(agent_id);
    CREATE INDEX IF NOT EXISTS idx_production_assignments_order ON production_assignments(order_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_reorders_material ON inventory_reorders(material_name);
    CREATE INDEX IF NOT EXISTS idx_order_requests_buyer ON order_requests(buyer_id);
  `);

  // Safe alterations for existing databases
  const safeAlter = (sql: string) => {
    try {
      db.exec(sql);
    } catch {
      // Column already exists, safe to ignore
    }
  };

  safeAlter(`ALTER TABLE users ADD COLUMN buyer_id TEXT REFERENCES buyers(id);`);
  safeAlter(`ALTER TABLE production_events ADD COLUMN line_no TEXT;`);
  safeAlter(`ALTER TABLE production_events ADD COLUMN shift TEXT;`);
  safeAlter(`ALTER TABLE production_events ADD COLUMN photo_url TEXT;`);
  safeAlter(`ALTER TABLE production_events ADD COLUMN voice_transcript TEXT;`);
  safeAlter(`ALTER TABLE notifications ADD COLUMN buyer_id TEXT;`);
  safeAlter(`ALTER TABLE scenario_simulations ADD COLUMN approved_by TEXT;`);
  safeAlter(`ALTER TABLE scenario_simulations ADD COLUMN approved_at TEXT;`);

  console.log("✅ Migrations complete");
}
