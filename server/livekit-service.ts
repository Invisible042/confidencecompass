import { AccessToken } from "livekit-server-sdk";
import { ConversationTopic, LiveKitSession } from "@shared/schema";
import { getTopicById } from "./conversation-topics";

export class LiveKitService {
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY!;
    this.apiSecret = process.env.LIVEKIT_API_SECRET!;
    this.wsUrl = process.env.LIVEKIT_URL!;

    if (!this.apiKey || !this.apiSecret || !this.wsUrl) {
      throw new Error("LiveKit credentials not configured");
    }
  }

  async createConversationRoom(userId: number, topicId: string): Promise<LiveKitSession> {
    const topic = getTopicById(topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    const roomName = `conversation-${userId}-${topicId}-${Date.now()}`;
    const participantName = `user-${userId}`;

    // Create access token for the user with proper expiration
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: '1h', // 1 hour expiration
    });

    // Grant permissions to join room and publish/subscribe
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });

    const jwt = await token.toJwt();

    return {
      roomName,
      token: jwt,
      topic
    };
  }

  async createAIAgentToken(roomName: string): Promise<string> {
    const agentToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity: "ai-agent",
      name: "AI Conversation Partner",
    });

    agentToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return agentToken.toJwt();
  }

  getConnectionUrl(): string {
    return this.wsUrl;
  }
}

export const liveKitService = new LiveKitService();