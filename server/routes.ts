import { Router } from "express";
import { storage } from "./storage";
import { insertSessionSchema } from "@shared/schema";
import { z } from "zod";
import { conversationTopics, getTopicById } from "./conversation-topics";
import { liveKitService } from "./livekit-service";

const router = Router();

// Get current user (demo implementation)
router.get("/api/user/current", (req, res) => {
  res.json({
    id: 1,
    name: "Demo User",
    email: "demo@example.com"
  });
});

// Get user progress and stats
router.get("/api/user/progress", async (req, res) => {
  try {
    const progress = await storage.getUserProgress(1);
    const stats = await storage.getSessionStats(1);
    res.json({ progress, stats });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch progress" });
  }
});

// Create a new practice session
router.post("/api/sessions", async (req, res) => {
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
router.get("/api/sessions", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const sessions = await storage.getUserSessions(1, limit);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
});

// Get specific session
router.get("/api/sessions/:id", async (req, res) => {
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
router.delete("/api/sessions/:id", async (req, res) => {
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
router.get("/api/conversation/topics", (req, res) => {
  const topics = [
    {
      id: "job-interview",
      title: "Job Interview",
      description: "Practice common job interview questions and scenarios",
      difficulty: "intermediate",
      category: "Professional",
      prompt: "Let's practice some common job interview questions. I'll ask you questions and provide feedback on your responses."
    },
    {
      id: "small-talk",
      title: "Small Talk",
      description: "Practice casual conversation and social interactions",
      difficulty: "beginner",
      category: "Social",
      prompt: "Let's practice making small talk. I'll help you develop natural conversation skills for social situations."
    },
    {
      id: "public-speaking",
      title: "Public Speaking",
      description: "Practice presentation skills and public speaking",
      difficulty: "advanced",
      category: "Professional",
      prompt: "Let's work on your public speaking skills. I'll help you practice delivering clear and engaging presentations."
    }
  ];
  res.json(topics);
});

// Create a LiveKit conversation room with AI voice agent
router.post("/api/conversation/create-room", async (req, res) => {
  try {
    const { topicId } = req.body;
    
    if (!topicId) {
      return res.status(400).json({ error: "Topic ID is required" });
    }

    const topic = getTopicById(topicId);
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }

    // Create room and get token
    const { roomName, token } = await liveKitService.createConversationRoom(topicId);

    // Give user time to join before starting AI conversation
    setTimeout(() => {
      if (liveKitService.isAgentActive(roomName)) {
        console.log(`AI conversation started in room: ${roomName}`);
      } else {
        console.error(`Failed to start AI conversation in room: ${roomName}`);
        liveKitService.stopVoiceAgent(roomName).catch(console.error);
      }
    }, 5000);

    res.json({
      roomName,
      token,
      topic
    });

  } catch (error) {
    console.error("Error creating conversation room:", error);
    res.status(500).json({ error: "Failed to create conversation room" });
  }
});

// End conversation
router.post("/api/conversation/end", async (req, res) => {
  try {
    const { roomName } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ error: "Room name is required" });
    }

    await liveKitService.stopVoiceAgent(roomName);
    res.json({ success: true });

  } catch (error) {
    console.error("Error ending conversation:", error);
    res.status(500).json({ error: "Failed to end conversation" });
  }
});

// Get conversation status
router.get("/api/conversation/status/:roomName", (req, res) => {
  try {
    const { roomName } = req.params;
    
    if (!roomName) {
      return res.status(400).json({ error: "Room name is required" });
    }

    const isActive = liveKitService.isAgentActive(roomName);
    res.json({ isActive });

  } catch (error) {
    console.error("Error getting conversation status:", error);
    res.status(500).json({ error: "Failed to get conversation status" });
  }
});

export default router;
