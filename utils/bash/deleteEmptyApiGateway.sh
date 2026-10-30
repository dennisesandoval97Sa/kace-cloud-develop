#!/usr/bin/env bash
###############################################################################
# delete_apigw_without_resources.sh
# - Elimina APIs de API Gateway sin recursos (REST) o sin rutas (HTTP).
# - Requisitos: AWS CLI v2 y jq.
###############################################################################
#set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"  # Ajusta si lo necesitas
DRY_RUN=true                       # ← cámbialo a false para ejecutar el borrado

echo "⏩ Región objetivo: $REGION"
echo "⏩ Dry-run: $DRY_RUN"
echo

###############################################################################
# 1. REST APIs (v1)
###############################################################################
echo "🔍 Buscando REST APIs sin recursos…"

aws apigateway get-rest-apis --region "$REGION" \
  --query 'items[].{id:id,name:name}' --output json |
jq -r '.[] | [.id, .name] | @tsv' |
while IFS=$'\t' read -r API_ID API_NAME; do
  NON_ROOT_COUNT=$(aws apigateway get-resources \
                     --rest-api-id "$API_ID" --region "$REGION" \
                     --query 'length(items[?path!=`/`])' --output text)

  if [[ "$NON_ROOT_COUNT" == "0" ]]; then
    echo "🛑  REST API sin recursos: \"$API_NAME\" ($API_ID)"
    if [[ "$DRY_RUN" == "false" ]]; then
      sleep 15  # Pausa para evitar problemas de rate limiting
      aws apigateway delete-rest-api --rest-api-id "$API_ID" --region "$REGION"
      echo "    ✔️  Eliminada."

    fi
  fi
done

###############################################################################
# 2. HTTP APIs (v2)
###############################################################################
echo
echo "🔍 Buscando HTTP APIs sin rutas…"

aws apigatewayv2 get-apis --region "$REGION" \
  --query 'Items[?ProtocolType==`HTTP`].[ApiId,Name]' --output text |
while read -r API_ID API_NAME; do
  ROUTE_COUNT=$(aws apigatewayv2 get-routes \
                 --api-id "$API_ID" --region "$REGION" \
                 --query 'length(Items)' --output text)
  if [[ "$ROUTE_COUNT" == "0" ]]; then
    echo "🛑  HTTP API sin rutas: \"$API_NAME\" ($API_ID)"
    if [[ "$DRY_RUN" == "false" ]]; then
      sleep 15  # Pausa para evitar problemas de rate limiting
      aws apigatewayv2 delete-api --api-id "$API_ID" --region "$REGION"
      echo "    ✔️  Eliminada."
    fi
  fi
done

echo
echo "🏁  Proceso terminado."
[[ "$DRY_RUN" == "true" ]] && echo "❗ Nada se ha eliminado. Desactiva DRY_RUN para ejecutar el borrado."
