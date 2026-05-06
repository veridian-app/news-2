#!/bin/bash
API_KEY="AIzaSyAq65-YvZJxV9-fH7dAn2sn3MPoElPRNyk"
MODEL="gemini-1.5-flash"

echo "🛰️ Iniciando test de conexión directa con Google Gemini..."
echo "📡 Enviando señal a: https://generativelanguage.googleapis.com/v1beta/models/$MODEL"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent?key=$API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "contents": [{
            "parts":[{
                "text": "Responde con la palabra OK si recibes esto."
            }]
        }]
    }')

HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "------------------------------------------"
echo "📥 Código de Respuesta HTTP: $HTTP_STATUS"
echo "📄 Cuerpo de la Respuesta:"
echo "$BODY"
echo "------------------------------------------"

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ ÉXITO: La clave de API es válida y el modelo está disponible."
else
    echo "❌ ERROR: El satélite ha rechazado la señal. Verifica la clave en AI Studio."
fi
