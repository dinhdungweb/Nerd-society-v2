import { broadcastMytime, formatDate } from '@/lib/mytime-api';
import { NextResponse } from 'next/server';

export async function GET() {
  const employeeId = 'T' + Math.floor(Math.random() * 10000);
  const fullName = 'Test API MultiHub ' + new Date().toLocaleTimeString();
  
  const args = [
    'EmployeeID', employeeId,
    'FullName', fullName,
    'DepartmentName', 'TS',
    'PositionName', 'HỘI VIÊN',
    'Sex', 'male',
    'Birthday', '1990-01-01',
    'HireDate', new Date().toISOString().split('T')[0],
    'Acc_ID', 'DEBUG',
    'CardNo', '999999',
  ];

  try {
    console.log('[Debug] Starting test creation broadcast...');
    const results = await broadcastMytime('sp_ImportEmployeeInfor', args);
    
    return NextResponse.json({
      message: 'Test broadcast finished.',
      employeeId,
      fullName,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
