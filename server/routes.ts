import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema } from "@shared/schema";
import { z } from "zod";

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

  const httpServer = createServer(app);
  return httpServer;
}
