#!/bin/bash
set -e

# =============================================================================
# NyxMindClaw — Smart Installation Script
# Detects OS, checks deps, supports install/update, runs onboard at end
# Usage: ./install.sh [--force] [--skip-docker] [--skip-doctor] [--non-interactive]
# =============================================================================

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
FORCE_ENV=false
SKIP_DOCKER=false
SKIP_DOCTOR=false
INTERACTIVE=true
UPDATE_MODE=false
FOUND_DEPS=true

# -----------------------------------------------------------------------------
# Colours
# -----------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET} $1"; }
success() { echo -e "${GREEN}[OK]${RESET}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $1"; }
error()   { echo -e "${RED}[ERR]${RESET}   $1"; }
step()    { echo -e "\n${BOLD}[$1]${RESET} $2"; }

# -----------------------------------------------------------------------------
# Detect OS
# -----------------------------------------------------------------------------
detect_os() {
    OS="$(uname -s)"
    case "$OS" in
        Linux*)     DISTRO=$(lsb_release -si 2>/dev/null || cat /etc/os-release 2>/dev/null | grep '^ID=' | cut -d= -f2 | tr -d '"');;
        Darwin*)    DISTRO="macOS";;
/        CYGWIN*|MINGW*|MSYS*) DISTRO="Windows";;
        *)          DISTRO="$OS";
    esac
    ARCH="$(uname -m)"
    info "Detected: ${DISTRO} (${ARCH})"
}

# -----------------------------------------------------------------------------
# Dependency checker
# -----------------------------------------------------------------------------
check_dep() {
    if command -v "$1" &>/dev/null; then
        success "$1 found"
        return 0
    else
        warn "$1 not found — $2"
        FOUND_DEPS=false
        return 1
    fi
}

check_node_version() {
    NODE_VER=$(node -v 2>/dev/null | tr -d 'v')
    if [ -z "$NODE_VER" ]; then
        return 1
    fi
    NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        return 1
    fi
    return 0
}

# -----------------------------------------------------------------------------
# Check if already installed (symlink exists)
# -----------------------------------------------------------------------------
check_existing_install() {
    if [ -L "$HOME/.npm-global/bin/nyxmind" ] || [ -L "/usr/local/bin/nyxmind" ]; then
        if [ -f "$REPO_DIR/.env" ]; then
            return 0
        fi
    fi
    return 1
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)          FORCE_ENV=true;   shift ;;
        --skip-docker)    SKIP_DOCKER=true; shift ;;
        --skip-doctor)    SKIP_DOCTOR=true; shift ;;
        --non-interactive) INTERACTIVE=false; shift ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "  --force            Overwrite existing .env"
            echo "  --skip-docker      Skip MongoDB Docker setup"
            echo "  --skip-doctor      Skip post-install doctor check"
            echo "  --non-interactive  Fully hands-off (for CI)"
            exit 0 ;;
        *) error "Unknown option: $1"; exit 1 ;;
    esac
done

# -----------------------------------------------------------------------------
# Banner
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║      NyxMindClaw — Installation        ║${RESET}"
echo -e "${BOLD}╚════════════════════════════════════════╝${RESET}"
echo ""

# -----------------------------------------------------------------------------
# 0. OS Detection
# -----------------------------------------------------------------------------
step "0/10" "Detecting system..."
detect_os

# -----------------------------------------------------------------------------
# 1. Existing install check
# -----------------------------------------------------------------------------
step "1/10" "Checking existing installation..."
if check_existing_install; then
    UPDATE_MODE=true
    echo -e "  ${GREEN}✓${RESET} NyxMindClaw already installed"
    info "Running in UPDATE mode — will pull latest and rebuild"
    echo ""
    read -p "Continue with update? [Y/n]: " -r
    if [[ "$REPLY" =~ ^[Nn]$ ]]; then
        info "Aborted."
        exit 0
    fi
else
    echo -e "  ${YELLOW}─${RESET} Fresh install"
fi

# -----------------------------------------------------------------------------
# 2. Dependency checks
# -----------------------------------------------------------------------------
step "2/10" "Checking dependencies..."

if check_node_version; then
    success "Node.js v${NODE_VER} ✓"
else
    error "Node.js 18+ not found. Install from: https://nodejs.org"
    FOUND_DEPS=false
fi

check_dep "git" "required for version updates"

if ! check_dep "docker" "optional — needed for MongoDB"; then
    # Check for local mongod as fallback
    if pgrep -x mongod &>/dev/null; then
        success "MongoDB daemon is running locally"
    fi
fi

check_dep "npm" "required for building"

if [ "$FOUND_DEPS" = false ]; then
    echo ""
    warn "Some dependencies are missing. Install them and run again."
    if [ "$INTERACTIVE" = false ]; then
        exit 1
    fi
    read -p "Continue anyway? [y/N]: " -r
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# -----------------------------------------------------------------------------
# 3. Repository sync
# -----------------------------------------------------------------------------
step "3/10" "Syncing repository..."
cd "$REPO_DIR"
if [ -d ".git" ]; then
    if [ "$UPDATE_MODE" = true ]; then
        info "Pulling latest changes..."
        git pull origin main 2>/dev/null && success "Repository updated" || warn "Could not pull — continuing with local version"
    else
        success "Repository ready"
    fi
else
    warn "Not a git repo — skipping update check"
fi

# -----------------------------------------------------------------------------
# 4. npm install
# -----------------------------------------------------------------------------
step "4/10" "Installing dependencies..."
npm install --silent 2>/dev/null || npm install
success "Dependencies installed"

# -----------------------------------------------------------------------------
# 5. Build
# -----------------------------------------------------------------------------
step "5/10" "Building project..."
npm run build 2>&1 | tail -3
success "Build complete"

# -----------------------------------------------------------------------------
# 6. Directories
# -----------------------------------------------------------------------------
step "6/10" "Creating directories..."
mkdir -p "$REPO_DIR/data"
mkdir -p "$REPO_DIR/tmp"
mkdir -p "$REPO_DIR/.agents/skills"
mkdir -p "$REPO_DIR/.agents/profiles"
mkdir -p "$REPO_DIR/.agents/memory"
success "Directories ready"

# -----------------------------------------------------------------------------
# 7. .env setup
# -----------------------------------------------------------------------------
step "7/10" "Setting up environment..."
if [ "$FORCE_ENV" = true ]; then
    info "Force flag: overwriting .env"
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
elif [ ! -f "$REPO_DIR/.env" ]; then
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    success ".env created from .env.example"
else
    success ".env already exists (--force to overwrite)"
fi

# -----------------------------------------------------------------------------
# 8. MongoDB (optional)
# -----------------------------------------------------------------------------
step "8/10" "MongoDB setup..."
if [ "$SKIP_DOCKER" = true ]; then
    warn "Skipping Docker check (--skip-docker)"
else
    # Check if user wants local-only DB (no MongoDB)
    if [ "$INTERACTIVE" = true ]; then
        echo ""
        read -p "Use local file storage instead of MongoDB? (recommended for dev) [Y/n]: " -r
        if [[ "$REPLY" =~ ^[Nn]$ ]]; then
            SKIP_MONGO=false
        else
            SKIP_MONGO=true
        fi
    else
        SKIP_MONGO=true
    fi

    if [ "$SKIP_MONGO" = true ]; then
        warn "Skipping MongoDB — using local file storage (set DATABASE_URL in .env to enable later)"
        # Set local storage hint in .env if not already set
        if grep -q "^DATABASE_URL=" "$REPO_DIR/.env" 2>/dev/null; then
            :
        else
            echo "DATABASE_URL=local" >> "$REPO_DIR/.env"
        fi
    elif command -v docker &>/dev/null; then
        DB_URL=$(grep DATABASE_URL "$REPO_DIR/.env" 2>/dev/null | cut -d= -f2-)
        MONGO_HOST=$(echo "$DB_URL" | sed -n 's|mongodb://\([^:/]*\).*|\1|p')
        MONGO_PORT=$(echo "$DB_URL" | sed -n 's|mongodb://[^:]*:\([0-9]*\).*|\1|p')
        MONGO_DB=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

        MONGO_HOST=${MONGO_HOST:-localhost}
        MONGO_PORT=${MONGO_PORT:-27017}
        MONGO_DB=${MONGO_DB:-nyxmind}

        if docker ps --format '{{.Names}}' | grep -q "^nyxmind-mongo$"; then
            success "MongoDB container already running"
        elif docker ps -a --format '{{.Names}}' | grep -q "^nyxmind-mongo$"; then
            info "Starting existing nyxmind-mongo container..."
            docker start nyxmind-mongo && success "MongoDB started" || warn "Could not start MongoDB"
        else
            info "Creating MongoDB container..."
            docker run -d \
                --name nyxmind-mongo \
                -p 27017:27017 \
                -v "$REPO_DIR/data/mongo:/data/db" \
                --restart unless-stopped \
                mongo:7 \
                && success "MongoDB container created & started" \
                || warn "Docker run failed"
        fi
    else
        warn "Docker not found and MongoDB not available"
        info "Set DATABASE_URL in .env to point to your MongoDB instance"
    fi
fi

# -----------------------------------------------------------------------------
# 9. Symlink CLI globally
# -----------------------------------------------------------------------------
step "9/10" "Installing CLI..."
if [ -f "$REPO_DIR/packages/cli/dist/index.js" ]; then
    NPM_BIN=$(npm bin -g 2>/dev/null || echo "$HOME/.npm-global/bin")
    mkdir -p "$NPM_BIN"

    # Remove old symlinks first
    rm -f "$NPM_BIN/nyxmind" 2>/dev/null
    rm -f "/usr/local/bin/nyxmind" 2>/dev/null

    ln -sf "$REPO_DIR/packages/cli/dist/index.js" "$NPM_BIN/nyxmind"
    chmod +x "$NPM_BIN/nyxmind"

    # Also try system-wide if available
    if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
        ln -sf "$REPO_DIR/packages/cli/dist/index.js" "/usr/local/bin/nyxmind"
        chmod +x "/usr/local/bin/nyxmind"
    fi

    success "CLI available as 'nyxmind'"
    echo "  Location: $NPM_BIN/nyxmind"
else
    warn "CLI dist not found — run 'npm run build' first"
fi

# Verify nyxmind is now in PATH
if command -v nyxmind &>/dev/null; then
    CLI_VER=$(nyxmind --version 2>/dev/null || echo "unknown")
    success "nyxmind is in PATH (v$CLI_VER)"
else
    warn "nyxmind not in PATH — restart terminal or run: export PATH=\"\$PATH:$NPM_BIN\""
fi

# -----------------------------------------------------------------------------
# 10. Doctor + onboard prompt
# -----------------------------------------------------------------------------
step "10/10" "Verifying installation..."

if [ "$SKIP_DOCTOR" = false ] && command -v nyxmind &>/dev/null; then
    echo ""
    info "Running nyxmind doctor..."
    echo ""
    if nyxmind doctor 2>&1; then
        success "Doctor check passed"
    else
        warn "Doctor found issues — review above"
    fi
else
    [ "$SKIP_DOCTOR" = true ] && warn "Skipping doctor (--skip-doctor)" || info "Run 'nyxmind doctor' manually"
fi

# -----------------------------------------------------------------------------
# Autostart (only on fresh install)
# -----------------------------------------------------------------------------
if [ "$UPDATE_MODE" = false ] && [ -x "$REPO_DIR/setup-autostart.sh" ]; then
    echo ""
    if [ "$INTERACTIVE" = true ]; then
        read -p "Setup autostart service? [y/N]: " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            bash "$REPO_DIR/setup-autostart.sh"
        fi
    fi
fi

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${RESET}"
if [ "$UPDATE_MODE" = true ]; then
    echo -e "${BOLD}║        Update Complete! 🎉             ║${RESET}"
else
    echo -e "${BOLD}║       Installation Complete! 🎉        ║${RESET}"
fi
echo -e "${BOLD}╚════════════════════════════════════════╝${RESET}"
echo ""

if [ "$UPDATE_MODE" = false ]; then
    # Fresh install — auto-run onboard
    echo "Running nyxmind onboard to configure your agent..."
    echo ""
    sleep 1

    if command -v nyxmind &>/dev/null; then
        nyxmind onboard
    else
        error "nyxmind not in PATH. Run these commands:"
        echo ""
        echo "  export PATH=\"\$PATH:$NPM_BIN\""
        echo "  nyxmind onboard"
        echo ""
    fi
else
    echo "Update applied. Run 'nyxmind run' to start."
    echo ""
fi
