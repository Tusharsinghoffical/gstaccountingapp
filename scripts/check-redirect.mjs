const url = 'http://localhost:3000/dashboard';

async function checkRedirect() {
  const res = await fetch(url, { redirect: 'manual' });
  console.log(`Status: ${res.status}`);
  console.log(`Location: ${res.headers.get('location')}`);
}

checkRedirect();
