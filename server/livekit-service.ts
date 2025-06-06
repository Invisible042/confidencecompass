import { AccessToken } from "livekit-server-sdk";
import { ConversationTopic, LiveKitSession } from "@shared/schema";
import { getTopicById } from "./conversation-topics";
import { spawn } from "child_process";

export class LiveKitService {
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;
  private activeAgents: Map<string, any> = new Map();

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

  async startVoiceAgent(roomName: string, options: { 
    topic: string; 
    difficulty: string; 
    prompt: string; 
  }): Promise<void> {
    try {
      // Create metadata for the voice agent
      const metadata = JSON.stringify({
        topic: options.topic,
        difficulty: options.difficulty,
        prompt: options.prompt
      });

      // Start the Python voice agent process
      const agentProcess = spawn('python', ['server/simple-voice-agent.py'], {
        env: {
          ...process.env,
          LIVEKIT_URL: this.wsUrl,
          LIVEKIT_API_KEY: this.apiKey,
          LIVEKIT_API_SECRET: this.apiSecret,
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY
        }
      });

      // Store the agent process
      this.activeAgents.set(roomName, agentProcess);

      agentProcess.stdout?.on('data', (data) => {
        console.log(`Voice Agent ${roomName}:`, data.toString());
      });

      agentProcess.stderr?.on('data', (data) => {
        console.error(`Voice Agent ${roomName} Error:`, data.toString());
      });

      agentProcess.on('close', (code) => {
        console.log(`Voice Agent ${roomName} exited with code ${code}`);
        this.activeAgents.delete(roomName);
      });

      // Wait a moment for the agent to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('Failed to start voice agent:', error);
      throw new Error('Failed to start voice agent');
    }
  }

  async stopVoiceAgent(roomName: string): Promise<void> {
    const agentProcess = this.activeAgents.get(roomName);
    if (agentProcess) {
      agentProcess.kill();
      this.activeAgents.delete(roomName);
    }
  }

  getConnectionUrl(): string {
    return this.wsUrl;
  }
}

export const liveKitService = new LiveKitService();