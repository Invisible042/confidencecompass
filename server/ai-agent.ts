import { Room, RoomEvent, RemoteParticipant, RemoteTrack, RemoteAudioTrack } from "livekit-server-sdk";

export class ConversationAI {
  private openRouterApiKey: string;
  private deepgramApiKey: string;
  private room: Room | null = null;
  private isListening = false;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY!;
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY!;

    if (!this.openRouterApiKey || !this.deepgramApiKey) {
      throw new Error("AI service credentials not configured");
    }
  }

  async joinRoom(roomUrl: string, token: string, conversationPrompt: string): Promise<void> {
    this.room = new Room();
    
    // Initialize conversation with system prompt
    this.conversationHistory = [
      {
        role: "system",
        content: `${conversationPrompt} Keep responses natural and conversational. Provide constructive feedback on communication skills when appropriate.`
      }
    ];

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('Participant connected:', participant.identity);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
      if (track.kind === 'audio') {
        this.handleAudioTrack(track as RemoteAudioTrack);
      }
    });

    await this.room.connect(roomUrl, token);
  }

  private async handleAudioTrack(audioTrack: RemoteAudioTrack): Promise<void> {
    if (this.isListening) return;
    
    this.isListening = true;
    
    try {
      // Convert audio to text using Deepgram STT
      const transcript = await this.speechToText(audioTrack);
      
      if (transcript && transcript.trim()) {
        // Add user message to conversation
        this.conversationHistory.push({
          role: "user",
          content: transcript
        });

        // Generate AI response using OpenRouter
        const aiResponse = await this.generateResponse();
        
        if (aiResponse) {
          // Add AI response to conversation
          this.conversationHistory.push({
            role: "assistant",
            content: aiResponse
          });

          // Convert response to speech using Deepgram TTS
          await this.textToSpeech(aiResponse);
        }
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      this.isListening = false;
    }
  }

  private async speechToText(audioTrack: RemoteAudioTrack): Promise<string> {
    // Implement Deepgram STT integration
    try {
      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.deepgramApiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioTrack // This would need proper audio stream handling
      });

      const result = await response.json();
      return result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    } catch (error) {
      console.error('STT Error:', error);
      return '';
    }
  }

  private async generateResponse(): Promise<string> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: this.conversationHistory.slice(-10), // Keep last 10 messages for context
          max_tokens: 150,
          temperature: 0.7
        })
      });

      const result = await response.json();
      return result.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('LLM Error:', error);
      return '';
    }
  }

  private async textToSpeech(text: string): Promise<void> {
    try {
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.deepgramApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        // Publish audio to LiveKit room
        await this.publishAudioToRoom(audioBuffer);
      }
    } catch (error) {
      console.error('TTS Error:', error);
    }
  }

  private async publishAudioToRoom(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.room) return;
    
    // This would require proper audio publishing implementation
    // For now, this is a placeholder for the audio publishing logic
    console.log('Publishing AI audio response to room');
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    this.conversationHistory = [];
  }
}