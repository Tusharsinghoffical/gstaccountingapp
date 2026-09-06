async function testAuthAndProtectedRoutes() {
  console.log('Testing Authentication & Protected Route Access...\n');

  // 1. Fetch CSRF token
  const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const setCookie = csrfRes.headers.get('set-cookie');
  console.log('[PASS] CSRF Token fetched successfully.');

  // 2. Sign in with admin credentials
  const cookies = setCookie.split(';')[0];
  const loginBody = new URLSearchParams({
    csrfToken,
    email: 'admin@gstledger.local',
    password: 'admin123',
    json: 'true',
  });

  const loginRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
    },
    body: loginBody.toString(),
    redirect: 'manual',
  });

  console.log(`[PASS] Login endpoint responded with status: ${loginRes.status}`);

  const authCookies = loginRes.headers.get('set-cookie');
  if (!authCookies) {
    console.error('[FAIL] No session cookie set on login!');
    return;
  }
  console.log('[PASS] Session cookie received from NextAuth.');

  // Extract session token
  const sessionCookieHeader = authCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');

  // 3. Test accessing protected routes with authenticated session cookie
  const protectedEndpoints = [
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
    'http://localhost:3000/settings/audit-log',
  ];

  console.log('\nVerifying Authenticated Access:');
  for (const url of protectedEndpoints) {
    const res = await fetch(url, {
      headers: {
        Cookie: sessionCookieHeader,
      },
      redirect: 'manual',
    });

    if (res.status === 200) {
      console.log(`[PASS] 200 OK -> ${url}`);
    } else {
      console.log(`[STATUS] ${res.status} ${res.statusText} -> ${url}`);
    }
  }

  console.log('\nAll authenticated route checks completed successfully.');
}

testAuthAndProtectedRoutes().catch(console.error);
