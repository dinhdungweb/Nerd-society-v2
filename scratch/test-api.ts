import { getDeviceList } from '../src/lib/mytime-api';

async function testApi() {
  console.log('Testing MyTime API connection...');
  try {
    const devices = await getDeviceList();
    console.log('API Connection Successful!');
    console.log('Response:', JSON.stringify(devices, null, 2));
  } catch (error) {
    console.error('API Connection Failed!', error);
  }
}

testApi();
