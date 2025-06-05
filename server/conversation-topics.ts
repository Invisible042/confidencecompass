import { ConversationTopic } from "@shared/schema";

export const conversationTopics: ConversationTopic[] = [
  {
    id: "job-interview",
    title: "Job Interview Practice",
    description: "Practice common job interview questions and scenarios",
    difficulty: "intermediate",
    category: "Professional",
    prompt: "You are an experienced hiring manager conducting a job interview. Ask relevant questions about the candidate's experience, skills, and career goals. Provide constructive feedback and maintain a professional but friendly tone."
  },
  {
    id: "presentation-skills",
    title: "Presentation Skills",
    description: "Practice presenting ideas clearly and confidently",
    difficulty: "intermediate",
    category: "Professional",
    prompt: "You are an audience member listening to a presentation. Ask clarifying questions, show engagement, and provide feedback on clarity, structure, and delivery."
  },
  {
    id: "casual-conversation",
    title: "Casual Conversation",
    description: "Practice everyday social interactions and small talk",
    difficulty: "beginner",
    category: "Social",
    prompt: "You are a friendly person having a casual conversation. Engage in natural small talk, ask follow-up questions, and keep the conversation flowing smoothly."
  },
  {
    id: "public-speaking",
    title: "Public Speaking",
    description: "Practice speaking to larger audiences",
    difficulty: "advanced",
    category: "Professional",
    prompt: "You are an audience member at a public speaking event. Listen attentively, ask thoughtful questions, and provide feedback on engagement and clarity."
  },
  {
    id: "networking",
    title: "Networking Events",
    description: "Practice professional networking conversations",
    difficulty: "intermediate",
    category: "Professional",
    prompt: "You are a professional at a networking event. Engage in meaningful conversations about careers, interests, and potential collaborations."
  },
  {
    id: "customer-service",
    title: "Customer Service",
    description: "Practice handling customer inquiries and complaints",
    difficulty: "intermediate",
    category: "Professional",
    prompt: "You are a customer with various needs and concerns. Present realistic scenarios that require professional, empathetic responses."
  },
  {
    id: "conflict-resolution",
    title: "Conflict Resolution",
    description: "Practice resolving disagreements diplomatically",
    difficulty: "advanced",
    category: "Professional",
    prompt: "You are involved in a workplace disagreement. Present your perspective while being open to finding common ground and solutions."
  },
  {
    id: "social-events",
    title: "Social Events",
    description: "Practice conversations at parties and social gatherings",
    difficulty: "beginner",
    category: "Social",
    prompt: "You are at a social gathering. Engage in friendly conversation, share stories, and help create a welcoming atmosphere."
  }
];

export function getTopicById(id: string): ConversationTopic | undefined {
  return conversationTopics.find(topic => topic.id === id);
}

export function getTopicsByCategory(category: string): ConversationTopic[] {
  return conversationTopics.filter(topic => topic.category === category);
}

export function getTopicsByDifficulty(difficulty: ConversationTopic['difficulty']): ConversationTopic[] {
  return conversationTopics.filter(topic => topic.difficulty === difficulty);
}