ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Allow users to update their own push_token via user-scoped client (RLS enforced)
CREATE POLICY "Users can update own push_token"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
