import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface PooledTransport {
  transport: Transporter;
  lastUsed: number;
  inUse: boolean;
}

const pools = new Map<string, PooledTransport>();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup idle connections periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, pooled] of pools) {
    if (!pooled.inUse && now - pooled.lastUsed > IDLE_TIMEOUT_MS) {
      pooled.transport.close();
      pools.delete(key);
    }
  }
}, 60_000);

function getPoolKey(config: SmtpConfig): string {
  return `${config.host}:${config.port}:${config.user}`;
}

export interface SmtpConfig {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  password: string;
}

export async function getSmtpTransport(config: SmtpConfig): Promise<Transporter> {
  const key = getPoolKey(config);
  let pooled = pools.get(key);

  if (pooled && !pooled.inUse) {
    // Verify connection is still alive
    try {
      await pooled.transport.verify();
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      return pooled.transport;
    } catch {
      // Connection dead, remove and create new
      pooled.transport.close();
      pools.delete(key);
    }
  }

  // Create new transport
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port ?? 587,
    secure: config.secure ?? false,
    auth: {
      user: config.user,
      pass: config.password,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  pools.set(key, {
    transport,
    lastUsed: Date.now(),
    inUse: true,
  });

  return transport;
}

export function releaseSmtpTransport(config: SmtpConfig): void {
  const key = getPoolKey(config);
  const pooled = pools.get(key);
  if (pooled) {
    pooled.inUse = false;
    pooled.lastUsed = Date.now();
  }
}

export function closeAllTransports(): void {
  for (const [, pooled] of pools) {
    pooled.transport.close();
  }
  pools.clear();
}
