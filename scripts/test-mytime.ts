import 'dotenv/config';
import { getDeviceList } from '../src/lib/mytime-api.ts';

async function testConnection() {
  console.log('--- BẮT ĐẦU KIỂM THỬ KẾT NỐI MYTIME ---');
  console.log('Đang gọi API lấy danh sách thiết bị...');
  
  const response = await getDeviceList();
  
  if (response.result === 'success') {
    console.log('✅ KẾT NỐI THÀNH CÔNG!');
    console.log('Danh sách thiết bị tìm thấy:', response.data);
  } else {
    console.log('❌ KẾT NỐI THẤT BẠI!');
    console.log('Lý do:', response.reason);
    console.log('Chi tiết phản hồi:', response);
  }
  console.log('--- KẾT THÚC ---');
}

testConnection();
