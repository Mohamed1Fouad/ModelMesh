# ModelMesh JetBrains Plugin

AI coding assistant plugin for IntelliJ IDEA and other JetBrains IDEs, powered by the ModelMesh routing gateway.

## Features

- **Chat Panel** — Side panel for conversational AI assistance
- **Model Switching** — Change models via Tools menu
- **Explain Code** — Right-click any selected code to get an explanation
- **Settings** — Configure gateway URL, API key, default model, and timeout

## Installation

### From Source

```bash
./gradlew buildPlugin
# Install the generated plugin zip from build/distributions/
```

### From JetBrains Marketplace

Coming soon.

## Configuration

Open **Settings → Tools → ModelMesh** to configure:

- **Gateway URL** — Your ModelMesh instance (default: `http://localhost:3000`)
- **API Key** — Optional authentication key
- **Default Model** — Model to use (leave empty for auto-routing)
- **Timeout** — Request timeout in milliseconds

## Keyboard Shortcuts

- `Ctrl + Shift + M` — Open ModelMesh Chat panel

## Requirements

- IntelliJ Platform 2023.2.5 or later
- A running ModelMesh gateway

## Development

```bash
./gradlew runIde          # Run IntelliJ with the plugin
./gradlew buildPlugin     # Build distribution
```
