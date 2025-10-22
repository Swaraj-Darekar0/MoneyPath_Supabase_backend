const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('Supabase Client Init - URL:', supabaseUrl);
console.log('Supabase Client Init - Key:', supabaseKey ? 'Key Loaded (length: ' + supabaseKey.length + ')' : 'Key NOT Loaded');

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
