import { createClient } from '@supabase/supabase-js';

/* The publishable key is meant to ship to browsers; row-level security protects the data. */
export const sb = createClient(
  'https://ctlldbpdtohalfcwkjwq.supabase.co',
  'sb_publishable_j4g8-00VVfjHfK6q8QlIaw_QHzAfAzU'
);
