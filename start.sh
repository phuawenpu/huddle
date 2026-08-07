#!/bin/sh
echo "Initializing database..."
npx prisma db push --skip-generate 2>&1
echo "Starting server..."
exec node server.js
