import { AccessToken } from "livekit-server-sdk";
import { ConversationTopic, LiveKitSession } from "@shared/schema";
import { getTopicById } from "./conversation-topics";
import { spawn } from "child_process";
import { EventEmitter } from "events";

export class LiveKitService extends EventEmitter {
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;
  private activeAgents: Map<string, any> = new Map();
  private agentHealthChecks: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.apiKey = process.env.LIVEKIT_API_KEY!;
    this.apiSecret = process.env.LIVEKIT_API_SECRET!;
    this.wsUrl = process.env.LIVEKIT_URL!;

    if (!this.apiKey || !this.apiSecret || !this.wsUrl) {
      throw new Error("LiveKit credentials not configured");
    }
  }

  getConnectionUrl(): string {
    return this.wsUrl;
  }

  async createConversationRoom(topicId: string): Promise<{ roomName: string; token: string }> {
    try {
      const topic = getTopicById(topicId);
      if (!topic) {
        throw new Error("Topic not found");
      }

      const roomName = `practice-${Date.now()}`;
      const token = new AccessToken(this.apiKey, this.apiSecret, {
        identity: "user",
        name: "Practice User",
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      // Start the voice agent with topic information
      await this.startVoiceAgent(roomName, {
        topic: topic.title,
        difficulty: topic.difficulty,
        prompt: topic.prompt
      });

      return {
        roomName,
        token: await token.toJwt(),
      };
    } catch (error) {
      console.error("Error creating conversation room:", error);
      throw error;
    }
  }

  async createAIAgentToken(roomName: string): Promise<string> {
    try {
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
    } catch (error) {
      console.error("Error creating AI agent token:", error);
      throw new Error("Failed to create AI agent token");
    }
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
      const agentProcess = spawn('python', ['server/livekit-voice-agent.py'], {
        env: {
          ...process.env,
          LIVEKIT_URL: this.wsUrl,
          LIVEKIT_API_KEY: this.apiKey,
          LIVEKIT_API_SECRET: this.apiSecret,
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
          ROOM_METADATA: metadata
        }
      });

      // Store the agent process
      this.activeAgents.set(roomName, agentProcess);

      // Set up process monitoring
      agentProcess.stdout?.on('data', (data) => {
        console.log(`Voice Agent ${roomName}:`, data.toString());
        this.emit('agentLog', { roomName, type: 'stdout', data: data.toString() });
      });

      agentProcess.stderr?.on('data', (data) => {
        console.error(`Voice Agent ${roomName} Error:`, data.toString());
        this.emit('agentLog', { roomName, type: 'stderr', data: data.toString() });
      });

      agentProcess.on('error', (error) => {
        console.error(`Voice Agent ${roomName} Process Error:`, error);
        this.emit('agentError', { roomName, error });
        this.cleanupAgent(roomName);
      });

      agentProcess.on('close', (code) => {
        console.log(`Voice Agent ${roomName} exited with code ${code}`);
        this.emit('agentClosed', { roomName, code });
        this.cleanupAgent(roomName);
      });

      // Start health check
      this.startHealthCheck(roomName);

      // Wait a moment for the agent to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('Failed to start voice agent:', error);
      this.emit('agentError', { roomName, error });
      throw new Error('Failed to start voice agent');
    }
  }

  private startHealthCheck(roomName: string): void {
    // Clear any existing health check
    this.stopHealthCheck(roomName);

    // Start new health check
    const healthCheck = setInterval(() => {
      const agentProcess = this.activeAgents.get(roomName);
      if (!agentProcess || agentProcess.killed) {
        console.log(`Voice Agent ${roomName} health check failed - agent not running`);
        this.emit('agentError', { roomName, error: new Error('Agent process not running') });
        this.cleanupAgent(roomName);
      }
    }, 5000); // Check every 5 seconds

    this.agentHealthChecks.set(roomName, healthCheck);
  }

  private stopHealthCheck(roomName: string): void {
    const healthCheck = this.agentHealthChecks.get(roomName);
    if (healthCheck) {
      clearInterval(healthCheck);
      this.agentHealthChecks.delete(roomName);
    }
  }

  private cleanupAgent(roomName: string): void {
    const agentProcess = this.activeAgents.get(roomName);
    if (agentProcess) {
      try {
        agentProcess.kill();
      } catch (error) {
        console.error(`Error killing agent process for room ${roomName}:`, error);
      }
      this.activeAgents.delete(roomName);
    }
    this.stopHealthCheck(roomName);
  }

  async stopVoiceAgent(roomName: string): Promise<void> {
    try {
      const agentProcess = this.activeAgents.get(roomName);
      if (agentProcess) {
        agentProcess.kill();
        this.cleanupAgent(roomName);
        console.log(`Voice Agent ${roomName} stopped successfully`);
      }
    } catch (error) {
      console.error(`Error stopping voice agent for room ${roomName}:`, error);
      throw error;
    }
  }

  // Cleanup all active agents
  async cleanup(): Promise<void> {
    const roomNames = Array.from(this.activeAgents.keys());
    await Promise.all(roomNames.map(roomName => this.stopVoiceAgent(roomName)));
  }

  isAgentActive(roomName: string): boolean {
    const agentProcess = this.activeAgents.get(roomName);
    return !!agentProcess && !agentProcess.killed;
  }
}

export const liveKitService = new LiveKitService();