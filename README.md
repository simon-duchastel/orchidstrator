<div align="center">
  
<h1>Orchid</h1>
<p>Orchid helps you orchestrate AI agents in the background.</p>

</div>

![Satellites in space](assets/images/satellites-header.avif)


## Overview

Orchid (`orchid`) manages a background daemon that runs an OpenCode server. This allows you to orchestrate AI tasks in the background without blocking your terminal.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'orchid' command available globally
```

## Usage

### Start the daemon

```bash
orchid up
```

Starts the orchid daemon and OpenCode server in the background. The server runs at `http://127.0.0.1:4096` by default.

### Check status

```bash
orchid status
```

Shows whether the daemon is running and its PID.

### Stop the daemon

```bash
orchid down
```

Gracefully stops the daemon and OpenCode server.

## Development

```bash
# Run in development mode (using tsx)
npm run dev

# Build for production
npm run build

# Run the built version
npm start
```

## License

MIT
