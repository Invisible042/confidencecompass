import { pgTable, text, serial, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  duration: integer("duration").notNull(), // in seconds
  eyeContactScore: real("eye_contact_score").notNull(),
  voiceClarity: real("voice_clarity").notNull(),
  speakingPace: real("speaking_pace").notNull(),
  volumeLevel: real("volume_level").notNull(),
  overallScore: real("overall_score").notNull(),
  recordingUrl: text("recording_url"),
  eyeTrackingData: jsonb("eye_tracking_data"), // stores eye position data over time
  voiceMetrics: jsonb("voice_metrics"), // stores voice analysis data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  totalSessions: integer("total_sessions").notNull().default(0),
  avgEyeContact: real("avg_eye_contact").notNull().default(0),
  avgVoiceClarity: real("avg_voice_clarity").notNull().default(0),
  avgSpeakingPace: real("avg_speaking_pace").notNull().default(0),
  totalPracticeTime: integer("total_practice_time").notNull().default(0), // in seconds
  lastSessionDate: timestamp("last_session_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;

// Additional types for real-time data
export interface EyeTrackingPoint {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
}

export interface VoiceMetric {
  volume: number;
  pitch: number;
  clarity: number;
  pace: number;
  timestamp: number;
}

export interface SessionStats {
  totalSessions: number;
  avgEyeContact: number;
  avgVoiceClarity: number;
  avgSpeakingPace: number;
  totalPracticeTime: number;
  sessionsThisWeek: number;
  improvementPercent: number;
}
