"""
Mock services for free testing in WebRTC test mode.
These services simulate STT/TTS without making external API calls.
"""

import asyncio
from typing import AsyncGenerator

from loguru import logger
from pipecat.frames.audio_frame import AudioFrame
from pipecat.frames.base import Frame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.ai_services import TTSService


class MockSTTService:
    """Mock STT service that returns predefined text for testing"""
    
    def __init__(self, test_responses: list[str] = None):
        self.test_responses = test_responses or [
            "Hi, I'm looking for a 3-bedroom house",
            "My budget is around $500,000", 
            "I'd like to see properties next weekend"
        ]
        self.response_index = 0
    
    async def process_audio_frame(self, frame: AudioFrame) -> str:
        """Mock processing - return predefined responses"""
        # Simulate processing delay
        await asyncio.sleep(0.5)
        
        response = self.test_responses[self.response_index % len(self.test_responses)]
        self.response_index += 1
        
        logger.info(f"Mock STT returning: {response}")
        return response


class MockTTSService(TTSService):
    """Mock TTS service that generates silent audio for testing"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.sample_rate = 16000
        self.samples_per_frame = 160  # 10ms frames at 16kHz
        
    async def run_tts(self, text: str) -> AsyncGenerator[Frame, None]:
        """Generate silent audio frames for the given text"""
        logger.info(f"Mock TTS processing text: {text}")
        
        # Calculate duration based on text length (rough estimate)
        words_per_second = 150  # Average speaking rate
        estimated_duration = len(text.split()) / words_per_second
        total_frames = int(estimated_duration * 100)  # 100 frames per second
        
        # Generate silent audio frames
        for i in range(total_frames):
            # Create silent audio frame (all zeros)
            audio_data = bytes([0] * (self.samples_per_frame * 2))  # 16-bit audio
            
            frame = AudioFrame(
                audio=audio_data,
                sample_rate=self.sample_rate,
                num_channels=1,
                num_frames=self.samples_per_frame
            )
            
            yield frame
            
            # Small delay to simulate real-time TTS
            await asyncio.sleep(0.01)
        
        logger.info(f"Mock TTS generated {total_frames} silent frames for text")


def create_mock_stt_service(test_responses: list[str] = None):
    """Create a mock STT service for testing"""
    return MockSTTService(test_responses)


def create_mock_tts_service(**kwargs):
    """Create a mock TTS service for testing"""
    return MockTTSService(**kwargs)
