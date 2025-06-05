import { Room, RoomEvent, RemoteParticipant, RemoteAudioTrack, LocalAudioTrack, RoomConnectOptions } from "livekit-client";
import { liveKitService } from "./livekit-service";

export class ConversationAI {
  private openRouterApiKey: string;
  private deepgramApiKey: string;
  private room: Room | null = null;
  private isActive = false;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private currentTopic: string = "";

  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY || "";

    if (!this.openRouterApiKey || !this.deepgramApiKey) {
      console.warn("AI Agent: Missing API keys for OpenRouter or Deepgram");
    }
  }

  async joinConversation(roomName: string, topic: string): Promise<void> {
    if (!this.openRouterApiKey || !this.deepgramApiKey) {
      throw new Error("AI Agent: API keys not configured");
    }

    this.currentTopic = topic;
    this.conversationHistory = [
      {
        role: "system",
        content: `You are a friendly AI conversation partner helping someone practice communication skills. The conversation topic is: ${topic}. 
        
        Guidelines:
        - Keep responses conversational and natural (2-3 sentences max)
        - Ask follow-up questions to encourage dialogue
        - Be encouraging and supportive
        - Stay focused on the topic
        - Respond as if you're having a real conversation`
      }
    ];

    try {
      // Create AI agent token
      const token = await liveKitService.createAIAgentToken(roomName);
      const wsUrl = liveKitService.getConnectionUrl();

      // Create and connect room
      this.room = new Room();
      
      const connectOptions: RoomConnectOptions = {
        autoSubscribe: true,
        publishDefaults: {
          audioEnabled: true,
          videoEnabled: false,
        }
      };

      await this.room.connect(wsUrl, token, connectOptions);
      this.isActive = true;

      console.log(`AI Agent joined room: ${roomName}`);

      // Set up event listeners
      this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected.bind(this));
      this.room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed.bind(this));
      this.room.on(RoomEvent.Disconnected, this.handleDisconnected.bind(this));

      // Send initial greeting after a delay
      setTimeout(() => {
        this.sendInitialGreeting();
      }, 3000);

    } catch (error) {
      console.error("AI Agent: Failed to join room:", error);
      throw error;
    }
  }

  private handleParticipantConnected(participant: RemoteParticipant): void {
    console.log(`AI Agent: Participant connected - ${participant.identity}`);
  }

  private handleTrackSubscribed(track: RemoteAudioTrack, participant: RemoteParticipant): void {
    if (track.kind === "audio") {
      console.log(`AI Agent: Audio track subscribed from ${participant.identity}`);
      // In a real implementation, you would process the audio stream here
      // For now, we'll simulate conversation responses
      this.simulateConversationFlow();
    }
  }

  private handleDisconnected(): void {
    console.log("AI Agent: Disconnected from room");
    this.isActive = false;
    this.room = null;
  }

  private async sendInitialGreeting(): Promise<void> {
    const greetings = [
      `Hi there! I'm excited to help you practice discussing ${this.currentTopic}. How are you feeling about this topic?`,
      `Hello! Let's have a great conversation about ${this.currentTopic}. What interests you most about this subject?`,
      `Hi! I'm here to help you practice your communication skills with ${this.currentTopic}. Shall we get started?`
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    await this.generateAndSendResponse(greeting);
  }

  private async simulateConversationFlow(): Promise<void> {
    // Simulate conversation responses at intervals
    if (!this.isActive) return;

    setTimeout(async () => {
      if (this.isActive) {
        await this.generateConversationResponse();
        // Schedule next response
        this.simulateConversationFlow();
      }
    }, 8000 + Math.random() * 7000); // 8-15 seconds between responses
  }

  private async generateConversationResponse(): Promise<void> {
    if (!this.isActive || !this.openRouterApiKey) return;

    try {
      // Simulate user input for demonstration
      const userPrompts = [
        "That's an interesting point.",
        "I'd like to know more about that.",
        "What do you think about this situation?",
        "How would you approach this?",
        "That makes sense to me."
      ];

      const simulatedUserInput = userPrompts[Math.floor(Math.random() * userPrompts.length)];
      this.conversationHistory.push({ role: "user", content: simulatedUserInput });

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "ConfidenceBuilder AI"
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-haiku",
          messages: this.conversationHistory,
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || "I'm sorry, could you repeat that?";
      
      this.conversationHistory.push({ role: "assistant", content: aiResponse });
      
      // Keep conversation history manageable
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = [
          this.conversationHistory[0], // Keep system message
          ...this.conversationHistory.slice(-8) // Keep last 8 messages
        ];
      }

      await this.generateAndSendResponse(aiResponse);

    } catch (error) {
      console.error("AI Agent: Error generating response:", error);
      await this.generateAndSendResponse("I'm having trouble processing that. Could you try saying it again?");
    }
  }

  private async generateAndSendResponse(text: string): Promise<void> {
    if (!this.room || !this.deepgramApiKey) return;

    try {
      console.log(`AI Agent: Generating speech for: "${text}"`);
      
      // Generate speech using Deepgram TTS
      const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.deepgramApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text
        })
      });

      if (!ttsResponse.ok) {
        throw new Error(`Deepgram TTS error: ${ttsResponse.status}`);
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      
      // Convert to audio format and publish to room
      await this.publishAudioToRoom(audioBuffer);
      
      console.log(`AI Agent: Sent response: "${text}"`);

    } catch (error) {
      console.error("AI Agent: Error in TTS:", error);
      // Fallback: just log the response
      console.log(`AI Agent: Would say: "${text}"`);
    }
  }

  private async publishAudioToRoom(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.room) return;

    try {
      // Convert ArrayBuffer to audio track
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(audioBuffer);
      
      // Create MediaStream from audio data
      const mediaStreamDestination = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = audioData;
      source.connect(mediaStreamDestination);
      source.start();

      // Get audio track from MediaStream
      const audioTrack = mediaStreamDestination.stream.getAudioTracks()[0];
      const localTrack = new LocalAudioTrack(audioTrack);
      
      // Publish to room
      await this.room.localParticipant.publishTrack(localTrack, {
        name: "ai-speech",
        source: "microphone"
      });

      // Clean up after audio finishes
      setTimeout(() => {
        this.room?.localParticipant.unpublishTrack(localTrack);
        audioContext.close();
      }, audioData.duration * 1000 + 1000);

    } catch (error) {
      console.error("AI Agent: Error publishing audio:", error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      this.isActive = false;
      await this.room.disconnect();
      this.room = null;
      console.log("AI Agent: Disconnected");
    }
  }

  isConnected(): boolean {
    return this.room?.state === "connected";
  }
}

// Global AI agent instance
export const conversationAI = new ConversationAI();