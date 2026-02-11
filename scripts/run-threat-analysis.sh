#!/bin/bash

################################################################################
# Threat Analysis Script
# 
# Runs automated threat analysis on infrastructure changes
# Supports both local Docker and remote API endpoints
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${THREAT_MODEL_API_URL:-http://localhost:5000}"
MAX_RETRIES=3
RETRY_DELAY=5
TIMEOUT=300

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check API health
check_api_health() {
    local url="$1"
    local max_attempts=30
    local attempt=0
    
    log_info "Checking API health at $url..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s -o /dev/null -w "%{http_code}" "$url/health" | grep -q "200"; then
            log_success "API is healthy!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_info "Waiting for API... (attempt $attempt/$max_attempts)"
        sleep 2
    done
    
    log_error "API health check failed after $max_attempts attempts"
    return 1
}

# Function to collect Terraform files
collect_terraform_files() {
    log_info "Collecting Terraform files..."
    
    # Create temporary directory for Terraform files
    TEMP_DIR=$(mktemp -d)
    TF_FILES_DIR="$TEMP_DIR/terraform"
    mkdir -p "$TF_FILES_DIR"
    
    # Find all Terraform files
    if [ -f "relevant-changes.txt" ]; then
        # Only analyze changed files
        log_info "Analyzing changed files only..."
        while IFS= read -r file; do
            if [[ "$file" == *.tf ]] || [[ "$file" == *.tfvars ]]; then
                if [ -f "$file" ]; then
                    log_info "  - $file"
                    cp "$file" "$TF_FILES_DIR/"
                fi
            fi
        done < relevant-changes.txt
    else
        # Analyze all Terraform files
        log_info "Analyzing all Terraform files..."
        find . -type f \( -name "*.tf" -o -name "*.tfvars" \) \
            -not -path "*/\.*" \
            -not -path "*/node_modules/*" \
            -not -path "*/venv/*" \
            -exec cp {} "$TF_FILES_DIR/" \;
    fi
    
    TF_FILE_COUNT=$(find "$TF_FILES_DIR" -type f | wc -l)
    log_info "Collected $TF_FILE_COUNT Terraform files"
    
    if [ "$TF_FILE_COUNT" -eq 0 ]; then
        log_warning "No Terraform files found to analyze"
        echo "$TEMP_DIR"
        return 0
    fi
    
    echo "$TEMP_DIR"
}

# Function to upload Terraform files
upload_terraform_files() {
    local api_url="$1"
    local files_dir="$2"
    
    log_info "Uploading Terraform files to API..."
    
    # Create tar archive of Terraform files
    TAR_FILE="$files_dir/terraform.tar.gz"
    tar -czf "$TAR_FILE" -C "$files_dir/terraform" .
    
    # Upload to API
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/gzip" \
        --data-binary "@$TAR_FILE" \
        "$api_url/api/analysis/upload" 2>&1)
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        log_success "Files uploaded successfully"
        echo "$body" | jq -r '.analysis_id // .id // "unknown"'
        return 0
    else
        log_error "Upload failed with HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Function to run threat analysis
run_analysis() {
    local api_url="$1"
    local analysis_id="$2"
    
    log_info "Running threat analysis (ID: $analysis_id)..."
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        "$api_url/api/analysis/analyze/$analysis_id" 2>&1)
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        log_success "Analysis completed successfully"
        echo "$body"
        return 0
    else
        log_error "Analysis failed with HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Function to get analysis results
get_results() {
    local api_url="$1"
    local analysis_id="$2"
    
    log_info "Fetching analysis results..."
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" -X GET \
        -H "Content-Type: application/json" \
        "$api_url/api/analysis/results/$analysis_id" 2>&1)
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        log_success "Results retrieved successfully"
        echo "$body"
        return 0
    else
        log_error "Failed to retrieve results with HTTP $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Function to save report
save_report() {
    local results="$1"
    local output_file="${2:-threat-report.json}"
    
    log_info "Saving threat report to $output_file..."
    
    echo "$results" | jq '.' > "$output_file"
    
    if [ -f "$output_file" ]; then
        log_success "Report saved successfully"
        
        # Print summary
        local total=$(echo "$results" | jq '.total_matched // 0')
        local critical=$(echo "$results" | jq '.statistics.by_severity.critical // 0')
        local high=$(echo "$results" | jq '.statistics.by_severity.high // 0')
        local medium=$(echo "$results" | jq '.statistics.by_severity.medium // 0')
        local low=$(echo "$results" | jq '.statistics.by_severity.low // 0')
        
        echo ""
        log_info "Threat Analysis Summary:"
        echo "  Total Threats: $total"
        echo "  Critical: $critical"
        echo "  High: $high"
        echo "  Medium: $medium"
        echo "  Low: $low"
        echo ""
        
        return 0
    else
        log_error "Failed to save report"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting Threat Analysis..."
    log_info "API URL: $API_URL"
    
    # Check if API is available
    if ! check_api_health "$API_URL"; then
        log_error "API is not available. Exiting."
        exit 1
    fi
    
    # Collect Terraform files
    TEMP_DIR=$(collect_terraform_files)
    
    # Check if there are files to analyze
    TF_COUNT=$(find "$TEMP_DIR/terraform" -type f 2>/dev/null | wc -l)
    if [ "$TF_COUNT" -eq 0 ]; then
        log_warning "No Terraform files to analyze. Creating empty report."
        echo '{"total_matched": 0, "matched_threats": [], "statistics": {"by_severity": {}}}' > threat-report.json
        rm -rf "$TEMP_DIR"
        exit 0
    fi
    
    # Upload files with retry logic
    ANALYSIS_ID=""
    for attempt in $(seq 1 $MAX_RETRIES); do
        log_info "Upload attempt $attempt/$MAX_RETRIES..."
        
        if ANALYSIS_ID=$(upload_terraform_files "$API_URL" "$TEMP_DIR"); then
            break
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_warning "Upload failed. Retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        else
            log_error "Upload failed after $MAX_RETRIES attempts"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    done
    
    log_info "Analysis ID: $ANALYSIS_ID"
    
    # Run analysis
    if ! ANALYSIS_RESULT=$(run_analysis "$API_URL" "$ANALYSIS_ID"); then
        log_error "Analysis failed"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    # Get results with retry logic
    RESULTS=""
    for attempt in $(seq 1 $MAX_RETRIES); do
        log_info "Fetching results attempt $attempt/$MAX_RETRIES..."
        
        if RESULTS=$(get_results "$API_URL" "$ANALYSIS_ID"); then
            break
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_warning "Failed to get results. Retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        else
            log_error "Failed to get results after $MAX_RETRIES attempts"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    done
    
    # Save report
    if ! save_report "$RESULTS" "threat-report.json"; then
        log_error "Failed to save report"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log_success "Threat analysis completed successfully!"
    exit 0
}

# Run main function
main "$@"
