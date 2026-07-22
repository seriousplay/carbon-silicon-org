#!/bin/bash
# Supabase → Local PostgreSQL Migration Script
# Usage: ./scripts/migrate-from-supabase.sh

set -euo pipefail

echo "=== Supabase → Local PostgreSQL Migration ==="
echo "This script exports data from Supabase and imports to local PostgreSQL."
echo ""

# Configuration
SUPABASE_A_URL="${SUPABASE_A_URL:-https://uxaxvzqskqsujmlmxvhj.supabase.co}"
SUPABASE_B_URL="${SUPABASE_B_URL:-https://zfuojnosurshknvcnkgi.supabase.co}"
LOCAL_PG="${LOCAL_PG:-postgresql://csi_admin:password@localhost:5432}"

# Check dependencies
for cmd in pg_dump psql; do
  if ! command -v $cmd &> /dev/null; then
    echo "Error: $cmd is required but not installed"
    exit 1
  fi
done

# Step 1: Export from Supabase Project A (Book app tables)
echo "Step 1: Exporting from Supabase Project A..."
echo "  Run this manually in Supabase SQL Editor:"
echo "  pg_dump --no-owner --no-acl --data-only --table=events --table=organizations ... > supabase_a_data.sql"
echo ""

# Step 2: Export from Supabase Project B (Loop Designer tables)
echo "Step 2: Exporting from Supabase Project B..."
echo "  Export only loop_designer_* tables (skip matrix_origin_*, carbon_silicon_*, loop_os_*)"
echo ""

# Step 3: Import to local PostgreSQL
echo "Step 3: Import to local PostgreSQL"
echo "  psql ${LOCAL_PG}/csi_book < supabase_a_ddl.sql"
echo "  psql ${LOCAL_PG}/csi_book < supabase_a_data.sql"
echo "  psql ${LOCAL_PG}/csi_loop < supabase_b_loop_ddl.sql"
echo "  psql ${LOCAL_PG}/csi_loop < supabase_b_loop_data.sql"
echo ""

# Step 4: Verify row counts
echo "Step 4: Verify row counts"
echo "  Compare Supabase dashboard row counts with local PG"
echo ""

echo "Migration guide complete. Execute steps manually to ensure data integrity."
