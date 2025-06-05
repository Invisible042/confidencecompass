import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema } from "@shared/schema";
import { z } from "zod";
import { conversationTopics, getTopicById } from "./conversation-topics";
import { liveKitService } from "./livekit-service";
import { aiConversationService } from "./ai-conversation-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current user (demo user)
  app.get("/api/user", async (req, res) => {
    try {
      const user = await storage.getUser(1); // Default demo user
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user progress and stats
  app.get("/api/user/progress", async (req, res) => {
    try {
      const progress = await storage.getUserProgress(1);
      const stats = await storage.getSessionStats(1);
      res.json({ progress, stats });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Create a new practice session
  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse({
        ...req.body,
        userId: 1 // Default demo user
      });
      
      const session = await storage.createSession(validatedData);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Get user sessions
  app.get("/api/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const sessions = await storage.getUserSessions(1, limit);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Get specific session
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // Delete session
  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const deleted = await storage.deleteSession(sessionId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Get conversation topics
  app.get("/api/conversation/topics", async (req, res) => {
    try {
      res.json(conversationTopics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  // Create LiveKit conversation room
  app.post("/api/conversation/create-room", async (req, res) => {
    try {
      const { topicId } = req.body;
      
      if (!topicId) {
        return res.status(400).json({ message: "Topic ID is required" });
      }

      const topic = getTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const liveKitSession = await liveKitService.createConversationRoom(1, topicId); // Using demo user ID
      
      // Start AI conversation session
      setTimeout(async () => {
        try {
          await aiConversationService.startConversation(liveKitSession.roomName, topicId);
          console.log(`AI Conversation started for room: ${liveKitSession.roomName}`);
        } catch (aiError) {
          console.error("Failed to start AI conversation:", aiError);
        }
      }, 2000); // Give user time to join first
      
      res.json({
        ...liveKitSession,
        serverUrl: liveKitService.getConnectionUrl()
      });
    } catch (error) {
      console.error("Error creating LiveKit room:", error);
      res.status(500).json({ message: "Failed to create conversation room" });
    }
  });

  // AI Conversation endpoints
  app.post("/api/conversation/message", async (req, res) => {
    try {
      const { roomName, message } = req.body;
      
      if (!roomName || !message) {
        return res.status(400).json({ message: "Room name and message are required" });
      }

      const aiResponse = await aiConversationService.processUserInput(roomName, message);
      const audioBuffer = await aiConversationService.generateResponse(roomName, aiResponse);
      
      res.json({
        response: aiResponse,
        hasAudio: !!audioBuffer
      });
    } catch (error) {
      console.error("Error processing conversation message:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  app.post("/api/conversation/end", async (req, res) => {
    try {
      const { roomName } = req.body;
      
      if (!roomName) {
        return res.status(400).json({ message: "Room name is required" });
      }

      aiConversationService.endConversation(roomName);
      res.json({ message: "Conversation ended successfully" });
    } catch (error) {
      console.error("Error ending conversation:", error);
      res.status(500).json({ message: "Failed to end conversation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
