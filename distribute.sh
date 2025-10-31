#!/usr/bin/env bash
DB_HOST="localhost"
DB_USER="root"
DB_PASS="your_mysql_password"
DB_NAME="smart_vend"

PRODUCT_ID=2      # product to restock
TOTAL_QTY=120     # total units to distribute across machines

# fetch machine ids into an array
mapfile -t machines < <(mysql -N -u${DB_USER} -p${DB_PASS} -h ${DB_HOST} ${DB_NAME} -e "SELECT machine_id FROM machines WHERE 1 ORDER BY machine_id;")

count=${#machines[@]}
if [ "$count" -eq 0 ]; then
  echo "No machines found. Exiting."
  exit 1
fi

base=$((TOTAL_QTY / count))
rem=$((TOTAL_QTY % count))

echo "Distributing $TOTAL_QTY units of product $PRODUCT_ID to $count machines: $base each, $rem remainder."

for i in "${!machines[@]}"; do
  m="${machines[$i]}"
  add=$base
  if [ "$i" -lt "$rem" ]; then
    add=$((add + 1))
  fi

  echo "Machine $m <- $add units"
  mysql -u${DB_USER} -p${DB_PASS} -h ${DB_HOST} ${DB_NAME} -e "
    INSERT INTO inventory (machine_id, product_id, qty, last_restock)
    VALUES (${m}, ${PRODUCT_ID}, ${add}, NOW())
    ON DUPLICATE KEY UPDATE qty = COALESCE(qty,0) + VALUES(qty), last_restock = VALUES(last_restock);
  "
done

echo "Done."
