import 'dotenv/config';
import { getAttendanceList } from '../src/lib/mytime-api';
import { format } from 'date-fns';

async function testAttendance() {
  const today = format(new Date(), 'yyyy-MM-dd');
  console.log('Testing attendance for date:', today);
  
  const response = await getAttendanceList(today, today);
  console.log('Raw Response:', JSON.stringify(response, null, 2));
}

testAttendance();
