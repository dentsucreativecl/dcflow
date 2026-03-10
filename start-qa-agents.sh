#!/bin/bash
# DC Flow — QA Agents Launcher
# Ejecutar desde: /workspaces/dcflow
# Uso: bash start-qa-agents.sh

SESSION="dcflow-qa"

# Matar sesión previa si existe
tmux kill-session -t $SESSION 2>/dev/null

# Crear nueva sesión con panel orquestador
tmux new-session -d -s $SESSION -x 220 -y 50

# --- Panel 0: Orquestador (arriba izquierda) ---
tmux send-keys -t $SESSION:0.0 'clear && echo "🧠 ORQUESTADOR QA" && claude --dangerously-skip-permissions' Enter

# --- Panel 1: QA Datos Reales (arriba derecha) ---
tmux split-window -h -t $SESSION:0
tmux send-keys -t $SESSION:0.1 'clear && echo "📊 QA DATOS REALES" && claude --dangerously-skip-permissions' Enter

# --- Panel 2: QA Rutas/Auth (abajo izquierda) ---
tmux split-window -v -t $SESSION:0.0
tmux send-keys -t $SESSION:0.2 'clear && echo "🔐 QA RUTAS/AUTH" && claude --dangerously-skip-permissions' Enter

# --- Panel 3: QA Features (abajo derecha) ---
tmux split-window -v -t $SESSION:0.1
tmux send-keys -t $SESSION:0.3 'clear && echo "🧩 QA FEATURES" && claude --dangerously-skip-permissions' Enter

# Conectarse a la sesión
tmux attach -t $SESSION
