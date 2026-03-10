#!/bin/bash
# start-fase0-agents.sh
# Lanza 3 agentes Claude Code en paralelo para Fase 0

echo "🚀 Iniciando agentes Fase 0 en paralelo..."
echo ""
echo "Agente 1: Limpieza DB (SQL en Supabase - manual)"
echo "Agente 2: Limpieza código mock"  
echo "Agente 3: Creación canales"
echo ""
echo "IMPORTANTE: El Agente 1 (DB) requiere que ejecutes los SQLs manualmente"
echo "en el SQL Editor de Supabase. Los otros 2 son automáticos."
echo ""

mkdir -p /tmp/qa-reports

# Lanzar agente de limpieza de código mock (automático)
claude --dangerously-skip-permissions \
  "Lee el archivo qa-agents/CLAUDE-fase0-codigo.md y ejecuta todas las instrucciones paso a paso. Reporta en /tmp/qa-reports/fase0-codigo.md" &

AGENT_CODIGO=$!

# Lanzar agente de canales (automático)  
claude --dangerously-skip-permissions \
  "Lee el archivo qa-agents/CLAUDE-fase0-canales.md y ejecuta todas las instrucciones paso a paso. Para los pasos que requieren ejecutar SQL en Supabase, genera los scripts SQL y guárdalos en /tmp/qa-reports/fase0-canales-sql.sql para ejecución manual. Reporta en /tmp/qa-reports/fase0-canales.md" &

AGENT_CANALES=$!

echo "✅ Agente Limpieza Código: PID $AGENT_CODIGO"
echo "✅ Agente Canales: PID $AGENT_CANALES"
echo ""
echo "Mientras corren los agentes, ejecuta manualmente en Supabase SQL Editor"
echo "los scripts de limpieza de DB del archivo:"
echo "qa-agents/CLAUDE-fase0-db.md"
echo ""
echo "Esperando que terminen los agentes automáticos..."

wait $AGENT_CODIGO
echo "✅ Agente Código terminó"

wait $AGENT_CANALES  
echo "✅ Agente Canales terminó"

echo ""
echo "🎯 Fase 0 completada. Reportes en /tmp/qa-reports/"
ls /tmp/qa-reports/
