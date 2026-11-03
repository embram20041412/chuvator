const fs = require('fs');

function inspectSQL(filename) {
  if (!fs.existsSync(filename)) return;
  console.log(`\n=== INSPECTING ${filename} ===`);
  const content = fs.readFileSync(filename, 'utf8');

  // Check ENABLE ROW LEVEL SECURITY
  const rlsMatches = [...content.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)];
  const rlsTables = rlsMatches.map(m => m[1]);
  console.log('Tables with ENABLE ROW LEVEL SECURITY:', rlsTables);

  // Check CREATE POLICY
  const policyMatches = [...content.matchAll(/CREATE\s+POLICY\s+["']?([^"'\s]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s+(?:FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s+)?(?:TO\s+([a-zA-Z0-9_,\s]+)\s+)?(?:USING\s*\((.*?)\)\s*)?(?:WITH\s+CHECK\s*\((.*?)\)\s*)?;/gis)];
  
  console.log(`Found ${policyMatches.length} CREATE POLICY statements.`);
  policyMatches.forEach((m, idx) => {
    console.log(`Policy #${idx+1}: [${m[1]}] on table [${m[2]}] FOR [${m[3] || 'ALL'}] TO [${m[4] || 'public'}]`);
  });
}

inspectSQL('supabase_migration.sql');
inspectSQL('supabase_migration_phase1_security_hardening.sql');
