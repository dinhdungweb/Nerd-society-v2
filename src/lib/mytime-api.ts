/**
 * MyTime API Client — Tích hợp ZKTeco W666+ qua phần mềm MyTime
 * Gọi qua internal network (HTTP GET, JSON response)
 */


const MYTIME_ENDPOINT = process.env.MYTIME_BASE_URL || process.env.MYTIME_URL_HTM || 'http://htm.vietjewelers.com:7900/api/hpa/Paradise';
const MYTIME_USER = 'admin';
const MYTIME_PASS = '123';

export interface MytimeResponse<T = unknown> {
  result: 'success' | 'error';
  reason?: string;
  data: T;
}

export interface AttendanceRecord {
  AttDate: string;
  AttTime: string;
  EmployeeID: string;
  FullName: string;
  MachineAlias: string;
  sn: string;
  Temperature?: number;
  AttType?: number;
  PhotoID?: string;
}

export interface DeviceInfo {
  ID: string;
  SerialNumber: string;
  MachineAlias: string;
  IP: string;
}

// Định dạng ngày chuẩn cho MyTime API: yyyy-MM-dd
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Mapping Serial Number → Branch
const DEVICE_BRANCH_MAP: Record<string, string> = {
  '8116250900027': 'HTM', // Máy 1: Hồ Tùng Mậu
  '8116254601505': 'TS',  // Máy 2: Tây Sơn
};

export async function callMytime<T>(name: string, params: (string | number)[]): Promise<MytimeResponse<T>> {
  const paramStr = JSON.stringify(params);
  const url = `${MYTIME_ENDPOINT}?user=${MYTIME_USER}&pass=${MYTIME_PASS}&name=${name}&param=${paramStr}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    let text = await res.text();
    // Fix lỗi JSON không hợp lệ từ MyTime server (trường hợp "data":} thiếu [])
    if (text.includes('"data":}')) {
      text = text.replace('"data":}', '"data":[]}');
    }

    try {
      const data = JSON.parse(text) as MytimeResponse<T>;
      if (data.result === 'error') console.error(`[MyTime API] ${name} error:`, data.reason);
      return data;
    } catch (parseErr) {
      console.error(`[MyTime API] JSON Parse Error for ${name}. Raw text:`, text);
      return { result: 'error', reason: `Invalid JSON response: ${text.slice(0, 50)}`, data: [] as unknown as T };
    }
  } catch (err) {
    console.error(`[MyTime API] ${name} failed:`, err);
    return { result: 'error', reason: 'Connection failed', data: [] as unknown as T };
  }
}

/**
 * 1. Nhập hồ sơ nhân viên mới (sp_ImportEmployeeInfor)
 * Tự động đồng bộ sang máy chấm công (Hỗ trợ đa chi nhánh)
 */
export async function importEmployee(params: {
  employeeId: string,
  fullName: string,
  planType: string,
  accId: string,
  cardNo?: string,
  gender?: 'male' | 'female',
  birthday?: Date | string,
  branch?: string // 'HTM' | 'TS'
}) {
  // Thứ tự các cột và khóa chuẩn từ tài liệu ví dụ
  const args = [
    'EmployeeID', params.employeeId,
    'FullName', params.fullName,
    'DepartmentName', params.branch || 'Nerd Society',
    'PositionName', 'HỘI VIÊN',
    'Sex', params.gender || 'male',
    'Birthday', typeof params.birthday === 'string' ? params.birthday : (params.birthday ? formatDate(params.birthday) : '1990-01-01'),
    'HireDate', formatDate(new Date()),
    'Acc_ID', params.accId,
    'CardNo', params.cardNo || '',
  ];

  return callMytime('sp_ImportEmployeeInfor', args);
}

export async function updateEmployeeStatus(employeeId: string, status: 'ACTIVE' | 'LOCKED' | 'RESIGNED' = 'ACTIVE') {
  const statusMap: Record<string, string> = {
    ACTIVE: '0',
    LOCKED: '20',
    RESIGNED: '20',
  };

  return callMytime('API_UpdateEmployeeStatus', [
    'EmployeeStatusID', statusMap[status] || '0',
    'EmployeeID', employeeId,
    'EffectiveDate', formatDate(new Date()),
  ]);
}

/**
 * 3. Lấy dữ liệu chấm công gần đây (sp_RecentAttimeList)
 * Trả về thông tin chi tiết hơn gồm cả nhiệt độ (nếu có)
 */
export async function getRecentAttendance(fromDate: string, toDate: string, employeeId: string = '-1') {
  return callMytime<AttendanceRecord[]>('sp_RecentAttimeList', [
    'FromDate', fromDate,
    'ToDate', toDate,
    'EmployeeID', employeeId,
  ]);
}

/**
 * 4. Lấy lịch sử chấm công chuẩn (API_AttendanceList)
 */
export async function getAttendanceList(fromDate: string, toDate: string, employeeId: string = '-1') {
  return callMytime<AttendanceRecord[]>('API_AttendanceList', [
    'FromDate', fromDate,
    'ToDate', toDate,
    'EmployeeID', employeeId,
  ]);
}

/**
 * 5. Danh sách các máy chấm công (API_DeviceList)
 */
export async function getDeviceList() {
  return callMytime<DeviceInfo[]>('API_DeviceList', []);
}

/**
 * 6. Lấy danh sách nhân viên theo máy (API_EmployeeListByDevices)
 */
export async function getEmployeesByDevice(serialNumber: string) {
  return callMytime<any[]>('API_EmployeeListByDevices', [
    'SerialNumber', serialNumber,
  ]);
}

/**
 * 7. Xóa hồ sơ nhân viên (API_DeleteEmployeeProfile)
 */
export async function deleteEmployee(employeeId: string) {
  return callMytime('API_DeleteEmployeeProfile', [
    'EmployeeID', employeeId,
  ]);
}

/**
 * Xác định branch từ Serial Number / MachineAlias
 */
export function getBranchFromDevice(snOrAlias: string): string {
  if (DEVICE_BRANCH_MAP[snOrAlias]) return DEVICE_BRANCH_MAP[snOrAlias];

  return 'HTM';
}

/**
 * Tạo EmployeeID tiếp theo (NS001, NS002...)
 */
export async function generateNextEmployeeId(prisma: any): Promise<string> {
  const count = await prisma.subscriber.count();
  return `NS${String(count + 1).padStart(3, '0')}`;
}
