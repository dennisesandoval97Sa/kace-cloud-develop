#!/bin/bash

while [[ -z "$BASE_URL" ]]; do
    read -p "Enter API Base URL: " BASE_URL
    if [[ -z "$BASE_URL" ]]; then
        echo "❌ API Base URL is required. Please enter a valid URL."
    fi
done

while [[ -z "$AUTH_HEADER" ]]; do
    read -sp "Enter your Authorization token: " AUTH_HEADER
    echo ""
    if [[ -z "$AUTH_HEADER" ]]; then
        echo "❌ Authorization token is required. Please enter a valid token."
    fi
done

ENDPOINTS_FILE="endpoints.txt"
OUTPUT_FILE="api_results.log"

TOTAL_ENDPOINTS=$(wc -l < "$ENDPOINTS_FILE")
CURRENT=0

echo "Checking API endpoints... Please wait."
echo "API Validation - $(date)" > "$OUTPUT_FILE"
echo "Base URL: $BASE_URL" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [[ ! -f "$ENDPOINTS_FILE" ]]; then
    echo "❌ The file $ENDPOINTS_FILE does not exist. Create the file with the endpoints." | tee -a "$OUTPUT_FILE"
    exit 1
fi

show_progress() {
    local percentage=$(( (CURRENT * 100) / TOTAL_ENDPOINTS ))
    local filled=$(( (percentage * 40) / 100 )) 
    local empty=$(( 40 - filled ))

    printf "\rProgress: [%s%s] %d%%" "$(printf '#%.0s' $(seq 1 $filled))" "$(printf ' %.0s' $(seq 1 $empty))" "$percentage"
}

while IFS= read -r endpoint || [[ -n "$endpoint" ]]; do
    URL="$BASE_URL$(echo "$endpoint" | awk '{print $1}')"
    BODY=$(echo "$endpoint" | awk '{for(i=2;i<=NF;++i) printf "%s ", $i}')

    if [[ -n "$BODY" ]]; then
        RESPONSE=$(curl -o /dev/null -s -w "%{http_code}" -H "Authorization: $AUTH_HEADER" -H "Content-Type: application/json" -d "$BODY" "$URL")
    else
        RESPONSE=$(curl -o /dev/null -s -w "%{http_code}" -H "Authorization: $AUTH_HEADER" "$URL")
    fi

    if [ "$RESPONSE" -eq 200 ]; then
        echo "✅ [200] GET $URL" >> "$OUTPUT_FILE"
    else
        echo "❌ [ERROR] GET $URL - HTTP $RESPONSE" >> "$OUTPUT_FILE"
    fi

    ((CURRENT++))
    show_progress

done < "$ENDPOINTS_FILE"

echo -e "\nValidation completed. Results saved in $OUTPUT_FILE."
