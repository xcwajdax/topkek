@echo off
echo Starting VIBE_2025 Server...
echo Opening http://localhost:8002
start "" http://localhost:8002
python -m http.server 8002
