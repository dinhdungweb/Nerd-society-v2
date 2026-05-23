import 'dotenv/config';
import { getDeviceList, getEmployeesByDevice } from '../src/lib/mytime-api';

async function testEmployees() {
  console.log('--- BẮT ĐẦU TRUY VẤN NHÂN VIÊN TRÊN MÁY CHẤM CÔNG ---');
  try {
    const devicesRes = await getDeviceList();
    if (devicesRes.result !== 'success') {
      console.error('Không lấy được danh sách thiết bị:', devicesRes.reason);
      return;
    }

    console.log(`Tìm thấy ${devicesRes.data.length} thiết bị.`);
    for (const device of devicesRes.data) {
      console.log(`\nTruy vấn máy: ${device.MachineAlias} (SN: ${device.SerialNumber})...`);
      const empRes = await getEmployeesByDevice(device.SerialNumber);
      if (empRes.result === 'success') {
        console.log(`✅ Thành công! Tìm thấy ${empRes.data.length} nhân viên.`);
        if (empRes.data.length > 0) {
          console.log('Ví dụ 3 nhân viên đầu tiên:', JSON.stringify(empRes.data.slice(0, 3), null, 2));
        }
      } else {
        console.error(`❌ Thất bại:`, empRes.reason);
      }
    }
  } catch (err) {
    console.error('Lỗi:', err);
  }
  console.log('\n--- KẾT THÚC ---');
}

testEmployees();
