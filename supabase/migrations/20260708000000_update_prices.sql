-- Update pricing to normalized Rs values
UPDATE public.services SET price = 60.00 WHERE name = 'Classic Haircut';
UPDATE public.services SET price = 80.00 WHERE name = 'Fade & Taper';
UPDATE public.services SET price = 100.00 WHERE name = 'Executive Cut';
UPDATE public.services SET price = 50.00 WHERE name = 'Kids Haircut';

UPDATE public.services SET price = 40.00 WHERE name = 'Beard Trim & Shape';
UPDATE public.services SET price = 50.00 WHERE name = 'Hot Towel Shave';
UPDATE public.services SET price = 70.00 WHERE name = 'Full Beard Grooming';

UPDATE public.services SET price = 150.00 WHERE name = 'Full Color';
UPDATE public.services SET price = 200.00 WHERE name = 'Highlights / Lowlights';

UPDATE public.services SET price = 120.00 WHERE name = 'Deep Cleanse Facial';

UPDATE public.services SET price = 100.00 WHERE name = 'The Gentleman (Cut+Shave)';
UPDATE public.services SET price = 250.00 WHERE name = 'The King (Cut+Beard+Facial)';
