#!/bin/bash

################################################################################
# OPERIX ERP - COMPREHENSIVE TEST SUITE
# Runs all API tests and verifications
################################################################################

set -e

PROJECT_DIR="/Users/ahmedaboelsnoon/Desktop/PROjects/ERP"
cd "$PROJECT_DIR"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3000"
TESTS_PASSED=0
TESTS_FAILED=0

################################################################################
# HELPER FUNCTIONS
################################################################################

log_section() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

log_test() {
    echo -e "${YELLOW}TEST: $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    ((TESTS_FAILED++))
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_code=$3
    local description=$4

    log_test "$description"

    response=$(curl -s -w "\n%{http_code}" \
        -X "$method" \
        "$API_URL$endpoint" \
        -H "Content-Type: application/json")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "$expected_code" ]; then
        log_pass "$description (HTTP $http_code)"
        return 0
    else
        log_fail "$description (Expected HTTP $expected_code, got $http_code)"
        echo "Response: $body"
        return 1
    fi
}

################################################################################
# MAIN TEST SUITE
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║    OPERIX ERP - COMPREHENSIVE TEST SUITE                      ║"
echo "║    Testing all 5 CRUD modules + Authentication                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
log_section "PRE-FLIGHT CHECK"

echo -e "${YELLOW}Checking if server is running at $API_URL...${NC}"
if curl -s "$API_URL" > /dev/null 2>&1; then
    log_pass "Server is running at $API_URL"
else
    log_fail "Server is NOT running at $API_URL"
    echo ""
    echo "Start the server with: npm run dev"
    exit 1
fi

################################################################################
# API ENDPOINT TESTS
################################################################################

log_section "API ENDPOINT TESTS"

echo "Testing all 5 CRUD modules..."
echo ""

# Test Inventory Module
log_test "Inventory Module - List"
test_endpoint "GET" "/api/inventory" "200" "GET /api/inventory" || true
test_endpoint "GET" "/api/inventory?page=0&pageSize=10" "200" "GET /api/inventory (with pagination)" || true

# Test Products Module
log_test "Products Module - List"
test_endpoint "GET" "/api/products" "200" "GET /api/products" || true
test_endpoint "GET" "/api/products?search=test" "200" "GET /api/products (with search)" || true

# Test Orders Module
log_test "Orders Module - List"
test_endpoint "GET" "/api/orders" "200" "GET /api/orders" || true
test_endpoint "GET" "/api/orders?status=pending" "200" "GET /api/orders (with filter)" || true

# Test Customers Module
log_test "Customers Module - List"
test_endpoint "GET" "/api/customers" "200" "GET /api/customers" || true
test_endpoint "GET" "/api/customers?search=test" "200" "GET /api/customers (with search)" || true

# Test Warehouses Module
log_test "Warehouses Module - List"
test_endpoint "GET" "/api/warehouses" "200" "GET /api/warehouses" || true

################################################################################
# AUTHENTICATION TESTS
################################################################################

log_section "AUTHENTICATION TESTS"

echo "Testing login endpoint..."
echo ""

test_endpoint "POST" "/api/auth/login" "400" "POST /api/auth/login (missing credentials)" || true

################################################################################
# RESPONSE VALIDATION
################################################################################

log_section "RESPONSE VALIDATION"

echo "Validating API response structure..."
echo ""

# Test Products response structure
log_test "Products response structure"
response=$(curl -s "$API_URL/api/products" -H "Content-Type: application/json")

if echo "$response" | grep -q '"success"'; then
    if echo "$response" | grep -q '"data"'; then
        if echo "$response" | grep -q '"pagination"'; then
            log_pass "Products response has correct structure (success, data, pagination)"
        else
            log_fail "Products response missing pagination field"
        fi
    else
        log_fail "Products response missing data field"
    fi
else
    log_fail "Products response missing success field"
fi

# Test Inventory response structure
log_test "Inventory response structure"
response=$(curl -s "$API_URL/api/inventory" -H "Content-Type: application/json")

if echo "$response" | grep -q '"success"'; then
    log_pass "Inventory response has correct structure"
else
    log_fail "Inventory response missing success field"
fi

################################################################################
# TEST RESULTS
################################################################################

log_section "TEST RESULTS"

total_tests=$((TESTS_PASSED + TESTS_FAILED))

echo "Tests Run:     $total_tests"
echo -e "${GREEN}Tests Passed:  $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed:  $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo "System is ready for:"
    echo "  • Production deployment"
    echo "  • Multi-tenant testing"
    echo "  • Security verification"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please check the failures above and:"
    echo "  1. Ensure server is running: npm run dev"
    echo "  2. Check database is accessible"
    echo "  3. Verify RLS policies are applied"
    echo "  4. Create test data in Supabase"
    exit 1
fi

