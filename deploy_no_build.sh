#!/bin/bash
# Deploy script for SuggestMe Decky Plugin
# Usage: ./deploy.sh [DECK_IP]

PLUGIN_NAME="suggestme-decky-plugin"
DECK_USER="deck"
DECK_IP="${1:-${DECK_IP:-192.168.1.100}}"
PLUGIN_PATH="/home/deck/homebrew/plugins/${PLUGIN_NAME}"
TMP_PATH="/home/deck/tmp/${PLUGIN_NAME}"

echo "=== SuggestMe Deployment Script ==="
echo "Target: ${DECK_USER}@${DECK_IP}"
echo ""

# Prepare temp dir on Deck
echo "Preparing temporary directory on Deck..."
ssh ${DECK_USER}@${DECK_IP} "mkdir -p ${TMP_PATH}"

if [ $? -ne 0 ]; then
    echo "Failed to create temp directory. Check SSH connection."
    exit 1
fi

# Sync to temp dir
echo "Copying files to temporary directory..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'out' \
    --exclude '.vscode' \
    --exclude '*.log' \
    ./ ${DECK_USER}@${DECK_IP}:${TMP_PATH}/

if [ $? -ne 0 ]; then
    echo "File transfer failed!"
    exit 1
fi

# Install with sudo
echo "Installing plugin (requires sudo permissions)..."
echo "You may be asked for the 'deck' user password."
ssh -t ${DECK_USER}@${DECK_IP} "sudo mkdir -p ${PLUGIN_PATH} && sudo rsync -av --delete ${TMP_PATH}/ ${PLUGIN_PATH}/ && sudo chmod -R 755 ${PLUGIN_PATH} && sudo chown -R root:root ${PLUGIN_PATH} && rm -rf ${TMP_PATH}"

if [ $? -ne 0 ]; then
    echo "Installation failed!"
    exit 1
fi

# Restart
echo ""
read -p "Restart Decky Loader? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Restarting Decky Loader..."
    ssh -t ${DECK_USER}@${DECK_IP} "sudo systemctl restart plugin_loader"
fi

echo ""
echo "Deployment complete!"
