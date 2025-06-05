import { getTopicById } from "./conversation-topics";

interface ConversationSession {
  roomName: string;
  topicId: string;
  isActive: boolean;
  conversationHistory: Array<{ role: string; content: string }>;
  lastResponse: number;
}

class AIConversationService {
  private activeSessions: Map<string, ConversationSession> = new Map();
  private openRouterApiKey: string;
  private deepgramApiKey: string;

  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY || "";
  }

  async startConversation(roomName: string, topicId: string): Promise<void> {
    const topic = getTopicById(topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    const session: ConversationSession = {
      roomName,
      topicId,
      isActive: true,
      conversationHistory: [
        {
          role: "system",
          content: `You are a friendly AI conversation partner helping someone practice communication skills. The conversation topic is: ${topic.title}. 
          
          Guidelines:
          - Keep responses conversational and natural (2-3 sentences max)
          - Ask follow-up questions to encourage dialogue
          - Be encouraging and supportive
          - Stay focused on the topic: ${topic.description}
          - Respond as if you're having a real conversation`
        }
      ],
      lastResponse: Date.now()
    };

    this.activeSessions.set(roomName, session);
    console.log(`AI Conversation started for room: ${roomName}, topic: ${topic.title}`);

    // Send initial greeting after delay
    setTimeout(() => {
      this.sendInitialGreeting(roomName);
    }, 3000);
  }

  private async sendInitialGreeting(roomName: string): Promise<void> {
    const session = this.activeSessions.get(roomName);
    if (!session) return;

    const topic = getTopicById(session.topicId);
    if (!topic) return;

    const greetings = [
      `Hi there! I'm excited to help you practice discussing ${topic.title}. How are you feeling about this topic?`,
      `Hello! Let's have a great conversation about ${topic.title}. What interests you most about this subject?`,
      `Hi! I'm here to help you practice your communication skills with ${topic.title}. Shall we get started?`
    ];
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    await this.generateResponse(roomName, greeting);
  }

  async processUserInput(roomName: string, userInput: string): Promise<string> {
    const session = this.activeSessions.get(roomName);
    if (!session || !session.isActive) {
      throw new Error("No active session found");
    }

    // Add user input to conversation history
    session.conversationHistory.push({ role: "user", content: userInput });
    session.lastResponse = Date.now();

    // Generate AI response
    const aiResponse = await this.generateAIResponse(session);
    session.conversationHistory.push({ role: "assistant", content: aiResponse });

    // Keep conversation history manageable
    if (session.conversationHistory.length > 12) {
      session.conversationHistory = [
        session.conversationHistory[0], // Keep system message
        ...session.conversationHistory.slice(-10) // Keep last 10 messages
      ];
    }

    return aiResponse;
  }

  private async generateAIResponse(session: ConversationSession): Promise<string> {
    if (!this.openRouterApiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    try {
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
          messages: session.conversationHistory,
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "I'm sorry, could you repeat that?";

    } catch (error) {
      console.error("Error generating AI response:", error);
      return "I'm having trouble processing that. Could you try saying it again?";
    }
  }

  async generateResponse(roomName: string, text: string): Promise<ArrayBuffer | null> {
    console.log(`AI Response for ${roomName}: "${text}"`);

    if (!this.deepgramApiKey) {
      console.log("Deepgram API key not configured - would speak:", text);
      return null;
    }

    try {
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

      return await ttsResponse.arrayBuffer();

    } catch (error) {
      console.error("Error in TTS generation:", error);
      return null;
    }
  }

  endConversation(roomName: string): void {
    const session = this.activeSessions.get(roomName);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(roomName);
      console.log(`AI Conversation ended for room: ${roomName}`);
    }
  }

  getActiveSession(roomName: string): ConversationSession | undefined {
    return this.activeSessions.get(roomName);
  }

  isSessionActive(roomName: string): boolean {
    const session = this.activeSessions.get(roomName);
    return session?.isActive || false;
  }
}

export const aiConversationService = new AIConversationService();