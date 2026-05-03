Nerd Network Infrastructure — Endpoint Registry
Owner: Mai Phạm Last updated: 26 April 2026 Status: Active


Mục đích document này
Đây là registry chính thức của các network endpoint dùng chung cho mọi project tại Nerd Society. Bất kỳ ứng dụng nào cần truy cập thiết bị tại chi nhánh HTM hoặc TS từ internet (camera, máy chấm công, NAS, server, IoT...) đều phải dùng các endpoint trong document này thay vì hardcode IP.
Quy tắc:
Application code chỉ dùng endpoint ở Layer 2 (Cloudflare) — không bao giờ hardcode IP, không gọi trực tiếp Layer 1.
Khi cần thêm thiết bị mới ra internet → thêm port forwarding rule trên Ruijie và cập nhật bảng registry trong document này.
Document này là single source of truth. Nếu code và document mâu thuẫn, document đúng.


Architecture overview
Hạ tầng được tổ chức thành 3 layer, mỗi layer có một trách nhiệm riêng:

┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Application endpoints (port-based per device)     │
│  e.g.  ts.vietjewelers.com:18241   → Camera 1 TS            │
│        htm.vietjewelers.com:18245  → Camera 5 HTM           │
│        htm.vietjewelers.com:4370   → Máy chấm công HTM      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ uses
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Cloudflare CNAME (network alias per branch)       │
│  htm.vietjewelers.com  →  nerdhtm.ruijieddns.com            │
│  ts.vietjewelers.com   →  nerdts.ruijieddns.com             │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ resolves to
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Ruijie DDNS (auto-update khi public IP đổi)       │
│  nerdhtm.ruijieddns.com  →  Public IP HTM (động)            │
│  nerdts.ruijieddns.com   →  Public IP TS (động)             │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                  ISP cấp IP động cho router


Tại sao tách 3 layer?
Layer 1 xử lý vấn đề IP động — Ruijie router tự detect khi WAN IP đổi và push lên DNS của Ruijie Cloud trong vài giây. Không cần script chạy trên máy shop.
Layer 2 tách hạ tầng (Ruijie) khỏi business naming. Sau này nếu đổi router/provider, chỉ cần update CNAME ở đây — toàn bộ application không cần đụng code.
Layer 3 dùng port để phân biệt thiết bị trong cùng một mạng (vì tất cả thiết bị tại 1 chi nhánh chia sẻ 1 IP công cộng).


Naming & port conventions
Áp dụng cho mọi chi nhánh để dev không phải nhớ riêng từng nơi.
Tên camera: Camera N (BRANCH) — N là số thứ tự theo IP nội bộ tăng dần (240 → 1, 241 → 2, ...)
External port mapping: Camera N → port 1824N (Camera 1 = 18241, Camera 5 = 18245, ...)
Subnet: TS dùng 192.168.1.x, HTM dùng 192.168.2.x — dễ phân biệt khi debug
NVR: Mỗi chi nhánh có 1 NVR cuối subnet (.250), giữ vai trò recording/storage; KHÔNG bắt buộc dùng cho live snapshot vì truy cập trực tiếp camera đơn giản và resilient hơn


Network aliases (Layer 2 — DÙNG TRONG APPLICATION)

Alias
Branch
Trỏ về
Status
htm.vietjewelers.com
Hồ Tùng Mậu (HTM)
nerdhtm.ruijieddns.com
✅ Active
ts.vietjewelers.com
Tây Sơn (TS)
nerdts.ruijieddns.com
✅ Active


→ Đây là endpoint mà mọi application phải dùng. Không hardcode IP, không gọi *.ruijieddns.com trực tiếp.


Underlying DDNS (Layer 1 — INTERNAL, không dùng trong app)

DDNS hostname
Branch
Provider
Router serial
nerdhtm.ruijieddns.com
HTM
Ruijie Cloud
H1U42KQ002820
nerdts.ruijieddns.com
TS
Ruijie Cloud
H1T04Y4017306


Cấu hình DDNS trên Ruijie Cloud:
Map to: Public IP (không phải WAN IP)
WAN Interface: Auto
IPv4
Update: tự động khi router detect IP change
→ Section này chỉ phục vụ debugging và migration. Application không gọi trực tiếp.


Device inventory
TS (Tây Sơn) — Subnet 192.168.1.x — 3 cameras + 1 NVR

Tên gọi
Model
Internal IP
MAC
Vai trò / Note
Camera 1 (TS)
DS-2CD1321G0-I
192.168.1.240
54:8C:81:55:3F:4D
"main_seating" trong chatbot v1 — Khu vực ngồi chung
Camera 2 (TS)
DS-2CD1321G0-I
192.168.1.241
5C:34:5B:CD:3F:4A
Vị trí: TBD
Camera 3 (TS)
DS-2CD1323G2-L
192.168.1.242
04:03:12:70:23:0F
Model G2-L (wide-angle?). Vị trí: TBD
NVR (TS)
DS-7104NI-Q1/M
192.168.1.250
DC:07:F8:85:27:44
4-channel NVR


Serial numbers: Camera 1: 20241202AAWRFT543, Camera 3: IUF20240324AAWRFB
HTM (Hồ Tùng Mậu) — Subnet 192.168.2.x — 7 cameras + 1 NVR

Tên gọi
Model
Internal IP
MAC
Vai trò / Note
Camera 1 (HTM)
DS-2CD1321G2-L
192.168.2.240
50:E5:38:72:0F:19
Model G2-L — wide-angle, mới hơn. Vị trí: TBD
Camera 2 (HTM)
DS-2CD1321G0-I
192.168.2.241
50:E5:38:72:35:26
Standard dome. Vị trí: TBD
Camera 3 (HTM)
DS-2CD1321G0-I
192.168.2.242
50:E5:38:72:34:8F
Standard dome. Vị trí: TBD
Camera 4 (HTM)
DS-2CD1321G0-I
192.168.2.243
50:E5:38:72:36:C2
Standard dome. Vị trí: TBD
Camera 5 (HTM)
DS-2CD1021G0-I
192.168.2.244
50:E5:38:6E:C8:08
Model 1021 (khác dòng 1321). Vị trí: TBD
Camera 6 (HTM)
DS-2CD1021G0-I
192.168.2.245
50:E5:38:6E:CA:04
Model 1021. Vị trí: TBD
Camera 7 (HTM)
DS-2CD1321G0-I
192.168.2.246
50:E5:38:B6:48:75
Standard dome. Vị trí: TBD
NVR (HTM)
DS-7108NI-Q1/M
192.168.2.250
08:CC:81:0B:38:20
8-channel NVR — phù hợp với 7 camera


Lưu ý project knowledge: Chatbot v1 (Feb 2026) chỉ map 3 camera HTM (main_seating ch501, personal_desk ch502, hallway ch241). Hiện tại HTM đã có 7 camera — bot v1 đã outdated, cần re-map vai trò khi rebuild.


Port forwarding registry
Khi cần expose một thiết bị nội bộ ra internet, thêm rule trên Ruijie Cloud → Device Config → NAT và cập nhật bảng dưới đây.
TS (ts.vietjewelers.com)

External port
Internal device
Internal IP:port
Owner project
Status
18241
Camera 1 (TS)
192.168.1.240:80
nerd-vision
⏳ Cần setup
18242
Camera 2 (TS)
192.168.1.241:80
nerd-vision
⏳ Cần setup
18243
Camera 3 (TS)
192.168.1.242:80
nerd-vision
⏳ Cần setup


HTM (htm.vietjewelers.com)

External port
Internal device
Internal IP:port
Owner project
Status
18241
Camera 1 (HTM)
192.168.2.240:80
nerd-vision
⏳ Verify rule cũ
18242
Camera 2 (HTM)
192.168.2.241:80
nerd-vision
⏳ Verify rule cũ
18243
Camera 3 (HTM)
192.168.2.242:80
nerd-vision
⏳ Verify rule cũ
18244
Camera 4 (HTM)
192.168.2.243:80
nerd-vision
⏳ Cần setup mới
18245
Camera 5 (HTM)
192.168.2.244:80
nerd-vision
⏳ Cần setup mới
18246
Camera 6 (HTM)
192.168.2.245:80
nerd-vision
⏳ Cần setup mới
18247
Camera 7 (HTM)
192.168.2.246:80
nerd-vision
⏳ Cần setup mới
TBD
Máy chấm công
TBD
nerd-attendance
⏳ Đang setup, dev chốt port


Naming consistency: "Camera 1, 2, 3..." giữ nguyên giữa HTM và TS để code bot không cần phân biệt theo chi nhánh — bot dùng URL pattern {branch}.vietjewelers.com:1824{n}.
Port choice rationale: External port có thể trùng nhau giữa 2 router (port forwarding là per-router scope). Dùng cùng số port cho cả 2 chi nhánh giúp config app gọn hơn — chỉ cần thay hostname để chuyển chi nhánh.


Hướng dẫn cho dev
Khi build app mới cần truy cập thiết bị tại chi nhánh
Cách đúng:

# config.yaml
htm_camera_5:
  host: htm.vietjewelers.com
  port: 18245
  isapi_path: /ISAPI/Streaming/channels/101/picture
  auth: digest

attendance_device:
  host: htm.vietjewelers.com
  port: 4370   # confirm với dev


Cách SAI (đừng làm):

# ❌ Đừng hardcode IP — sẽ chết khi IP đổi
camera_1:
  host: 14.162.181.197
  port: 18241

# ❌ Đừng gọi trực tiếp Ruijie hostname — bypass abstraction layer
camera_1:
  host: nerdhtm.ruijieddns.com
  port: 18241


Khi cần expose thiết bị mới ra internet
Gắn thiết bị vào mạng nội bộ chi nhánh, ghi lại Internal IP (xem trên Ruijie → Clients) và Internal port mà thiết bị listen.
Chọn 1 External port chưa được dùng (xem registry ở trên). Theo convention 1824N cho camera thứ N.
Vào Ruijie Cloud → Device Config → chọn router của chi nhánh → NAT → thêm rule port forwarding.
Cập nhật bảng "Port forwarding registry" trong document này.
Test từ ngoài: curl http://<branch>.vietjewelers.com:<port>/...
Báo cho project owner endpoint mới.
Khi IP của thiết bị nội bộ đổi (vì đổi DHCP, thay router...)
→ Chỉ cần vào Ruijie Cloud, sửa Internal IP trong rule port forwarding đó. Cập nhật registry. Application không cần đổi gì cả.
→ Best practice: Bind static DHCP cho các camera/NVR trên Ruijie để IP nội bộ không đổi.


Hikvision ISAPI reference
Truy cập snapshot từ camera Hikvision (cần Digest Auth):

# Test trực tiếp camera (Cách A - khuyến nghị)
curl --digest -u "admin:PASSWORD" \
  "http://htm.vietjewelers.com:18245/ISAPI/Streaming/channels/101/picture" \
  --output snapshot.jpg

# Test qua NVR (Cách B - chỉ dùng nếu đặc biệt cần)
curl --digest -u "admin:PASSWORD" \
  "http://htm.vietjewelers.com:18250/ISAPI/Streaming/channels/501/picture" \
  --output snapshot.jpg


Channel numbering:
Truy cập trực tiếp camera (mỗi camera là 1 thiết bị độc lập): 101 = main stream, 102 = sub stream
Truy cập qua NVR (1 thiết bị quản lý nhiều camera): N01 = camera N main stream, N02 = camera N sub stream (vd 501 = cam 5 main)
→ Recommend dùng 102 (hoặc N02 qua NVR) cho Vision AI để tiết kiệm bandwidth, vẫn đủ để Claude analyze.


Troubleshooting
App không kết nối được tới ts.vietjewelers.com hoặc htm.vietjewelers.com?
Theo thứ tự kiểm tra:
Test DNS resolve: ping ts.vietjewelers.com từ máy có internet
Nếu không resolve → vấn đề ở Cloudflare CNAME (Layer 2)
Nếu resolve ra IP của Cloudflare (104.x.x.x / 172.x.x.x) → CNAME đang ở Proxied mode, đổi sang DNS only
Test ping IP: ping <IP-vừa-resolve>
Nếu không ping được → có thể IP đã đổi và DDNS chưa kịp update, đợi 1–2 phút và thử lại
Nếu vẫn không được → router chi nhánh có thể đang offline, hoặc ISP đổi sang CGNAT (cần report)
Test port forwarding: curl http://ts.vietjewelers.com:<port>/
Nếu connection refused → rule port forwarding chưa setup hoặc internal IP sai
Nếu timeout → firewall trên router hoặc thiết bị nội bộ chặn
Test camera auth: curl --digest -u admin:PASS http://...:18241/ISAPI/...
Nếu 401 Unauthorized → password sai
Nếu 200 OK → endpoint hoạt động, vấn đề ở app
Layer 1 fail (Ruijie hostname không resolve)?
Hiếm khi xảy ra. Nếu xảy ra:
Vào Ruijie Cloud → Device Config → Dynamic DNS → check status, IP có khớp public IP thật không
Disable rồi enable lại DDNS để force re-register
Worst case: chuyển tạm sang No-IP hoặc DynDNS (router hỗ trợ sẵn)


Disaster recovery scenarios
Scenario 1: Ruijie Cloud DDNS service ngừng hoạt động
Setup DDNS thay thế trên router (No-IP đã có sẵn trong Ruijie)
Đổi target của CNAME ở Layer 2 sang hostname mới
Application không cần update
Scenario 2: Mai mua được IP tĩnh từ ISP
Đổi CNAME ở Layer 2 thành A record trỏ về IP tĩnh
Có thể giữ nguyên Layer 1 làm backup hoặc xóa
Application không cần update
Scenario 3: Đổi domain (vd vietjewelers.com hết hạn / chuyển ngành)
Tạo subdomain tương đương ở domain mới (vd: htm.newdomain.com)
Update config của tất cả application
Document phải được sửa và thông báo cho mọi project owner


Changelog

Date
Change
By
26 Apr 2026
Initial setup. Layer 1 + Layer 2 cho HTM và TS. Inventory đầy đủ cho cả 2 chi nhánh: TS 3 cam + 1 NVR (192.168.1.x), HTM 7 cam + 1 NVR (192.168.2.x).
Mai




Phụ lục: Liên hệ
Cloudflare account chứa vietjewelers.com: Haihaibeo0103@gmail.com
Ruijie Cloud account: (cần điền)
Mắt Bão registrar (vietjewelers.com): (cần điền)


Document này là sản phẩm của infrastructure layer "nerd-network". Bất kỳ thay đổi nào ảnh hưởng đến endpoint phải được phản ánh ở đây.

