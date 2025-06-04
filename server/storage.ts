import { users, sessions, userProgress, type User, type InsertUser, type Session, type InsertSession, type UserProgress, type InsertUserProgress, type SessionStats } from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  getUserSessions(userId: number, limit?: number): Promise<Session[]>;
  deleteSession(id: number): Promise<boolean>;

  // User progress operations
  getUserProgress(userId: number): Promise<UserProgress | undefined>;
  updateUserProgress(userId: number, progress: Partial<InsertUserProgress>): Promise<UserProgress>;
  getSessionStats(userId: number): Promise<SessionStats>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private sessions: Map<number, Session>;
  private userProgress: Map<number, UserProgress>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentProgressId: number;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.userProgress = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentProgressId = 1;

    // Create a default user for demo
    this.createUser({
      username: "johndoe",
      email: "john@example.com"
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);

    // Initialize user progress
    await this.updateUserProgress(id, {
      userId: id,
      totalSessions: 0,
      avgEyeContact: 0,
      avgVoiceClarity: 0,
      avgSpeakingPace: 0,
      totalPracticeTime: 0,
      lastSessionDate: null
    });

    return user;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.currentSessionId++;
    const session: Session = {
      id,
      userId: insertSession.userId,
      title: insertSession.title,
      duration: insertSession.duration,
      eyeContactScore: insertSession.eyeContactScore,
      voiceClarity: insertSession.voiceClarity,
      speakingPace: insertSession.speakingPace,
      volumeLevel: insertSession.volumeLevel,
      overallScore: insertSession.overallScore,
      recordingUrl: insertSession.recordingUrl || null,
      eyeTrackingData: insertSession.eyeTrackingData || null,
      voiceMetrics: insertSession.voiceMetrics || null,
      createdAt: new Date()
    };
    this.sessions.set(id, session);

    // Update user progress
    await this.updateProgressAfterSession(session);

    return session;
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getUserSessions(userId: number, limit = 50): Promise<Session[]> {
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    return userSessions;
  }

  async deleteSession(id: number): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async getUserProgress(userId: number): Promise<UserProgress | undefined> {
    return Array.from(this.userProgress.values()).find(progress => progress.userId === userId);
  }

  async updateUserProgress(userId: number, progressUpdate: Partial<InsertUserProgress>): Promise<UserProgress> {
    const existing = await this.getUserProgress(userId);
    
    if (existing) {
      const updated: UserProgress = {
        ...existing,
        ...progressUpdate,
        updatedAt: new Date()
      };
      this.userProgress.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentProgressId++;
      const newProgress: UserProgress = {
        id,
        userId,
        totalSessions: 0,
        avgEyeContact: 0,
        avgVoiceClarity: 0,
        avgSpeakingPace: 0,
        totalPracticeTime: 0,
        lastSessionDate: null,
        updatedAt: new Date(),
        ...progressUpdate
      };
      this.userProgress.set(id, newProgress);
      return newProgress;
    }
  }

  async getSessionStats(userId: number): Promise<SessionStats> {
    const progress = await this.getUserProgress(userId);
    const sessions = await this.getUserSessions(userId);
    
    // Calculate sessions this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const sessionsThisWeek = sessions.filter(session => session.createdAt > oneWeekAgo).length;

    // Calculate improvement (mock calculation based on recent vs older sessions)
    const recentSessions = sessions.slice(0, 5);
    const olderSessions = sessions.slice(5, 10);
    
    let improvementPercent = 0;
    if (recentSessions.length > 0 && olderSessions.length > 0) {
      const recentAvg = recentSessions.reduce((sum, s) => sum + s.overallScore, 0) / recentSessions.length;
      const olderAvg = olderSessions.reduce((sum, s) => sum + s.overallScore, 0) / olderSessions.length;
      improvementPercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    }

    return {
      totalSessions: progress?.totalSessions || 0,
      avgEyeContact: progress?.avgEyeContact || 0,
      avgVoiceClarity: progress?.avgVoiceClarity || 0,
      avgSpeakingPace: progress?.avgSpeakingPace || 0,
      totalPracticeTime: progress?.totalPracticeTime || 0,
      sessionsThisWeek,
      improvementPercent: Math.round(improvementPercent)
    };
  }

  private async updateProgressAfterSession(session: Session): Promise<void> {
    const currentProgress = await this.getUserProgress(session.userId);
    
    if (!currentProgress) return;

    const totalSessions = currentProgress.totalSessions + 1;
    const newAvgEyeContact = ((currentProgress.avgEyeContact * currentProgress.totalSessions) + session.eyeContactScore) / totalSessions;
    const newAvgVoiceClarity = ((currentProgress.avgVoiceClarity * currentProgress.totalSessions) + session.voiceClarity) / totalSessions;
    const newAvgSpeakingPace = ((currentProgress.avgSpeakingPace * currentProgress.totalSessions) + session.speakingPace) / totalSessions;

    await this.updateUserProgress(session.userId, {
      totalSessions,
      avgEyeContact: newAvgEyeContact,
      avgVoiceClarity: newAvgVoiceClarity,
      avgSpeakingPace: newAvgSpeakingPace,
      totalPracticeTime: currentProgress.totalPracticeTime + session.duration,
      lastSessionDate: session.createdAt
    });
  }
}

export const storage = new MemStorage();
