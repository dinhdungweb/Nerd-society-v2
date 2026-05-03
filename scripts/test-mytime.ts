import 'dotenv/config';
import { getDeviceList } from '../src/lib/mytime-api';

async function testConnection() {
  console.log('--- BẮT ĐẦU KIỂM THỬ KẾT NỐI MYTIME ---');
  console.log('Đang gọi API lấy danh sách thiết bị...');
  
  try {
    const response = await getDeviceList();
    
    if (response.result === 'success') {
      console.log('✅ KẾT NỐI THÀNH CÔNG!');
      console.log('Danh sách thiết bị tìm thấy:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ KẾT NỐI THẤT BẠI!');
      console.log('Lý do:', response.reason);
      console.log('Chi tiết phản hồi:', JSON.stringify(response, null, 2));
    }
  } catch (err) {
    console.log('❌ LỖI HỆ THỐNG:', err);
  }
  
  console.log('--- KẾT THÚC ---');
}

testConnection();
