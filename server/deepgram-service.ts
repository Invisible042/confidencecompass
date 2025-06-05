export interface DeepgramConfig {
  apiKey: string;
  model: string;
  language: string;
  punctuate: boolean;
  diarize: boolean;
  filler_words: boolean;
  sentiment: boolean;
  emotion: boolean;
  interim_results: boolean;
}

export interface FillerWordDetection {
  word: string;
  confidence: number;
  start: number;
  end: number;
  channel: number;
}

export interface EmotionSegment {
  emotion: string;
  confidence: number;
  start: number;
  end: number;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  segments: Array<{
    text: string;
    sentiment: string;
    confidence: number;
    start: number;
    end: number;
  }>;
}

export interface DeepgramTranscription {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word: string;
  }>;
  fillerWords: FillerWordDetection[];
  emotions: EmotionSegment[];
  sentiment: SentimentAnalysis;
  metadata: {
    request_id: string;
    transaction_key: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
  };
}

export interface DeepgramWebSocketResponse {
  channel_index: number[];
  duration: number;
  start: number;
  is_final: boolean;
  speech_final: boolean;
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        punctuated_word: string;
        speaker?: number;
      }>;
    }>;
  };
  metadata: {
    request_id: string;
    model_info: {
      name: string;
      version: string;
      arch: string;
      language: string;
    };
  };
}

export class DeepgramService {
  private apiKey: string;
  private config: DeepgramConfig;
  private wsConnections: Map<string, WebSocket> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPGRAM_API_KEY || "";
    this.config = {
      apiKey: this.apiKey,
      model: "nova-2",
      language: "en-US",
      punctuate: true,
      diarize: false,
      filler_words: true,
      sentiment: true,
      emotion: true,
      interim_results: true
    };

    if (!this.apiKey) {
      console.warn("Deepgram API key not provided");
    }
  }

  async transcribeAudio(audioBuffer: ArrayBuffer): Promise<DeepgramTranscription> {
    if (!this.apiKey) {
      throw new Error("Deepgram API key not configured");
    }

    try {
      const url = new URL("https://api.deepgram.com/v1/listen");
      
      // Add query parameters
      url.searchParams.append("model", this.config.model);
      url.searchParams.append("language", this.config.language);
      url.searchParams.append("punctuate", this.config.punctuate.toString());
      url.searchParams.append("diarize", this.config.diarize.toString());
      url.searchParams.append("filler_words", this.config.filler_words.toString());
      url.searchParams.append("sentiment", this.config.sentiment.toString());
      url.searchParams.append("detect_entities", "true");
      url.searchParams.append("detect_topics", "true");

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.apiKey}`,
          "Content-Type": "audio/wav"
        },
        body: audioBuffer
      });

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return this.parseDeepgramResponse(result);

    } catch (error) {
      console.error("Error transcribing audio with Deepgram:", error);
      throw error;
    }
  }

  async generateSpeech(text: string, voice: string = "aura-asteria-en"): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new Error("Deepgram API key not configured");
    }

    try {
      const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Deepgram TTS error: ${response.status} ${response.statusText}`);
      }

      return await response.arrayBuffer();

    } catch (error) {
      console.error("Error generating speech with Deepgram:", error);
      throw error;
    }
  }

  createWebSocketConnection(sessionId: string, onTranscription: (data: DeepgramTranscription) => void): WebSocket | null {
    if (!this.apiKey) {
      console.error("Cannot create WebSocket connection: Deepgram API key not configured");
      return null;
    }

    try {
      const url = new URL("wss://api.deepgram.com/v1/listen");
      
      // Add query parameters for real-time transcription
      url.searchParams.append("model", this.config.model);
      url.searchParams.append("language", this.config.language);
      url.searchParams.append("punctuate", this.config.punctuate.toString());
      url.searchParams.append("interim_results", this.config.interim_results.toString());
      url.searchParams.append("filler_words", this.config.filler_words.toString());
      url.searchParams.append("sentiment", this.config.sentiment.toString());
      url.searchParams.append("vad_events", "true");
      url.searchParams.append("endpointing", "300");

      const ws = new WebSocket(url.toString(), ["token", this.apiKey]);

      ws.onopen = () => {
        console.log(`Deepgram WebSocket connected for session: ${sessionId}`);
      };

      ws.onmessage = (event) => {
        try {
          const data: DeepgramWebSocketResponse = JSON.parse(event.data);
          
          if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
            const alternative = data.channel.alternatives[0];
            
            if (alternative.transcript && alternative.transcript.trim()) {
              const transcription = this.parseWebSocketResponse(data);
              onTranscription(transcription);
            }
          }
        } catch (error) {
          console.error("Error parsing Deepgram WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error(`Deepgram WebSocket error for session ${sessionId}:`, error);
      };

      ws.onclose = (event) => {
        console.log(`Deepgram WebSocket closed for session ${sessionId}:`, event.code, event.reason);
        this.wsConnections.delete(sessionId);
      };

      this.wsConnections.set(sessionId, ws);
      return ws;

    } catch (error) {
      console.error("Error creating Deepgram WebSocket connection:", error);
      return null;
    }
  }

  sendAudioData(sessionId: string, audioData: ArrayBuffer): boolean {
    const ws = this.wsConnections.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(audioData);
      return true;
    } catch (error) {
      console.error("Error sending audio data to Deepgram:", error);
      return false;
    }
  }

  closeConnection(sessionId: string): void {
    const ws = this.wsConnections.get(sessionId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(sessionId);
    }
  }

  private parseDeepgramResponse(response: any): DeepgramTranscription {
    const channel = response.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      throw new Error("No transcription results found");
    }

    // Extract filler words
    const fillerWords: FillerWordDetection[] = [];
    if (alternative.words) {
      alternative.words.forEach((word: any) => {
        if (word.filler_word === true) {
          fillerWords.push({
            word: word.word,
            confidence: word.confidence,
            start: word.start,
            end: word.end,
            channel: 0
          });
        }
      });
    }

    // Extract emotions (if available in response)
    const emotions: EmotionSegment[] = [];
    if (response.results?.emotions) {
      response.results.emotions.forEach((emotion: any) => {
        emotions.push({
          emotion: emotion.emotion,
          confidence: emotion.confidence,
          start: emotion.start,
          end: emotion.end,
          segments: emotion.segments || []
        });
      });
    }

    // Extract sentiment
    const sentiment: SentimentAnalysis = {
      sentiment: alternative.sentiment || 'neutral',
      confidence: alternative.sentiment_confidence || 0,
      segments: alternative.sentiment_segments || []
    };

    return {
      transcript: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      words: alternative.words || [],
      fillerWords,
      emotions,
      sentiment,
      metadata: response.metadata || {}
    };
  }

  private parseWebSocketResponse(response: DeepgramWebSocketResponse): DeepgramTranscription {
    const alternative = response.channel.alternatives[0];

    // Detect filler words in real-time
    const fillerWords: FillerWordDetection[] = [];
    const commonFillers = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'actually', 'basically', 'literally', 'well'];
    
    if (alternative.words) {
      alternative.words.forEach((word) => {
        if (commonFillers.includes(word.word.toLowerCase())) {
          fillerWords.push({
            word: word.word,
            confidence: word.confidence,
            start: word.start,
            end: word.end,
            channel: response.channel_index[0] || 0
          });
        }
      });
    }

    // Basic emotion detection based on word patterns and confidence
    const emotions: EmotionSegment[] = [];
    const transcript = alternative.transcript.toLowerCase();
    
    if (transcript) {
      let detectedEmotion = 'neutral';
      let emotionConfidence = 0.5;
      
      // Simple rule-based emotion detection
      if (transcript.includes('happy') || transcript.includes('great') || transcript.includes('excited')) {
        detectedEmotion = 'happy';
        emotionConfidence = 0.7;
      } else if (transcript.includes('sad') || transcript.includes('disappointed') || transcript.includes('upset')) {
        detectedEmotion = 'sad';
        emotionConfidence = 0.7;
      } else if (transcript.includes('angry') || transcript.includes('frustrated') || transcript.includes('annoyed')) {
        detectedEmotion = 'angry';
        emotionConfidence = 0.6;
      } else if (transcript.includes('worried') || transcript.includes('nervous') || transcript.includes('anxious')) {
        detectedEmotion = 'fearful';
        emotionConfidence = 0.6;
      }
      
      emotions.push({
        emotion: detectedEmotion,
        confidence: emotionConfidence,
        start: response.start,
        end: response.start + response.duration,
        segments: [{
          text: alternative.transcript,
          start: response.start,
          end: response.start + response.duration,
          confidence: alternative.confidence
        }]
      });
    }

    // Basic sentiment analysis
    const sentiment: SentimentAnalysis = {
      sentiment: this.detectSentiment(alternative.transcript),
      confidence: 0.6,
      segments: [{
        text: alternative.transcript,
        sentiment: this.detectSentiment(alternative.transcript),
        confidence: 0.6,
        start: response.start,
        end: response.start + response.duration
      }]
    };

    return {
      transcript: alternative.transcript,
      confidence: alternative.confidence,
      words: alternative.words || [],
      fillerWords,
      emotions,
      sentiment,
      metadata: {
        request_id: response.metadata.request_id,
        transaction_key: '',
        sha256: '',
        created: new Date().toISOString(),
        duration: response.duration,
        channels: 1
      }
    };
  }

  private detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'excited'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disappointed'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  async analyzeConversationMetrics(transcriptions: DeepgramTranscription[]): Promise<{
    totalFillerWords: number;
    fillerWordRate: number;
    dominantEmotion: string;
    overallSentiment: string;
    speakingPace: number;
    vocabularyDiversity: number;
  }> {
    if (transcriptions.length === 0) {
      return {
        totalFillerWords: 0,
        fillerWordRate: 0,
        dominantEmotion: 'neutral',
        overallSentiment: 'neutral',
        speakingPace: 0,
        vocabularyDiversity: 0
      };
    }

    // Count total filler words
    const totalFillerWords = transcriptions.reduce((sum, t) => sum + t.fillerWords.length, 0);
    const totalWords = transcriptions.reduce((sum, t) => sum + t.words.length, 0);
    const fillerWordRate = totalWords > 0 ? (totalFillerWords / totalWords) * 100 : 0;

    // Calculate dominant emotion
    const emotionCounts: { [key: string]: number } = {};
    transcriptions.forEach(t => {
      t.emotions.forEach(e => {
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.confidence;
      });
    });
    
    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => 
      emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral'
    );

    // Calculate overall sentiment
    const sentimentCounts: { [key: string]: number } = { positive: 0, negative: 0, neutral: 0 };
    transcriptions.forEach(t => {
      sentimentCounts[t.sentiment.sentiment] += t.sentiment.confidence;
    });
    
    const overallSentiment = Object.keys(sentimentCounts).reduce((a, b) => 
      sentimentCounts[a] > sentimentCounts[b] ? a : b
    );

    // Calculate speaking pace (words per minute)
    const totalDuration = transcriptions.reduce((sum, t) => sum + t.metadata.duration, 0);
    const speakingPace = totalDuration > 0 ? (totalWords / totalDuration) * 60 : 0;

    // Calculate vocabulary diversity (unique words / total words)
    const allWords = transcriptions.flatMap(t => 
      t.words.map(w => w.word.toLowerCase())
    );
    const uniqueWords = new Set(allWords);
    const vocabularyDiversity = allWords.length > 0 ? (uniqueWords.size / allWords.length) * 100 : 0;

    return {
      totalFillerWords,
      fillerWordRate,
      dominantEmotion,
      overallSentiment,
      speakingPace,
      vocabularyDiversity
    };
  }
}

export const deepgramService = new DeepgramService();