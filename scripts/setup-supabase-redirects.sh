#!/bin/bash

# Script para configurar las Redirect URLs en Supabase
# Esto requiere acceso al dashboard de Supabase

echo "Configuración de Redirect URLs en Supabase"
echo "=========================================="
echo ""
echo "Debes agregar estas URLs a tu configuración de Supabase:"
echo ""
echo "1. Ve a: https://app.supabase.com/project/[TU_PROJECT_ID]/auth/providers"
echo "2. En la sección 'Email' → 'Redirect URLs', agrega:"
echo ""
echo "   https://fudocenter.quantixarg.cloud"
echo "   https://fudocenter.quantixarg.cloud/auth/callback"
echo "   http://localhost:5173"
echo "   http://localhost:3000"
echo ""
echo "3. Haz clic en 'Save'"
echo ""
echo "O si tienes acceso a la CLI de Supabase, ejecuta:"
echo ""
echo "  supabase link --project-ref [TU_PROJECT_REF]"
echo "  supabase functions deploy auth-redirect"
echo ""
echo "Después, agrega esta URL de Edge Function a las Redirect URLs:"
echo "  https://[TU_PROJECT_REF].supabase.co/functions/v1/auth-redirect"
echo ""
