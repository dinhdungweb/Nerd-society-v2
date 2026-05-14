
import { importEmployee } from '../src/lib/mytime-api';

async function testCreateSubscriber() {
  console.log('Testing Create Subscriber (Broadcast)...');
  
  const testData = {
    employeeId: 'TEST_TS_' + Date.now().toString().slice(-4),
    fullName: 'Test Hội Viên Tây Sơn',
    planType: '8h/ngày',
    accId: 'TS001',
    cardNo: '1234567890',
    branch: 'TS'
  };

  try {
    const result = await importEmployee(testData);
    console.log('Final Result (First Success or Primary Error):', JSON.stringify(result, null, 2));
    
    // Note: Since I refactored it to broadcast, the console logs in mytime-api.ts 
    // will show individual bridge successes/failures.
  } catch (error) {
    console.error('Test failed with exception:', error);
  }
}

testCreateSubscriber();
