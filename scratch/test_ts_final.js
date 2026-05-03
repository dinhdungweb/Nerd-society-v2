
const MYTIME_USER = 'admin';
const MYTIME_PASS = '123';

async function testConnection(branch, baseUrl) {
  const name = 'API_DeviceList';
  const params = [];
  const paramStr = JSON.stringify(params);
  const url = `${baseUrl}?user=${MYTIME_USER}&pass=${MYTIME_PASS}&name=${name}&param=${paramStr}`;

  console.log(`Checking connection to MyTime API for ${branch} at: ${baseUrl}...`);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`❌ [${branch}] HTTP Error: ${res.status} ${res.statusText}`);
      return;
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text.includes('"data":}') ? text.replace('"data":}', '"data":[]}') : text);
    } catch (e) {
      console.error(`❌ [${branch}] Failed to parse JSON. Raw response: ${text}`);
      return;
    }

    if (data.result === 'success') {
      console.log(`✅ [${branch}] Connection Successful!`);
      const devices = data.data[0] || [];
      console.table(devices.map(dev => ({
        ID: dev.ID,
        Alias: dev.MachineAlias,
        SN: dev.SerialNumber,
        IP: dev.IP
      })));
    } else {
      console.error(`❌ [${branch}] MyTime API returned an error: ${data.reason}`);
    }
  } catch (err) {
    console.error(`❌ [${branch}] Connection failed: ${err.message}`);
  }
}

testConnection('TS', 'http://ts.vietjewelers.com:7900/api/hpa/Paradise');
