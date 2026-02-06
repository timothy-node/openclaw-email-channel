export interface Conversation {
  threadId: string;
  lastMessageId: string;
  subject: string;
  createdAt: number;
  updatedAt: number;
}

const MAX_CONVERSATIONS = 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class ConversationStore {
  private store = new Map<string, Conversation>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old conversations every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  get(threadId: string): Conversation | undefined {
    return this.store.get(threadId);
  }

  set(threadId: string, data: Omit<Conversation, "createdAt" | "updatedAt">): void {
    const existing = this.store.get(threadId);
    const now = Date.now();

    this.store.set(threadId, {
      ...data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    // Enforce max size
    if (this.store.size > MAX_CONVERSATIONS) {
      this.evictOldest();
    }
  }

  delete(threadId: string): boolean {
    return this.store.delete(threadId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, conv] of this.store) {
      if (now - conv.updatedAt > MAX_AGE_MS) {
        this.store.delete(key);
      }
    }
  }

  private evictOldest(): void {
    // Remove oldest 10% when over limit
    const toRemove = Math.ceil(this.store.size * 0.1);
    const entries = [...this.store.entries()]
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
      .slice(0, toRemove);
    
    for (const [key] of entries) {
      this.store.delete(key);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

export const conversationStore = new ConversationStore();
