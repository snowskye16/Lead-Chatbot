import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ikkrzwcxzuczjiatfzow.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra3J6d2N4enVjemlqYXRmem93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkxMzE3MiwiZXhwIjoyMDg2NDg5MTcyfQ.eHndcYtRacMci_i3255GCxXLBKNMeXvktA9VNhWYwfI
"

export const supabase = createClient(supabaseUrl, supabaseKey)
