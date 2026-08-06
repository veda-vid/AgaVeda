ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL
  DEFAULT 'Hey, I am new in the market. with hi smiles';

ALTER TABLE public.profiles
  ALTER COLUMN bio SET DEFAULT 'Hey, I am new in the market. with hi smiles';

UPDATE public.profiles
SET bio = 'Hey, I am new in the market. with hi smiles'
WHERE bio = '';
