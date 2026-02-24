-- Add nickname column to chat_rooms so managers can label web customers
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS nickname TEXT DEFAULT NULL;
