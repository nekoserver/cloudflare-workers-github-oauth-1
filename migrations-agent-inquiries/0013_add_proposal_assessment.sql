ALTER TABLE inquiry_proposals ADD COLUMN benefits TEXT;
ALTER TABLE inquiry_proposals ADD COLUMN side_effects TEXT;
ALTER TABLE inquiry_proposals ADD COLUMN breaking_change TEXT CHECK (breaking_change IN ('none', 'possible', 'yes'));
ALTER TABLE inquiry_proposals ADD COLUMN reversible TEXT CHECK (reversible IN ('yes', 'partial', 'no'));
