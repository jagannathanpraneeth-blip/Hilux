/**
 * MessageBus — In-process pub/sub message bus for workforce communication.
 *
 * In production: backed by Kafka (see infrastructure layer).
 * In development/testing: in-memory EventEmitter-based bus.
 *
 * Communication is topic-based:
 *   worker.<workerId>          — Direct messages to a worker
 *   department.<deptId>        — Broadcast to all workers in a department
 *   department.<deptId>.directive — Executive directives to department
 *   department.<deptId>.request   — Cross-department requests
 *   executive.reports          — Department reports to executives
 *   executive.ceo.escalation   — Escalations to CEO
 */

import { EventEmitter } from 'events';

type MessageHandler = (message: Record<string, unknown>) => Promise<void>;

export class MessageBus {
  private readonly subscriptions: Map<string, MessageHandler[]> = new Map();
  private messageCount = 0;

  constructor() {}

  subscribe(topic: string, handler: MessageHandler): void {
    const handlers = this.subscriptions.get(topic) ?? [];
    handlers.push(handler);
    this.subscriptions.set(topic, handlers);
  }

  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
  }

  async publish(topic: string, message: Record<string, unknown>): Promise<void> {
    this.messageCount++;
    const envelope = {
      ...message,
      _messageId: crypto.randomUUID(),
      _topic: topic,
      _publishedAt: new Date().toISOString(),
      _seq: this.messageCount,
    };

    const handlers = this.subscriptions.get(topic) ?? [];
    await Promise.allSettled(
      handlers.map(async handler => {
        try {
          await handler(envelope);
        } catch (err) {
          console.error(`[MessageBus] Handler error on topic "${topic}":`, err);
        }
      })
    );
  }

  getStats(): { topics: number; totalMessages: number } {
    return {
      topics: this.subscriptions.size,
      totalMessages: this.messageCount,
    };
  }
}
