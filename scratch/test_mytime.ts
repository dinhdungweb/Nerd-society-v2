
import { getDeviceList } from '../src/lib/mytime-api';

async function testConnection() {
  console.log('Testing MyTime API connection...');
  try {
    const devices = await getDeviceList();
    console.log('Get Device List Result:', JSON.stringify(devices, null, 2));
    
    if (devices.result === 'success') {
      console.log('Connected successfully!');
      const found = devices.data.find((d: any) => d.SerialNumber === '8116254601505');
      if (found) {
        console.log('Target machine found in API list:', found);
      } else {
        console.log('Target machine NOT found in API list. Please ensure it is activated in MyTime software.');
      }
    } else {
      console.error('API Error:', devices.reason);
    }
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();
