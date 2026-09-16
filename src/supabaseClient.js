import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nfeomcevgodyffidepnl.supabase.co'
const supabaseKey = 'sb_publishable_GMY7b0D2e2CpunTS471uxQ_mvSFT2cj'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Event ID untuk testing / fallback (AIM SPACE)
export const HARDCODED_EVENT_ID = 'f1723176-eaa7-4c1d-bfc9-2c112677bb38'
