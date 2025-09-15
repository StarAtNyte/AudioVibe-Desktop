#!/usr/bin/env python3
"""
FastAPI for VibeVoice TTS generation on Modal Labs.
Converts text to high-quality speech using Microsoft VibeVoice-1.5B model.
"""
import torch
import modal
import os
import io
import base64
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = modal.App("vibevoice-tts-api")

# Base image with VibeVoice dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        "libgl1-mesa-glx", 
        "libglib2.0-0",
        "libsndfile1",
        "ffmpeg"
    ])
    .pip_install([
        "torch>=2.0.0",
        "accelerate==1.6.0",
        "transformers==4.51.3",
        "llvmlite>=0.40.0",
        "numba>=0.57.0",
        "diffusers",
        "tqdm",
        "numpy",
        "scipy",
        "librosa",
        "ml-collections",
        "absl-py",
        "gradio",
        "av",
        "aiortc",
        "fastapi",
        "uvicorn",
        "soundfile",
    ])
    # Upload the VibeVoice repository
    .add_local_dir("./VibeVoice", remote_path="/VibeVoice")
)

# Volume configuration
hf_cache_volume = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
CACHE_PATH = "/root/huggingface_cache"
MODEL_PATH = "/tmp/vibevoice-model"

# Global model variables
model = None
processor = None
available_voices = {}

# Pydantic models for request/response validation
class GenerateAudioRequest(BaseModel):
    text: str
    speaker_voice: str = "en-Alice_woman"
    cfg_scale: float = 1.3
    num_speakers: int = 1
    format: str = "wav"  # wav, mp3

class GenerateAudioResponse(BaseModel):
    success: bool
    audio_data: Optional[str] = None  # base64 encoded audio
    duration: Optional[float] = None
    sample_rate: int = 24000
    format: str = "wav"
    error: Optional[str] = None

class VoicesResponse(BaseModel):
    voices: List[Dict[str, str]]

class HealthCheckResponse(BaseModel):
    status: str
    message: str
    model: str
    available_voices: int

def load_model():
    """Load the VibeVoice model and processor."""
    global model, processor, available_voices
    
    print("Loading VibeVoice model...")
    
    # Import VibeVoice modules
    import sys
    sys.path.insert(0, "/VibeVoice")
    
    from vibevoice.modular.configuration_vibevoice import VibeVoiceConfig
    from vibevoice.modular.modeling_vibevoice_inference import VibeVoiceForConditionalGenerationInference
    from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor
    
    # Set model path (download from HuggingFace if needed)
    model_path = "microsoft/VibeVoice-1.5B"
    
    # Set device and dtype (use float32 for T4 compatibility)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    load_dtype = torch.float32  # Use float32 for better T4 compatibility
    attn_impl = "sdpa"
    
    print(f"Using device: {device}, dtype: {load_dtype}, attention: {attn_impl}")
    
    # Load processor
    processor = VibeVoiceProcessor.from_pretrained(model_path, cache_dir=CACHE_PATH)
    
    # Load model (no fallback needed since we're using SDPA)
    model = VibeVoiceForConditionalGenerationInference.from_pretrained(
        model_path,
        torch_dtype=load_dtype,
        device_map=device if device == "cuda" else None,
        attn_implementation=attn_impl,
        cache_dir=CACHE_PATH
    )
    if device != "cuda":
        model.to(device)
    
    model.eval()
    
    # Configure noise scheduler for better quality
    model.model.noise_scheduler = model.model.noise_scheduler.from_config(
        model.model.noise_scheduler.config,
        algorithm_type='sde-dpmsolver++',
        beta_schedule='squaredcos_cap_v2'
    )
    model.set_ddpm_inference_steps(num_steps=10)
    
    # Load voice presets
    setup_voice_presets()
    
    print(f"VibeVoice model loaded successfully with {len(available_voices)} voices")

def setup_voice_presets():
    """Setup voice presets by loading voice samples."""
    global available_voices
    
    voices_dir = "/VibeVoice/demo/voices"
    available_voices = {}
    
    if not os.path.exists(voices_dir):
        print(f"Warning: Voices directory not found at {voices_dir}")
        return
    
    # Get all audio files in the voices directory
    for file in os.listdir(voices_dir):
        if file.lower().endswith(('.wav', '.mp3', '.flac', '.ogg')):
            name = os.path.splitext(file)[0]
            full_path = os.path.join(voices_dir, file)
            if os.path.exists(full_path):
                available_voices[name] = full_path
    
    print(f"Found {len(available_voices)} voice presets: {list(available_voices.keys())}")

def read_audio(audio_path: str, target_sr: int = 24000):
    """Read and preprocess audio file."""
    try:
        import soundfile as sf
        import librosa
        import numpy as np
        
        wav, sr = sf.read(audio_path)
        if len(wav.shape) > 1:
            wav = np.mean(wav, axis=1)
        if sr != target_sr:
            wav = librosa.resample(wav, orig_sr=sr, target_sr=target_sr)
        return wav
    except Exception as e:
        print(f"Error reading audio {audio_path}: {e}")
        import numpy as np
        return np.array([])

def generate_audio(text: str, speaker_voice: str = "en-Alice_woman", cfg_scale: float = 1.3) -> tuple:
    """Generate audio from text using VibeVoice."""
    global model, processor, available_voices
    import numpy as np  # Import numpy at the beginning
    
    if not text.strip():
        raise ValueError("Text cannot be empty")
    
    if speaker_voice not in available_voices:
        raise ValueError(f"Voice '{speaker_voice}' not found. Available: {list(available_voices.keys())}")
    
    # Load voice sample
    voice_path = available_voices[speaker_voice]
    voice_sample = read_audio(voice_path)
    
    if len(voice_sample) == 0:
        raise ValueError(f"Failed to load voice sample from {voice_path}")
    
    # Format text with speaker label if not already formatted
    if not text.strip().startswith("Speaker"):
        formatted_text = f"Speaker 0: {text}"
    else:
        formatted_text = text
    
    # Prepare inputs
    inputs = processor(
        text=[formatted_text],
        voice_samples=[[voice_sample]],
        padding=True,
        return_tensors="pt",
        return_attention_mask=True,
    )
    
    # Move to device
    device = next(model.parameters()).device
    for k, v in inputs.items():
        if torch.is_tensor(v):
            inputs[k] = v.to(device)
    
    # Generate audio using streaming approach like the Gradio demo
    from vibevoice.modular.streamer import AudioStreamer
    import threading
    import time
    
    # Create audio streamer
    audio_streamer = AudioStreamer(
        batch_size=1,
        stop_signal=None,
        timeout=None
    )
    
    # Start generation in a separate thread
    def generate_with_streamer():
        try:
            outputs = model.generate(
                **inputs,
                max_new_tokens=None,
                cfg_scale=cfg_scale,
                tokenizer=processor.tokenizer,
                generation_config={'do_sample': False},
                audio_streamer=audio_streamer,
                verbose=False,
                refresh_negative=True,
            )
        except Exception as e:
            print(f"Error in generation thread: {e}")
            audio_streamer.end()
    
    generation_thread = threading.Thread(target=generate_with_streamer)
    generation_thread.start()
    
    # Wait a moment for generation to start
    time.sleep(2)
    
    # Collect audio chunks
    audio_chunks = []
    audio_stream = audio_streamer.get_stream(0)
    chunk_count = 0
    
    print(f"Starting to collect audio chunks...")
    
    for audio_chunk in audio_stream:
        chunk_count += 1
        print(f"Received chunk {chunk_count}, type: {type(audio_chunk)}")
        
        if torch.is_tensor(audio_chunk):
            print(f"Chunk {chunk_count} tensor shape: {audio_chunk.shape}, dtype: {audio_chunk.dtype}")
            # Convert tensor to numpy
            if audio_chunk.dtype == torch.bfloat16:
                audio_chunk = audio_chunk.float()
            audio_np = audio_chunk.cpu().numpy().astype(np.float32)
        else:
            audio_np = np.array(audio_chunk, dtype=np.float32)
        
        # Ensure audio is 1D
        if len(audio_np.shape) > 1:
            audio_np = audio_np.squeeze()
        
        print(f"Chunk {chunk_count} final shape: {audio_np.shape}, samples: {len(audio_np)}")
        audio_chunks.append(audio_np)
    
    print(f"Finished collecting {chunk_count} audio chunks")
    
    # Wait for generation thread to complete
    generation_thread.join(timeout=30)
    
    if not audio_chunks:
        raise ValueError("No audio chunks generated")
    
    # Concatenate all chunks
    audio_data = np.concatenate(audio_chunks)
    
    # Ensure proper format
    if len(audio_data.shape) > 1:
        audio_data = audio_data.squeeze()
    
    # Normalize
    if np.max(np.abs(audio_data)) > 1.0:
        audio_data = audio_data / np.max(np.abs(audio_data))
    
    return audio_data, 24000

@app.function(
    image=image,
    gpu="T4",  # T4 should be sufficient for 1.5B model and much cheaper
    volumes={CACHE_PATH: hf_cache_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=1800,
    memory=16000,  # Reduce memory allocation for T4
    scaledown_window=300,
)
@modal.asgi_app()
def fastapi_app():
    """Create FastAPI app for VibeVoice TTS."""
    
    # Initialize FastAPI app
    app = FastAPI(
        title="VibeVoice TTS API", 
        description="Text-to-Speech using Microsoft VibeVoice-1.5B"
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Set environment variables
    os.environ["HF_HOME"] = CACHE_PATH
    
    @app.on_event("startup")
    async def startup_event():
        """Load model on startup."""
        load_model()
    
    @app.get("/", response_class=HTMLResponse)
    async def serve_ui():
        """Serve a simple UI."""
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>VibeVoice TTS API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; max-width: 800px; }
                h1 { color: #333; }
                .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
                code { background: #e9ecef; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎙️ VibeVoice TTS API</h1>
                <p>High-quality text-to-speech conversion using Microsoft VibeVoice-1.5B</p>
                
                <div class="endpoint">
                    <h3>POST /generate-audio</h3>
                    <p>Convert text to speech with voice selection</p>
                    <code>{"text": "Hello world", "speaker_voice": "en-Alice_woman"}</code>
                </div>
                
                <div class="endpoint">
                    <h3>GET /voices</h3>
                    <p>List available voice presets</p>
                </div>
                
                <div class="endpoint">
                    <h3>GET /health</h3>
                    <p>API health check</p>
                </div>
                
                <p><strong>Note:</strong> This API is for research purposes only.</p>
            </div>
        </body>
        </html>
        """)
    
    @app.get("/health", response_model=HealthCheckResponse)
    async def health_check():
        """Health check endpoint."""
        global model, available_voices
        return HealthCheckResponse(
            status="healthy",
            message="VibeVoice TTS API is running",
            model="microsoft/VibeVoice-1.5B",
            available_voices=len(available_voices)
        )
    
    @app.get("/voices", response_model=VoicesResponse)
    async def list_voices():
        """List available voice presets."""
        global available_voices
        
        voices = [
            {"name": name, "description": f"Voice preset: {name}"}
            for name in sorted(available_voices.keys())
        ]
        
        return VoicesResponse(voices=voices)
    
    @app.post("/generate-audio", response_model=GenerateAudioResponse)
    async def generate_audio_endpoint(request: GenerateAudioRequest):
        """Generate audio from text using VibeVoice."""
        try:
            start_time = time.time()
            
            print(f"Generating audio for text: {request.text[:50]}...")
            print(f"Using voice: {request.speaker_voice}, CFG scale: {request.cfg_scale}")
            
            # Generate audio
            audio_data, sample_rate = generate_audio(
                text=request.text,
                speaker_voice=request.speaker_voice,
                cfg_scale=request.cfg_scale
            )
            
            # Calculate duration
            duration = len(audio_data) / sample_rate
            generation_time = time.time() - start_time
            
            print(f"Generated {duration:.2f}s of audio in {generation_time:.2f}s")
            
            # Convert to requested format
            import soundfile as sf
            with tempfile.NamedTemporaryFile(suffix=f".{request.format}", delete=False) as tmp_file:
                if request.format.lower() == "wav":
                    sf.write(tmp_file.name, audio_data, sample_rate)
                else:
                    # Default to WAV for now
                    sf.write(tmp_file.name, audio_data, sample_rate)
                
                # Read back as bytes and encode to base64
                with open(tmp_file.name, "rb") as f:
                    audio_bytes = f.read()
                    audio_b64 = base64.b64encode(audio_bytes).decode()
                
                os.unlink(tmp_file.name)
            
            return GenerateAudioResponse(
                success=True,
                audio_data=audio_b64,
                duration=duration,
                sample_rate=sample_rate,
                format=request.format
            )
            
        except Exception as e:
            print(f"Error generating audio: {str(e)}")
            import traceback
            traceback.print_exc()
            return GenerateAudioResponse(
                success=False,
                error=str(e)
            )
    
    return app

# LOCAL ENTRYPOINT
@app.local_entrypoint()
def serve():
    """Start the VibeVoice TTS API server."""
    print("Starting VibeVoice TTS API server...")
    print("API will be available at the Modal endpoint URL")
    print("\nEndpoints:")
    print("  GET  / - Web UI")
    print("  GET  /health - Health check") 
    print("  GET  /voices - List available voices")
    print("  POST /generate-audio - Generate speech from text")
    
    print("\nExample request:")
    print('curl -X POST <your-modal-url>/generate-audio \\')
    print('  -H "Content-Type: application/json" \\')
    print('  -d \'{"text": "Hello, this is a test of VibeVoice TTS!", "speaker_voice": "en-Alice_woman"}\'')

if __name__ == "__main__":
    print("VibeVoice TTS API for Modal Labs")
    print("Usage: modal serve vibevoice_api.py")