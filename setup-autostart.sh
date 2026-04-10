#!/bin/bash
set -e

SERVICE_FILE="/root/nyxmind-corp/Nyx-Mind-Claw/nyxmind.service"
SERVICE_NAME="nyxmind.service"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"

echo "Setting up NyxMind auto-start service..."

# Create systemd user directory if it doesn't exist
mkdir -p "$SYSTEMD_USER_DIR"

# Create symlink to service file
if [ -L "$SYSTEMD_USER_DIR/$SERVICE_NAME" ]; then
    echo "Symlink already exists: $SYSTEMD_USER_DIR/$SERVICE_NAME"
elif [ -f "$SYSTEMD_USER_DIR/$SERVICE_NAME" ]; then
    echo "Service file already exists in systemd user directory"
else
    ln -sf "$SERVICE_FILE" "$SYSTEMD_USER_DIR/$SERVICE_NAME"
    echo "Created symlink: $SYSTEMD_USER_DIR/$SERVICE_NAME -> $SERVICE_FILE"
fi

# Reload systemd daemon
echo "Reloading systemd daemon..."
systemctl --user daemon-reload

# Enable the service
echo "Enabling nyxmind service..."
systemctl --user enable "$SERVICE_NAME"

# Start the service
echo "Starting nyxmind service..."
systemctl --user start "$SERVICE_NAME"

# Test and show status
echo ""
echo "Service status:"
systemctl --user status "$SERVICE_NAME" --no-pager

echo ""
echo "Auto-start setup complete!"
