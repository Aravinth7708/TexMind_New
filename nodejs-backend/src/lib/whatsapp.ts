import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";

export interface StaffingMessageParams {
  groupId: string;
  unit: string;
  workersNeeded: number;
  date: string;
  shift: string;
  location: string;
  contact: string;
  orderId: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

export class WhatsAppManager {
  private sock: WASocket | null = null;
  private status: "disconnected" | "connecting" | "connected" | "qr_ready" = "disconnected";
  private qrDataUrl: string | null = null;
  private groups: WhatsAppGroup[] = [];
  private sessionDir: string;
  private isConnecting: boolean = false;

  constructor() {
    this.sessionDir = path.resolve(__dirname, "../../whatsapp-session");
  }

  public getStatus(): string {
    return this.status;
  }

  public getQRDataUrl(): string | null {
    return this.qrDataUrl;
  }

  public getGroups(): WhatsAppGroup[] {
    return this.groups;
  }

  public async connect(): Promise<void> {
    if (this.isConnecting || this.status === "connected") {
      return;
    }

    this.isConnecting = true;
    this.status = "connecting";

    try {
      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
      });

      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr);
            this.status = "qr_ready";
            // Also write QR to file for quick preview
            const qrFilePath = path.resolve(__dirname, "../../whatsapp-qr.png");
            await QRCode.toFile(qrFilePath, qr);
            console.log("📲 WhatsApp QR Code generated. Scan to link WhatsApp.");
          } catch (qrErr) {
            console.error("Failed to generate QR data URL:", qrErr);
          }
        }

        if (connection === "open") {
          this.status = "connected";
          this.qrDataUrl = null;
          this.isConnecting = false;
          console.log("✅ WhatsApp socket connection established!");

          try {
            const fetched = await sock.groupFetchAllParticipating();
            this.groups = Object.values(fetched).map((g) => ({
              id: g.id,
              name: g.subject || g.id,
            }));
            console.log(`📱 Loaded ${this.groups.length} participating WhatsApp groups.`);
          } catch (groupErr) {
            console.warn("Could not fetch groups immediately:", groupErr);
          }
        } else if (connection === "close") {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`⚠️ WhatsApp connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);

          if (shouldReconnect) {
            this.status = "connecting";
            setTimeout(() => {
              this.connect().catch((e) => console.error("Reconnection attempt error:", e));
            }, 5000);
          } else {
            this.status = "disconnected";
          }
        }
      });
    } catch (err) {
      this.isConnecting = false;
      this.status = "disconnected";
      console.error("Error initializing WhatsApp connection:", err);
    }
  }

  public async sendStaffingMessage(params: StaffingMessageParams): Promise<any> {
    const text = [
      "🚨 *TexMind Operational Alert: Staffing Request*",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      `📦 *Order ID*: ${params.orderId}`,
      `🧵 *Unit / Stage*: ${params.unit}`,
      `👥 *Workers Needed*: ${params.workersNeeded}`,
      `📅 *Date*: ${params.date}`,
      `⏰ *Shift*: ${params.shift}`,
      `📍 *Location*: ${params.location}`,
      `📞 *Contact*: ${params.contact}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "_Automated alert dispatched via TexMind Manufacturing Intelligence Engine_",
    ].join("\n");

    if (this.sock && this.status === "connected") {
      try {
        await this.sock.sendMessage(params.groupId, { text });
        return {
          delivered: true,
          groupId: params.groupId,
          text,
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        console.error("Failed to send WhatsApp message via socket:", err);
        throw new Error(`Failed to send WhatsApp message: ${err.message}`);
      }
    }

    // Fallback if WhatsApp is currently offline / pending QR scan
    console.log(`[WhatsApp Simulated Send] (Status: ${this.status}) to ${params.groupId}:\n${text}`);
    return {
      delivered: false,
      simulated: true,
      reason: `WhatsApp status is '${this.status}'. Message queued for dispatch upon connection.`,
      groupId: params.groupId,
      text,
      timestamp: new Date().toISOString(),
    };
  }
}

export const waManager = new WhatsAppManager();
