ALTER TABLE inquiry_cases ADD COLUMN stage TEXT NOT NULL DEFAULT 'concept' CHECK (stage IN ('concept', 'plan', 'implementation', 'trial'));
