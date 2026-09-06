const routes = [
  'http://localhost:3000',
  'http://localhost:3000/dashboard',
  'http://localhost:3000/invoices',
  'http://localhost:3000/invoices/new',
  'http://localhost:3000/ocr',
  'http://localhost:3000/customers',
  'http://localhost:3000/suppliers',
  'http://localhost:3000/payments',
  'http://localhost:3000/reports/gstr1',
  'http://localhost:3000/reports/ageing',
  'http://localhost:3000/settings/users',
  'http://localhost:3000/settings/audit-log'
];

async function testRoutes() {
  console.log('Testing GST Ledger HTTP Routes...\n');
  let passed = 0;
  for (const url of routes) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      console.log(`[PASS] ${res.status} ${res.statusText} -> ${url}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${url} -> ${err.message}`);
    }
  }
  console.log(`\nResults: ${passed}/${routes.length} routes responded cleanly.`);
}

testRoutes();
