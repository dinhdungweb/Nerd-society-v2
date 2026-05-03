
const MYTIME_USER = 'admin';
const MYTIME_PASS = '123';

async function testConnection(ip, port) {
  const baseUrl = `http://${ip}:${port}/api/hpa/Paradise`;
  const name = 'API_DeviceList';
  const params = [];
  const paramStr = JSON.stringify(params);
  const url = `${baseUrl}?user=${MYTIME_USER}&pass=${MYTIME_PASS}&name=${name}&param=${paramStr}`;

  console.log(`Checking ${ip}:${port}...`);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      console.log(`✅ Success on port ${port}!`);
      return true;
    } else {
      console.log(`❌ Port ${port} returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`❌ Port ${port} failed: ${err.message}`);
  }
  return false;
}

async function scan() {
  const ip = '14.248.150.254';
  const ports = [7900, 8081, 80, 4370, 8000, 8888];
  for (const port of ports) {
    await testConnection(ip, port);
  }
}

scan();
