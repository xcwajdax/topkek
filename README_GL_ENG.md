# ⚡ Glitch Lab

**Experimental glitch effects on animation frames with real-time preview**

Glitch Lab is an advanced desktop tool for creating digital art through controlled image distortion. The application allows you to apply various glitch effects to animation frame sequences, offering full control over effect intensity and parameters.

![Glitch Lab Interface](https://img.shields.io/badge/Interface-Polish-blue) ![Python](https://img.shields.io/badge/Python-3.x-green) ![GUI](https://img.shields.io/badge/GUI-Tkinter-orange) ![License](https://img.shields.io/badge/License-Open%20Source-brightgreen)

## ✨ Key Features

### 🎨 **10+ Glitch Effects**
- **RGB Shift** - Color channel displacement for chromatic aberration effect
- **Horizontal Shift** - Horizontal displacement of image strips
- **Block Displacement** - Moving pixel blocks around
- **Scanlines** - CRT-style scanning line effects
- **Color Channel Swap** - Swapping color channels
- **Noise Bands** - Digital noise strips
- **VHS Tracking** - VHS-style tracking effects
- **JPEG Artifacts** - Compression artifact simulation

### 🎬 **Advanced Animation System**
- **Keyframe Animation** - Full control over effect intensity over time
- **Animation Patterns**: `every`, `every_n`, `random`, `burst`, `keyframes`
- **Intensity Modes**: `constant`, `fade_in`, `fade_out`, `pulse`, `random`
- **Interpolation** - Smooth transitions between keyframes

### 👁️ **Real-Time Preview**
- **Dual Preview** - Simultaneous preview of original and result
- **Synchronization** - Shared playback controls
- **Zoom & Pan** - Full view control
- **Frame Navigation** - Precise frame-by-frame navigation

### ⚙️ **Advanced Mode**
- **Effect Parameters** - Detailed control over each effect
- **Real-time Preview** - Single frame preview with effects
- **Batch Processing** - Processing entire sequences

## 🚀 Quick Start

### Automatic Installation (Recommended)

#### Windows
```bash
# Full installation (Python + libraries)
install.bat

# Libraries only (if Python already installed)
install-packages.bat
```

#### Linux/macOS
```bash
# Full installation (Python + libraries)
./install.sh

# Or manually via pip
pip install -r requirements.txt
```

### Manual Installation
```bash
# Required libraries
pip install Pillow numpy

# Optional (auto-restart)
pip install watchdog
```

### Running
```bash
# Windows
run.bat

# Linux/macOS or directly
python main.py
```

### Basic Usage
1. **Select directory** with numbered frames (e.g., `frame_001.png`, `frame_002.jpg`)
2. **Set output directory** or use "New Output"
3. **Choose effects** from available list
4. **Adjust intensity** (0.5 - 5.0)
5. **Click GENERATE** and watch the progress

## 🎯 Target Users

- **Digital Artists** - Creating experimental digital art
- **Video Editors** - Adding glitch effects to animations
- **Creative Professionals** - Working with glitch art aesthetics
- **Hobbyists** - Experimenting with visual effects

## 🛠️ Architecture

### Modular Design
```
glitch_lab/
├── main.py                 # Main application and GUI
├── core/                   # Processing logic
│   ├── effects.py          # Effect implementations
│   ├── animation.py        # Keyframe system
│   ├── processing.py       # Processing pipeline
│   └── utils.py           # Helper utilities
├── gui/                    # Interface components
│   ├── theme.py           # Dark neon theme
│   ├── preview.py         # Preview players
│   └── animation_editor.py # Keyframe editor
└── config/                 # Configuration
    ├── effects_registry.py # Effects registry
    └── constants.py       # Application constants
```

### Key Technologies
- **Python 3.x** - Programming language
- **Tkinter + ttk** - GUI framework with dark theme
- **PIL/Pillow** - Image processing
- **NumPy** - Pixel array operations

## 🎨 Effect Examples

### RGB Shift
Classic chromatic aberration effect - shifting red and blue channels creates characteristic color "splitting".

### Block Displacement
Random movement of rectangular pixel blocks, creating a "falling apart" image effect.

### VHS Tracking
Simulation of VHS tape playback issues - wavy distortions and tracking artifacts.

## 🔧 Advanced Features

### Frame Multiplier
Automatic frame duplication with sequential numbering - perfect for frame rate adjustment.

### Keyframe Animation
Full control over effect animation:
- Defining key points
- Interpolation between keyframes
- Different transition modes (linear, ease-in, ease-out)

### Batch Processing
Efficient processing of entire sequences with:
- Real-time progress bar
- Operation logging
- Error handling

## 📊 Workflow

1. **Import** → Load frame sequence
2. **Configure** → Choose effects and parameters
3. **Preview** → Check result on single frame
4. **Animate** → Set intensity animation (optional)
5. **Process** → Generate entire sequence
6. **Export** → Ready frames in output directory

## 🎪 Interface

The application offers an intuitive interface in Polish with three main panels:

- **Left Panel** - Basic settings, effects, animation
- **Center Panel** - Advanced effect parameters (optional)
- **Right Panel** - Original and result previews with controls

## 🚀 Development

Glitch Lab is actively developed with focus on:
- Adding new glitch effects
- Performance optimization
- Expanding animation capabilities
- Improving user experience

## 🤝 Contributing

We welcome contributions! The project is open to:
- New glitch effects
- Bug fixes
- Performance optimizations
- Interface translations
- Documentation

## 📋 TODO and Changelog

- **[TODO.md](TODO.md)** – Task list (to do, in progress, done). Usage instructions are in the file.
- **[CHANGELOG.md](CHANGELOG.md)** – Version history. Maintenance rules (Keep a Changelog) are described at the top of the file.

## 📄 License

Open Source - details in LICENSE file

---

**Glitch Lab** - Where controlled distortions become digital art ⚡