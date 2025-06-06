import asyncio
import os
from typing import Dict, Any
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    deepgram,
    noise_cancellation,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv()


class ConversationPracticeAssistant(Agent):
    def __init__(self, topic: str = "general conversation", difficulty: str = "intermediate") -> None:
        self.topic = topic
        self.difficulty = difficulty
        
        # Create conversation instructions based on topic and difficulty
        instructions = self._generate_instructions(topic, difficulty)
        super().__init__(instructions=instructions)
        
        # Track conversation metrics
        self.conversation_history = []
        self.feedback_points = []
        self.session_metrics = {
            "speaking_time": 0,
            "response_count": 0,
            "avg_response_time": 0,
            "vocabulary_complexity": 0,
            "user_engagement": 0,
            "conversation_flow": 0
        }

    def _generate_instructions(self, topic: str, difficulty: str) -> str:
        base_instructions = f"""
        You are a helpful AI conversation practice assistant specializing in {topic} conversations.
        
        Your role:
        1. Engage in natural, flowing conversation about {topic}
        2. Ask thoughtful questions to encourage the user to speak more
        3. Provide gentle corrections and helpful suggestions
        4. Adapt conversation complexity to {difficulty} level
        5. Give constructive feedback on communication skills
        
        Guidelines:
        - Keep responses conversational and encouraging (2-3 sentences)
        - Ask follow-up questions to maintain dialogue flow
        - Be supportive and positive in your feedback
        - Focus on practical communication improvement
        - Stay on topic: {topic}
        
        Difficulty adjustments:
        - Beginner: Use simple vocabulary, shorter sentences, basic topics
        - Intermediate: Normal conversation pace, varied vocabulary
        - Advanced: Complex topics, nuanced discussions, advanced vocabulary
        - Ask follow-up questions to maintain conversation flow
        - Note any filler words, unclear speech, or areas for improvement
        - Provide encouragement and positive reinforcement
        - Help build confidence in speaking
        """
        
        if difficulty == "beginner":
            base_instructions += """
            - Use simple vocabulary and clear speech
            - Give more time for responses
            - Provide basic conversation prompts
            """
        elif difficulty == "advanced":
            base_instructions += """
            - Use complex vocabulary and sophisticated topics
            - Challenge with nuanced questions
            - Provide detailed feedback on advanced communication skills
            """
            
        return base_instructions

    async def on_message_received(self, message: str) -> None:
        """Track conversation metrics when user speaks"""
        self.conversation_history.append({
            "speaker": "user",
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        })
        
        # Analyze message for feedback
        feedback = self._analyze_user_message(message)
        if feedback:
            self.feedback_points.append(feedback)

    def _analyze_user_message(self, message: str) -> Dict[str, Any]:
        """Analyze user message for conversation quality"""
        feedback = {}
        
        # Check for filler words
        filler_words = ["um", "uh", "like", "you know", "sort of", "kind of"]
        filler_count = sum(1 for word in filler_words if word in message.lower())
        
        if filler_count > 0:
            feedback["filler_words"] = {
                "count": filler_count,
                "suggestion": "Try to reduce filler words for clearer communication"
            }
        
        # Check message length and complexity
        word_count = len(message.split())
        if word_count < 5:
            feedback["elaboration"] = {
                "suggestion": "Try to elaborate on your thoughts with more detail"
            }
        
        return feedback if feedback else None


async def entrypoint(ctx: agents.JobContext):
    """Main entry point for LiveKit voice agent"""
    
    # Get room metadata for topic and difficulty
    room_metadata = ctx.room.metadata or "{}"
    import json
    try:
        metadata = json.loads(room_metadata)
        topic = metadata.get("topic", "general conversation")
        difficulty = metadata.get("difficulty", "intermediate")
    except:
        topic = "general conversation"
        difficulty = "intermediate"
    
    # Create AI agent session with enhanced voice processing
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-2",
            language="en-US",
            smart_format=True,
            punctuate=True,
            filler_words=True,
            sentiment=True,
            interim_results=True
        ),
        llm=openai.LLM(
            model="gpt-4o-mini",
            temperature=0.7,
            max_tokens=150  # Keep responses concise for conversation flow
        ),
        tts=deepgram.TTS(
            model="aura-asteria-en",
            encoding="linear16",
            sample_rate=24000
        ),
        vad=silero.VAD.load(
            min_speech_duration=0.5,
            min_silence_duration=0.8
        ),
        turn_detection=MultilingualModel(
            min_turn_duration=1.0,
            silence_threshold=0.5
        ),
    )

    # Create conversation practice assistant
    assistant = ConversationPracticeAssistant(topic, difficulty)

    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
            auto_subscribe=True,
            auto_publish=True
        ),
    )

    await ctx.connect()

    # Generate initial greeting based on topic
    greeting = f"Hello! I'm here to help you practice {topic} conversations. Let's start with a simple question to get our conversation flowing. How are you feeling about discussing this topic today?"
    
    await session.generate_reply(instructions=greeting)

    # Keep session alive and handle conversation flow
    while ctx.room.connection_state == "connected":
        await asyncio.sleep(1)
        
        # Provide periodic feedback during longer conversations
        if len(assistant.conversation_history) > 0:
            last_message_time = assistant.conversation_history[-1]["timestamp"]
            current_time = asyncio.get_event_loop().time()
            
            # If no activity for 30 seconds, prompt for continuation
            if current_time - last_message_time > 30:
                await session.generate_reply(
                    instructions="The user seems to have paused. Gently encourage them to continue the conversation with a follow-up question."
                )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))