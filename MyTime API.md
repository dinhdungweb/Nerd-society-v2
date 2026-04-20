# MyTime API

# Muc luc

Cau truc chung. 2

Cau trunc URL cua MyTime API. 2   
Cach goi môt hAm API trong Phân mEm MyTime HRS 2   
Chi tiét)cachamAPI. 3   
Nhap h6 so nh7n vien moi 3   
Capnhat thong tin nhan vien 4   
Xoa hô sô nhân vien 4   
Capnhatrang thai nhanh vien. 5   
Danh sacha may cham cong 5   
Danh sacha nhan vien. 6   
Danh sacha nhan vien theo may cham cong. 8   
Chi tiét thong tin nhàn vièn trèn may chām cóng, có hinh. 9   
Lay du lieu cham cóng tho. 10   
Lay du lieu cham cóng tho có ché do xac nhàn va nhiét do 11

# Cáu truc chung

# Cău trunc URL că Mytime API

Dé goi tiên API)cua Phân mèm MyTime bàn can xác dinh tiênUrl và Authentication (dǎng nháp vào MyTime )

<table><tr><td>Url</td><td>Là khác chí may chu cua cóng ty ban noi có cai dãt services MyTime. Kèm theo
port cua phân mêm ví du: 8081 hoac 900 hoac bát ký port não lúc cai dãt
phân mêm ban cau hinh dé dãt cho phân MyTime trén may chu cua cóng ty
ban. Truong hay su dung port 8081 hoac 7900
Cău先进技术 du cua url là http://IP address:Port/api/hta/Paradise
api/hta/Paradise: Là controller cua MyTime bát buoc phài có</td></tr><tr><td>Authentication</td><td>Thnéng tin xác thuc bao gòm user va password dé dang nháp vào MyTime.
Thnéng hay su dung user là: admin va Password mác dinh lá: 123
Password cua user admin ban có théDEXItron phân mèm MyTime duçc cai
dãt ò máy cua nhân vien nhân su.</td></tr></table>

Cáché goi môt hân API trong Phân mêm MyTime

Cău truc DAY DU DE GOI MOT hAm API nhur sau

http://[IP address]:[Port]/api/hma/Paradise? Authentication& API_Name&Params

Ví du hàm api duóiiday tra vè dānh sách céc may thiet bi chám cóng.

http://192.168.2.28:8081/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ APIDeviceList&param $\equiv$

1

Chi tiét xem hinh duoji

![](images/44acf506b6054de27249320b0669f7cfccc6f9a908111e1a8cd54acd9700bfe8.jpg)

Luu y: Tham so nèu không truyen vào thi vǎn ghi Param= [], không duoc détrightng

# Chi tiêt céc hàm API

Nhāp hô sō nhân viên bói

Goi hàn sau dé nhap hò so nhân viên mói hoac cap nhát lái thong tin nhân viên

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ sp_ImportEmployeeInfor&param $\equiv$ []

Ví du muón nháp hò sō nhán vién míú vái cák thùng tin sau:

Mã NV 08213

Tên dãy du Nguyen Thái Minh

Bô phân Cóng nghe thòng tin

Chuc vu Nhân viên IT

Giacuteinh Nam

Ngay sinh 1992-02-17 (luu y dinh dang ngay luon la: yyyy-MM-dd. 1992-2-17 s thong hap le)

Ngay vao lam 2020-11-23

Mãchãm cóng 8213

Ta gài hàn sp_ImportEmployeeInfor vói céc params nhú sau:

/api/hpa/Paradise?user=admin&pass=123&name=sp_ImportEmployeeInfor&param=["EmployeeID", "00003","FullName", "Nguyen Thai Minh","DepartmentName", "Cộng跟他 thong tin", "PositionName", "Nhân viến IT","Sex", "male","Birthday", "1992-02-17","HireDate", "2020-11-23","Acc_ID", "8213","CardNo", "123456"]

Két qua tra vè

![](images/dd63227eca8f715ae641fe2061c9060dfc80106bc6aa726c471c8723e3a704dd.jpg)

Thong tin nhan vien

Dāng k'y vān tay

# Thong tin tren may cham cong

Ma cham cong

Tén chám cóng

Ma the

8213

Nguyen Thai Minh

Māt mā

Phàn qyuèn

$\left( {x - {2x}}\right) t - x{y}^{2} = \left( {x - {2x}}\right) {f}^{\prime }t$

Ngu'dung

# Capnhat thong tin nhuan vien

Vân su dung API sp_ImportEmployeeInfor dé capnhat thong tin nhân viên

Ví du dé capnhat nhán vien 08213 doi tén thanh法律顾问 Thanh Minh

Bàn gài hàm API nhu' sau:

/api/hpa/Paradise?user=admin&pass=123&name=sp_ImportEmployeeInfor&param=["EmployeeID", "08213","FullName", "Nguyen Thanh Minh","DepartmentName", "Cộng跟他 thong tin","PositionName", "Nhân vien IT","Sex", "male", "Birthday", "1992-02-17", "HireDate", "2020-11-23", "Acc_ID", "8213"]

Két qua tra vè

# Thong tin co ban

![](images/29747a03ea7527974d621ba8e81ab53aa9bcece72917b97527552779b5d36d5a.jpg)

Mānhān viēn

Tén nhan vien

Ngay vao lam

Chinanhanh

Chuc dahn\*

Trang thai (°)

08213

Nguyen Thanh Minh

24-07-2023

Vān phong chinh

Nhan vien IT

Lam vièc bīnh tuǒng

![](images/5e39d9d53e136640c72f3b9f02d2276b0436845a4d6ebd604373b2efa1adad6b.jpg)

Gidi tinh

Phong ban $(^{*})$

Loai nhan vien $(^{*})$

Ngaybatdau $(^{*})$

Nam

INhan vien mofi

Nghi CN

24-07-2023

Thong tin nhan vien

Dāng kj'vān tay

# Thong tin tren may cham cong

Māchām cóng

Tén chām cóng

Ma the

8213

Nguyen Thanh Minh

Māt mā

Phàn quyèn

Nguai dung

# Xóa hò sα nhān vièn

Goi hamsau de xoahosnhan vien

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API 删除EmployeeProfile&param $\equiv$ []

Ví du muón xóa hó so nhán vièn có mā 08213 ta lam nhu sau:

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API 删除EmployeeProfile&param $\equiv$ ["EmployeeID", "08213"]

Két qua:

![](images/2bb023144f16fd183c5a3aa0d9fd32dc8cc7560fe473979dfac41944817dc8b5.jpg)

![](images/1eb36d409579309cd3be2df2b48092ff0f3e0f675142adc048ce0ca23efc8f3c.jpg)

![](images/dad2471bb1bc7012098b87ecf4c849b300d2308b1259818bcf8b102f7e02011e.jpg)

Khong bao māt

192.168.1.250:7900/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API 删除EmployeeProfile&param $\equiv$ ["EmployeeID",%20].

//20230724164533

// http://192.168.1.250:7900/api/hpa/Paradise?user=admin&pass=123&name=API 删除EmployeeProfile&param=[%22EmployeeID%22,%20%2208213%22]

F

"result": "success",

"reason": ""

"data":

![](images/6878014d8ecb8ca654413d701dd7050bfc41b56a37f1d9fb829d08bb51739833.jpg)

# Capnhāt trang thai nhān vien

Goi hàn sau dé cap nhàt trang thai cua nhân vièn

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_UpdateEmployeeStatus&param $\equiv$ []

Ví du muón cap nhát trang thai駐風險 tù dang lām vièc sang trang thai dāghi vièc. Hièu lyc tù ngày 01-01-2021 ta goi hàn nu' sau:

/api/hpa/Paradise?user=admin&pass=123&name=API_UpdateEmployeeStatus&param=["EmployeeStatusID","20","EmployeeID", "08213","EffectiveDate", "2021-01-01"]

Két qua:

![](images/507b753513ebb1146ba7cc2bb89aadd2806acebbee2f854bf0d9ad8183973656.jpg)

Báng tham chieu cac trang thai nhân vièn

<table><tr><td>EmployeeStatusID</td><td>EmployeeStatus</td></tr><tr><td>0</td><td>Làm tiên binh/thú保險</td></tr><tr><td>1</td><td>Đang nghi thai sân</td></tr><tr><td>2</td><td>Nghi lùu chúc</td></tr><tr><td>3</td><td>Nghiǒm nhièu ngày</td></tr><tr><td>4</td><td>Sânghi</td></tr><tr><td>10</td><td>Huếng ché do mang thai</td></tr><tr><td>11</td><td>Huếng ché do con ngô</td></tr><tr><td>20</td><td>Đà网络传播ioc</td></tr></table>

# Danh sacha may cham cong

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_DeviceList&param $\equiv$ []

$\leftarrow \rightarrow \text{C}$ ▲Not secure | 192.168.11.51:6900/api/hpa/Paradise?user=adm&pass=123&name=API_DeviceList&param $\equiv$ []   
{"result":"success","reason":"","data":[   
{ "ID":0, "SerialNumber":"6171204200001", "MachineAlias": "Xuong 2", "IP": "192.168.11.100" }, { "ID":1, "SerialNumber": "CL9M203460078", "MachineAlias": "Xuong 1", "IP": "192.168.1.201" }, { "ID":2, "SerialNumber": "CKII202560067", "MachineAlias": "Bao vê", "IP": "192.168.11.114" } ] ]

```txt
\}JSON
result:"success"
reason:""
data
0
ID:0
SerialNumber:"6171204200001"
MachineAlias:"Xu'ng 2"
IP:"192.168.11.100"
ID:1
SerialNumber:"CL9M203460078"
MachineAlias:"Xu'ng 1"
IP:"192.168.1.201"
ID:2
SerialNumber:"CKII202560067"
MachineAlias:"Bao vê"
IP:"192.168.11.114" 
```

# Danh sacha nhan vien

Gói hàn API_EmployeeList dé liét kê dans sachuń viêntronghé thong MyTime

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_EmployeeList &param $\equiv$ []

Ví du muón láy dans Sach nhán vién dang có trèn phàn mèm thi goi ham nu' Sau:

```javascript
/api/hpa/Paradise?user=admin&pass=123&name=API_EmployeeList&param=["ViewTerminated","0"] 
```

ViewTerminated: là param loc xem tát ca nhân viên bao gôm nhân viên dã,nghí viêc hay chixem nhùng nhân viên dang lam viêc

ViewTerminated:0 => chixemnhung nhán vièn dang lam vièc

ViewTerminated:1 => xem tát cànhân vièn

Két qua tra vè:

![](images/604c3040fd3a0b1d0a0c6090791ef20ec1375fc3f69ca77632e247ef82b2398a.jpg)

![](images/f9ee223c157ac86704505606aa125a081a6bad1e622ec6ad55a00d8dee3b3fd9.jpg)

# Danh sách nhân viên theo may chám cóng

GóihamAPI_EmployeeListByDevices déliét ké dans sachań vien theo may chám cóng

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_EmployeeListByDevices &param $\equiv$ []

Ví du muón láy dans sách nhán vién dang có trèn may chám cóng áuǒng 2 thi goi ham nu' sau:

Két qua tra vè:   
```json
/api/hpa/Paradise?user=admin&pass=123&name=API_EmployeeListByDevices&param=["SerialNumber","6171 204200001"] 
```

$\leftarrow \rightarrow \text{C}$ A Not secure | 192.168.11.51:6900/api/hpa/Paradise?user=adm&pass=123&name=API_EmployeeListByDevices&param=["SerialNumber","6171204200001"]   
{"result":"success","reason":"","data":[   
{ "SSN": "00002", "_FULLName": "00002.", "DepartmentName": "Nhân sγ", "PositionName": "Cóng ], "EmployeeStatusID": 0, "MachineAlias": "6171204200001 Network", "SerialNumber": "6171204200001" }, { "SSN": "00003", "_FULLName": "00003", "DepartmentName": !Nhân viến ].,"PositionName": "Cóng ], "EmployeeStatusID": 0, "MachineAlias": "6171204200001 Network", "SerialNumber": "6171204200001" }, { "SSN": "036", "_FULLName": "Nguyén Thi Huế", "DepartmentName": "Phu", "PositionName": "Nhân Viến", "EmployeeStatusID": 0, "MachineAlias": "6171204200001 Network", "SerialNumber": "6171204200001" }, { "SSN": "037", "FullName": "Trān Vǎn Minh", "DepartmentName": "Ui", "PositionName": "Nhân Viến".

![](images/bc543f147492c2c1509cf68e08387cc61312ea4115039ee7e2bce1ccea0e54de.jpg)

# Chi tiét thóc tin nhân viên tiên may chám cóng, có hinh

Goi hàm API_EmployeeListByDevices dé liét ké dans sách nhân viên theo may chám cóng

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_GetEmployeeDetailListByDevices&param $\equiv$ []

Ví du muón lay thong tin nhàn vièn kèm hìn anh dang có trén may chám cóng á xuǒng 2 thi goi hàm nhu' sau:

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_GetEmployeeDetailListByDevices&param $\equiv$ ["SerialNumberer","6171204200001","EmployeeID","00001"]

Két qua tra vè:

←→ ▲ Not secure | 192.168.11.51:6900/api/hpa/Paradise?user=adm&pass=123&name=API_GetEmployeeDetailListByDevices&param=['SerialNumber","6171204200001","EmployeeID","00002"]   
```jsonl
{"result":"success","reason":""","data":[  
{  
"SSN": "00002",  
"FullName": "00002.",  
"DepartmentName": "Nhàn sú",  
"PositionName": "Cộng ],  
"EmployeeStatusID": 0,  
"EmployeeFacePic": 
```

```html
9/1/4AAQSKZ1RBAQABAQAIEA2BQAECAGIAGQADAGCAGUEBAUGBGUGGYBFgBGyVbK18cbUgVHcYGCAICOQAGCAGUAduKbVHcGOKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGcQCGKcGc 
```

[]JSON

```txt
result:"success"   
reason:"   
data   
[0   
SSN:"00002"   
FullName:"00002."   
DepartmentName:"Nhàn sù"   
PositionName:"Cộng-sharing"   
EmployeeStatusID:0   
EmployeeFacePic:"79/4AAQSkZJRgABAQQAAAQABAAD/2wBDAAIBAQBAQIBAQCAGICAgQDAgICAgUEBAMEBgUGBfYBgYGBwkIBgcJBwYGCSiCQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICg 
```

# Láy du lièu chém cóng thô

Goi ham API_ArtendanceList lay du lieuu cham cóng cua nhuan vien theo khoang thai bian duoc chon

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ API_ArtendanceList&param $\equiv$ []

Ví du muón laying du liieu chám cóng cua tát cánhàn vièn tu ngay 1 tháng 2 nám 2021 dén ngay 23 tháng 2 nám 2021 ta goi hàn nu' sau:

```javascript
/api/hpa/Paradise?user=admin&pass=123&name=API_ArtendanceList&param=["FromDate","2021-02-01","ToDate","2021-02-24","EmployeeID],[-1"] 
```

Ví du muón laying du lièu chám cóng cua nhân vièn 00004 tù ngày 1 tháng 2 nám 2021 dén ngày 23 tháng 2 nám 2021 ta goi hàn nuú sau:

```json
/api/hpa/Paradise?user=admin&pass=123&name=API_ArtendanceList&param=["FromDate","2021-02-01","ToDate","2021-02-24","EmployeeID","00004"] 
```

Ví du muón laying du lièu chám cóng theo may chám cóng tú ngay 1 tháng 12 nám 2024 dén ngay 30tháng 12 nám 2024 ta goi hàn nu'sau:

```javascript
/api/hpa/Paradise?user=admin&pass=123&name=API_ArteenthanceList&param=["FromDate","2024-12-01","ToDate","2024-12-30","SerialNumber","8116235100055"] 
```

Két quà tra vè:

```jsonl
{"result": "success", "reason": "", "data": [  
{  
    "AttDate": "2021-02-23T00:00:00",  
    "AttTime": "2021-02-23T10:04:29",  
    "EmployeeID": "00004",  
    "FullName": "Dāng Ngoc Hái",  
    "MachineAlias": "Xuóng 2",  
    "sn": "6171204200001"  
},  
{  
    "AttDate": "2021-02-23T00:00:00",  
    "AttTime": "2021-02-23T10:08:18",  
    "EmployeeID": "00004",  
    "FullName": "Dāng Ngoc Hái",  
    "MachineAlias": "Xuóng 1",  
    "sn": "CL9M203460078"  
},  
{  
    "AttDate": "2021-02-23T00:00:00",  
    "AttTime": "2021-02-23T10:10:39",  
    "EmployeeID": "00004",  
    "FullName": "Dāng Ngoc Hái",  
    "MachineAlias": "Xuóng 1",  
    "sn": "CL9M203460078"  
},  
{  
    "AttDate": "2021-02-23T00:00:00",  
    "AttTime": "Dāng Ngoc Hái",  
    "MachineAlias": "Xuóng 1",  
    "sn": "CL9M203460078"  
},  
{  
    "AttDate": "2021-02-23T00:00:00",  
    "AttTime": "Dāng Ngoc Hái",  
    "MachineAlias": "Xuóng 2",  
    "sn": "617120420001"  
},  
{  
    "AttDate": "2021-02-23T00:00:00",  
    "AttTime": "Dāng Ngoc Hái",  
    "MachineAlias": "Xuóng 2", 
```

[]JSON

result:"success"

reason:

[]data

[]0

```txt
0 AttDate:"2021-02-23T00:00:00" AttTime:"2021-02-23T10:04:29" EmployeeID:"00004" FullName:"Dang Ngoc HAI" MachineAlias:"Xuong 2" sn:"6171204200001" 
```

1

AttDate:"2021-02-23T00:00:00"   
AttTime:"2021-02-23T10:08:18"   
EmployeeID:"00004"   
FullName:"Dang Ngoc HAI"   
MachineAlias:Xuong1   
sn:"CL9M203460078"

2   
3   
4   
图5  
6   
国  
8   
9   
10   
11   
12   
13   
14   
15   
16   
17   
18   
19   
20   
21   
22

Láy du liéu chém cóng thô kèché do xac nhân và nhiét do

Gói hàn sp_RecentAttimeList lát du lieu chám cóng cúa khác viến theo khoản tooli gian duoc chon

/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ sp_RecentAttimeList&param $\equiv$ []

Ví du muón lay d'u liEU chám cóng cua nhân vièn 00001 tu ngay 1 tháng 7 nám 2027 dén ngay 30 tháng 7 nám 2023 ta goi hàn nu' sau:

Két qua tra vê:   
```javascript
/api/hpa/Paradise?user=admin&pass=123&name=sp_RecentAttimeList&param=["FromDate","2023-07-01","ToDate","2023-07-30","EmployeeID","00001"] 
```

// 20230724173710 // http://192.168.1.250:7900/api/hpa/Paradise?user $\equiv$ admin&pass $= 123$ &name $\equiv$ sp_RecentAtttimeList&param $\equiv$ ["FromDate","2023-07-01","T... G ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★★★★  
{ "result": "success", "reason": ", "data": [ ] { "sn": "8116231160040", "PhotoImage": null, "Attdate": "2023-07-24T00:00:00", "AttTime View": "2023-07-24T12:00:26", "maskflag": null, "EmployeeID": "00001", "FullName": "00001", "MachineAlias": "78L", "Machinelo": 1, "AttstateName": "Shared", "AttState": 0, "Atttime": "2023-07-24T12:00:26", "temperature": 0.0, "AttType": 15, "DepartmentName": "Nbh nvi n moi", "isReadOnlyRow": 0 } { "sn": "8116231160040", "PhotoImage": null, "Attdate": "2023-07-24T00:00:00", "AttTime View": "2023-07-24T12:00:27", "maskflag": null, "EmployeeID": "00001", "FullName": "00001", "MachineAlias": "78L", "Machinelo": 1, "AttstateName": "Shared", "AttState": 0, "Atttime": "2023-07-24T12:00:27", "temperature": 0.0, "AttType": 15,
