-- CreateTable
CREATE TABLE "log_entries" (
    "id" BIGSERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "userId" UUID,
    "ip" TEXT,
    "isError" BOOLEAN NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_entries_timestamp_idx" ON "log_entries"("timestamp");

-- CreateIndex
CREATE INDEX "log_entries_isError_idx" ON "log_entries"("isError");
