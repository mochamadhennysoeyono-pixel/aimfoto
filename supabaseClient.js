import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nfeomcevgodyffidepnl.supabase.co'
const supabaseKey = 'sb_publishable_GMY7b0D2e2CpunTS471uxQ_mvSFT2cj'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Event ID untuk testing sementara
export const HARDCODED_EVENT_ID = '38417c52-810b-4a2d-8f7f-b232e1331004'
