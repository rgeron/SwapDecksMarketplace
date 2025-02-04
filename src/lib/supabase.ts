import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mrblpcwbxeeqcueoyusb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
