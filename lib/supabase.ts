import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzwuknfycyqitcbotsvx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3VrbmZ5Y3lxaXRjYm90c3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Nzc0MTcsImV4cCI6MjA4MzE1MzQxN30.TKXVVOCaiV-wX--V4GEPNg2yupF-ERSZFMfekve2yt8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
