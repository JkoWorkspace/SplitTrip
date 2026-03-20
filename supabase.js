import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ⚠️ Reemplaza estos valores con los de tu proyecto en Supabase
const supabaseUrl = "https://omxrgmfgorbzlyhvrhwt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teHJnbWZnb3Jiemx5aHZyaHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTg3NzUsImV4cCI6MjA4OTUzNDc3NX0.FhuJDEeG_7Fq7jqCiO68rCrRPb1LY5YXUhX7U7ubROo";

export const supabase = createClient(supabaseUrl, supabaseKey);
