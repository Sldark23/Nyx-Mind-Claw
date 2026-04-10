#!/bin/bash
set -e

# =============================================================================
# Nyx-Mind-Claw Installation Script
# =============================================================================

REPO_DIR="/root/nyxmind-corp/Nyx-Mind-Claw"
FORCE_ENV=false

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_ENV=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--force]"
            echo "  --force    Overwrite existing .env file with .env.example"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# -----------------------------------------------------------------------------
# Change to repository directory
# -----------------------------------------------------------------------------
if [ ! -d "$REPO_DIR" ]; then
    echo "Cloning Nyx-Mind-Claw repository..."
    git clone git@github.com:Sldark23/Nyx-Mind-Claw.git "$REPO_DIR"
fi

cd "$REPO_DIR"

echo "=============================================="
echo "Nyx-Mind-Claw Installation"
echo "=============================================="
echo ""

# -----------------------------------------------------------------------------
# Git pull (idempotent)
# -----------------------------------------------------------------------------
echo "[1/6] Updating repository..."
git pull origin main 2>/dev/null || true

# -----------------------------------------------------------------------------
# Install dependencies (idempotent - fast if already installed)
# -----------------------------------------------------------------------------
echo "[2/6] Installing dependencies..."
npm install

# -----------------------------------------------------------------------------
# Build project (idempotent)
# -----------------------------------------------------------------------------
echo "[3/6] Building project..."
npm run build

# -----------------------------------------------------------------------------
# Setup .env file (idempotent with --force override)
# -----------------------------------------------------------------------------
echo "[4/6] Setting up environment file..."
if [ "$FORCE_ENV" = true ]; then
    echo "  --force flag: Overwriting .env"
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
elif [ ! -f "$REPO_DIR/.env" ]; then
    echo "  Creating .env from .env.example"
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
else
    echo "  .env already exists (use --force to overwrite)"
fi

# -----------------------------------------------------------------------------
# Setup autostart service
# -----------------------------------------------------------------------------
echo "[5/6] Setting up autostart service..."
if [ -x "$REPO_DIR/setup-autostart.sh" ]; then
    bash "$REPO_DIR/setup-autostart.sh"
else
    echo "  setup-autostart.sh not found or not executable, skipping"
fi

# -----------------------------------------------------------------------------
# Success message
# -----------------------------------------------------------------------------
echo "[6/6] Installation complete!"
echo ""
echo "=============================================="
echo "Installation Successful!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys and configuration"
echo "  2. Run: npm run dev"
echo "  3. Or start the service: systemctl --user start nyxmind.service"
echo ""
echo "Useful commands:"
echo "  View logs:    journalctl --user -u nyxmind.service -f"
echo "  Restart:      systemctl --user restart nyxmind.service"
echo "  Stop:         systemctl --user stop nyxmind.service"
echo ""
