#!/bin/bash

# Batch PDF Comparison Script
# This script recursively finds all folders containing exactly 2 PDFs
# and compares them using Adobe Acrobat

set -e  # Exit on error (but we'll handle errors manually)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
  local color=$1
  shift
  echo -e "${color}$@${NC}"
}

# Function to print section header
print_header() {
  echo ""
  print_color "$BLUE" "========================================"
  print_color "$BLUE" "$1"
  print_color "$BLUE" "========================================"
  echo ""
}

# Function to validate directory exists
validate_directory() {
  local dir=$1
  local dir_name=$2

  if [ ! -d "$dir" ]; then
    print_color "$RED" "Error: $dir_name does not exist: $dir"
    exit 1
  fi
}

# Function to create directory if it doesn't exist
ensure_directory() {
  local dir=$1
  local dir_name=$2

  if [ ! -d "$dir" ]; then
    print_color "$YELLOW" "$dir_name does not exist. Creating: $dir"
    mkdir -p "$dir"
    if [ $? -eq 0 ]; then
      print_color "$GREEN" "✓ Created $dir_name"
    else
      print_color "$RED" "✗ Failed to create $dir_name"
      exit 1
    fi
  else
    print_color "$GREEN" "✓ $dir_name exists: $dir"
  fi
}

# Script start
print_header "Batch PDF Comparison Tool"

# Ask user for comparison mode
print_color "$BLUE" "Select comparison mode..."
COMPARISON_MODE=$(osascript -e '
tell application "System Events"
  activate
  set modeChoice to button returned of (display dialog "Choose comparison mode:" buttons {"Text Only", "Complete"} default button "Complete")
  return modeChoice
end tell
' 2>/dev/null)

# Check if user cancelled
if [ -z "$COMPARISON_MODE" ]; then
  print_color "$RED" "✗ No mode selected. Exiting."
  exit 1
fi

print_color "$GREEN" "✓ Comparison mode: $COMPARISON_MODE"

# Get PDF root folder from user using native folder picker
print_color "$BLUE" "Please select the PDF root folder (containing all PDF files)..."
PDF_ROOT_FOLDER=$(osascript -e '
tell application "System Events"
  activate
  set selectedFolder to choose folder with prompt "Select the PDF root folder containing all PDF files:"
  return POSIX path of selectedFolder
end tell
' 2>/dev/null)

# Check if user cancelled
if [ -z "$PDF_ROOT_FOLDER" ]; then
  print_color "$RED" "✗ No folder selected. Exiting."
  exit 1
fi

# Remove trailing slash if present
PDF_ROOT_FOLDER="${PDF_ROOT_FOLDER%/}"

print_color "$GREEN" "✓ PDF root folder: $PDF_ROOT_FOLDER"
validate_directory "$PDF_ROOT_FOLDER" "PDF root folder"

# Get Excel folder from user using native folder picker
print_color "$BLUE" "Please select the Excel folder (containing .xlsx files with mappings)..."
EXCEL_FOLDER=$(osascript -e '
tell application "System Events"
  activate
  set selectedFolder to choose folder with prompt "Select the Excel folder containing .xlsx files:"
  return POSIX path of selectedFolder
end tell
' 2>/dev/null)

# Check if user cancelled
if [ -z "$EXCEL_FOLDER" ]; then
  print_color "$RED" "✗ No folder selected. Exiting."
  exit 1
fi

# Remove trailing slash if present
EXCEL_FOLDER="${EXCEL_FOLDER%/}"

print_color "$GREEN" "✓ Excel folder: $EXCEL_FOLDER"
validate_directory "$EXCEL_FOLDER" "Excel folder"

# Get output folder from user using native folder picker
print_color "$BLUE" "Please select the output folder for comparison PDFs..."
OUTPUT_FOLDER=$(osascript -e '
tell application "System Events"
  activate
  set selectedFolder to choose folder with prompt "Select the output folder where comparison PDFs will be saved:"
  return POSIX path of selectedFolder
end tell
' 2>/dev/null)

# Check if user cancelled
if [ -z "$OUTPUT_FOLDER" ]; then
  print_color "$RED" "✗ No folder selected. Exiting."
  exit 1
fi

# Remove trailing slash if present
OUTPUT_FOLDER="${OUTPUT_FOLDER%/}"

print_color "$GREEN" "✓ Output folder: $OUTPUT_FOLDER"
ensure_directory "$OUTPUT_FOLDER" "Output folder"

# Get log folder from user using native folder picker
print_color "$BLUE" "Please select the log folder..."
LOG_FOLDER=$(osascript -e '
tell application "System Events"
  activate
  set selectedFolder to choose folder with prompt "Select the folder where logs will be saved:"
  return POSIX path of selectedFolder
end tell
' 2>/dev/null)

# Check if user cancelled
if [ -z "$LOG_FOLDER" ]; then
  print_color "$RED" "✗ No folder selected. Exiting."
  exit 1
fi

# Remove trailing slash if present
LOG_FOLDER="${LOG_FOLDER%/}"

print_color "$GREEN" "✓ Log folder: $LOG_FOLDER"

ensure_directory "$LOG_FOLDER" "Log folder"

# Create log file with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_FOLDER/batch_comparison_$TIMESTAMP.log"
SUMMARY_FILE="$LOG_FOLDER/summary_$TIMESTAMP.txt"

# Function to log message to both console and file
log_message() {
  local message="$1"
  echo "$message" | tee -a "$LOG_FILE"
}

log_message ""
log_message "========================================"
log_message "Excel-Based PDF Comparison Started"
log_message "========================================"
log_message "Timestamp: $(date)"
log_message "PDF Root Folder: $PDF_ROOT_FOLDER"
log_message "Excel Folder: $EXCEL_FOLDER"
log_message "Output Folder: $OUTPUT_FOLDER"
log_message "Log Folder: $LOG_FOLDER"
log_message "Comparison Mode: $COMPARISON_MODE"
log_message "Log File: $LOG_FILE"
log_message ""

# Get the script directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
COMPARE_SCRIPT="$SCRIPT_DIR/compareFromExcel.js"

log_message "Backend Directory: $BACKEND_DIR"
log_message "Excel Compare Script: $COMPARE_SCRIPT"
log_message ""

# Verify the Node.js script exists
if [ ! -f "$COMPARE_SCRIPT" ]; then
  print_color "$RED" "Error: compareFromExcel.js not found at: $COMPARE_SCRIPT"
  exit 1
fi

# Initialize counters
total_excel_files=0
successful_excel=0
failed_excel=0

# Arrays to store results
declare -a success_list
declare -a failed_list

print_header "Scanning for Excel files..."
log_message "Scanning Excel folder for .xlsx files..."
log_message ""

# Find all .xlsx files in Excel folder
while IFS= read -r -d '' excel_file; do
  ((total_excel_files++))

  excel_filename=$(basename "$excel_file")
  print_color "$GREEN" "[$total_excel_files] Found Excel: $excel_filename"
  log_message "[$total_excel_files] Processing Excel file: $excel_filename"
  log_message "  Full path: $excel_file"
  log_message "  Starting comparison processing..."
  log_message ""

  # Run the comparison (redirect all output to log)
  cd "$BACKEND_DIR"

  if node "$COMPARE_SCRIPT" "$excel_file" "$PDF_ROOT_FOLDER" "$OUTPUT_FOLDER" "$COMPARISON_MODE" >> "$LOG_FILE" 2>&1; then
    ((successful_excel++))
    success_list+=("$excel_filename")
    print_color "$GREEN" "  ✓ Success: $excel_filename processed"
    log_message "  ✓ Excel file processed successfully"
  else
    ((failed_excel++))
    failed_list+=("$excel_filename")
    print_color "$RED" "  ✗ Failed: $excel_filename - See log for details"
    log_message "  ✗ Excel file processing failed"
  fi

  log_message ""

done < <(find "$EXCEL_FOLDER" -maxdepth 1 -type f -iname "*.xlsx" -print0)

# Generate summary
print_header "Batch Processing Complete"

{
  echo "========================================"
  echo "Excel-Based PDF Comparison Summary"
  echo "========================================"
  echo "Completed: $(date)"
  echo ""
  echo "Statistics:"
  echo "  Total Excel files processed: $total_excel_files"
  echo "  Successfully processed: $successful_excel"
  echo "  Failed to process: $failed_excel"
  echo ""

  if [ ${#success_list[@]} -gt 0 ]; then
    echo "Successfully Processed Excel Files ($successful_excel):"
    for item in "${success_list[@]}"; do
      echo "  ✓ $item"
    done
    echo ""
  fi

  if [ ${#failed_list[@]} -gt 0 ]; then
    echo "Failed Excel Files ($failed_excel):"
    for item in "${failed_list[@]}"; do
      echo "  ✗ $item"
    done
    echo ""
  fi

  echo "PDF Root folder: $PDF_ROOT_FOLDER"
  echo "Excel folder: $EXCEL_FOLDER"
  echo "Output folder: $OUTPUT_FOLDER"
  echo "Log file: $LOG_FILE"
  echo "========================================"
} | tee "$SUMMARY_FILE" | tee -a "$LOG_FILE"

# Print colored summary to console
print_color "$GREEN" "✓ Successful: $successful_excel"
if [ $failed_excel -gt 0 ]; then
  print_color "$RED" "✗ Failed: $failed_excel"
fi

echo ""
print_color "$BLUE" "Summary saved to: $SUMMARY_FILE"
print_color "$BLUE" "Full log saved to: $LOG_FILE"

# Exit with appropriate code
if [ $failed_excel -gt 0 ]; then
  exit 1
else
  exit 0
fi
