
const MYTIME_BASE_URL = 'http://htm.vietjewelers.com:7900/api/hpa/Paradise';
const MYTIME_USER = 'admin';
const MYTIME_PASS = '123';

async function testConnection() {
  const name = 'API_DeviceList';
  const params = [];
  const paramStr = JSON.stringify(params);
  const url = `${MYTIME_BASE_URL}?user=${MYTIME_USER}&pass=${MYTIME_PASS}&name=${name}&param=${paramStr}`;

  console.log(`Checking connection to MyTime API at: ${MYTIME_BASE_URL}...`);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`❌ HTTP Error: ${res.status} ${res.statusText}`);
      return;
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text.includes('"data":}') ? text.replace('"data":}', '"data":[]}') : text);
    } catch (e) {
      console.error(`❌ Failed to parse JSON. Raw response: ${text}`);
      return;
    }

    if (data.result === 'success') {
      console.log(`✅ Connection Successful via Domain!`);
      const devices = data.data[0] || [];
      console.log(`Total devices found: ${devices.length}`);
      console.table(devices.map(dev => ({
        ID: dev.ID,
        Alias: dev.MachineAlias,
        SN: dev.SerialNumber,
        IP: dev.IP
      })));
    } else {
      console.error(`❌ MyTime API returned an error: ${data.reason}`);
    }
  } catch (err) {
    console.error(`❌ Connection failed: ${err.message}`);
  }
}

testConnection();
